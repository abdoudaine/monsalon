// src/app/admin/salons/create/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type ThemeOption = 'luxe' | 'urban' | 'classique' | 'dark' | 'rose_gold' | 'vibrant'

interface ManagerOption {
  id: string
  full_name: string
  email?: string
}

const THEMES: { value: ThemeOption; label: string; desc: string; colors: string }[] = [
  { value: 'luxe', label: 'Luxe', desc: 'Noir profond & Or', colors: 'bg-black border-amber-500' },
  { value: 'urban', label: 'Urban', desc: 'Béton & Néon', colors: 'bg-gray-800 border-cyan-500' },
  { value: 'classique', label: 'Classique', desc: 'Blanc & Bois', colors: 'bg-stone-100 border-amber-700' },
  { value: 'dark', label: 'Dark', desc: 'Gris anthracite', colors: 'bg-gray-950 border-gray-700' },
  { value: 'rose_gold', label: 'Rose Gold', desc: 'Doux & Féminin', colors: 'bg-pink-50 border-pink-400' },
  { value: 'vibrant', label: 'Vibrant', desc: 'Couleurs vives', colors: 'bg-purple-900 border-yellow-400' },
]

export default function CreateSalonPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [theme, setTheme] = useState<ThemeOption>('luxe')
  const [managerId, setManagerId] = useState('')
  const [managers, setManagers] = useState<ManagerOption[]>([])
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Charger la liste des managers disponibles
  useEffect(() => {
    const fetchManagers = async () => {
      // On récupère les profils qui sont managers ou super_admin
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['manager', 'super_admin'])
        .order('full_name')

      if (!error && data) {
        setManagers(data)
      }
    }
    fetchManagers()
  }, [supabase])

  // Génération automatique du slug
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setName(val)
    // Slugify basique : minuscules, espaces -> tirets, suppression des caractères spéciaux
    const generatedSlug = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    setSlug(generatedSlug)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!name || !slug) {
      setError('Le nom et le slug sont obligatoires.')
      setLoading(false)
      return
    }

    try {
      const { data, error: insertError } = await supabase
        .from('salons')
        .insert({
          name,
          slug,
          theme,
          manager_id: managerId || null,
          settings: {
            opening_hours: {
              monday: { open: '09:00', close: '18:00', is_open: true },
              tuesday: { open: '09:00', close: '18:00', is_open: true },
              wednesday: { open: '09:00', close: '18:00', is_open: true },
              thursday: { open: '09:00', close: '18:00', is_open: true },
              friday: { open: '09:00', close: '18:00', is_open: true },
              saturday: { open: '10:00', close: '17:00', is_open: true },
              sunday: { open: '', close: '', is_open: false },
            },
          },
          is_closed: false,
        })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') { // Unique violation
          throw new Error('Ce slug est déjà utilisé. Veuillez en choisir un autre.')
        }
        throw insertError
      }

      setSuccess(true)
      setTimeout(() => {
        router.push(`/admin/salons`) // Ou vers le dashboard du salon créé
      }, 2000)

    } catch (err: any) {
      console.error('Erreur création salon:', err)
      setError(err.message || 'Une erreur est survenue lors de la création.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="bg-neutral-900 border border-amber-500/30 rounded-2xl p-8 text-center max-w-md w-full shadow-2xl shadow-amber-900/10">
          <div className="text-5xl mb-4">👑</div>
          <h2 className="text-2xl font-bold text-amber-400 mb-2 tracking-wide">SALON CRÉÉ</h2>
          <p className="text-gray-400 mb-6">Le salon <strong className="text-white">{name}</strong> est maintenant actif.</p>
          <div className="animate-pulse text-amber-500 text-sm">Redirection en cours...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-gray-200 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        {/* Header Style Gentlemen */}
        <div className="mb-10 border-b border-amber-900/30 pb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
            Nouveau <span className="text-amber-500">Salon</span>
          </h1>
          <p className="text-gray-500">Configurer l'identité et la structure du nouvel établissement.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Identité */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 md:p-8 space-y-6">
            <h2 className="text-lg font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
              Identité
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Nom du salon *</label>
                <input
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                  placeholder="Ex: Le Gentlemen Barber"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Slug (URL) *</label>
                <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition">
                  <span className="px-4 py-3 text-gray-600 text-sm border-r border-neutral-800 bg-neutral-900">monsalon.fr/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="flex-1 bg-transparent px-4 py-3 text-amber-400 focus:outline-none"
                    placeholder="le-gentlemen-barber"
                    required
                  />
                </div>
                <p className="text-xs text-gray-600">Identifiant unique dans l'URL. Minuscules et tirets uniquement.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Manager assigné (Optionnel)</label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition appearance-none"
              >
                <option value="">-- Aucun (à assigner plus tard) --</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || 'Utilisateur sans nom'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Thème Visuel */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 md:p-8 space-y-6">
            <h2 className="text-lg font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
              Thème Visuel
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTheme(t.value)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                    theme === t.value
                      ? 'border-amber-500 bg-neutral-800 shadow-lg shadow-amber-900/20'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                  }`}
                >
                  <div className={`w-full h-16 rounded-lg mb-3 ${t.colors} border`}></div>
                  <div className="font-bold text-white">{t.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{t.desc}</div>
                  {theme === t.value && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-black text-xs font-bold">
                      ✓
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Erreurs et Actions */}
          {error && (
            <div className="bg-red-950/30 border border-red-900/50 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-neutral-800 transition font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl shadow-lg shadow-amber-900/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Création...
                </>
              ) : (
                'Créer le salon'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}