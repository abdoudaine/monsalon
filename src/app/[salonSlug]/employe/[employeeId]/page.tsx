'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { getThemeStyles, type SalonTheme } from '@/lib/themes'

interface Employee {
  id: string
  salon_id: string
  first_name: string
  phone: string | null
  photo_url: string | null
  specialities: string[] | null
  availabilities?: any
  salons: { name: string; slug: string; theme?: string } | null
}

interface Appointment {
  id: string
  start_time: string
  end_time: string
  status: string
  client_name: string | null
  client_phone: string | null
  services: { name: string; duration_minutes: number; price_display: number } | null
}

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const
type DayKey = typeof DAYS[number]

interface DaySchedule {
  is_open: boolean
  open: string
  close: string
}

interface Exception {
  is_open: boolean
  open?: string
  close?: string
  reason?: string
}

const DEFAULT_STANDARD: Record<DayKey, DaySchedule> = {
  lundi: { is_open: true, open: '09:00', close: '18:00' },
  mardi: { is_open: true, open: '09:00', close: '18:00' },
  mercredi: { is_open: true, open: '09:00', close: '18:00' },
  jeudi: { is_open: true, open: '09:00', close: '18:00' },
  vendredi: { is_open: true, open: '09:00', close: '18:00' },
  samedi: { is_open: true, open: '09:00', close: '17:00' },
  dimanche: { is_open: false, open: '09:00', close: '18:00' },
}

const DEFAULT_C = { bg: '#09090b', bgCard: '#18181b', text: '#fafafa', textMuted: '#a1a1aa', accent: '#fbbf24', border: '#27272a', button: '#f59e0b', buttonText: '#000000' }

