// src/app/[salonSlug]/dashboard/manager/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import PhotoUploader from '@/components/photos/PhotoUploader'
import { PHOTO_QUOTAS, type PhotoCategory } from '@/lib/photos/quotas'

interface Photo {
  id: string
  url: string
  category: PhotoCategory
  order: number
  employee_id: string | null
}

export default function ManagerDashboard() {
  const params = useParams()
  const slug = params.salonSlug as string
  const supabase = createClient()

  const [salon, setSalon] = useState<any>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [activeCategory, setActiveCategory] = useState<PhotoCategory>('salon')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (slug) {
      loadSalon()
      loadPhotos()
    }
  }, [slug])

  const loadSalon = async () => {
    const { data, error } = await supabase
      .from('salons')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) {
      setError('Salon introuvable')
      setLoading(false)
      return
    }
    setSalon(data)
  }

  const loadPhotos = async () => {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('salon_id', salon?.id)
      .order('category')
      .order('order', { ascending: true })

    if (error) {
      console.error('Erreur chargement photos:', error)
      return
    }
    setPhotos(data || [])
    setLoading(false)
  }

  const handleUploadSuccess = async () => {
    await loadPhotos()
  }

  const handleDelete = async (photoId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette photo ?')) return

    setDeletingId(photoId)
    try {
      const photo = photos.find(p => p.id === photoId)
      if (!photo) return

      // Supprimer du Storage
      const path = photo.url.split('/salon-photos/')[1]
      if (path) {
        await supabase.storage.from('salon-photos').remove([path])
      }

      // Supprimer de la BDD
      const { error } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId)

      if (error) throw error

      await loadPhotos()
    } catch (err: any) {
      console.error('Erreur suppression:', err)
      alert('Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
    }
  }

  const getPhotosByCategory = (category: PhotoCategory) => {
    return photos.filter(p => p.category === category)
  }

  const getCategoryCount = (category: PhotoCategory) => {
    return getPhotosByCategory(category).length
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-amber-400 text-xl">Chargement...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-red-400 text-xl">{error}</div>
      </div>
    )
  }

  const categories: { key: PhotoCategory; label: string; icon: string }[] = [
    { key: 'profile', label: 'Profil', icon: '👤' },
    { key: 'salon', label: 'Salon', icon: '🏪' },
    { key: 'photobook', label: 'Photobook', icon: '📸' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-amber-400">
            Dashboard Manager
          </h1>
          <div className="text-sm text-gray-400">
            {salon?.name} • {slug}
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Onglets catégories */}
        <div className="flex gap-2 mb-8">
          {categories.map((cat) => {
            const count = getCategoryCount(cat.key)
            const max = PHOTO_QUOTAS.manager[cat.key]
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex-1 py-4 px-6 rounded-xl font-semibold transition ${
                  activeCategory === cat.key
                    ? 'bg-amber-500 text-black'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl">{cat.icon}</span>
                  <span>{cat.label}</span>
                </div>
                <div className="text-xs mt-1 opacity-75">
                  {count}/{max}
                </div>
              </button>
            )
          })}
        </div>

        {/* Zone d'upload */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-white">
            Ajouter une photo {activeCategory === 'profile' ? 'de profil' : activeCategory === 'salon' ? 'du salon' : 'du photobook'}
          </h2>
          <PhotoUploader
            salonId={salon.id}
            userRole="manager"
            category={activeCategory}
            onUploadSuccess={handleUploadSuccess}
            label={`Ajouter une photo ${activeCategory === 'profile' ? 'de profil' : activeCategory === 'salon' ? 'du salon' : 'du photobook'}`}
          />
        </div>

        {/* Galerie photos */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-6 text-white">
            Photos existantes ({getCategoryCount(activeCategory)})
          </h2>

          {getPhotosByCategory(activeCategory).length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">📷</div>
              <p>Aucune photo dans cette catégorie</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {getPhotosByCategory(activeCategory).map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.url}
                    alt={`Photo ${photo.category}`}
                    className="w-full h-40 object-cover rounded-xl border-2 border-gray-800 group-hover:border-amber-500 transition"
                  />
                  <button
                    onClick={() => handleDelete(photo.id)}
                    disabled={deletingId === photo.id}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                  >
                    {deletingId === photo.id ? (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      '✕'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}