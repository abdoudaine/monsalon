'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getThemeStyles, type SalonTheme } from '@/lib/themes'

// Types basés sur le schéma (price_display ajouté pour le calcul du CA)
interface Service {
  name: string
  duration_minutes: number
  price_display?: number
}

interface ClientData {
  full_name: string | null
  phone: string | null
}

interface Appointment {
  id: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  payment_status: 'pending' | 'succeeded' | 'failed'
  services: Service | null
  clients: ClientData | null
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'

const STATUS_CONFIG = {
  pending: { label: 'En attente', bg: 'rgba(234, 179, 8, 0.1)', text: '#eab308', border: 'rgba(234, 179, 8, 0.3)' },
  confirmed: { label: 'Confirmé', bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
  completed: { label: 'Terminé', bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
  cancelled: { label: 'Annulé', bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
}

// --- Helpers de date pour les stats ---
const isToday = (dateString: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 1)
  const d = new Date(dateString)
  return d >= today && d < dayAfter
}

const isTomorrow = (dateString: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 2)
  const d = new Date(dateString)
  return d >= tomorrow && d < dayAfter
}

const isThisWeek = (dateString: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 7)
  const d = new Date(dateString)
  return d >= today && d < dayAfter
}

function withAlpha(hex: string, a: number): string {
  if (!hex) return `rgba(0,0,0,${a})`
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function ManagerDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.salonSlug as string
  const supabase = createClient()

  const [salonId, setSalonId] = useState<string | null>(null)
  const [salonName, setSalonName] = useState<string>('')
  const [colors, setColors] = useState<any>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [stats, setStats] = useState({ today: 0, tomorrow: 0, pending: 0, revenueWeek: 0 })

  const c = colors || { bg: '#ffffff', bgCard: '#fafafa', text: '#000000', textMuted: '#525252', accent: '#000000', border: '#e5e5e5', button: '#000000', buttonText: '#ffffff' }

  useEffect(() => {
    const getSalon = async () => {
      const { data, error } = await supabase.from('salons').select('id, name, theme').eq('slug', slug).single()
      if (error || !data) {
        setError('Salon introuvable. Vérifiez l\'URL.')
        setLoading(false)
        return
      }
      setSalonId(data.id)
      setSalonName(data.name)
      setColors(getThemeStyles((data.theme as SalonTheme) || 'luxe'))
    }
    getSalon()
  }, [slug, supabase])

  useEffect(() => {
    if (!salonId) return

    const fetchAppointments = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, start_time, end_time, status, payment_status, client_id,
          services (name, duration_minutes, price_display),
          clients!client_id (full_name, phone)
        `)
        .eq('salon_id', salonId)
        .order('start_time', { ascending: false })

      if (error) {
        console.error('Erreur chargement RDV:', error)
        setError('Erreur lors du chargement des données.')
      } else if (data) {
        const typedData = data.map(item => ({
          ...item,
          services: item.services as unknown as Service | null,
          clients: item.clients as unknown as ClientData | null,
        })) as Appointment[]
        setAppointments(typedData)

        let todayCount = 0, tomorrowCount = 0, pendingCount = 0, revenueWeek = 0
        typedData.forEach(appt => {
          if (appt.status === 'cancelled') return
          if (isToday(appt.start_time)) todayCount++
          if (isTomorrow(appt.start_time)) tomorrowCount++
          if (appt.status === 'pending') pendingCount++
          if (isThisWeek(appt.start_time)) revenueWeek += (appt.services?.price_display || 0)
        })
        setStats({ today: todayCount, tomorrow: tomorrowCount, pending: pendingCount, revenueWeek })
      }
      setLoading(false)
    }

    fetchAppointments()
  }, [salonId, supabase])

  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredAppointments(appointments)
    } else {
      setFilteredAppointments(appointments.filter(a => a.status === activeFilter))
    }
  }, [activeFilter, appointments])

  const handleStatusChange = async (appointmentId: string, newStatus: Appointment['status']) => {
    if (!salonId || updatingId === appointmentId) return
    setUpdatingId(appointmentId)
    
    const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', appointmentId).eq('salon_id', salonId)

    if (!error) {
      setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a))
    } else {
      console.error('Erreur mise à jour:', error)
      alert('Erreur lors de la mise à jour du statut.')
    }
    setUpdatingId(null)
  }

  // --- NOUVEAU : Fonction de déconnexion ---
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push(`/${slug}/dashboard/login`)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: c.accent }}>
          <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span style={{ fontWeight: 500, letterSpacing: '0.05em' }}>Chargement du tableau de bord...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#ef4444', fontSize: '20px', marginBottom: '16px' }}>{error}</p>
          <Link href={`/${slug}`} style={{ color: c.accent, textDecoration: 'underline' }}>Retour à l'accueil</Link>
        </div>
      </div>
    )
  }

  const shortcuts = [
    { title: 'Mon Équipe', desc: 'Gérer les coiffeurs et leurs horaires', icon: '👥', href: `/${slug}/dashboard/employees` },
    { title: 'Mes Tarifs', desc: 'Modifier les prestations et les prix', icon: '✂️', href: `/${slug}/dashboard/services` },
    { title: 'Mon Apparence', desc: 'Choisir le thème visuel de la vitrine', icon: '🎨', href: `/${slug}/dashboard/theme` },
    { title: 'Planning', desc: 'Vue calendrier jour et semaine', icon: '📅', href: `/${slug}/dashboard/planning` },
    { title: 'Galerie Photos', desc: 'Ajouter ou remplacer des images', icon: '📸', href: `/${slug}/dashboard/photos` },
    { title: 'QR Code', desc: 'Télécharger le QR pour le salon', icon: '🔳', href: `/${slug}/dashboard/qrcode` },
  ]

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, padding: '16px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header modifié pour inclure le bouton de déconnexion à droite */}
        <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <Link href={`/${slug}`} style={{ color: c.textMuted, textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '8px' }}
              onMouseEnter={e => (e.currentTarget.style.color = c.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = c.textMuted)}
            >
              ← Retour à la vitrine
            </Link>
            <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '8px' }}>
              Tableau de Bord : <span style={{ color: c.accent }}>{salonName}</span>
            </h1>
            <p style={{ color: c.textMuted }}>Vue d'ensemble et gestion de votre salon.</p>
          </div>
          
          {/* NOUVEAU : Bouton de déconnexion */}
          <button 
            onClick={handleLogout}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              border: `1px solid ${withAlpha('#ef4444', 0.3)}`,
              background: withAlpha('#ef4444', 0.1),
              color: '#ef4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = withAlpha('#ef4444', 0.2) }}
            onMouseLeave={e => { e.currentTarget.style.background = withAlpha('#ef4444', 0.1) }}
          >
            🚪 Se déconnecter
          </button>
        </div>

        {/* 1. SECTION STATS (4 Cartes) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Aujourd\'hui', value: stats.today, icon: '📅', color: c.text },
            { label: 'Demain', value: stats.tomorrow, icon: '⏰', color: c.accent },
            { label: 'En attente', value: stats.pending, icon: '⏳', color: '#eab308' },
            { label: 'CA Prévisionnel (Semaine)', value: `${stats.revenueWeek} €`, icon: '💰', color: '#22c55e' },
          ].map((stat, i) => (
            <div key={i} style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: withAlpha(stat.color, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                {stat.icon}
              </div>
              <div>
                <p style={{ fontSize: '14px', color: c.textMuted, margin: '0 0 4px 0' }}>{stat.label}</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: stat.color, margin: 0 }}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 2. SECTION RACCOURCIS PRO (Grille de 6) */}
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: c.text }}>Gestion rapide</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '40px' }}>
          {shortcuts.map((item, i) => (
            <Link key={i} href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div 
                style={{ 
                  background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '24px', 
                  display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s', cursor: 'pointer'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 10px 20px -5px ${withAlpha(c.accent, 0.15)}` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: withAlpha(c.accent, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: c.text, margin: '0 0 4px 0' }}>{item.title}</h3>
                  <p style={{ fontSize: '13px', color: c.textMuted, margin: 0 }}>{item.desc}</p>
                </div>
                <div style={{ color: c.textMuted, fontSize: '20px' }}>›</div>
              </div>
            </Link>
          ))}
        </div>

        {/* 3. LISTE DES RDV */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: c.text, margin: 0 }}>Rendez-vous récents</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as StatusFilter[]).map((filter) => {
              const isActive = activeFilter === filter
              const count = filter === 'all' ? appointments.length : appointments.filter(a => a.status === filter).length
              const label = filter === 'all' ? 'Tous' : STATUS_CONFIG[filter].label
              return (
                <button key={filter} onClick={() => setActiveFilter(filter)} style={{
                  padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: isActive ? c.button : c.bgCard, color: isActive ? c.buttonText : c.textMuted,
                  border: `1px solid ${isActive ? c.button : c.border}`
                }}>
                  {label} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {filteredAppointments.length === 0 ? (
          <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: c.text, marginBottom: '8px' }}>Aucun rendez-vous</h3>
            <p style={{ color: c.textMuted }}>{activeFilter !== 'all' ? 'Aucun RDV ne correspond à ce filtre.' : 'Votre agenda est vide pour le moment.'}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {filteredAppointments.map((appt) => {
              const isUpdating = updatingId === appt.id
              const clientName = appt.clients?.full_name || 'Client anonyme'
              const clientPhone = appt.clients?.phone || 'N/A'
              const statusCfg = STATUS_CONFIG[appt.status]
              const isApptTomorrow = isTomorrow(appt.start_time) && appt.status !== 'cancelled' && appt.status !== 'completed'
              
              return (
                <div key={appt.id} style={{ 
                  background: c.bgCard, 
                  border: `1px solid ${isApptTomorrow ? c.accent : c.border}`, 
                  borderRadius: '12px', 
                  padding: '20px', 
                  transition: 'border-color 0.2s',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}
                onMouseEnter={e => { if (!isApptTomorrow) e.currentTarget.style.borderColor = c.accent }}
                onMouseLeave={e => { if (!isApptTomorrow) e.currentTarget.style.borderColor = c.border }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: c.text, margin: 0 }}>{clientName}</h3>
                        
                        {isApptTomorrow && (
                          <span style={{ 
                            padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, 
                            border: `1px solid ${withAlpha(c.accent, 0.4)}`, background: withAlpha(c.accent, 0.15), color: c.accent,
                            display: 'flex', alignItems: 'center', gap: '4px'
                          }}>
                            📞 À rappeler demain
                          </span>
                        )}

                        <span style={{ 
                          padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, 
                          border: `1px solid ${statusCfg.border}`, background: statusCfg.bg, color: statusCfg.text
                        }}>
                          {statusCfg.label}
                        </span>
                        {appt.payment_status === 'succeeded' && (
                          <span style={{ 
                            padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, 
                            border: '1px solid rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e'
                          }}>
                            PAYÉ
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px', color: c.textMuted }}>
                        <span>📅 {formatDate(appt.start_time)}</span>
                        <span>✂️ {appt.services?.name || 'Service inconnu'} ({appt.services?.duration_minutes || '?'} min)</span>
                        <span>📞 {clientPhone}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {appt.status === 'pending' && (
                        <button onClick={() => handleStatusChange(appt.id, 'confirmed')} disabled={isUpdating} style={{
                          padding: '8px 16px', background: '#2563eb', color: '#ffffff', fontSize: '14px', fontWeight: 700,
                          borderRadius: '8px', border: 'none', cursor: isUpdating ? 'not-allowed' : 'pointer', opacity: isUpdating ? 0.5 : 1
                        }}>
                          {isUpdating ? '...' : 'Confirmer'}
                        </button>
                      )}
                      {appt.status === 'confirmed' && (
                        <button onClick={() => handleStatusChange(appt.id, 'completed')} disabled={isUpdating} style={{
                          padding: '8px 16px', background: '#16a34a', color: '#ffffff', fontSize: '14px', fontWeight: 700,
                          borderRadius: '8px', border: 'none', cursor: isUpdating ? 'not-allowed' : 'pointer', opacity: isUpdating ? 0.5 : 1
                        }}>
                          {isUpdating ? '...' : 'Terminer'}
                        </button>
                      )}
                      {(appt.status === 'pending' || appt.status === 'confirmed') && (
                        <button onClick={() => handleStatusChange(appt.id, 'cancelled')} disabled={isUpdating} style={{
                          padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '14px', fontWeight: 700,
                          borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', cursor: isUpdating ? 'not-allowed' : 'pointer', opacity: isUpdating ? 0.5 : 1
                        }}>
                          {isUpdating ? '...' : 'Annuler'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}