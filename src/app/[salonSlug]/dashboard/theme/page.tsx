'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { THEMES, THEME_STYLES, type SalonTheme } from '@/lib/themes'

export default function ManagerThemePage() {
  const params = useParams()
  const slug = params.salonSlug as string
  const supabase = createClient()

  const [salon, setSalon] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [savingTheme, setSavingTheme] = useState<SalonTheme | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    const loadSalon = async () => {
      setLoading(true)
      const { data, error } = await supabase.from('salons').select('*').eq('slug', slug).single()
      if (error || !data) setError('Salon introuvable.')
      else setSalon(data)
      setLoading(false)
    }
    loadSalon()
  }, [slug, supabase])

  const handleThemeChange = async (newTheme: SalonTheme) => {
    if (!salon || savingTheme) return
    setSavingTheme(newTheme)
    setError('')
    setSuccessMsg('')

    const { error } = await supabase.from('salons').update({ theme: newTheme }).eq('id', salon.id)

    if (error) {
      console.error('Erreur mise à jour thème:', error)
      setError('Impossible de changer le thème.')
    } else {
      setSalon((prev: any) => ({ ...prev, theme: newTheme }))
      setSuccessMsg(`Thème "${THEMES[newTheme].name}" activé !`)
      setTimeout(() => setSuccessMsg(''), 4000)
    }
    setSavingTheme(null)
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>Chargement...</div>
  if (error && !salon) return <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>{error}</div>

  const currentThemeKey = (salon?.theme as SalonTheme) || 'luxe'

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5', padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid #451a03' }}>
          <div>
            <Link href={`/${slug}/dashboard`} style={{ color: '#737373', fontSize: '14px', textDecoration: 'none', display: 'block', marginBottom: '8px' }}>← Retour au tableau de bord</Link>
            <h1 style={{ fontSize: '30px', fontWeight: 700, color: '#ffffff' }}>Apparence & <span style={{ color: '#f59e0b' }}>Thème</span></h1>
            <p style={{ color: '#737373', marginTop: '4px' }}>Personnalisez l'identité visuelle de votre vitrine.</p>
          </div>
          <Link href={`/${slug}`} target="_blank" style={{ padding: '12px 24px', background: '#262626', color: '#ffffff', fontWeight: 700, borderRadius: '12px', textDecoration: 'none', border: '1px solid #404040' }}>👁️ Voir la vitrine</Link>
        </div>

        {successMsg && <div style={{ marginBottom: '24px', background: 'rgba(20, 83, 45, 0.2)', border: '1px solid #14532d', color: '#86efac', padding: '12px 16px', borderRadius: '12px', fontSize: '14px' }}>✅ {successMsg}</div>}
        {error && <div style={{ marginBottom: '24px', background: 'rgba(127, 29, 29, 0.2)', border: '1px solid #7f1d1d', color: '#fca5a5', padding: '12px 16px', borderRadius: '12px', fontSize: '14px' }}>⚠️ {error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {(Object.keys(THEMES) as SalonTheme[]).map((themeKey) => {
            const theme = THEMES[themeKey]
            const colors = THEME_STYLES[themeKey]
            const isActive = currentThemeKey === themeKey
            const isSaving = savingTheme === themeKey

            return (
              <div key={themeKey} style={{ position: 'relative', borderRadius: '16px', border: `2px solid ${isActive ? '#f59e0b' : '#262626'}`, overflow: 'hidden', transition: 'all 0.3s' }}>
                {isActive && <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, padding: '4px 12px', background: '#f59e0b', color: '#000000', fontSize: '12px', fontWeight: 700, borderRadius: '9999px' }}>✓ Actif</div>}

                <div style={{ background: colors.bg, padding: '20px' }}>
                  <div style={{ background: colors.card, borderRadius: '12px', padding: '24px', marginBottom: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
                    <span style={{ color: colors.accent, fontSize: '18px', fontWeight: 700 }}>{theme.name}</span>
                    <span style={{ color: colors.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>Aperçu Hero</span>
                  </div>
                  <button style={{ width: '100%', padding: '10px', background: colors.button, color: colors.buttonText, borderRadius: '8px', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}>
                    Bouton d'action
                  </button>
                </div>

                <div style={{ padding: '20px', background: 'rgba(23, 23, 23, 0.5)' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>{theme.name}</h3>
                  <p style={{ fontSize: '14px', color: '#a3a3a3', marginBottom: '20px', minHeight: '40px' }}>{theme.description}</p>
                  <button
                    onClick={() => handleThemeChange(themeKey)}
                    disabled={isActive || isSaving}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '12px', fontWeight: 700, fontSize: '14px',
                      background: isActive ? '#262626' : '#f59e0b',
                      color: isActive ? '#737373' : '#000000',
                      border: 'none', cursor: isActive ? 'default' : 'pointer',
                      opacity: isSaving ? 0.5 : 1
                    }}
                  >
                    {isSaving ? 'Activation...' : isActive ? 'Thème actuel' : 'Appliquer ce thème'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '14px', color: '#737373' }}>
          <p>💡 Astuce : cliquez sur "Voir la vitrine" en haut à droite pour le rendu réel dans un nouvel onglet.</p>
        </div>
      </div>
    </div>
  )
}