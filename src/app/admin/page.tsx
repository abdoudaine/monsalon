'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Salon { id: string; name: string; slug: string; theme: string; created_at: string; settings?: any; manager_id?: string | null }
interface Appt { id: string; salon_id: string; status: string; start_time: string; created_at: string }
interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string }

const THEMES = ['luxe', 'moderne', 'minimal', 'classique']
const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: '#f59e0b' },
  confirmed: { label: 'Confirmé', color: '#3b82f6' },
  completed: { label: 'Terminé', color: '#10b981' },
  cancelled: { label: 'Annulé', color: '#ef4444' },
}
const ROLE_TONE: Record<string, { card: string; dot: string }> = {
  violet: { card: 'border-violet-500/30', dot: 'text-violet-400' },
  amber: { card: 'border-amber-500/30', dot: 'text-amber-400' },
  blue: { card: 'border-blue-500/30', dot: 'text-blue-400' },
  emerald: { card: 'border-emerald-500/30', dot: 'text-emerald-400' },
}
const FEE = 1

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.disconnect() } }, { threshold: 0.1 })
    o.observe(el); return () => o.disconnect()
  }, [])
  return <div ref={ref} className={className} style={{ opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(24px)', transition: `opacity .6s ease ${delay}ms, transform .6s cubic-bezier(.22,1,.36,1) ${delay}ms` }}>{children}</div>
}

function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0; const t0 = performance.now(); const dur = 900
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 3)
      setN(Math.round(value * e)); if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [value])
  return <span>{n.toLocaleString('fr-FR')}{suffix}</span>
}

