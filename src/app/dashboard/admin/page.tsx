'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Salon {
  id: string
  name: string
  slug: string
  theme: string
  created_at: string
}

export default function AdminDashboardPage() {
  const [salons, setSalons] = useState<Salon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newSalonName, setNewSalonName] = useState('')
  const [newTheme, setNewTheme] = useState('urban')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadSalons()
  }, [])

  const loadSalons = async () => {
    try {
      const { data, error } = await supabase
        .from('salons')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setSalons(data || [])
    } catch (err: any) {
      console.error('Erreur chargement salons:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSalon = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    setSuccess('')

    try {
      const slug = newSalonName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const { error: salonError } = await supabase.from('salons').insert({ name: newSalonName, slug, theme: newTheme })
      if (salonError) throw salonError

      setSuccess(`✅ Salon "${newSalonName}" créé avec succès !`)
      setNewSalonName('')
      setNewTheme('urban')
      setShowForm(false)
      loadSalons()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création')
    } finally {
      setCreating(false)
    }
  }

  const themes = [
    { value: 'luxe', label: '👑 Luxe', desc: 'Noir & Or', color: 'from-gray-900 to-black', border: 'border-gentlemen-gold' },
    { value: 'urban', label: '⚡ Urban', desc: 'Noir & Blanc', color: 'from-gray-900 to-gray-800', border: 'border-white' },
    { value: 'classique', label: '🪒 Classique', desc: 'Beige & Vert', color: 'from-green-900 to-green-800', border: 'border-amber-200' },
    { value: 'dark', label: '🌑 Dark', desc: 'Gris & Photos', color: 'from-gray-800 to-gray-900', border: 'border-gray-400' },
    { value: 'rose_gold', label: '🌸 Rose Gold', desc: 'Nude & Rose', color: 'from-pink-900 to-pink-800', border: 'border-pink-400' },
    { value: 'vibrant', label: '🎨 Vibrant', desc: 'Violet & Corail', color: 'from-purple-900 to-purple-800', border: 'border-purple-400' },
  ]

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 border-b border-gentlemen-gold/20 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-gentlemen-text">
            Administration <span className="text-gentlemen-gold">Premium</span>
          </h1>
          <p className="text-gentlemen-muted mt-2 text-sm sm:text-base">
            Gérez votre plateforme et vos salons partenaires avec élégance.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-3 bg-gradient-to-r from-gentlemen-gold to-gentlemen-goldLight text-gentlemen-bg font-bold rounded-xl shadow-gold-glow hover:shadow-gold-glow-hover transition-all duration-300 active:scale-95 flex items-center justify-center space-x-2 w-full sm:w-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>{showForm ? 'Annuler' : 'Nouveau Salon'}</span>
        </button>
      </div>

      {/* Stats rapides (Style Gentlemen) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Salons', value: salons.length, color: 'text-gentlemen-goldLight' },
          { label: 'Ce mois', value: salons.filter(s => new Date(s.created_at).getMonth() === new Date().getMonth()).length, color: 'text-gentlemen-gold' },
          { label: 'Revenus', value: '0,00 €', color: 'text-green-400' },
          { label: 'Utilisateurs', value: '1', color: 'text-blue-400' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-gentlemen-card rounded-xl p-5 border border-gentlemen-gold/10 hover:border-gentlemen-gold/30 transition-all duration-300 hover:shadow-gold-glow group">
            <div className="text-gentlemen-muted text-xs uppercase tracking-wider font-semibold">{stat.label}</div>
            <div className={`text-2xl sm:text-3xl font-display font-bold mt-2 ${stat.color} group-hover:scale-105 transition-transform origin-left`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Formulaire de création */}
      {showForm && (
        <div className="bg-gentlemen-card rounded-2xl p-6 sm:p-8 border border-gentlemen-gold/30 shadow-gold-glow">
          <h2 className="text-xl font-display font-bold text-gentlemen-text mb-6 flex items-center">
            <span className="w-1 h-6 bg-gentlemen-gold rounded-full mr-3"></span>
            Créer un nouveau salon
          </h2>
          <form onSubmit={handleCreateSalon} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gentlemen-muted mb-2">Nom du salon *</label>
              <input
                type="text"
                value={newSalonName}
                onChange={(e) => setNewSalonName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gentlemen-bg border border-gentlemen-gold/20 rounded-xl text-gentlemen-text placeholder-gentlemen-muted focus:outline-none focus:ring-2 focus:ring-gentlemen-gold/50 focus:border-gentlemen-gold transition-all"
                placeholder="Ex: Le Barbier de Paris"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gentlemen-muted mb-3">Thème visuel par défaut *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {themes.map((theme) => (
                  <button
                    key={theme.value}
                    type="button"
                    onClick={() => setNewTheme(theme.value)}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                      newTheme === theme.value
                        ? `${theme.border} ring-2 ring-gentlemen-gold/50 bg-gentlemen-bg scale-[1.02]`
                        : 'border-gentlemen-gold/10 hover:border-gentlemen-gold/30 bg-gentlemen-bg/50'
                    } bg-gradient-to-br ${theme.color}`}
                  >
                    <div className="text-gentlemen-text font-semibold text-sm">{theme.label}</div>
                    <div className="text-gentlemen-muted text-xs mt-1">{theme.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="bg-red-900/20 border border-red-800 text-red-300 px-4 py-3 rounded-xl text-sm">{error}</div>}
            {success && <div className="bg-green-900/20 border border-green-800 text-green-300 px-4 py-3 rounded-xl text-sm">{success}</div>}

            <button
              type="submit"
              disabled={creating}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-gentlemen-gold to-gentlemen-goldLight text-gentlemen-bg font-bold rounded-xl shadow-gold-glow hover:shadow-gold-glow-hover transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Création en cours...' : 'Valider la création'}
            </button>
          </form>
        </div>
      )}

      {/* Liste des salons */}
      <div className="bg-gentlemen-card rounded-2xl border border-gentlemen-gold/10 overflow-hidden">
        <div className="p-6 border-b border-gentlemen-gold/10 flex justify-between items-center">
          <h2 className="text-xl font-display font-bold text-gentlemen-text">Salons enregistrés</h2>
          <span className="px-3 py-1 bg-gentlemen-gold/10 text-gentlemen-gold rounded-full text-xs font-semibold">{salons.length}</span>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-4 border-gentlemen-gold border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gentlemen-muted mt-4 text-sm">Chargement des données...</p>
          </div>
        ) : salons.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto bg-gentlemen-bg rounded-full flex items-center justify-center mb-4 border border-gentlemen-gold/20">
              <svg className="w-8 h-8 text-gentlemen-gold/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-gentlemen-text font-medium">Aucun salon pour le moment</p>
            <p className="text-gentlemen-muted text-sm mt-1">Commencez par créer votre premier établissement.</p>
          </div>
        ) : (
          <div className="divide-y divide-gentlemen-gold/10">
            {salons.map((salon) => (
              <div key={salon.id} className="p-4 sm:p-6 hover:bg-gentlemen-bg/50 transition-colors group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-gentlemen-text font-semibold text-lg group-hover:text-gentlemen-goldLight transition-colors">{salon.name}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gentlemen-bg border border-gentlemen-gold/20 text-gentlemen-muted text-xs font-mono">
                      {salon.slug}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gentlemen-gold/10 text-gentlemen-gold text-xs font-medium capitalize">
                      {salon.theme}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push(`/${salon.slug}`)}
                    className="px-5 py-2.5 bg-gentlemen-bg border border-gentlemen-gold/30 text-gentlemen-gold hover:bg-gentlemen-gold hover:text-gentlemen-bg rounded-lg text-sm font-medium transition-all duration-200"
                  >
                    Voir la page
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}