function withAlpha(hex: string, a: number): string {
  if (!hex) return `rgba(0,0,0,${a})`
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function EmployeeSpacePage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.salonSlug as string
  const employeeId = params.employeeId as string
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [colors, setColors] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authName, setAuthName] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  // NOUVEAU : Onglet actif
  const [activeTab, setActiveTab] = useState<'rdv' | 'planning' | 'profil'>('rdv')

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [firstName, setFirstName] = useState('')
  const [phone, setPhone] = useState('')
  const [specialities, setSpecialities] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')

  const [standard, setStandard] = useState<Record<DayKey, DaySchedule>>(DEFAULT_STANDARD)
  const [exceptions, setExceptions] = useState<Record<string, Exception>>({})
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showExceptionModal, setShowExceptionModal] = useState(false)
  const [exceptionData, setExceptionData] = useState<Exception>({ is_open: false, reason: '' })

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [otherEmployees, setOtherEmployees] = useState<{ id: string; first_name: string }[]>([])
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [selectedApptForTransfer, setSelectedApptForTransfer] = useState<Appointment | null>(null)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)

  const c = colors || DEFAULT_C

  useEffect(() => {
    const loadEmployee = async () => {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('employees')
        .select('*, salons (name, slug, theme)')
        .eq('id', employeeId)
        .single()

      if (error || !data) {
        setError('Employe introuvable. Verifiez le lien.')
        setLoading(false)
        return
      }

      if (data.salons?.slug !== slug) {
        setError('Ce lien ne correspond pas au bon salon.')
        setLoading(false)
        return
      }

      setEmployee(data as Employee)
      setColors(getThemeStyles((data.salons?.theme as SalonTheme) || 'luxe'))
      setFirstName(data.first_name || '')
      setPhone(data.phone || '')
      setSpecialities(data.specialities?.join(', ') || '')
      setPhotoUrl(data.photo_url || '')

      const avail = data.availabilities || {}
      setStandard(avail.standard || DEFAULT_STANDARD)
      setExceptions(avail.exceptions || {})

      setLoading(false)
    }

    if (employeeId && slug) loadEmployee()
  }, [employeeId, slug, supabase])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    if (!employee) return

    const nameMatch = employee.first_name.toLowerCase().includes(authName.trim().toLowerCase()) || 
                      authName.trim().toLowerCase().includes(employee.first_name.toLowerCase())
    const phoneMatch = employee.phone && employee.phone.replace(/\s+/g, '') === authPhone.trim().replace(/\s+/g, '')

    if (nameMatch && phoneMatch) {
      setIsAuthenticated(true)
      localStorage.setItem(`employee_session_${employeeId}`, 'true')
    } else {
      setAuthError('Informations incorrectes. Verifiez votre prenom et numero de telephone.')
    }
    setAuthLoading(false)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem(`employee_session_${employeeId}`)
    setAuthName('')
    setAuthPhone('')
  }

  useEffect(() => {
    if (employee && !isAuthenticated) {
      const session = localStorage.getItem(`employee_session_${employeeId}`)
      if (session === 'true') setIsAuthenticated(true)
    }
  }, [employee, employeeId, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && employee) {
      const loadData = async () => {
        const now = new Date().toISOString()
        const { data: apptsData } = await supabase
          .from('appointments')
          .select('id, start_time, end_time, status, client_name, client_phone, services (name, duration_minutes, price_display)')
          .eq('employee_id', employee.id)
          .gte('start_time', now)
          .neq('status', 'cancelled')
          .order('start_time', { ascending: true })
        setAppointments(apptsData || [])

        const { data: empsData } = await supabase
          .from('employees')
          .select('id, first_name')
          .eq('salon_id', employee.salon_id)
          .neq('id', employee.id)
        setOtherEmployees(empsData || [])
      }
      loadData()
    }
  }, [isAuthenticated, employee, supabase])

  const handleConfirmAppt = async (apptId: string) => {
    const { error } = await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', apptId)
    if (!error) {
      setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, status: 'confirmed' } : a))
      setSuccessMsg('RDV confirme !')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const handleRefuseAppt = async (apptId: string) => {
    if (!confirm('Voulez-vous vraiment refuser ce RDV ? Il retournera en attente pour le gerant.')) return
    const { error } = await supabase.from('appointments').update({ status: 'pending', employee_id: null }).eq('id', apptId)
    if (!error) {
      setAppointments(prev => prev.filter(a => a.id !== apptId))
      setSuccessMsg('RDV refuse et desassigne.')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const handleTransferAppt = async () => {
    if (!selectedApptForTransfer || !transferTargetId) return
    setTransferLoading(true)
    const { error } = await supabase
      .from('appointments')
      .update({ employee_id: transferTargetId, status: 'pending' })
      .eq('id', selectedApptForTransfer.id)
    
    if (!error) {
      setAppointments(prev => prev.filter(a => a.id !== selectedApptForTransfer.id))
      setSuccessMsg('RDV transfere avec succes !')
      setTimeout(() => setSuccessMsg(''), 3000)
      setTransferModalOpen(false)
      setSelectedApptForTransfer(null)
      setTransferTargetId('')
    }
    setTransferLoading(false)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !employee) return
    setUploading(true); setError('')
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `employees/${employee.id}-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('salon-photos').upload(fileName, file, { cacheControl: '3600', upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('salon-photos').getPublicUrl(fileName)
      setPhotoUrl(urlData.publicUrl)
      await supabase.from('employees').update({ photo_url: urlData.publicUrl }).eq('id', employee.id)
      setSuccessMsg('Photo mise a jour !')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'upload.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employee || !firstName.trim()) { setError('Le prenom est obligatoire.'); return }
    setSaving(true); setError(''); setSuccessMsg('')
    const specsArray = specialities.split(',').map(s => s.trim()).filter(s => s.length > 0)
    try {
      const { error } = await supabase.from('employees').update({
        first_name: firstName.trim(), phone: phone.trim() || null, specialities: specsArray.length > 0 ? specsArray : null,
      }).eq('id', employee.id)
      if (error) throw error
      setSuccessMsg('Profil mis a jour avec succes !')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde.')
    } finally { setSaving(false) }
  }

  const handleSaveAvailabilities = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employee) return
    setSaving(true); setError(''); setSuccessMsg('')
    for (const d of DAYS) {
      const a = standard[d]
      if (a.is_open && a.open >= a.close) { setError(`« ${d} » : l'heure de debut doit etre avant l'heure de fin.`); setSaving(false); return }
    }
    const payload = { standard, exceptions }
    try {
      const { error } = await supabase.from('employees').update({ availabilities: payload }).eq('id', employee.id)
      if (error) throw error
      setEmployee(prev => (prev ? { ...prev, availabilities: payload } : prev))
      setSuccessMsg('Disponibilites enregistrees !')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde des disponibilites.')
    } finally { setSaving(false) }
  }

  const setDay = (d: DayKey, patch: Partial<DaySchedule>) => setStandard(prev => ({ ...prev, [d]: { ...prev[d], ...patch } }))
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year: number, month: number) => { const day = new Date(year, month, 1).getDay(); return day === 0 ? 6 : day - 1 }
  const formatDateKey = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  
  const getDaySchedule = (dateKey: string): { is_open: boolean; open: string; close: string } | null => {
    const exception = exceptions[dateKey]
    if (exception) {
      if (!exception.is_open) return null
      return { is_open: true, open: exception.open || '09:00', close: exception.close || '18:00' }
    }
    const date = new Date(dateKey)
    const dayName = DAYS[(date.getDay() + 6) % 7]
    const std = standard[dayName]
    if (!std.is_open) return null
    return std
  }

  const handleDayClick = (dateKey: string) => {
    setSelectedDate(dateKey)
    const existing = exceptions[dateKey]
    setExceptionData(existing || { is_open: false, reason: '' })
    setShowExceptionModal(true)
  }

  const handleExceptionSave = () => {
    if (!selectedDate) return
    if (!exceptionData.is_open && !exceptionData.reason) {
      const newExceptions = { ...exceptions }; delete newExceptions[selectedDate]; setExceptions(newExceptions)
    } else {
      setExceptions(prev => ({ ...prev, [selectedDate]: exceptionData }))
    }
    setShowExceptionModal(false); setSelectedDate(null)
  }

  const handleExceptionDelete = () => {
    if (!selectedDate) return
    const newExceptions = { ...exceptions }; delete newExceptions[selectedDate]; setExceptions(newExceptions)
    setShowExceptionModal(false); setSelectedDate(null)
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '12px', color: c.text, fontSize: '16px', outline: 'none' }
  const smallInputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', color: c.text, fontSize: '14px', outline: 'none' }
  const cardStyle: React.CSSProperties = { background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '24px' }
  const btnStyle: React.CSSProperties = { borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.accent }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span style={{ fontWeight: 500, letterSpacing: '0.05em' }}>Chargement...</span>
        </div>
      </div>
    )
  }

  if (error && !employee) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ textAlign: 'center', maxWidth: '448px' }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: c.text, marginBottom: '16px' }}>Acces impossible</h1>
          <p style={{ color: '#ef4444', marginBottom: '24px' }}>{error}</p>
          <button onClick={() => router.push(`/${slug}`)} style={{ ...btnStyle, padding: '12px 24px', background: c.button, color: c.buttonText, fontSize: '16px' }}>Retour a l'accueil</button>
        </div>
      </div>
    )
  }

  if (!isAuthenticated && employee) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: c.text, margin: '0 0 8px 0' }}>Espace <span style={{ color: c.accent }}>Employe</span></h1>
            <p style={{ color: c.textMuted, margin: 0 }}>{employee.salons?.name}</p>
          </div>
          <div style={{ ...cardStyle, padding: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: c.text, marginBottom: '24px', textAlign: 'center' }}>Connexion</h2>
            {authError && (
              <div style={{ marginBottom: '16px', background: withAlpha('#ef4444', 0.15), border: `1px solid ${withAlpha('#ef4444', 0.4)}`, color: '#ef4444', padding: '12px', borderRadius: '12px', fontSize: '14px', textAlign: 'center' }}>{authError}</div>
            )}
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Votre prenom</label>
                <input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} style={inputStyle} placeholder="Ex: Amine" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Numero de telephone</label>
                <input type="tel" value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} style={inputStyle} placeholder="06 12 34 56 78" required />
              </div>
              <button type="submit" disabled={authLoading || !authName.trim() || !authPhone.trim()} style={{ ...btnStyle, width: '100%', padding: '14px', background: c.button, color: c.buttonText, fontSize: '16px', marginTop: '8px', opacity: (authLoading || !authName.trim() || !authPhone.trim()) ? 0.7 : 1 }}>
                {authLoading ? 'Verification...' : 'Acceder a mon espace'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const monthName = new Date(currentYear, currentMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const tabs = [
    { id: 'rdv' as const, label: 'Mes RDV', icon: '📋', count: appointments.length },
    { id: 'planning' as const, label: 'Mon Planning', icon: '🗓️' },
    { id: 'profil' as const, label: 'Mon Profil', icon: '👤' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, padding: '16px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: c.text, margin: '0 0 8px 0' }}>Mon Espace <span style={{ color: c.accent }}>Employe</span></h1>
            <p style={{ color: c.textMuted, margin: 0 }}>{employee?.salons?.name}</p>
          </div>
          <button onClick={handleLogout} style={{ ...btnStyle, padding: '8px 16px', background: withAlpha('#ef4444', 0.1), color: '#ef4444', border: `1px solid ${withAlpha('#ef4444', 0.3)}`, fontSize: '14px' }}>🚪 Deconnexion</button>
        </div>

        {successMsg && (
          <div style={{ marginBottom: '24px', background: withAlpha('#16a34a', 0.15), border: `1px solid ${withAlpha('#16a34a', 0.4)}`, color: '#16a34a', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>✅</span> {successMsg}</div>
        )}
        {error && (
          <div style={{ marginBottom: '24px', background: withAlpha('#dc2626', 0.15), border: `1px solid ${withAlpha('#dc2626', 0.4)}`, color: '#dc2626', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>⚠️</span> {error}</div>
        )}

        {/* NOUVEAU : Navigation par onglets */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: `1px solid ${c.border}`, paddingBottom: '0' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 20px',
                borderRadius: '12px 12px 0 0',
                border: 'none',
                borderBottom: activeTab === tab.id ? `3px solid ${c.accent}` : '3px solid transparent',
                background: activeTab === tab.id ? c.bgCard : 'transparent',
                color: activeTab === tab.id ? c.text : c.textMuted,
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span style={{ background: c.accent, color: c.buttonText, padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 700 }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* CONTENU DES ONGLETS */}
        {activeTab === 'rdv' && (
          <div style={{ ...cardStyle, marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: c.text, marginBottom: '16px', margin: '0 0 16px 0' }}>Mes Reservations a venir ({appointments.length})</h2>
            
            {appointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: c.textMuted, background: c.bg, borderRadius: '12px' }}>
                <p>Aucun rendez-vous assigne pour le moment.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {appointments.map(appt => {
                  const dateObj = new Date(appt.start_time)
                  const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                  const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  const isPending = appt.status === 'pending'

                  return (
                    <div key={appt.id} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 700, color: c.text, margin: 0 }}>{appt.services?.name || 'Prestation'}</h3>
                          <p style={{ fontSize: '14px', color: c.textMuted, margin: '4px 0 0 0' }}>📅 {dateStr} a {timeStr} ({appt.services?.duration_minutes} min)</p>
                          <p style={{ fontSize: '13px', color: c.textMuted, margin: '4px 0 0 0' }}>👤 {appt.client_name || 'Client'} • 📞 {appt.client_phone || 'N/A'}</p>
                        </div>
                        <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, background: isPending ? withAlpha('#eab308', 0.15) : withAlpha('#16a34a', 0.15), color: isPending ? '#eab308' : '#16a34a', border: `1px solid ${isPending ? withAlpha('#eab308', 0.4) : withAlpha('#16a34a', 0.4)}` }}>
                          {isPending ? 'En attente' : 'Confirme'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: `1px solid ${c.border}`, paddingTop: '12px' }}>
                        {isPending && (
                          <>
                            <button onClick={() => handleConfirmAppt(appt.id)} style={{ ...btnStyle, padding: '8px 16px', background: '#16a34a', color: '#ffffff', fontSize: '13px' }}>✅ Confirmer</button>
                            <button onClick={() => { setSelectedApptForTransfer(appt); setTransferTargetId(''); setTransferModalOpen(true) }} style={{ ...btnStyle, padding: '8px 16px', background: '#2563eb', color: '#ffffff', fontSize: '13px' }}>🔄 Transferer</button>
                            <button onClick={() => handleRefuseAppt(appt.id)} style={{ ...btnStyle, padding: '8px 16px', background: withAlpha('#dc2626', 0.1), color: '#dc2626', border: `1px solid ${withAlpha('#dc2626', 0.3)}`, fontSize: '13px' }}>❌ Refuser</button>
                          </>
                        )}
                        {!isPending && (
                          <span style={{ fontSize: '13px', color: c.textMuted, fontStyle: 'italic' }}>Ce RDV est deja confirme.</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'planning' && (
          <form onSubmit={handleSaveAvailabilities} style={{ ...cardStyle, marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: c.text, margin: 0 }}>Horaires standards</h2>
              <button type="button" onClick={() => setStandard({ ...DEFAULT_STANDARD })} style={{ ...btnStyle, padding: '6px 12px', background: c.bg, color: c.textMuted, border: `1px solid ${c.border}`, fontSize: '12px' }}>Reinitialiser</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {DAYS.map((d) => {
                const a = standard[d]
                return (
                  <div key={d} style={{ borderRadius: '12px', border: `1px solid ${c.border}`, padding: '16px', background: a.is_open ? c.bg : withAlpha(c.text, 0.02) }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize', color: a.is_open ? c.text : c.textMuted }}>{d}</span>
                      <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${c.border}` }}>
                        <button type="button" onClick={() => setDay(d, { is_open: true })} style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', background: a.is_open ? '#16a34a' : c.bgCard, color: a.is_open ? '#ffffff' : c.textMuted }}>Ouvert</button>
                        <button type="button" onClick={() => setDay(d, { is_open: false })} style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', background: !a.is_open ? '#dc2626' : c.bgCard, color: !a.is_open ? '#ffffff' : c.textMuted }}>Ferme</button>
                      </div>
                    </div>
                    {a.is_open && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                        <div><label style={{ display: 'block', fontSize: '12px', color: c.textMuted, marginBottom: '4px' }}>Debut</label><input type="time" value={a.open} onChange={(e) => setDay(d, { open: e.target.value })} style={smallInputStyle} /></div>
                        <div><label style={{ display: 'block', fontSize: '12px', color: c.textMuted, marginBottom: '4px' }}>Fin</label><input type="time" value={a.close} onChange={(e) => setDay(d, { close: e.target.value })} style={smallInputStyle} /></div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: c.text, marginBottom: '8px', margin: '0 0 8px 0' }}>Exceptions ponctuelles</h3>
              <p style={{ fontSize: '12px', color: c.textMuted, marginBottom: '16px' }}>Cliquez sur un jour pour ajouter une exception.</p>
              <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <button type="button" onClick={() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1) } else setCurrentMonth(currentMonth - 1) }} style={{ ...btnStyle, padding: '4px 12px', background: c.bgCard, color: c.text, border: `1px solid ${c.border}`, fontSize: '14px' }}>&lsaquo;</button>
                  <h4 style={{ fontSize: '18px', fontWeight: 700, color: c.text, textTransform: 'capitalize', margin: 0 }}>{monthName}</h4>
                  <button type="button" onClick={() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1) } else setCurrentMonth(currentMonth + 1) }} style={{ ...btnStyle, padding: '4px 12px', background: c.bgCard, color: c.text, border: `1px solid ${c.border}`, fontSize: '14px' }}>&rsaquo;</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px' }}>
                  {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: c.textMuted }}>{d}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} style={{ aspectRatio: '1' }}></div>)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const dateKey = formatDateKey(currentYear, currentMonth, day)
                    const exception = exceptions[dateKey]
                    const schedule = getDaySchedule(dateKey)
                    const today = new Date().toISOString().split('T')[0]
                    const isToday = dateKey === today
                    let bgColor = c.bgCard, borderColor = c.border, textColor = c.text
                    if (exception) {
                      if (!exception.is_open) { bgColor = withAlpha('#dc2626', 0.2); borderColor = withAlpha('#dc2626', 0.5); textColor = '#dc2626' }
                      else { bgColor = withAlpha('#f97316', 0.2); borderColor = withAlpha('#f97316', 0.5); textColor = '#f97316' }
                    } else if (!schedule) { bgColor = withAlpha('#dc2626', 0.1); borderColor = withAlpha('#dc2626', 0.3); textColor = '#dc2626' }
                    return (
                      <button key={day} type="button" onClick={() => handleDayClick(dateKey)} style={{ aspectRatio: '1', borderRadius: '8px', border: `1px solid ${borderColor}`, background: bgColor, color: textColor, fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.15s', boxShadow: isToday ? `0 0 0 2px ${c.accent}` : 'none' }} onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')} onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} title={exception?.reason || (schedule ? `Disponible ${schedule.open}-${schedule.close}` : 'Ferme')}>
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <button type="submit" disabled={saving} style={{ ...btnStyle, width: '100%', padding: '16px', background: c.button, color: c.buttonText, opacity: saving ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '16px' }}>
              {saving ? 'Enregistrement...' : '🗓️ Enregistrer mes disponibilites'}
            </button>
          </form>
        )}

        {activeTab === 'profil' && (
          <>
            <div style={{ ...cardStyle, marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: c.text, marginBottom: '16px', margin: '0 0 16px 0' }}>Ma photo</h2>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '128px', height: '128px', borderRadius: '50%', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', fontWeight: 700, color: c.accent, overflow: 'hidden', border: `4px solid ${c.border}` }}>
                  {photoUrl ? <img src={photoUrl} alt={firstName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : firstName.charAt(0).toUpperCase() || '?'}
                </div>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ ...btnStyle, padding: '8px 24px', background: c.bg, color: c.text, border: `1px solid ${c.border}`, opacity: uploading ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {uploading ? 'Upload...' : '📷 Changer ma photo'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                <p style={{ fontSize: '12px', color: c.textMuted, textAlign: 'center' }}>Visible par les clients lors de la reservation.</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} style={{ ...cardStyle, marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: c.text, margin: 0 }}>Mes informations</h2>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Prenom *</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Telephone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Specialites (separees par des virgules)</label>
                <input type="text" value={specialities} onChange={(e) => setSpecialities(e.target.value)} style={inputStyle} />
              </div>
              <button type="submit" disabled={saving || !firstName.trim()} style={{ ...btnStyle, width: '100%', padding: '16px', background: c.button, color: c.buttonText, opacity: (saving || !firstName.trim()) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '16px' }}>
                {saving ? 'Enregistrement...' : '💾 Enregistrer mes modifications'}
              </button>
            </form>
          </>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button onClick={() => router.push(`/${slug}`)} style={{ color: c.textMuted, background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' }}>&larr; Retour a l'accueil du salon</button>
        </div>
      </div>

      {/* Modale de Transfert */}
      {transferModalOpen && selectedApptForTransfer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: c.text, marginBottom: '8px', margin: '0 0 8px 0' }}>Transferer le RDV</h3>
            <p style={{ fontSize: '14px', color: c.textMuted, marginBottom: '20px' }}>
              Client : {selectedApptForTransfer.client_name || 'N/A'}<br/>
              Date : {new Date(selectedApptForTransfer.start_time).toLocaleString('fr-FR')}
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Choisir un collegue</label>
              <select 
                value={transferTargetId} 
                onChange={(e) => setTransferTargetId(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">-- Selectionner un employe --</option>
                {otherEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.first_name}</option>
                ))}
              </select>
              <p style={{ fontSize: '12px', color: c.textMuted, marginTop: '8px' }}>Le RDV repassera en "En attente" pour que votre collegue puisse le confirmer.</p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setTransferModalOpen(false); setSelectedApptForTransfer(null); setTransferTargetId('') }} style={{ ...btnStyle, flex: 1, padding: '12px', background: c.bg, color: c.textMuted, border: `1px solid ${c.border}` }}>Annuler</button>
              <button onClick={handleTransferAppt} disabled={transferLoading || !transferTargetId} style={{ ...btnStyle, flex: 1, padding: '12px', background: '#2563eb', color: '#ffffff', opacity: (transferLoading || !transferTargetId) ? 0.5 : 1 }}>
                {transferLoading ? 'Transfert...' : 'Confirmer le transfert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Exception */}
      {showExceptionModal && selectedDate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '24px', maxWidth: '448px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: c.text, marginBottom: '16px', margin: '0 0 16px 0' }}>Exception pour le {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Statut</label>
                <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${c.border}` }}>
                  <button type="button" onClick={() => setExceptionData({ ...exceptionData, is_open: true })} style={{ flex: 1, padding: '8px 16px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', background: exceptionData.is_open ? '#16a34a' : c.bg, color: exceptionData.is_open ? '#ffffff' : c.textMuted }}>Travaille</button>
                  <button type="button" onClick={() => setExceptionData({ ...exceptionData, is_open: false })} style={{ flex: 1, padding: '8px 16px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', background: !exceptionData.is_open ? '#dc2626' : c.bg, color: !exceptionData.is_open ? '#ffffff' : c.textMuted }}>Repos</button>
                </div>
              </div>
              {exceptionData.is_open && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={{ display: 'block', fontSize: '12px', color: c.textMuted, marginBottom: '4px' }}>Debut</label><input type="time" value={exceptionData.open || '09:00'} onChange={(e) => setExceptionData({ ...exceptionData, open: e.target.value })} style={smallInputStyle} /></div>
                  <div><label style={{ display: 'block', fontSize: '12px', color: c.textMuted, marginBottom: '4px' }}>Fin</label><input type="time" value={exceptionData.close || '18:00'} onChange={(e) => setExceptionData({ ...exceptionData, close: e.target.value })} style={smallInputStyle} /></div>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Raison (optionnel)</label>
                <input type="text" value={exceptionData.reason || ''} onChange={(e) => setExceptionData({ ...exceptionData, reason: e.target.value })} style={smallInputStyle} placeholder="Ex: Vacances, Formation..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              {exceptions[selectedDate] && <button type="button" onClick={handleExceptionDelete} style={{ ...btnStyle, padding: '8px 16px', background: withAlpha('#dc2626', 0.15), color: '#dc2626', border: `1px solid ${withAlpha('#dc2626', 0.4)}`, fontSize: '14px' }}>Supprimer</button>}
              <button type="button" onClick={() => setShowExceptionModal(false)} style={{ ...btnStyle, flex: 1, padding: '8px 16px', background: c.bg, color: c.textMuted, border: `1px solid ${c.border}`, fontSize: '14px' }}>Annuler</button>
              <button type="button" onClick={handleExceptionSave} style={{ ...btnStyle, flex: 1, padding: '8px 16px', background: c.button, color: c.buttonText, fontSize: '14px' }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}