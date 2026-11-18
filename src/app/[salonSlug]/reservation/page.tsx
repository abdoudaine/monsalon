'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { getThemeStyles, type SalonTheme } from '@/lib/themes'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')
const PAYMENT_ENABLED = process.env.NEXT_PUBLIC_PAYMENT_ENABLED === 'true'

const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

const timeToMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

const generateSlots = (openTime: string, closeTime: string, duration: number) => {
  const slots = []
  let current = timeToMinutes(openTime)
  const end = timeToMinutes(closeTime)
  while (current + duration <= end) {
    const h = Math.floor(current / 60).toString().padStart(2, '0')
    const m = (current % 60).toString().padStart(2, '0')
    slots.push(`${h}:${m}`)
    current += 30
  }
  return slots
}

const parseDayHours = (val: any): { open: string; close: string } | null => {
  if (!val) return null
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'ferme' || val.toLowerCase() === 'closed' || val.trim() === '') return null
    const m = val.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
    return m ? { open: m[1], close: m[2] } : null
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return null
    const m = String(val[0]).match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
    return m ? { open: m[1], close: m[2] } : null
  }
  if (typeof val === 'object') {
    if (val.is_open === false) return null
    if (val.open && val.close) return { open: val.open, close: val.close }
  }
  return null
}