function Donut({ counts, total }: { counts: Record<string, number>; total: number }) {
  const entries = Object.entries(STATUS_META).map(([k, m]) => ({ k, ...m, n: counts[k] || 0 })).filter(e => e.n > 0)
  const R = 54, C = 2 * Math.PI * R
  let acc = 0
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg viewBox="0 0 140 140" className="w-36 h-36 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#262626" strokeWidth="16" />
        {total > 0 && entries.map(e => {
          const frac = e.n / total; const dash = frac * C
          const el = <circle key={e.k} cx="70" cy="70" r={R} fill="none" stroke={e.color} strokeWidth="16" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc * C} />
          acc += frac; return el
        })}
      </svg>
      <div className="space-y-2">
        {Object.entries(STATUS_META).map(([k, m]) => (
          <div key={k} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-sm" style={{ background: m.color }} />
            <span className="text-neutral-300 w-24">{m.label}</span>
            <span className="font-bold text-white">{counts[k] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SuperAdminPage() {
  const supabase = createClient()
  const [salons, setSalons] = useState<Salon[]>([])
  const [appts, setAppts] = useState<Appt[]>([])
  const [empCount, setEmpCount] = useState<Record<string, number>>({})
  const [svcCount, setSvcCount] = useState<Record<string, number>>({})
  const [phCount, setPhCount] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [themeFilter, setThemeFilter] = useState('all')
  const [sortKey, setSortKey] = useState<'reservations' | 'name' | 'recent'>('reservations')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; salon?: Salon } | null>(null)
  const [fName, setFName] = useState(''); const [fSlug, setFSlug] = useState(''); const [fTheme, setFTheme] = useState('luxe')
  const [slugTouched, setSlugTouched] = useState(false)
  const [formErr, setFormErr] = useState(''); const [saving, setSaving] = useState(false)
  const [drawer, setDrawer] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const tid = useRef(0)

  // NOUVEAU : États pour la modale d'invitation gérant
  const [inviteModal, setInviteModal] = useState<{ salonId: string; salonName: string } | null>(null)
  const [invEmail, setInvEmail] = useState('')
  const [invPassword, setInvPassword] = useState('')
  const [invMode, setInvMode] = useState<'invite' | 'manual'>('invite')
  const [invLoading, setInvLoading] = useState(false)

  const toast = useCallback((type: Toast['type'], message: string) => {
    const id = ++tid.current
    setToasts(p => [...p, { id, type, message }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const [{ data: s, error: se }, { data: a }, { data: e }, { data: sv }, { data: ph }] = await Promise.all([
      supabase.from('salons').select('*').order('created_at', { ascending: false }),
      supabase.from('appointments').select('id, salon_id, status, start_time, created_at'),
      supabase.from('employees').select('salon_id'),
      supabase.from('services').select('salon_id'),
      supabase.from('photos').select('salon_id'),
    ])
    if (se || !s) { setError(se?.message || 'Impossible de charger les salons.'); setLoading(false); return }
    setSalons(s as Salon[]); setAppts((a as Appt[]) || [])
    const tally = (rows: any[] | null) => (rows || []).reduce((m: Record<string, number>, r: any) => { m[r.salon_id] = (m[r.salon_id] || 0) + 1; return m }, {})
    setEmpCount(tally(e)); setSvcCount(tally(sv)); setPhCount(tally(ph))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  const resBySalon = appts.reduce((m: Record<string, number>, a) => { m[a.salon_id] = (m[a.salon_id] || 0) + 1; return m }, {})
  const statusCounts = appts.reduce((m: Record<string, number>, a) => { m[a.status] = (m[a.status] || 0) + 1; return m }, {})
  const totalRes = appts.length
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayRes = appts.filter(a => (a.start_time || '').slice(0, 10) === todayStr).length
  const revenue = totalRes * FEE

  const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  const openCreate = () => { setModal({ mode: 'create' }); setFName(''); setFSlug(''); setFTheme('luxe'); setSlugTouched(false); setFormErr('') }
  const openEdit = (s: Salon) => { setModal({ mode: 'edit', salon: s }); setFName(s.name); setFSlug(s.slug); setFTheme(s.theme || 'luxe'); setSlugTouched(true); setFormErr('') }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modal) return
    const name = fName.trim(); const slug = fSlug.trim()
    if (!name) { setFormErr('Le nom est obligatoire.'); return }
    if (!/^[a-z0-9-]+$/.test(slug)) { setFormErr('Slug invalide (a-z, 0-9, tirets).'); return }
    const dup = salons.some(s => s.slug === slug && s.id !== modal.salon?.id)
    if (dup) { setFormErr('Ce slug est déjà utilisé.'); return }
    setSaving(true); setFormErr('')
    if (modal.mode === 'create') {
      const tempId = `temp-${Date.now()}`
      const optimistic: Salon = { id: tempId, name, slug, theme: fTheme, created_at: new Date().toISOString() }
      setSalons(p => [optimistic, ...p])
      const { data, error } = await supabase.from('salons').insert({ name, slug, theme: fTheme, settings: {} }).select().single()
      if (error || !data) { setSalons(p => p.filter(s => s.id !== tempId)); setFormErr(error?.message || 'Création échouée.'); setSaving(false); return }
      setSalons(p => p.map(s => s.id === tempId ? (data as Salon) : s))
      toast('success', `Salon « ${name} » créé.`)
    } else if (modal.salon) {
      const old = modal.salon
      setSalons(p => p.map(s => s.id === old.id ? { ...s, name, slug, theme: fTheme } : s))
      const { error } = await supabase.from('salons').update({ name, slug, theme: fTheme }).eq('id', old.id)
      if (error) { setSalons(p => p.map(s => s.id === old.id ? old : s)); setFormErr(error.message); setSaving(false); return }
      toast('success', `Salon « ${name} » mis à jour.`)
    }
    setSaving(false); setModal(null)
  }

  // NOUVEAU : Fonction d'invitation / création de gérant
  const handleInviteManager = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteModal || !invEmail) return
    if (invMode === 'manual' && invPassword.length < 6) {
      toast('error', 'Le mot de passe doit contenir au moins 6 caractères.')
      return
    }

    setInvLoading(true)
    try {
      const res = await fetch('/api/admin/invite-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonId: inviteModal.salonId,
          email: invEmail.trim(),
          password: invMode === 'manual' ? invPassword : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'opération')
      
      toast('success', data.message)
      setInviteModal(null)
      setInvEmail('')
      setInvPassword('')
      // Recharger les données pour mettre à jour l'affichage si besoin
      await load()
    } catch (err: any) {
      toast('error', err.message)
    } finally {
      setInvLoading(false)
    }
  }

  const visible = salons
    .filter(s => (themeFilter === 'all' || s.theme === themeFilter))
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.slug.includes(search.toLowerCase()))
    .sort((a, b) => sortKey === 'name' ? a.name.localeCompare(b.name)
      : sortKey === 'recent' ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : (resBySalon[b.id] || 0) - (resBySalon[a.id] || 0))

  const drawerSalon = salons.find(s => s.id === drawer) || null
  const drawerAppts = drawerSalon ? appts.filter(a => a.salon_id === drawerSalon.id) : []
  const drawerStatus = drawerAppts.reduce((m: Record<string, number>, a) => { m[a.status] = (m[a.status] || 0) + 1; return m }, {})

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0a10] flex items-center justify-center">
        <div className="flex items-center gap-3 text-amber-400">
          <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          <span className="font-medium tracking-wide">Chargement de la console...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0a10] text-neutral-200 relative overflow-x-hidden">
      <style>{`
        body::-webkit-scrollbar{width:10px}
        body::-webkit-scrollbar-track{background:#0b0a10}
        body::-webkit-scrollbar-thumb{background:linear-gradient(#f59e0b,#8b5cf6);border-radius:8px}
        body{scrollbar-color:#f59e0b #0b0a10;scrollbar-width:thin}
        @keyframes sa-drift{0%{transform:translate(0,0)}50%{transform:translate(50px,-35px)}100%{transform:translate(0,0)}}
        .sa-glow{animation:sa-drift 16s ease-in-out infinite}
      `}</style>
      <div className="sa-glow absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full bg-amber-500/15 blur-[130px] pointer-events-none" />
      <div className="sa-glow absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-violet-600/15 blur-[140px] pointer-events-none" style={{ animationDelay: '-8s' }} />

      <div className="relative z-10 max-w-7xl mx-auto p-4 md:p-8">
        <Reveal className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-violet-500/20 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/40 text-violet-300 text-xs font-bold mb-3">
              👑 SUPER ADMIN · PLATEFORME
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Console <span className="bg-gradient-to-r from-amber-400 to-violet-400 bg-clip-text text-transparent">MonSalon</span></h1>
            <p className="text-neutral-400 mt-1">Supervision de tous les salons, réservations et revenus plateforme.</p>
          </div>
          <button onClick={openCreate} className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-xl shadow-lg shadow-amber-900/30 transition flex items-center gap-2">
            <span className="text-xl">+</span> Créer un salon
          </button>
        </Reveal>

        {error && <div className="mb-6 bg-red-900/20 border border-red-800 text-red-300 px-4 py-3 rounded-xl text-sm">⚠️ {error}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Salons', value: salons.length, suffix: '', accent: 'from-violet-500/20 to-violet-500/5 border-violet-500/30 text-violet-300' },
            { label: 'Réservations totales', value: totalRes, suffix: '', accent: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-300' },
            { label: "RDV aujourd'hui", value: todayRes, suffix: '', accent: 'from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-300' },
            { label: 'Revenus plateforme', value: revenue, suffix: ' €', accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-300' },
          ].map((k, i) => (
            <Reveal key={k.label} delay={i * 80}>
              <div className={`bg-gradient-to-br ${k.accent} border rounded-2xl p-5 backdrop-blur-sm`}>
                <p className="text-xs uppercase tracking-wider opacity-80 mb-2">{k.label}</p>
                <p className="text-3xl font-bold text-white"><CountUp value={k.value} suffix={k.suffix} /></p>
                <p className="text-xs text-neutral-400 mt-1">{k.label === 'Revenus plateforme' ? `${FEE} € / réservation (famille incluse)` : 'tous salons confondus'}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mb-8">
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Répartition des réservations (plateforme)</h2>
            <Donut counts={statusCounts} total={totalRes} />
          </div>
        </Reveal>

        <Reveal className="flex flex-wrap gap-3 mb-4 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un salon (nom ou slug)..." className="flex-1 min-w-[220px] bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          <select value={themeFilter} onChange={e => setThemeFilter(e.target.value)} className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500">
            <option value="all">Tous thèmes</option>
            {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as 'reservations' | 'name' | 'recent')} className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500">
            <option value="reservations">Tri : réservations</option>
            <option value="name">Tri : nom</option>
            <option value="recent">Tri : récents</option>
          </select>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-12">
          {visible.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-neutral-900/50 border border-dashed border-neutral-800 rounded-2xl">
              <div className="text-5xl mb-3">🏪</div>
              <p className="text-neutral-400 mb-4">Aucun salon ne correspond.</p>
              <button onClick={openCreate} className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition">Créer le premier salon</button>
            </div>
          ) : visible.map((s, i) => (
            <Reveal key={s.id} delay={i * 60}>
              <div className="bg-neutral-900/70 border border-neutral-800 hover:border-amber-500/40 rounded-2xl p-5 transition group h-full flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-white truncate group-hover:text-amber-400 transition">{s.name}</h3>
                    <p className="text-xs text-neutral-500 font-mono truncate">/{s.slug}</p>
                  </div>
                  <span className="px-2 py-1 rounded-md text-xs font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30 capitalize shrink-0">{s.theme}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                  <div className="bg-neutral-950/60 rounded-lg py-2"><p className="text-lg font-bold text-amber-400">{resBySalon[s.id] || 0}</p><p className="text-[10px] uppercase tracking-wide text-neutral-500">RDV</p></div>
                  <div className="bg-neutral-950/60 rounded-lg py-2"><p className="text-lg font-bold text-blue-400">{empCount[s.id] || 0}</p><p className="text-[10px] uppercase tracking-wide text-neutral-500">Équipe</p></div>
                  <div className="bg-neutral-950/60 rounded-lg py-2"><p className="text-lg font-bold text-emerald-400">{svcCount[s.id] || 0}</p><p className="text-[10px] uppercase tracking-wide text-neutral-500">Services</p></div>
                  <div className="bg-neutral-950/60 rounded-lg py-2"><p className="text-lg font-bold text-violet-400">{phCount[s.id] || 0}</p><p className="text-[10px] uppercase tracking-wide text-neutral-500">Photos</p></div>
                </div>
                <p className="text-xs text-neutral-400 mb-4">Revenus : <span className="text-emerald-400 font-bold">{(resBySalon[s.id] || 0) * FEE} €</span></p>
                <div className="mt-auto flex gap-2">
                  <button onClick={() => setDrawer(s.id)} className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-semibold transition">Détails</button>
                  <button onClick={() => openEdit(s)} className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm transition" title="Modifier">✏️</button>
                  <Link href={`/${s.slug}`} className="py-2 px-3 bg-amber-500/15 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-lg text-sm transition" title="Vitrine">🌐</Link>
                  <Link href={`/${s.slug}/dashboard`} className="py-2 px-3 bg-violet-500/15 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30 rounded-lg text-sm transition" title="Dashboard gérant">📊</Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Cartographie des <span className="text-amber-400">rôles</span></h2>
          <p className="text-neutral-400 text-sm mb-6">Qui voit quoi, qui fait quoi — et les modules restants.</p>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-12">
          {[
            { icon: '👑', title: 'Super Admin (vous)', tone: 'violet', items: ['Création / édition des salons', 'Réservations par salon + total plateforme', 'Revenus 1 € / réservation', 'Supervision globale & statuts'], soon: '' },
            { icon: '💼', title: 'Gérant', tone: 'amber', items: ['Vitrine publique du salon', 'Services, équipe, photos, QR code', 'Dashboard RDV (confirmer / terminer / annuler)', 'Planning global + par employé'], soon: 'Planning détaillé' },
            { icon: '✂️', title: 'Employé', tone: 'blue', items: ['Espace perso (photo, prénom, spécialités)', 'Ses RDV assignés', 'Planning & disponibilités'], soon: 'Dispos / emploi du temps' },
            { icon: '🧑', title: 'Client', tone: 'emerald', items: ['Identification nom + téléphone', 'Vitrine + galerie photos', 'Réservation : coupe + coiffeur + créneau', 'Mes réservations (modifier / annuler)', 'Frais : 1 € forfait / réservation (famille incluse)'], soon: 'Paiement Stripe' },
          ].map((r, i) => (
            <Reveal key={r.title} delay={i * 80}>
              <div className={`bg-neutral-900/70 border rounded-2xl p-5 h-full ${ROLE_TONE[r.tone].card}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{r.icon}</span>
                  <h3 className="font-bold text-white">{r.title}</h3>
                </div>
                <ul className="space-y-2 text-sm text-neutral-300">
                  {r.items.map(it => <li key={it} className="flex gap-2"><span className={ROLE_TONE[r.tone].dot}>•</span>{it}</li>)}
                </ul>
                {r.soon && <p className="mt-3 text-xs px-2 py-1 rounded-md bg-neutral-800 text-neutral-400 inline-block">⏳ À venir : {r.soon}</p>}
              </div>
            </Reveal>
          ))}
        </div>

        <footer className="border-t border-neutral-800 pt-6 pb-10 text-center text-neutral-500 text-sm">
          © 2026 MonSalon · Console Super Admin · {salons.length} salon{salons.length > 1 ? 's' : ''} · {totalRes} réservation{totalRes > 1 ? 's' : ''}
        </footer>
      </div>

      {drawerSalon && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDrawer(null)} />
          <div className="relative w-full max-w-md h-full bg-neutral-900 border-l border-neutral-800 overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{drawerSalon.name}</h2>
                <p className="text-xs text-neutral-500 font-mono">/{drawerSalon.slug} · {drawerSalon.theme}</p>
              </div>
              <button onClick={() => setDrawer(null)} className="w-9 h-9 rounded-lg bg-neutral-800 hover:bg-red-900 transition">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-neutral-950 rounded-xl p-4 border border-amber-500/30"><p className="text-2xl font-bold text-amber-400">{drawerAppts.length}</p><p className="text-xs text-neutral-400">Réservations</p></div>
              <div className="bg-neutral-950 rounded-xl p-4 border border-emerald-500/30"><p className="text-2xl font-bold text-emerald-400">{drawerAppts.length * FEE} €</p><p className="text-xs text-neutral-400">Revenus</p></div>
              <div className="bg-neutral-950 rounded-xl p-4 border border-blue-500/30"><p className="text-2xl font-bold text-blue-400">{empCount[drawerSalon.id] || 0}</p><p className="text-xs text-neutral-400">Employés</p></div>
              <div className="bg-neutral-950 rounded-xl p-4 border border-violet-500/30"><p className="text-2xl font-bold text-violet-400">{phCount[drawerSalon.id] || 0}</p><p className="text-xs text-neutral-400">Photos</p></div>
            </div>
            
            {/* NOUVEAU : Section Gestion du Gérant dans le Drawer */}
            <div className="mb-6 p-4 bg-neutral-950/50 rounded-xl border border-neutral-800">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">👤 Gestion du Gérant</h3>
              <p className="text-xs text-neutral-400 mb-3">
                {drawerSalon.manager_id ? 'Un gérant est déjà assigné à ce salon.' : 'Aucun gérant n\'est encore assigné.'}
              </p>
              <button 
                onClick={() => { setInviteModal({ salonId: drawerSalon.id, salonName: drawerSalon.name }); setDrawer(null) }}
                className="w-full py-2.5 bg-amber-500/15 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                ⚙️ Configurer / Inviter un gérant
              </button>
            </div>

            <h3 className="text-sm font-bold text-white mb-3">Statuts des RDV</h3>
            <div className="mb-6"><Donut counts={drawerStatus} total={drawerAppts.length} /></div>
            <h3 className="text-sm font-bold text-white mb-3">Accès rapides</h3>
            <div className="grid grid-cols-2 gap-2 mb-6">
              <Link href={`/${drawerSalon.slug}`} className="py-2.5 text-center bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-semibold hover:bg-amber-500/30 transition">Vitrine</Link>
              <Link href={`/${drawerSalon.slug}/dashboard`} className="py-2.5 text-center bg-violet-500/15 text-violet-300 border border-violet-500/30 rounded-lg text-sm font-semibold hover:bg-violet-500/30 transition">Dashboard</Link>
              <Link href={`/${drawerSalon.slug}/dashboard/services`} className="py-2.5 text-center bg-neutral-800 rounded-lg text-sm hover:bg-neutral-700 transition">Services</Link>
              <Link href={`/${drawerSalon.slug}/dashboard/employees`} className="py-2.5 text-center bg-neutral-800 rounded-lg text-sm hover:bg-neutral-700 transition">Équipe</Link>
              <Link href={`/${drawerSalon.slug}/dashboard/photos`} className="py-2.5 text-center bg-neutral-800 rounded-lg text-sm hover:bg-neutral-700 transition">Photos</Link>
              <Link href={`/${drawerSalon.slug}/dashboard/qrcode`} className="py-2.5 text-center bg-neutral-800 rounded-lg text-sm hover:bg-neutral-700 transition">QR code</Link>
            </div>
            <button onClick={() => { openEdit(drawerSalon); setDrawer(null) }} className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-semibold transition">✏️ Modifier le salon</button>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-5">{modal.mode === 'create' ? 'Créer un salon' : 'Modifier le salon'}</h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Nom du salon *</label>
                <input value={fName} onChange={e => { setFName(e.target.value); if (!slugTouched) setFSlug(slugify(e.target.value)) }} className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-amber-500" placeholder="Ex : Karim Coiffure" autoFocus />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Slug (URL) *</label>
                <input value={fSlug} onChange={e => { setSlugTouched(true); setFSlug(slugify(e.target.value)) }} className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white font-mono focus:outline-none focus:border-amber-500" placeholder="karim-coiffure" />
                <p className="text-xs text-neutral-500 mt-1">Vitrine : /{fSlug || '...'}</p>
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Thème</label>
                <div className="grid grid-cols-4 gap-2">
                  {THEMES.map(t => (
                    <button key={t} type="button" onClick={() => setFTheme(t)} className={`py-2 rounded-lg text-sm font-semibold capitalize transition ${fTheme === t ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}>{t}</button>
                  ))}
                </div>
              </div>
              {formErr && <div className="bg-red-900/20 border border-red-800 text-red-300 px-4 py-3 rounded-xl text-sm">{formErr}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} disabled={saving} className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-medium transition disabled:opacity-50">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition disabled:opacity-50">{saving ? 'Enregistrement...' : modal.mode === 'create' ? 'Créer' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NOUVEAU : Modale d'invitation / création de gérant */}
      {inviteModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Gérer le gérant</h2>
            <p className="text-sm text-neutral-400 mb-6">Pour le salon : <span className="text-amber-400 font-semibold">{inviteModal.salonName}</span></p>
            
            <form onSubmit={handleInviteManager} className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Mode d'ajout</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setInvMode('invite')} className={`py-2 rounded-lg text-sm font-semibold transition ${invMode === 'invite' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}>
                    📧 Invitation par mail
                  </button>
                  <button type="button" onClick={() => setInvMode('manual')} className={`py-2 rounded-lg text-sm font-semibold transition ${invMode === 'manual' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}>
                    🔑 Mot de passe manuel
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-2">Adresse email du gérant *</label>
                <input 
                  type="email" 
                  value={invEmail} 
                  onChange={e => setInvEmail(e.target.value)} 
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-amber-500" 
                  placeholder="gerant@salon.com" 
                  required 
                />
              </div>

              {invMode === 'manual' && (
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Mot de passe provisoire *</label>
                  <input 
                    type="password" 
                    value={invPassword} 
                    onChange={e => setInvPassword(e.target.value)} 
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-amber-500" 
                    placeholder="Min. 6 caractères" 
                    minLength={6}
                    required 
                  />
                  <p className="text-xs text-neutral-500 mt-1">Le gérant pourra le changer après sa première connexion.</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setInviteModal(null)} disabled={invLoading} className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-medium transition disabled:opacity-50">Annuler</button>
                <button type="submit" disabled={invLoading} className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition disabled:opacity-50">
                  {invLoading ? 'Traitement...' : (invMode === 'invite' ? 'Envoyer l\'invitation' : 'Créer le compte')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-xl border shadow-xl text-sm ${t.type === 'success' ? 'bg-emerald-900/90 border-emerald-700 text-emerald-200' : t.type === 'error' ? 'bg-red-900/90 border-red-700 text-red-200' : 'bg-neutral-800/95 border-neutral-700 text-neutral-200'}`}>
            {t.type === 'success' ? '✅' : t.type === 'error' ? '⚠️' : 'ℹ️'} {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}