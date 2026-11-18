'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { getThemeStyles, type SalonTheme } from '@/lib/themes'

function withAlpha(hex: string, a: number): string {
  if (!hex) return `rgba(0,0,0,${a})`
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function MesReservationsPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.salonSlug as string
  const supabase = createClient()

  const [isIdentified, setIsIdentified] = useState(false)
  const [clientPhone, setClientPhone] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [appointments, setAppointments] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [salon, setSalon] = useState<any>(null)
  const [colors, setColors] = useState<any>(null)

  const [editingAppointment, setEditingAppointment] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const DEFAULT_C = { bg: '#09090b', bgCard: '#18181b', text: '#fafafa', textMuted: '#a1a1aa', accent: '#fbbf24', border: '#27272a', button: '#f59e0b', buttonText: '#000000' }
  const c = colors || DEFAULT_C

  useEffect(() => {
    if (slug) loadSalon()
  }, [slug])

  useEffect(() => {
    const dates = []
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }
    setAvailableDates(dates)
  }, [])

  const loadSalon = async () => {
    const { data: salonData, error } = await supabase
      .from('salons')
      .select('*')
      .eq('slug', slug)
      .single()

    if (salonData && !error) {
      setSalon(salonData)
      setColors(getThemeStyles((salonData.theme as SalonTheme) || 'luxe'))
      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .eq('salon_id', salonData.id)
        .order('name')
      setServices(servicesData || [])
    }
  }

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientPhone.trim()) {
      setError('Veuillez entrer votre numero de telephone.')
      return
    }

    setLoading(true)
    setError('')
    const normalizedPhone = clientPhone.trim().replace(/\s+/g, '').replace(/^\+/, '')

    try {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, full_name')
        .eq('phone', normalizedPhone)
        .single()

      if (clientError || !client) {
        setError('Aucun compte trouve avec ce numero. Veuillez reserver d\'abord.')
        setLoading(false)
        return
      }

      setClientId(client.id)
      setClientName(client.full_name)
      setIsIdentified(true)
      await loadAppointments(client.id)

    } catch (err: any) {
      console.error('Erreur identification:', err)
      setError('Erreur lors de l\'identification.')
    } finally {
      setLoading(false)
    }
  }

  const loadAppointments = async (clientId: string) => {
    const { data, error } = await supabase
      .from('appointments')
      .select(`*, services (name, price_display, duration_minutes)`)
      .eq('client_id', clientId)
      .eq('salon_id', salon?.id)
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Erreur chargement RDV:', error)
      setError('Erreur lors du chargement des reservations.')
    } else {
      const now = new Date().toISOString()
      const upcoming = data?.filter(apt => apt.start_time >= now && apt.status !== 'cancelled') || []
      setAppointments(upcoming)
    }
  }

  const handleCancel = async (appointmentId: string) => {
    if (!confirm('Etes-vous sur de vouloir annuler cette reservation ?')) return
    try {
      const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appointmentId)
      if (error) throw new Error('Erreur lors de l\'annulation')
      if (clientId) await loadAppointments(clientId)
    } catch (err: any) {
      console.error('Erreur annulation:', err)
      setError(err.message || 'Erreur lors de l\'annulation.')
    }
  }

  const handleEditClick = (appointment: any) => {
    setEditingAppointment(appointment)
    setSelectedDate(appointment.start_time.split('T')[0])
    setSelectedTime(appointment.start_time.split('T')[1].substring(0, 5))
  }

  const handleDateSelect = (date: string) => {
    setSelectedDate(date)
    setSelectedTime('')
  }

  const handleSaveEdit = async () => {
    if (!selectedDate || !selectedTime || !editingAppointment) {
      setError('Veuillez selectionner une date et une heure.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const startDateTime = `${selectedDate}T${selectedTime}:00`
      const service = services.find(s => s.id === editingAppointment.service_id)
      const endDateTime = new Date(new Date(startDateTime).getTime() + (service?.duration_minutes || 30) * 60000).toISOString()

      const { error } = await supabase
        .from('appointments')
        .update({ start_time: startDateTime, end_time: endDateTime })
        .eq('id', editingAppointment.id)

      if (error) throw new Error('Erreur lors de la modification')
      setEditingAppointment(null)
      setSelectedDate('')
      setSelectedTime('')
      if (clientId) await loadAppointments(clientId)
    } catch (err: any) {
      console.error('Erreur modification:', err)
      setError(err.message || 'Erreur lors de la modification.')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const formatTime = (dateTimeStr: string) => dateTimeStr.split('T')[1].substring(0, 5)
  const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30']

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '12px', color: c.text, fontSize: '16px', outline: 'none' }
  const btnStyle: React.CSSProperties = { borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }

  // --- ÉCRAN IDENTIFICATION ---
  if (!isIdentified) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ maxWidth: '450px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Mes reservations</h1>
            <p style={{ color: c.textMuted }}>Entrez votre numero pour voir vos RDV</p>
          </div>
          <form onSubmit={handleIdentify} style={{ background: c.bgCard, padding: '32px', borderRadius: '16px', border: `1px solid ${c.border}` }}>
            {error && (
              <div style={{ marginBottom: '16px', background: withAlpha('#dc2626', 0.15), border: `1px solid ${withAlpha('#dc2626', 0.4)}`, color: '#dc2626', padding: '12px', borderRadius: '12px', fontSize: '14px' }}>
                {error}
              </div>
            )}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Numero de telephone</label>
              <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} style={inputStyle} placeholder="06 12 34 56 78" autoFocus />
            </div>
            <button type="submit" disabled={loading || !clientPhone} style={{ width: '100%', padding: '16px', background: c.button, color: c.buttonText, fontWeight: 700, borderRadius: '12px', border: 'none', fontSize: '16px', cursor: (loading || !clientPhone) ? 'not-allowed' : 'pointer', opacity: (loading || !clientPhone) ? 0.7 : 1 }}>
              {loading ? 'Recherche...' : 'Voir mes reservations'}
            </button>
            <button type="button" onClick={() => router.push(`/${slug}/reservation`)} style={{ width: '100%', padding: '12px', background: 'transparent', color: c.textMuted, border: 'none', fontSize: '14px', cursor: 'pointer', marginTop: '16px', textDecoration: 'underline' }}>
              &larr; Faire une nouvelle reservation
            </button>
          </form>
        </div>
      </div>
    )
  }

  // --- LISTE DES RÉSERVATIONS ---
  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, padding: '16px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>Mes reservations</h1>
            <p style={{ color: c.textMuted, marginTop: '4px' }}>Bonjour {clientName}</p>
          </div>
          <button onClick={() => { setIsIdentified(false); setClientId(null); setClientPhone(''); setAppointments([]) }} style={{ fontSize: '14px', color: c.textMuted, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>
            Changer de numero
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: '24px', background: withAlpha('#dc2626', 0.15), border: `1px solid ${withAlpha('#dc2626', 0.4)}`, color: '#dc2626', padding: '12px 16px', borderRadius: '12px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {appointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 16px', background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#128197;</div>
            <p style={{ fontSize: '20px', color: c.textMuted, marginBottom: '24px' }}>Aucune reservation a venir</p>
            <button onClick={() => router.push(`/${slug}/reservation`)} style={{ padding: '12px 24px', background: c.button, color: c.buttonText, fontWeight: 700, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
              Reserver maintenant
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {appointments.map((apt) => (
              <div key={apt.id} style={{ background: c.bgCard, borderRadius: '16px', padding: '24px', border: `1px solid ${c.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, color: c.accent, margin: 0 }}>{apt.services?.name}</h3>
                    <p style={{ color: c.textMuted, fontSize: '14px', marginTop: '4px' }}>
                      {formatDate(apt.start_time)} a {formatTime(apt.start_time)}
                    </p>
                    <p style={{ color: c.textMuted, fontSize: '12px', marginTop: '4px' }}>
                      Duree : {apt.services?.duration_minutes} min &bull; {apt.services?.price_display} EUR
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleEditClick(apt)} style={{ ...btnStyle, padding: '8px 16px', background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                      Modifier
                    </button>
                    <button onClick={() => handleCancel(apt.id)} style={{ ...btnStyle, padding: '8px 16px', background: withAlpha('#dc2626', 0.15), color: '#dc2626', border: `1px solid ${withAlpha('#dc2626', 0.4)}` }}>
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de modification */}
        {editingAppointment && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ background: c.bgCard, borderRadius: '16px', padding: '24px', maxWidth: '600px', width: '100%', border: `1px solid ${c.border}`, maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: c.text, marginBottom: '16px', margin: '0 0 16px 0' }}>Modifier votre reservation</h2>
              <p style={{ color: c.textMuted, marginBottom: '24px' }}>
                Service : <span style={{ color: c.accent, fontWeight: 600 }}>{editingAppointment.services?.name}</span>
              </p>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '16px' }}>Selectionnez une nouvelle date</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
                  {availableDates.map((date) => {
                    const isSelected = selectedDate === date
                    const dateObj = new Date(date)
                    return (
                      <button key={date} onClick={() => handleDateSelect(date)} style={{ padding: '12px 8px', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: isSelected ? c.button : c.bg, color: isSelected ? c.buttonText : c.text, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.7 }}>{dateObj.toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3)}</span>
                        <span style={{ fontSize: '18px', fontWeight: 700 }}>{dateObj.getDate()}</span>
                        <span style={{ fontSize: '11px' }}>{dateObj.toLocaleDateString('fr-FR', { month: 'short' })}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedDate && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '16px' }}>
                    Heure disponible pour le {formatDate(selectedDate)}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
                    {timeSlots.map((time) => (
                      <button key={time} onClick={() => setSelectedTime(time)} style={{ padding: '12px', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: selectedTime === time ? c.button : c.bg, color: selectedTime === time ? c.buttonText : c.text }}>
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div style={{ marginBottom: '16px', background: withAlpha('#dc2626', 0.15), border: `1px solid ${withAlpha('#dc2626', 0.4)}`, color: '#dc2626', padding: '12px', borderRadius: '12px', fontSize: '14px' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { setEditingAppointment(null); setSelectedDate(''); setSelectedTime(''); setError('') }} style={{ ...btnStyle, flex: 1, padding: '12px', background: c.bg, color: c.textMuted, border: `1px solid ${c.border}` }}>
                  Annuler
                </button>
                <button onClick={handleSaveEdit} disabled={saving || !selectedDate || !selectedTime} style={{ ...btnStyle, flex: 1, padding: '12px', background: c.button, color: c.buttonText, opacity: (saving || !selectedDate || !selectedTime) ? 0.5 : 1 }}>
                  {saving ? 'Enregistrement...' : 'Confirmer la modification'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}