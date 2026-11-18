'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getThemeStyles, type SalonTheme } from '@/lib/themes'

export default function DashboardLoginPage() {
  const params = useParams()
  const slug = params.salonSlug as string
  const router = useRouter()
  const supabase = createClient()

  const [colors, setColors] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadTheme = async () => {
      const { data } = await supabase.from('salons').select('theme').eq('slug', slug).single()
      if (data) {
        setColors(getThemeStyles((data.theme as SalonTheme) || 'luxe'))
      } else {
        // Fallback par défaut
        setColors({ bg: '#ffffff', bgCard: '#fafafa', text: '#000000', textMuted: '#525252', accent: '#000000', border: '#e5e5e5', button: '#000000', buttonText: '#ffffff' })
      }
    }
    loadTheme()
  }, [slug, supabase])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
    } else {
      // Redirection vers le dashboard une fois connecté
      router.push(`/${slug}/dashboard`)
    }
  }

  if (!colors) return null // Évite le flash blanc pendant le chargement du thème

  const inputStyle: React.CSSProperties = { 
    width: '100%', padding: '12px', background: colors.bg, border: `1px solid ${colors.border}`, 
    borderRadius: '12px', color: colors.text, fontSize: '16px', outline: 'none', boxSizing: 'border-box' 
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        
        {/* En-tête de la carte */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href={`/${slug}`} style={{ color: colors.textMuted, textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '16px' }}>
            &larr; Retour à la vitrine
          </Link>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: colors.text, margin: '0 0 8px 0' }}>Espace Gérant</h1>
          <p style={{ fontSize: '15px', color: colors.textMuted, margin: 0 }}>Connectez-vous pour gérer votre salon.</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleLogin} style={{ background: colors.bgCard, padding: '32px', borderRadius: '20px', border: `1px solid ${colors.border}`, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}>
          
          {error && (
            <div style={{ marginBottom: '20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '12px', borderRadius: '12px', fontSize: '14px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '8px' }}>Adresse email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              style={inputStyle} 
              placeholder="gerant@salon.com" 
              required 
              autoFocus 
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '8px' }}>Mot de passe</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={inputStyle} 
              placeholder="••••••••" 
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !email || !password}
            style={{ 
              width: '100%', padding: '14px', background: colors.button, color: colors.buttonText, 
              fontWeight: 700, fontSize: '16px', borderRadius: '12px', border: 'none', 
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>

        </form>

        <p style={{ textAlign: 'center', fontSize: '13px', color: colors.textMuted, marginTop: '24px' }}>
          Accès réservé aux administrateurs du salon.
        </p>
      </div>
    </div>
  )
}