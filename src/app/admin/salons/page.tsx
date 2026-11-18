// src/app/admin/salons/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Définition des types basée sur le schéma SQL
interface ManagerProfile {
  full_name: string | null
}

interface Salon {
  id: string
  name: string
  slug: string
  theme: 'luxe' | 'urban' | 'classique' | 'dark' | 'rose_gold' | 'vibrant'
  is_closed: boolean
  created_at: string
  manager_id: string | null
  profiles?: ManagerProfile | null
}

const THEME_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  luxe: { bg: 'bg-amber-950/30', text: 'text-amber-400', border: 'border-amber-500/50' },
  urban: { bg: 'bg-cyan-950/30', text: 'text-cyan-400', border: 'border-cyan-500/50' },
  classique: { bg: 'bg-stone-800/50', text: 'text-stone-300', border: 'border-stone-500/50' },
  dark: { bg: 'bg-gray-800/50', text: 'text-gray-300', border: 'border-gray-600/50' },
  rose_gold: { bg: 'bg-pink-950/30', text: 'text-pink-400', border: 'border-pink-500/50' },
  vibrant: { bg: 'bg-purple-950/30', text: 'text-purple-400', border: 'border-purple-500/50' },
}

export default function AdminSalonsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [salons, setSalons] = useState<Salon[]>([])
  const [filteredSalons, setFilteredSalons] = useState<Salon[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchSalons()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredSalons(salons)
    } else {
      const lowerQuery = searchQuery.toLowerCase()
      setFilteredSalons(
        salons.filter(
          (s) =>
            s.name.toLowerCase().includes(lowerQuery) ||
            s.slug.toLowerCase().includes(lowerQuery) ||
            s.profiles?.full_name?.toLowerCase().includes(lowerQuery)
        )
      )
    }
  }, [searchQuery, salons])

  const fetchSalons = async () => {
    setLoading(true)
    setError('')
    
    // On récupère les salons et le nom du manager associé
    const { data, error } = await supabase
      .from('salons')
      .select('*, profiles!manager_id(full_name)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erreur fetch salons:', error)
      setError('Impossible de charger les salons.')
    } else {
      setSalons(data || [])
      setFilteredSalons(data || [])
    }
    setLoading(false)
  }

  const handleToggleStatus = async (salon: Salon) => {
    const { error } = await supabase
      .from('salons')
      .update({ is_closed: !salon.is_closed })
      .eq('id', salon.id)

    if (error) {
      alert('Erreur lors de la mise à jour du statut.')
    } else {
      await fetchSalons()
    }
  }

  const handleDelete = async (salonId: string, salonName: string) => {
    const confirmDelete = window.confirm(
      `⚠️ ATTENTION : Vous êtes sur le point de supprimer le salon "${salonName}".\n\nCette action est IRRÉVERSIBLE et supprimera tous les employés, services, photos et rendez-vous associés.\n\nÊtes-vous absolument sûr ?`
    )

    if (!confirmDelete) return

    setDeletingId(salonId)
    const { error } = await supabase.from('salons').delete().eq('id', salonId)

    if (error) {
      alert('Erreur lors de la suppression : ' + error.message)
    } else {
      await fetchSalons()
    }
    setDeletingId(null)
  }

  // État de chargement
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-amber-500">
          <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-medium tracking-wide">Chargement des salons...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-gray-200 p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 border-b border-amber-900/30 pb-6 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
              Gestion des <span className="text-amber-500">Salons</span>
            </h1>
            <p className="text-gray-500">Vue d'ensemble de tous les établissements de la plateforme.</p>
          </div>
          <Link
            href="/admin/salons/create"
            className="inline-flex items-center justify-center px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl shadow-lg shadow-amber-900/20 transition"
          >
            <span className="mr-2 text-xl">+</span> Nouveau Salon
          </Link>
        </div>

        {/* Barre de recherche */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, slug ou manager..."
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
            />
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div className="mb-6 bg-red-950/30 border border-red-900/50 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Liste des salons */}
        {filteredSalons.length === 0 ? (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">🏪</div>
            <h3 className="text-xl font-bold text-white mb-2">Aucun salon trouvé</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Aucun résultat pour votre recherche.' : 'Commencez par créer votre premier salon.'}
            </p>
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-neutral-950/50 border-b border-neutral-800">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Salon</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Thème</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Manager</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filteredSalons.map((salon) => {
                    const themeStyle = THEME_STYLES[salon.theme] || THEME_STYLES.classique
                    return (
                      <tr key={salon.id} className="hover:bg-neutral-800/30 transition">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-lg">{salon.name}</span>
                            <Link 
                              href={`/${salon.slug}`} 
                              target="_blank"
                              className="text-xs text-amber-500/70 hover:text-amber-400 transition flex items-center gap-1 mt-1"
                            >
                              {salon.slug} 
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${themeStyle.bg} ${themeStyle.text} ${themeStyle.border}`}>
                            {salon.theme.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-sm">
                          {salon.profiles?.full_name || <span className="text-gray-600 italic">Non assigné</span>}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleStatus(salon)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                              salon.is_closed ? 'bg-red-900' : 'bg-green-900'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                salon.is_closed ? 'translate-x-1' : 'translate-x-6'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDelete(salon.id, salon.name)}
                            disabled={deletingId === salon.id}
                            className="text-gray-500 hover:text-red-400 transition disabled:opacity-50 p-2"
                            title="Supprimer le salon"
                          >
                            {deletingId === salon.id ? (
                              <svg className="animate-spin h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}