function withAlpha(hex: string, a: number): string {
  if (!hex) return `rgba(0,0,0,${a})`
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

function CheckoutForm({
  appointmentId, onSuccess, onError, c,
}: {
  appointmentId: string; onSuccess: () => void; onError: (msg: string) => void; c: any
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setIsProcessing(true)
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/${window.location.pathname.split('/')[1]}/reservation?status=success&appt=${appointmentId}`,
      },
      redirect: 'if_required',
    })
    if (error) {
      onError(error.message || 'Erreur de paiement')
      setIsProcessing(false)
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '16px' }}>
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        style={{
          padding: '16px', background: c.button, color: c.buttonText, fontWeight: 700, borderRadius: '12px',
          border: 'none', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '16px',
        }}
      >
        {isProcessing ? 'Traitement en cours...' : 'Payer 1,00 EUR et Confirmer'}
      </button>
    </form>
  )
}

export default function ReservationPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.salonSlug as string
  const supabase = createClient()

  const [isIdentified, setIsIdentified] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  // NOUVEAU : États pour l'email et le rappel
  const [clientEmail, setClientEmail] = useState('')
  const [wantsReminder, setWantsReminder] = useState(false)

  const [step, setStep] = useState(1)
  const [salon, setSalon] = useState<any>(null)
  const [colors, setColors] = useState<any>(null)
  const [services, setServices] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedService, setSelectedService] = useState<any>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
  const [employeeChoiceMade, setEmployeeChoiceMade] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [availableDates, setAvailableDates] = useState<string[]>([])

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [fetchingPayment, setFetchingPayment] = useState(false)

  useEffect(() => {
    if (slug) loadData()
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

  const loadData = async () => {
    setLoading(true)
    setError('')
    const { data: salonData, error: salonError } = await supabase.from('salons').select('*').eq('slug', slug).single()
    if (salonError || !salonData) {
      setError('Salon introuvable.')
      setLoading(false)
      return
    }
    setSalon(salonData)
    setColors(getThemeStyles((salonData.theme as SalonTheme) || 'luxe'))

    const { data: servicesData } = await supabase.from('services').select('*').eq('salon_id', salonData.id).order('name')
    setServices(servicesData || [])

    const { data: employeesData } = await supabase.from('employees').select('id, first_name, photo_url, specialities, availabilities').eq('salon_id', salonData.id).order('first_name')
    setEmployees(employeesData || [])
    setLoading(false)
  }

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName.trim() || !clientPhone.trim()) {
      setError('Veuillez remplir votre nom et numero.')
      return
    }
    const normalizedPhone = clientPhone.trim().replace(/\s+/g, '').replace(/^\+/, '')
    setAuthLoading(true)
    setError('')

    try {
      const { data: existingClient, error: searchError } = await supabase.from('clients').select('id, full_name').eq('phone', normalizedPhone).single()
      if (searchError && searchError.code !== 'PGRST116') throw new Error('Erreur lors de la recherche du client')

      let profileId = existingClient?.id
      if (existingClient) {
        if (existingClient.full_name !== clientName.trim()) {
          await supabase.from('clients').update({ full_name: clientName.trim() }).eq('id', existingClient.id)
        }
        setClientName(existingClient.full_name)
      } else {
        const { data: newClient, error: createError } = await supabase.from('clients').insert({ full_name: clientName.trim(), phone: normalizedPhone }).select('id').single()
        if (createError || !newClient) throw new Error('Impossible de creer le profil client')
        profileId = newClient.id
      }
      setClientId(profileId)
      setIsIdentified(true)
      setStep(1)
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'identification.")
    } finally {
      setAuthLoading(false)
    }
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const handleEmployeeSelect = (employee: any) => {
    setSelectedEmployee(employee)
    setEmployeeChoiceMade(true)
    setSelectedDate('')
    setSelectedTime('')
  }

  const getAvailableSlots = () => {
    if (!selectedDate || !salon || !selectedService) return []
    const date = new Date(selectedDate)
    const dayName = DAYS_FR[date.getDay()]
    const duration = selectedService.duration_minutes || 30

    const salonDay = parseDayHours(salon.settings?.opening_hours?.[dayName])
    if (!salonDay) return []

    let openTime = salonDay.open
    let closeTime = salonDay.close

    if (selectedEmployee) {
      const avail = selectedEmployee.availabilities || {}
      const exceptions = avail.exceptions || {}
      const exception = exceptions[selectedDate]

      if (exception) {
        if (!exception.is_open) return []
        const exOpen = exception.open || openTime
        const exClose = exception.close || closeTime
        if (timeToMinutes(exOpen) > timeToMinutes(openTime)) openTime = exOpen
        if (timeToMinutes(exClose) < timeToMinutes(closeTime)) closeTime = exClose
      } else {
        const dayVal = avail.standard ? avail.standard[dayName] : avail[dayName]
        const empDay = parseDayHours(dayVal)
        if (!empDay) return []
        if (timeToMinutes(empDay.open) > timeToMinutes(openTime)) openTime = empDay.open
        if (timeToMinutes(empDay.close) < timeToMinutes(closeTime)) closeTime = empDay.close
      }
    } else {
      const anyOpen = employees.some(emp => {
        const avail = emp.availabilities || {}
        const exceptions = avail.exceptions || {}
        const exception = exceptions[selectedDate]
        if (exception) return exception.is_open
        const dayVal = avail.standard ? avail.standard[dayName] : avail[dayName]
        return parseDayHours(dayVal) !== null
      })
      if (!anyOpen) return []
    }

    return generateSlots(openTime, closeTime, duration)
  }

  const availableSlots = getAvailableSlots()

  useEffect(() => {
    if (step === 3 && PAYMENT_ENABLED && selectedService && selectedDate && selectedTime && !clientSecret && !fetchingPayment) {
      const fetchPayment = async () => {
        setFetchingPayment(true)
        setError('')
        try {
          const service = services.find(s => s.id === selectedService.id)
          const startDateTime = `${selectedDate}T${selectedTime}:00`
          const endDateTime = new Date(new Date(startDateTime).getTime() + (service?.duration_minutes || 30) * 60000).toISOString()

          const res = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              salonSlug: slug,
              serviceId: selectedService.id,
              startTime: startDateTime,
              endTime: endDateTime,
              clientName,
              clientPhone: clientPhone.trim().replace(/\s+/g, '').replace(/^\+/, ''),
            }),
          })
          const data = await res.json()
          if (data.clientSecret) {
            setClientSecret(data.clientSecret)
            setAppointmentId(data.appointmentId)
          } else {
            setError(data.error || 'Erreur de preparation du paiement')
          }
        } catch (err) {
          setError('Erreur de connexion au serveur de paiement')
        } finally {
          setFetchingPayment(false)
        }
      }
      fetchPayment()
    }
  }, [step, PAYMENT_ENABLED, selectedService, selectedDate, selectedTime, slug, clientName, clientPhone, services, clientSecret, fetchingPayment])

  // --- FONCTION MISE À JOUR AVEC L'ENVOI D'EMAIL ---
  const handleDirectConfirm = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !salon || !clientId) {
      setError('Donnees incompletes.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const startDateTime = `${selectedDate}T${selectedTime}:00`
      const endDateTime = new Date(new Date(startDateTime).getTime() + (selectedService.duration_minutes || 30) * 60000).toISOString()

      const { error: dbError } = await supabase.from('appointments').insert({
        salon_id: salon.id,
        client_id: clientId,
        service_id: selectedService.id,
        employee_id: selectedEmployee?.id || null,
        start_time: startDateTime,
        end_time: endDateTime,
        status: 'confirmed',
        payment_status: 'pending',
        client_name: clientName.trim(),
        client_phone: clientPhone.trim().replace(/\s+/g, '').replace(/^\+/, ''),
        client_email: clientEmail.trim() || null,
        wants_reminder: wantsReminder,
      }).select('id').single()

      if (dbError) throw new Error(dbError.message || 'Erreur creation RDV')
      
      // NOUVEAU : Envoi de l'email de confirmation via Resend
      if (clientEmail.trim()) {
        try {
          const res = await fetch('/api/send-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientName: clientName.trim(),
              clientEmail: clientEmail.trim(),
              salonName: salon.name,
              serviceName: selectedService.name,
              date: formatDate(selectedDate),
              time: selectedTime,
              employeeName: selectedEmployee?.first_name || 'Le premier disponible',
            }),
          })
          const data = await res.json()
          if (!res.ok) {
            console.warn('Echec envoi email (non bloquant):', data.error)
          } else {
            console.log('Email de confirmation envoyé avec succès')
          }
        } catch (emailErr) {
          console.error("Erreur lors de l'envoi de l'email (non bloquant):", emailErr)
        }
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  const c = colors || { bg: '#ffffff', bgCard: '#fafafa', text: '#000000', textMuted: '#525252', accent: '#000000', border: '#e5e5e5', button: '#000000', buttonText: '#ffffff' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '12px', color: c.text, fontSize: '16px', outline: 'none' }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>✅</div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px' }}>Reservation confirmee !</h1>
          <p style={{ fontSize: '18px', color: c.textMuted, marginBottom: '8px' }}>Bonjour <strong style={{ color: c.text }}>{clientName}</strong>,</p>
          <p style={{ fontSize: '18px', color: c.textMuted, marginBottom: '8px' }}>Votre rendez-vous pour <strong style={{ color: c.accent }}>{selectedService?.name}</strong></p>
          <p style={{ fontSize: '18px', color: c.textMuted, marginBottom: '8px' }}>avec <strong style={{ color: c.accent }}>{selectedEmployee ? selectedEmployee.first_name : 'le coiffeur de votre choix'}</strong></p>
          <p style={{ fontSize: '18px', color: c.textMuted, marginBottom: '32px' }}>est confirme le <strong>{formatDate(selectedDate)}</strong> a <strong>{selectedTime}</strong>.</p>
          {wantsReminder && clientEmail && (
            <p style={{ fontSize: '14px', color: c.accent, marginBottom: '24px' }}>📧 Un rappel vous sera envoye a {clientEmail} 24h avant le RDV.</p>
          )}
          <button onClick={() => router.push(`/${slug}`)} style={{ padding: '16px 32px', background: c.button, color: c.buttonText, fontWeight: 700, borderRadius: '12px', border: 'none', fontSize: '18px', cursor: 'pointer' }}>Retour a l'accueil</button>
        </div>
      </div>
    )
  }

  if (!isIdentified) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ maxWidth: '450px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Bienvenue chez {salon?.name || 'MonSalon'}</h1>
            <p style={{ color: c.textMuted }}>Identifiez-vous pour reserver</p>
          </div>
          <form onSubmit={handleIdentify} style={{ background: c.bgCard, padding: '32px', borderRadius: '16px', border: `1px solid ${c.border}` }}>
            {error && <div style={{ marginBottom: '16px', background: withAlpha('#dc2626', 0.15), border: `1px solid ${withAlpha('#dc2626', 0.4)}`, color: '#dc2626', padding: '12px', borderRadius: '12px', fontSize: '14px' }}>{error}</div>}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Nom ou Prenom</label>
              <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} style={inputStyle} placeholder="Jean Dupont" autoFocus />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Numero de telephone</label>
              <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} style={inputStyle} placeholder="06 12 34 56 78" />
            </div>
            <button type="submit" disabled={authLoading || !clientName || !clientPhone} style={{ width: '100%', padding: '16px', background: c.button, color: c.buttonText, fontWeight: 700, borderRadius: '12px', border: 'none', fontSize: '16px', cursor: authLoading ? 'not-allowed' : 'pointer', opacity: authLoading ? 0.7 : 1 }}>
              {authLoading ? 'Identification...' : 'Continuer'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, padding: '16px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', background: c.bgCard, padding: '16px', borderRadius: '12px', border: `1px solid ${c.border}` }}>
          <div>
            <p style={{ fontSize: '14px', color: c.textMuted, margin: 0 }}>Connecte en tant que</p>
            <p style={{ fontWeight: 700, color: c.accent, margin: 0 }}>{clientName}</p>
          </div>
          <button onClick={() => { setIsIdentified(false); setClientId(null); setStep(1); setSelectedService(null); setSelectedEmployee(null); setEmployeeChoiceMade(false); setSelectedDate(''); setSelectedTime(''); setClientSecret(null); setClientEmail(''); setWantsReminder(false) }} style={{ fontSize: '12px', color: c.textMuted, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>Changer</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '48px' }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, background: step >= s ? c.button : c.bgCard, color: step >= s ? c.buttonText : c.textMuted, border: `1px solid ${step >= s ? c.button : c.border}` }}>{s}</div>
              {s < 3 && <div style={{ width: '48px', height: '2px', margin: '0 8px', background: step > s ? c.button : c.border }}></div>}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '32px' }}>Choisissez votre prestation</h2>
            {loading ? <p style={{ textAlign: 'center', color: c.textMuted, padding: '48px 0' }}>Chargement...</p> : services.length === 0 ? <p style={{ textAlign: 'center', color: c.textMuted, padding: '48px 0' }}>Aucun service disponible.</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {services.map((service) => (
                  <button key={service.id} onClick={() => { setSelectedService(service); setStep(2) }} style={{ padding: '24px', background: c.bgCard, border: `2px solid ${c.border}`, borderRadius: '16px', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = c.accent)} onMouseLeave={e => (e.currentTarget.style.borderColor = c.border)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: c.text, margin: 0 }}>{service.name}</h3>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: c.accent }}>{service.price_display} EUR</span>
                    </div>
                    <div style={{ fontSize: '14px', color: c.textMuted }}>⏱ {service.duration_minutes} minutes</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <button onClick={() => { setSelectedService(null); setSelectedEmployee(null); setEmployeeChoiceMade(false); setSelectedDate(''); setSelectedTime(''); setStep(1) }} style={{ fontSize: '14px', color: c.textMuted, background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', display: 'flex', alignItems: 'center' }}>&larr; Retour au choix du service</button>
            <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '8px' }}>Avec qui et quand ?</h2>
            <p style={{ color: c.textMuted, textAlign: 'center', marginBottom: '32px' }}>Service : <span style={{ color: c.accent, fontWeight: 600 }}>{selectedService?.name}</span> ({selectedService?.duration_minutes} min)</p>

            <div style={{ background: c.bgCard, borderRadius: '16px', padding: '24px', border: `1px solid ${c.border}`, marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '16px' }}>Choisissez votre coiffeur</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                <button onClick={() => handleEmployeeSelect(null)} style={{ padding: '16px', borderRadius: '12px', fontWeight: 600, fontSize: '14px', border: '2px solid', background: employeeChoiceMade && selectedEmployee === null ? c.button : c.bg, color: employeeChoiceMade && selectedEmployee === null ? c.buttonText : c.text, borderColor: employeeChoiceMade && selectedEmployee === null ? c.button : c.border, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: c.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🎲</div>
                  <span>Peu importe</span>
                </button>
                {employees.map((emp) => (
                  <button key={emp.id} onClick={() => handleEmployeeSelect(emp)} style={{ padding: '16px', borderRadius: '12px', fontWeight: 600, fontSize: '14px', border: '2px solid', background: selectedEmployee?.id === emp.id ? c.button : c.bg, color: selectedEmployee?.id === emp.id ? c.buttonText : c.text, borderColor: selectedEmployee?.id === emp.id ? c.button : c.border, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: c.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, overflow: 'hidden' }}>
                      {emp.photo_url ? <img src={emp.photo_url} alt={emp.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : emp.first_name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.first_name}</span>
                  </button>
                ))}
              </div>
            </div>

            {employeeChoiceMade && (
              <div style={{ background: c.bgCard, borderRadius: '16px', padding: '24px', border: `1px solid ${c.border}`, marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '16px' }}>Selectionnez une date</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
                  {availableDates.map((date) => {
                    const isSelected = selectedDate === date
                    const dateObj = new Date(date)
                    return (
                      <button key={date} onClick={() => { setSelectedDate(date); setSelectedTime('') }} style={{ padding: '12px 8px', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: isSelected ? c.button : c.bg, color: isSelected ? c.buttonText : c.text, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.7 }}>{DAYS_FR[dateObj.getDay()].substring(0, 3)}</span>
                        <span style={{ fontSize: '18px', fontWeight: 700 }}>{dateObj.getDate()}</span>
                        <span style={{ fontSize: '11px' }}>{dateObj.toLocaleDateString('fr-FR', { month: 'short' })}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {selectedDate && (
              <div style={{ background: c.bgCard, borderRadius: '16px', padding: '24px', border: `1px solid ${c.border}` }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '16px' }}>Heures disponibles le {formatDate(selectedDate)}</label>
                {availableSlots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: c.textMuted, background: c.bg, borderRadius: '12px' }}>⚠️ Aucun creneau disponible pour ce choix a cette date.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
                    {availableSlots.map((time) => (
                      <button key={time} onClick={() => { setSelectedTime(time); setStep(3) }} style={{ padding: '12px', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: selectedTime === time ? c.button : c.bg, color: selectedTime === time ? c.buttonText : c.text }}>{time}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <button onClick={() => { setSelectedTime(''); setStep(2); setClientSecret(null) }} style={{ fontSize: '14px', color: c.textMuted, background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', display: 'flex', alignItems: 'center' }}>&larr; Retour au choix du creneau</button>
            <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '8px' }}>Confirmez votre reservation</h2>
            <p style={{ color: c.textMuted, textAlign: 'center', marginBottom: '32px' }}>Tout est bon ?</p>

            <div style={{ background: c.bgCard, borderRadius: '16px', padding: '24px', border: `1px solid ${c.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', marginBottom: '16px', borderBottom: `1px solid ${c.border}` }}>
                <div>
                  <p style={{ fontSize: '14px', color: c.textMuted, margin: 0 }}>Prestation</p>
                  <p style={{ fontSize: '18px', fontWeight: 700, color: c.text, margin: 0 }}>{selectedService?.name}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: c.accent, margin: 0 }}>{selectedService?.price_display} EUR</p>
                  <p style={{ fontSize: '12px', color: c.textMuted, margin: 0 }}>{selectedService?.duration_minutes} min</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', marginBottom: '16px', borderBottom: `1px solid ${c.border}` }}>
                <div>
                  <p style={{ fontSize: '14px', color: c.textMuted, margin: 0 }}>Coiffeur</p>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: c.text, margin: 0 }}>{selectedEmployee ? selectedEmployee.first_name : 'Peu importe (premier disponible)'}</p>
                </div>
                {selectedEmployee?.photo_url && (
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${c.accent}` }}>
                    <img src={selectedEmployee.photo_url} alt={selectedEmployee.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', marginBottom: '16px', borderBottom: `1px solid ${c.border}` }}>
                <div>
                  <p style={{ fontSize: '14px', color: c.textMuted, margin: 0 }}>Date et heure</p>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: c.text, margin: 0 }}>{formatDate(selectedDate)}</p>
                </div>
                <p style={{ fontSize: '20px', fontWeight: 700, color: c.accent, margin: 0 }}>{selectedTime}</p>
              </div>

              <div style={{ background: c.bg, padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                <p style={{ fontSize: '14px', color: c.textMuted, margin: '0 0 4px 0' }}>Reservation pour</p>
                <p style={{ fontSize: '16px', fontWeight: 700, color: c.text, margin: 0 }}>{clientName}</p>
                <p style={{ fontSize: '14px', color: c.textMuted, margin: '4px 0 0 0' }}>{clientPhone}</p>
              </div>

              {/* NOUVEAU : Bloc Email et Rappel */}
              <div style={{ background: c.bg, padding: '16px', borderRadius: '12px', marginBottom: '24px', border: `1px solid ${c.border}` }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>
                  Adresse email (optionnel)
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => {
                    setClientEmail(e.target.value)
                    if (!e.target.value.trim()) setWantsReminder(false)
                  }}
                  style={inputStyle}
                  placeholder="votre@email.com"
                />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '16px', padding: '12px', background: c.bgCard, borderRadius: '8px', border: `1px solid ${c.border}` }}>
                  <input
                    type="checkbox"
                    id="reminder"
                    checked={wantsReminder}
                    onChange={(e) => setWantsReminder(e.target.checked)}
                    disabled={!clientEmail.trim()}
                    style={{ marginTop: '3px', width: '18px', height: '18px', cursor: clientEmail.trim() ? 'pointer' : 'not-allowed', accentColor: c.accent }}
                  />
                  <label htmlFor="reminder" style={{ fontSize: '14px', color: clientEmail.trim() ? c.text : c.textMuted, cursor: clientEmail.trim() ? 'pointer' : 'not-allowed', lineHeight: '1.4' }}>
                    M'envoyer un rappel par email 24h avant le RDV
                  </label>
                </div>
              </div>

              {error && <div style={{ marginBottom: '16px', background: withAlpha('#dc2626', 0.15), border: `1px solid ${withAlpha('#dc2626', 0.4)}`, color: '#dc2626', padding: '12px', borderRadius: '12px', fontSize: '14px' }}>{error}</div>}

              {PAYMENT_ENABLED ? (
                fetchingPayment ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: c.textMuted }}>Preparation du paiement securise...</div>
                ) : clientSecret && appointmentId ? (
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                    <CheckoutForm appointmentId={appointmentId} onSuccess={() => setSuccess(true)} onError={(msg) => setError(msg)} c={c} />
                  </Elements>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#dc2626' }}>Impossible de charger le module de paiement.</div>
                )
              ) : (
                <button onClick={handleDirectConfirm} disabled={loading} style={{ width: '100%', padding: '16px', background: c.button, color: c.buttonText, fontWeight: 700, borderRadius: '12px', border: 'none', fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {loading ? 'Confirmation...' : '✅ Confirmer la reservation'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}