'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getThemeStyles, type SalonTheme } from '@/lib/themes'

type ServiceCategory = 'adult' | 'child' | 'unisex'

interface Service {
  id: string
  name: string
  category?: ServiceCategory
  duration_minutes: number
  price_display: number
  salon_id: string
}

function withAlpha(hex: string, a: number): string {
  if (!hex) return `rgba(0,0,0,${a})`
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function ManagerServicesPage() {
  const params = useParams()
  const slug = params.salonSlug as string
  const supabase = createClient()

  const [salonId, setSalonId] = useState<string | null>(null)
  const [colors, setColors] = useState<any>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  
  // États du formulaire
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ServiceCategory>('unisex')
  const [duration, setDuration] = useState<string>('30')
  const [price, setPrice] = useState<string>('20')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const DEFAULT_C = { bg: '#09090b', bgCard: '#18181b', text: '#fafafa', textMuted: '#a1a1aa', accent: '#fbbf24', border: '#27272a', button: '#f59e0b', buttonText: '#000000' }
  const c = colors || DEFAULT_C

  // 1. Charger le salon
  useEffect(() => {
    const getSalon = async () => {
      const { data, error } = await supabase
        .from('salons')
        .select('id, theme')
        .eq('slug', slug)
        .single()
      
      if (data && !error) {
        setSalonId(data.id)
        setColors(getThemeStyles((data.theme as SalonTheme) || 'luxe'))
      }
    }
    getSalon()
  }, [slug, supabase])

  // 2. Charger les services
  useEffect(() => {
    if (!salonId) return

    const fetchServices = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('salon_id', salonId)
        .order('name')

      if (!error && data) {
        setServices(data as Service[])
      }
      setLoading(false)
    }

    fetchServices()
  }, [salonId, supabase])

  // 3. Reset du formulaire
  const resetForm = () => {
    setEditingId(null)
    setName('')
    setCategory('unisex')
    setDuration('30')
    setPrice('20')
    setShowForm(false)
    setError('')
    setSuccessMsg('')
  }

  // 4. Ouvrir le formulaire pour créer
  const handleCreate = () => {
    resetForm()
    setShowForm(true)
  }

  // 5. Ouvrir le formulaire pour modifier
  const handleEdit = (service: Service) => {
    setEditingId(service.id)
    setName(service.name)
    setCategory(service.category || 'unisex')
    setDuration(String(service.duration_minutes))
    setPrice(String(service.price_display))
    setShowForm(true)
    setError('')
    setSuccessMsg('')
  }

  // 6. Sauvegarder (créer ou modifier)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || !salonId) {
      setError('Le nom du service est obligatoire.')
      return
    }

    const parsedDuration = parseInt(duration, 10)
    const parsedPrice = parseFloat(price)

    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      setError('La durée doit être un nombre supérieur à 0.')
      return
    }
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Le prix doit être un nombre positif.')
      return
    }

    setSaving(true)
    setError('')
    setSuccessMsg('')

    const serviceData: any = {
      salon_id: salonId,
      name: name.trim(),
      duration_minutes: parsedDuration,
      price_display: parsedPrice,
      category: category,
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingId)
        if (error) throw error
        setSuccessMsg('Service modifié avec succès !')
      } else {
        const { error } = await supabase
          .from('services')
          .insert(serviceData)
        if (error) throw error
        setSuccessMsg('Service créé avec succès !')
      }

      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('salon_id', salonId)
        .order('name')

      if (data) setServices(data as Service[])
      
      setTimeout(() => {
        resetForm()
      }, 1500)

    } catch (err: any) {
      console.error('Erreur sauvegarde:', err)
      setError(err.message || 'Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  // 7. Supprimer
  const handleDelete = async (serviceId: string, serviceName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${serviceName}" ?\nCette action est irréversible.`)) return

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', serviceId)

    if (error) {
      setError('Erreur lors de la suppression : ' + error.message)
    } else {
      setServices(prev => prev.filter(s => s.id !== serviceId))
      setSuccessMsg('Service supprimé.')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '12px', color: c.text, fontSize: '16px', outline: 'none' }
  const btnStyle: React.CSSProperties = { borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.accent }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span style={{ fontWeight: 500, letterSpacing: '0.05em' }}>Chargement des services...</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, padding: '16px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px', paddingBottom: '24px', borderBottom: `1px solid ${c.border}` }}>
          <div>
            <Link href={`/${slug}/dashboard`} style={{ color: c.textMuted, textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '8px' }}>
              &larr; Retour au tableau de bord
            </Link>
            <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em', margin: 0 }}>
              Gestion des <span style={{ color: c.accent }}>Services</span>
            </h1>
            <p style={{ color: c.textMuted, marginTop: '4px', fontSize: '14px' }}>
              {services.length} prestation{services.length > 1 ? 's' : ''} configurée{services.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleCreate}
            style={{ ...btnStyle, padding: '12px 24px', background: c.button, color: c.buttonText, display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content', fontSize: '16px', fontWeight: 700 }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>+</span> Nouveau service
          </button>
        </div>

        {/* Messages de succès / erreur */}
        {successMsg && (
          <div style={{ marginBottom: '24px', background: withAlpha('#16a34a', 0.15), border: `1px solid ${withAlpha('#16a34a', 0.4)}`, color: '#16a34a', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✅</span> {successMsg}
          </div>
        )}
        {error && (
          <div style={{ marginBottom: '24px', background: withAlpha('#dc2626', 0.15), border: `1px solid ${withAlpha('#dc2626', 0.4)}`, color: '#dc2626', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Liste des services */}
        {services.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 16px', background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✂️</div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: c.text, marginBottom: '8px' }}>Aucun service</h3>
            <p style={{ color: c.textMuted, marginBottom: '24px' }}>Commencez par ajouter votre première prestation.</p>
            <button
              onClick={handleCreate}
              style={{ ...btnStyle, padding: '12px 24px', background: c.button, color: c.buttonText, fontSize: '16px', fontWeight: 700 }}
            >
              Ajouter un service
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {services.map((service) => (
              <div
                key={service.id}
                style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '24px', transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = c.accent)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = c.border)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, color: c.text, margin: 0 }}>
                    {service.name}
                  </h3>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: c.accent }}>
                    {service.price_display}€
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px', color: c.textMuted, marginBottom: '24px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {service.duration_minutes} min
                  </span>
                  {service.category && (
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '6px', 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      border: `1px solid ${service.category === 'adult' ? withAlpha('#3b82f6', 0.3) : service.category === 'child' ? withAlpha('#22c55e', 0.3) : withAlpha(c.textMuted, 0.3)}`,
                      background: service.category === 'adult' ? withAlpha('#3b82f6', 0.1) : service.category === 'child' ? withAlpha('#22c55e', 0.1) : withAlpha(c.textMuted, 0.1),
                      color: service.category === 'adult' ? '#3b82f6' : service.category === 'child' ? '#22c55e' : c.textMuted
                    }}>
                      {service.category === 'adult' ? '👤 Adulte' : service.category === 'child' ? '👶 Enfant' : '👥 Mixte'}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleEdit(service)}
                    style={{ ...btnStyle, flex: 1, padding: '8px', background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(service.id, service.name)}
                    style={{ ...btnStyle, padding: '8px 12px', background: withAlpha('#dc2626', 0.1), color: '#dc2626', border: `1px solid ${withAlpha('#dc2626', 0.3)}` }}
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Formulaire */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '24px', maxWidth: '448px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: c.text, marginBottom: '24px', margin: '0 0 24px 0' }}>
                {editingId ? 'Modifier le service' : 'Nouveau service'}
              </h2>

              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>
                    Nom du service *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                    placeholder="Ex: Coupe Homme, Brushing..."
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>
                    Catégorie
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {(['unisex', 'adult', 'child'] as ServiceCategory[]).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        style={{
                          padding: '12px',
                          borderRadius: '12px',
                          fontWeight: 500,
                          fontSize: '14px',
                          border: 'none',
                          cursor: 'pointer',
                          background: category === cat ? c.button : c.bg,
                          color: category === cat ? c.buttonText : c.textMuted
                        }}
                      >
                        {cat === 'adult' ? '👤 Adulte' : cat === 'child' ? '👶 Enfant' : '👥 Mixte'}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>
                      Durée (min) *
                    </label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      min={5}
                      max={240}
                      step={5}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>
                      Prix (€) *
                    </label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      min={0}
                      step={0.5}
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div style={{ background: withAlpha('#dc2626', 0.15), border: `1px solid ${withAlpha('#dc2626', 0.4)}`, color: '#dc2626', padding: '12px', borderRadius: '12px', fontSize: '14px' }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', paddingTop: '16px' }}>
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={saving}
                    style={{ ...btnStyle, flex: 1, padding: '12px', background: c.bg, color: c.textMuted, border: `1px solid ${c.border}`, opacity: saving ? 0.5 : 1 }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ ...btnStyle, flex: 1, padding: '12px', background: c.button, color: c.buttonText, opacity: saving ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        Enregistrement...
                      </>
                    ) : (
                      editingId ? 'Modifier' : 'Créer'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}