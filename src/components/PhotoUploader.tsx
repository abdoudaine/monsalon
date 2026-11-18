// src/components/photos/PhotoUploader.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  checkPhotoQuota, 
  PHOTO_QUOTAS, 
  type UserRole, 
  type PhotoCategory, 
  type QuotaCheckResult 
} from '@/lib/photos/quotas'

interface PhotoUploaderProps {
  salonId: string
  userRole: UserRole
  category: PhotoCategory
  employeeId?: string | null
  onUploadSuccess: (url: string) => void
  onQuotaExceeded?: () => void
  label?: string
}

export default function PhotoUploader({
  salonId,
  userRole,
  category,
  employeeId = null,
  onUploadSuccess,
  onQuotaExceeded,
  label = 'Uploader une photo',
}: PhotoUploaderProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [quota, setQuota] = useState<QuotaCheckResult | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string>('')
  const [showReplaceModal, setShowReplaceModal] = useState(false)
  const [existingPhotos, setExistingPhotos] = useState<Array<{ id: string; url: string }>>([])

  // Charger le quota au montage
  const loadQuota = useCallback(async () => {
    const quotaResult = await checkPhotoQuota(salonId, userRole, category, employeeId)
    setQuota(quotaResult)
  }, [salonId, userRole, category, employeeId])

  useState(() => {
    loadQuota()
  })

  // Charger les photos existantes (pour le remplacement)
  const loadExistingPhotos = useCallback(async () => {
    const { data, error } = await supabase
      .from('photos')
      .select('id, url')
      .eq('salon_id', salonId)
      .eq('category', category)
      .order('order', { ascending: true })

    if (!error && data) {
      setExistingPhotos(data)
    }
  }, [salonId, category, supabase])

  // Gestion de la sélection de fichier
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validation du type
    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image valide (JPG, PNG, WebP).')
      return
    }

    // Validation de la taille (max 5 Mo)
    if (file.size > 5 * 1024 * 1024) {
      setError('L\'image ne doit pas dépasser 5 Mo.')
      return
    }

    setError('')
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  // Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Veuillez déposer une image valide.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('L\'image ne doit pas dépasser 5 Mo.')
      return
    }

    setError('')
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Upload vers Supabase Storage
  const handleUpload = async () => {
    if (!selectedFile || !quota) return

    setUploading(true)
    setError('')

    try {
      // 1. Générer un nom de fichier unique
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${salonId}/${category}/${Date.now()}.${fileExt}`

      // 2. Upload vers Storage
      const { error: uploadError } = await supabase.storage
        .from('salon-photos')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // 3. Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from('salon-photos')
        .getPublicUrl(fileName)

      const publicUrl = urlData.publicUrl

      // 4. Enregistrer dans la table photos
      const { error: dbError } = await supabase
        .from('photos')
        .insert({
          salon_id: salonId,
          employee_id: employeeId,
          url: publicUrl,
          category: category,
          order: quota.currentCount,
        })

      if (dbError) throw dbError

      // 5. Succès
      onUploadSuccess(publicUrl)
      setSelectedFile(null)
      setPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadQuota()

    } catch (err: any) {
      console.error('Erreur upload:', err)
      setError(err.message || 'Erreur lors de l\'upload. Réessayez.')
    } finally {
      setUploading(false)
    }
  }

  // Remplacement d'une photo existante
  const handleReplace = async (photoId: string) => {
    if (!selectedFile) return

    setUploading(true)
    setError('')

    try {
      // 1. Supprimer l'ancienne photo de Storage
      const oldPhoto = existingPhotos.find(p => p.id === photoId)
      if (oldPhoto) {
        const oldPath = oldPhoto.url.split('/salon-photos/')[1]
        if (oldPath) {
          await supabase.storage
            .from('salon-photos')
            .remove([oldPath])
        }
      }

      // 2. Upload de la nouvelle
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${salonId}/${category}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('salon-photos')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('salon-photos')
        .getPublicUrl(fileName)

      const publicUrl = urlData.publicUrl

      // 3. Mettre à jour l'URL dans la BDD
      const { error: dbError } = await supabase
        .from('photos')
        .update({ url: publicUrl })
        .eq('id', photoId)

      if (dbError) throw dbError

      // 4. Succès
      onUploadSuccess(publicUrl)
      setSelectedFile(null)
      setPreview(null)
      setShowReplaceModal(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadQuota()
      await loadExistingPhotos()

    } catch (err: any) {
      console.error('Erreur remplacement:', err)
      setError(err.message || 'Erreur lors du remplacement.')
    } finally {
      setUploading(false)
    }
  }

  // Soumission principale
  const handleSubmit = async () => {
    if (!quota) return

    if (quota.canUpload) {
      await handleUpload()
    } else {
      // Quota atteint → ouvrir le modal de remplacement
      await loadExistingPhotos()
      setShowReplaceModal(true)
      onQuotaExceeded?.()
    }
  }

  const categoryLabels: Record<PhotoCategory, string> = {
    profile: 'Photo de profil',
    salon: 'Photo du salon',
    photobook: 'Photo du photobook',
  }

  return (
    <div className="space-y-4">
      {/* Barre de quota */}
      {quota && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-300">
              {categoryLabels[category]}
            </span>
            <span className={`text-sm font-bold ${
              quota.remaining > 0 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {quota.currentCount}/{quota.maxCount}
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                quota.remaining > 0 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${(quota.currentCount / quota.maxCount) * 100}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {quota.remaining > 0
              ? `${quota.remaining} emplacement${quota.remaining > 1 ? 's' : ''} restant${quota.remaining > 1 ? 's' : ''}`
              : 'Quota atteint. Vous pouvez remplacer une photo existante.'}
          </p>
        </div>
      )}

      {/* Zone de drop */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
          preview
            ? 'border-amber-500 bg-gray-900/50'
            : 'border-gray-700 bg-gray-900 hover:border-amber-500 hover:bg-gray-900/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {preview ? (
          <div className="space-y-4">
            <img
              src={preview}
              alt="Aperçu"
              className="max-h-48 mx-auto rounded-xl object-cover"
            />
            <p className="text-sm text-gray-400">
              {selectedFile?.name} ({((selectedFile?.size || 0) / 1024 / 1024).toFixed(2)} Mo)
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setPreview(null)
                setSelectedFile(null)
                setError('')
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="text-xs text-red-400 hover:text-red-300"
            >
              ✕ Retirer
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-4xl">📸</div>
            <p className="text-gray-300 font-medium">{label}</p>
            <p className="text-xs text-gray-500">
              Glissez-déposez ou cliquez • JPG, PNG, WebP • Max 5 Mo
            </p>
          </div>
        )}
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-300 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Bouton d'upload */}
      {preview && (
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-xl shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Upload en cours...
            </>
          ) : (
            quota?.canUpload ? '✅ Valider l\'upload' : '🔄 Remplacer une photo existante'
          )}
        </button>
      )}

      {/* Modal de remplacement */}
      {showReplaceModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-2">Quota atteint</h3>
            <p className="text-gray-400 text-sm mb-6">
              Vous avez utilisé tous vos emplacements ({quota?.maxCount}/{quota?.maxCount}). 
              Choisissez une photo à remplacer :
            </p>

            {existingPhotos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucune photo à remplacer.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {existingPhotos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.url}
                      alt="Photo existante"
                      className="w-full h-32 object-cover rounded-xl border-2 border-gray-800 group-hover:border-amber-500 transition"
                    />
                    <button
                      onClick={() => handleReplace(photo.id)}
                      disabled={uploading}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-xl"
                    >
                      <span className="text-amber-400 font-bold text-sm">
                        {uploading ? '...' : 'Remplacer'}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                setShowReplaceModal(false)
                setPreview(null)
                setSelectedFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="w-full mt-6 py-3 bg-gray-800 text-gray-300 font-medium rounded-xl hover:bg-gray-700 transition"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}