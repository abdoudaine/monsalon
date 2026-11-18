'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getThemeStyles, type SalonTheme } from '@/lib/themes'

interface Photo {
  id: string
  salon_id: string
  url: string
  created_at: string
}

interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
  action?: { label: string; onClick: () => void }
}

const BUCKET = 'salon-photos'
const MAX_SIZE = 8 * 1024 * 1024

function withAlpha(hex: string, a: number): string {
  if (!hex) return `rgba(0,0,0,${a})`
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function ManagerPhotosPage() {
  const params = useParams()
  const slug = params.salonSlug as string
  const supabase = createClient()

  const uploadInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const replacingIdRef = useRef<string | null>(null)
  const pendingBatches = useRef<Map<string, { photos: Photo[]; timer: any }>>(new Map())
  const toastId = useRef(0)
  const panState = useRef<{ dragging: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
    dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0,
  })

  const [salonId, setSalonId] = useState<string | null>(null)
  const [colors, setColors] = useState<any>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [replacingId, setReplacingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const [confirm, setConfirm] = useState<{ ids: string[] } | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const DEFAULT_C = { bg: '#09090b', bgCard: '#18181b', text: '#fafafa', textMuted: '#a1a1aa', accent: '#fbbf24', border: '#27272a', button: '#f59e0b', buttonText: '#000000' }
  const c = colors || DEFAULT_C

  const sortedPhotos = [...photos].sort((a, b) =>
    sort === 'newest'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const pushToast = useCallback((type: Toast['type'], message: string, action?: Toast['action']) => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, type, message, action }])
    const delay = action ? 6500 : 3500
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), delay)
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const { data: salonData } = await supabase.from('salons').select('id, theme').eq('slug', slug).single()
      if (salonData) {
        setSalonId(salonData.id)
        setColors(getThemeStyles((salonData.theme as SalonTheme) || 'luxe'))
        const { data, error } = await supabase
          .from('photos').select('*').eq('salon_id', salonData.id).order('created_at', { ascending: false })
        if (error) setError(error.message)
        else setPhotos((data as Photo[]) || [])
      } else {
        setError('Salon introuvable.')
      }
      setLoading(false)
    }
    init()
    return () => {
      pendingBatches.current.forEach(b => clearTimeout(b.timer))
      pendingBatches.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const storagePath = (url: string) => {
    const parts = url.split(`/${BUCKET}/`)
    return parts[1] ? decodeURIComponent(parts[1]) : null
  }

  const uploadOne = async (file: File, sId: string): Promise<Photo | null> => {
    if (!file.type.startsWith('image/')) { pushToast('error', `"${file.name}" n'est pas une image.`); return null }
    if (file.size > MAX_SIZE) { pushToast('error', `"${file.name}" depasse 8 Mo.`); return null }
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${sId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
    if (upErr) { pushToast('error', `Upload echoue : ${upErr.message}`); return null }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const { data: row, error: dbErr } = await supabase
      .from('photos').insert({ salon_id: sId, url: urlData.publicUrl }).select().single()
    if (dbErr || !row) { pushToast('error', `Enregistrement echoue : ${dbErr?.message}`); return null }
    return row as Photo
  }

  const handleFiles = async (files: FileList | File[]) => {
    if (!salonId) return
    const list = Array.from(files)
    if (list.length === 0) return
    setUploadingCount(cnt => cnt + list.length)
    setError('')
    let added = 0
    for (const file of list) {
      const photo = await uploadOne(file, salonId)
      if (photo) { setPhotos(prev => [photo, ...prev]); added++ }
      setUploadingCount(cnt => cnt - 1)
    }
    if (added > 0) pushToast('success', `${added} photo${added > 1 ? 's' : ''} ajoutee${added > 1 ? 's' : ''}.`)
  }

  const startReplace = (photo: Photo) => {
    replacingIdRef.current = photo.id
    setReplacingId(photo.id)
    replaceInputRef.current?.click()
  }

  const handleReplaceFile = async (file: File) => {
    const id = replacingIdRef.current
    const old = photos.find(p => p.id === id)
    if (!id || !old || !salonId) return
    const ext = file.name.split('.').pop() || 'jpg'
    if (!file.type.startsWith('image/')) { pushToast('error', 'Fichier non valide.'); return }
    if (file.size > MAX_SIZE) { pushToast('error', 'Image trop lourde (max 8 Mo).'); return }
    const path = `${salonId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
    if (upErr) { pushToast('error', `Upload echoue : ${upErr.message}`); return }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const { error: dbErr } = await supabase.from('photos').update({ url: urlData.publicUrl }).eq('id', id)
    if (dbErr) { pushToast('error', `Mise a jour echouee : ${dbErr.message}`); return }
    const oldPath = storagePath(old.url)
    if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath])
    setPhotos(prev => prev.map(p => (p.id === id ? { ...p, url: urlData.publicUrl } : p)))
    pushToast('success', 'Photo remplacee.')
    setReplacingId(null)
    replacingIdRef.current = null
  }

  const performDelete = (ids: string[]) => {
    const removed = photos.filter(p => ids.includes(p.id))
    if (removed.length === 0) return
    setPhotos(prev => prev.filter(p => !ids.includes(p.id)))
    setSelected(prev => { const n = new Set(prev); ids.forEach(i => n.delete(i)); return n })
    supabase.from('photos').delete().in('id', ids).then(({ error }) => {
      if (error) pushToast('error', `Suppression BDD : ${error.message}`)
    })
    const batchId = `${Date.now()}-${Math.random()}`
    const timer = setTimeout(() => {
      const paths = removed.map(p => storagePath(p.url)).filter(Boolean) as string[]
      if (paths.length) supabase.storage.from(BUCKET).remove(paths)
      pendingBatches.current.delete(batchId)
    }, 6000)
    pendingBatches.current.set(batchId, { photos: removed, timer })
    pushToast('info', `${removed.length} photo${removed.length > 1 ? 's' : ''} supprimee${removed.length > 1 ? 's' : ''}.`, {
      label: 'Annuler',
      onClick: () => undoBatch(batchId),
    })
  }

  const undoBatch = async (batchId: string) => {
    const batch = pendingBatches.current.get(batchId)
    if (!batch) return
    clearTimeout(batch.timer)
    pendingBatches.current.delete(batchId)
    const rows = batch.photos.map(p => ({ id: p.id, salon_id: p.salon_id, url: p.url, created_at: p.created_at }))
    const { error } = await supabase.from('photos').insert(rows)
    if (error) { pushToast('error', `Restauration echouee : ${error.message}`); return }
    setPhotos(prev => [...prev, ...batch.photos])
    pushToast('success', 'Suppression annulee.')
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleSelectAll = () => {
    setSelected(prev => (prev.size === sortedPhotos.length ? new Set() : new Set(sortedPhotos.map(p => p.id))))
  }

  const openLightbox = (index: number) => { setLightboxIndex(index); setZoom(1); setPan({ x: 0, y: 0 }) }
  const closeLightbox = useCallback(() => { setLightboxIndex(null); setZoom(1); setPan({ x: 0, y: 0 }) }, [])
  const navLightbox = useCallback((dir: number) => {
    setLightboxIndex(prev => {
      if (prev === null) return prev
      const len = sortedPhotos.length
      return (prev + dir + len) % len
    })
    setZoom(1); setPan({ x: 0, y: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedPhotos.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      else if (e.key === 'ArrowRight') navLightbox(1)
      else if (e.key === 'ArrowLeft') navLightbox(-1)
      else if (e.key === '+' || e.key === '=') setZoom(z => Math.min(4, z + 0.5))
      else if (e.key === '-') setZoom(z => Math.max(1, z - 0.5))
      else if (e.key === '0') { setZoom(1); setPan({ x: 0, y: 0 }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, closeLightbox, navLightbox])

  const onWheelZoom = (e: React.WheelEvent) => {
    setZoom(z => Math.min(4, Math.max(1, z + (e.deltaY < 0 ? 0.25 : -0.25))))
  }
  const onPanStart = (e: React.PointerEvent) => {
    if (zoom <= 1) return
    panState.current = { dragging: true, startX: e.clientX, startY: e.clientY, baseX: pan.x, baseY: pan.y }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  const onPanMove = (e: React.PointerEvent) => {
    if (!panState.current.dragging) return
    setPan({
      x: panState.current.baseX + (e.clientX - panState.current.startX),
      y: panState.current.baseY + (e.clientY - panState.current.startY),
    })
  }
  const onPanEnd = () => { panState.current.dragging = false }

  const downloadPhoto = async (photo: Photo) => {
    try {
      const res = await fetch(photo.url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `photo-${photo.id}.jpg`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {
      window.open(photo.url, '_blank')
    }
  }

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  const selectStyle: React.CSSProperties = { background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: c.text, outline: 'none' }
  const toolBtnStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: `1px solid ${c.border}`, background: c.bgCard, color: c.textMuted, cursor: 'pointer' }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.accent }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span style={{ fontWeight: 500, letterSpacing: '0.05em' }}>Chargement de la galerie...</span>
        </div>
      </div>
    )
  }

  const current = lightboxIndex !== null ? sortedPhotos[lightboxIndex] : null

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, padding: '16px' }}>
      <style>{`
        body::-webkit-scrollbar{width:10px}
        body::-webkit-scrollbar-track{background:${c.bg}}
        body::-webkit-scrollbar-thumb{background:${c.accent};border-radius:8px}
        body{scrollbar-color:${c.accent} ${c.bg};scrollbar-width:thin}
      `}</style>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px', paddingBottom: '24px', borderBottom: `1px solid ${c.border}` }}>
          <div>
            <Link href={`/${slug}/dashboard`} style={{ color: c.textMuted, textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '8px' }}>
              &larr; Retour au tableau de bord
            </Link>
            <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em', margin: 0 }}>
              Gestion des <span style={{ color: c.accent }}>Photos</span>
            </h1>
            <p style={{ color: c.textMuted, marginTop: '4px', fontSize: '14px' }}>{photos.length} photo{photos.length > 1 ? 's' : ''} dans la galerie</p>
          </div>
          <div>
            <button
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploadingCount > 0}
              style={{ padding: '12px 24px', background: c.button, color: c.buttonText, fontWeight: 700, borderRadius: '12px', border: 'none', cursor: uploadingCount > 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', opacity: uploadingCount > 0 ? 0.6 : 1 }}
            >
              {uploadingCount > 0 ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Upload ({uploadingCount})...
                </>
              ) : (<><span style={{ fontSize: '20px', lineHeight: 1 }}>+</span> Ajouter des photos</>)}
            </button>
          </div>
          <input ref={uploadInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />
          <input ref={replaceInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleReplaceFile(e.target.files[0]); e.target.value = '' }} />
        </div>

        {error && (
          <div style={{ marginBottom: '24px', background: withAlpha('#dc2626', 0.15), border: `1px solid ${withAlpha('#dc2626', 0.4)}`, color: '#dc2626', padding: '12px 16px', borderRadius: '12px', fontSize: '14px' }}>&#9888;&#65039; {error}</div>
        )}

        {/* Barre d'outils */}
        {photos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <select value={sort} onChange={e => setSort(e.target.value as 'newest' | 'oldest')} style={selectStyle}>
              <option value="newest">Plus recentes</option>
              <option value="oldest">Plus anciennes</option>
            </select>
            <button
              onClick={() => { setSelectMode(m => !m); setSelected(new Set()) }}
              style={{ ...toolBtnStyle, background: selectMode ? c.button : c.bgCard, color: selectMode ? c.buttonText : c.textMuted, border: `1px solid ${selectMode ? c.button : c.border}` }}
            >
              {selectMode ? 'Quitter la selection' : 'Selectionner'}
            </button>
            {selectMode && (
              <>
                <button onClick={toggleSelectAll} style={toolBtnStyle}>
                  {selected.size === sortedPhotos.length ? 'Tout deselectionner' : 'Tout selectionner'}
                </button>
                {selected.size > 0 && (
                  <button onClick={() => setConfirm({ ids: Array.from(selected) })} style={{ ...toolBtnStyle, background: withAlpha('#dc2626', 0.15), color: '#dc2626', border: `1px solid ${withAlpha('#dc2626', 0.4)}`, fontWeight: 700 }}>
                    Supprimer ({selected.size})
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Zone glisser-deposer + galerie */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files) }}
          style={{ position: 'relative', borderRadius: '16px', transition: 'box-shadow 0.2s', boxShadow: dragOver ? `0 0 0 2px ${c.accent}` : 'none' }}
        >
          {dragOver && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: withAlpha(c.accent, 0.1), border: `2px dashed ${c.accent}`, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ color: c.accent, fontWeight: 700, fontSize: '18px' }}>Deposez vos images ici</p>
            </div>
          )}

          {photos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 16px', background: c.bgCard, border: `1px dashed ${c.border}`, borderRadius: '16px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#128247;</div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: c.text, marginBottom: '8px' }}>Galerie vide</h3>
              <p style={{ color: c.textMuted, marginBottom: '24px' }}>Glissez-deposez des images ou parcourez vos fichiers.</p>
              <button onClick={() => uploadInputRef.current?.click()} style={{ padding: '12px 24px', background: c.button, color: c.buttonText, fontWeight: 700, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                Parcourir mes fichiers
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {sortedPhotos.map((photo, index) => (
                <div
                  key={photo.id}
                  onMouseEnter={() => setHoverIdx(index)}
                  onMouseLeave={() => setHoverIdx(null)}
                  style={{ position: 'relative', aspectRatio: '1', background: c.bgCard, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${hoverIdx === index ? c.accent : c.border}`, transition: 'border-color 0.2s' }}
                >
                  <img src={photo.url} alt="Photo salon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />

                  {selectMode && (
                    <button
                      onClick={() => toggleSelect(photo.id)}
                      style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10, width: '24px', height: '24px', borderRadius: '6px', border: `2px solid ${selected.has(photo.id) ? c.button : 'rgba(255,255,255,0.6)'}`, background: selected.has(photo.id) ? c.button : 'rgba(0,0,0,0.5)', color: selected.has(photo.id) ? c.buttonText : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 700 }}
                    >&#10003;</button>
                  )}

                  {replacingId === photo.id && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                      <svg className="animate-spin h-6 w-6" style={{ color: c.accent }} fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}

                  {!selectMode && (
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2), transparent)', opacity: hoverIdx === index ? 1 : 0, transition: 'opacity 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '12px' }}>
                      <p style={{ fontSize: '12px', color: '#d4d4d4', marginBottom: '8px' }}>{formatDate(photo.created_at)}</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => openLightbox(index)} title="Agrandir" style={{ flex: 1, padding: '8px', background: c.button, color: c.buttonText, borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>&#128269;</button>
                        <button onClick={() => startReplace(photo)} title="Remplacer" style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>&#9851;&#65039;</button>
                        <button onClick={() => setConfirm({ ids: [photo.id] })} title="Supprimer" style={{ flex: 1, padding: '8px', background: withAlpha('#dc2626', 0.6), color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>&#128465;&#65039;</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Visionneuse plein ecran (fond sombre volontaire pour la lisibilite des images) */}
      {current && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column' }} onWheel={onWheelZoom}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', color: '#d4d4d4' }}>
            <span style={{ fontSize: '14px' }}>{(lightboxIndex ?? 0) + 1} / {sortedPhotos.length} &bull; {formatDate(current.created_at)}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setZoom(z => Math.max(1, z - 0.5))} style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#262626', border: 'none', color: '#fff', cursor: 'pointer' }}>&minus;</button>
              <span style={{ fontSize: '14px', width: '56px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(4, z + 0.5))} style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#262626', border: 'none', color: '#fff', cursor: 'pointer' }}>+</button>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} style={{ padding: '0 12px', height: '36px', borderRadius: '8px', background: '#262626', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Reset</button>
              <button onClick={() => downloadPhoto(current)} style={{ padding: '0 12px', height: '36px', borderRadius: '8px', background: c.accent, border: 'none', color: '#000', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>&#11015;</button>
              <button onClick={closeLightbox} style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#262626', border: 'none', color: '#fff', cursor: 'pointer' }}>&#10005;</button>
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', userSelect: 'none' }}
            onPointerDown={onPanStart} onPointerMove={onPanMove} onPointerUp={onPanEnd} onPointerLeave={onPanEnd}>
            <button onClick={() => navLightbox(-1)} style={{ position: 'absolute', left: '12px', zIndex: 10, width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(38,38,38,0.8)', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>&lsaquo;</button>
            <img
              src={current.url}
              alt="Photo agrandie"
              draggable={false}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, cursor: zoom > 1 ? 'grab' : 'default', maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', transition: 'transform 0.15s' }}
            />
            <button onClick={() => navLightbox(1)} style={{ position: 'absolute', right: '12px', zIndex: 10, width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(38,38,38,0.8)', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>&rsaquo;</button>
          </div>
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#737373', padding: '8px 0' }}>&larr; &rarr; naviguer &bull; +/- zoom &bull; 0 reset &bull; Echap fermer &bull; molette zoomer &bull; glisser pour deplacer</p>
        </div>
      )}

      {/* Confirmation suppression */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '24px', maxWidth: '384px', width: '100%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: c.text, marginBottom: '8px' }}>Supprimer {confirm.ids.length > 1 ? `${confirm.ids.length} photos` : 'cette photo'} ?</h3>
            <p style={{ color: c.textMuted, fontSize: '14px', marginBottom: '24px' }}>Vous pourrez annuler pendant quelques secondes apres la suppression.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, padding: '12px', background: c.bg, color: c.text, fontWeight: 500, borderRadius: '12px', border: `1px solid ${c.border}`, cursor: 'pointer' }}>Annuler</button>
              <button onClick={() => { performDelete(confirm.ids); setConfirm(null) }} style={{ flex: 1, padding: '12px', background: '#dc2626', color: '#fff', fontWeight: 700, borderRadius: '12px', border: 'none', cursor: 'pointer' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 70, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '384px' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', border: `1px solid ${t.type === 'success' ? '#16a34a' : t.type === 'error' ? '#dc2626' : c.border}`, background: t.type === 'success' ? withAlpha('#16a34a', 0.9) : t.type === 'error' ? withAlpha('#dc2626', 0.9) : c.bgCard, color: t.type === 'info' ? c.text : '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', fontSize: '14px' }}>
            <span>{t.type === 'success' ? 'OK' : t.type === 'error' ? '!' : 'i'}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
            {t.action && (
              <button onClick={() => { t.action!.onClick(); setToasts(prev => prev.filter(x => x.id !== t.id)) }} style={{ fontWeight: 700, color: t.type === 'info' ? c.accent : '#fff', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}