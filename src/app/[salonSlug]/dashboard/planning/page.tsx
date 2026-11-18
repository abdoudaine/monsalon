// ============================================================
// FICHIER : src/app/[salonSlug]/dashboard/planning/page.tsx
// COMPOSANT : ManagerPlanningPage (avec vue Mois ajoutee)
// ============================================================
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getThemeStyles, type SalonTheme } from '@/lib/themes'

interface Emp { id: string; first_name: string; photo_url: string | null; availabilities: any }
interface Svc { id: string; name: string; duration_minutes: number; price_display: number }
interface Appt { id: string; salon_id: string; client_name: string | null; client_phone: string | null; service_id: string; employee_id: string | null; start_time: string; end_time: string; status: string; payment_status: string }
interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string; action?: { label: string; onClick: () => void } }

const PALETTE = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'En attente', color: '#eab308', icon: '⏳' },
  confirmed: { label: 'Confirme', color: '#2563eb', icon: '✔' },
  completed: { label: 'Termine', color: '#16a34a', icon: '✓' },
  cancelled: { label: 'Annule', color: '#dc2626', icon: '✕' },
}
const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const START = 8 * 60, END = 19 * 60, STEP = 30, ROWH = 48
const GRID_H = ((END - START) / STEP) * ROWH

const DEFAULT_C = { bg: '#09090b', bgCard: '#18181b', text: '#fafafa', textMuted: '#a1a1aa', accent: '#fbbf24', border: '#27272a', button: '#f59e0b', buttonText: '#000000' }

const minOf = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const mondayOf = (d: Date) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; return addDays(x, -day) }
const clock = (iso: string) => (iso || '').slice(11, 16)
const dayOf = (iso: string) => (iso || '').slice(0, 10)

function withAlpha(hex: string, a: number): string {
  if (!hex) return `rgba(0,0,0,${a})`
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

interface Positioned { a: Appt; top: number; height: number; lane: number; lanes: number }
function layoutColumn(list: Appt[], durOf: (a: Appt) => number): Positioned[] {
  const sorted = [...list].sort((x, y) => minOf(clock(x.start_time)) - minOf(clock(y.start_time)))
  const res: Positioned[] = []
  let cluster: { items: { a: Appt; s: number; e: number; lane: number }[]; lanes: number; end: number } | null = null
  const flush = () => {
    if (!cluster) return
    const lanes = cluster.lanes
    for (const it of cluster.items) res.push({ a: it.a, top: ((it.s - START) / STEP) * ROWH, height: Math.max(ROWH * 0.85, ((it.e - it.s) / STEP) * ROWH), lane: it.lane, lanes })
    cluster = null
  }
  for (const a of sorted) {
    const s = clamp(minOf(clock(a.start_time)), START, END)
    const e = clamp(s + durOf(a), START, END)
    if (cluster && s >= cluster.end) flush()
    if (!cluster) cluster = { items: [], lanes: 1, end: e }
    const laneEnds: number[] = []
    for (const it of cluster.items) laneEnds[it.lane] = Math.max(laneEnds[it.lane] || 0, it.e)
    let lane = 0
    while (laneEnds[lane] !== undefined && laneEnds[lane] > s) lane++
    cluster.items.push({ a, s, e, lane })
    cluster.lanes = Math.max(cluster.lanes, lane + 1)
    cluster.end = Math.max(cluster.end, e)
  }
  flush()
  return res
}

function openRanges(emp: Emp, dayName: string, dKey: string): 'closed' | { open: number; close: number }[] | null {
  const a = emp.availabilities
  if (!a || typeof a !== 'object') return null
  const exceptions = a.exceptions || {}
  if (exceptions[dKey]) {
    const ex = exceptions[dKey]
    if (ex.is_open === false) return 'closed'
    return [{ open: minOf(ex.open || '09:00'), close: minOf(ex.close || '18:00') }]
  }
  const std = a.standard || a
  const d = std[dayName]
  if (d === undefined || d === null) return null
  if (Array.isArray(d)) {
    const r = d.map((s: string) => { const [o, c] = String(s).split('-'); return { open: minOf(o), close: minOf(c) } }).filter((x: any) => !isNaN(x.open) && !isNaN(x.close))
    return r.length ? r : null
  }
  if (typeof d === 'object') {
    if (d.is_open === false) return 'closed'
    if (d.open && d.close) return [{ open: minOf(d.open), close: minOf(d.close) }]
  }
  return null
}

function Reveal({ children, delay = 0, style = {} }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.disconnect() } }, { threshold: 0.08 })
    o.observe(el); return () => o.disconnect()
  }, [])
  return <div ref={ref} style={{ ...style, opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(20px)', transition: `opacity .55s ease ${delay}ms, transform .55s cubic-bezier(.22,1,.36,1) ${delay}ms` }}>{children}</div>
}

function Avatar({ emp, color, size = 28 }: { emp: Emp | undefined; color: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, background: `${color}33`, color, border: `1px solid ${color}88`, fontSize: size * 0.4, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
      {emp?.photo_url ? <img src={emp.photo_url} alt={emp.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (emp?.first_name?.charAt(0).toUpperCase() || '?')}
    </span>
  )
}

export default function ManagerPlanningPage() {
  const params = useParams()
  const slug = params.salonSlug as string
  const supabase = createClient()

  const [salon, setSalon] = useState<any>(null)
  const [colors, setColors] = useState<any>(null)
  const [employees, setEmployees] = useState<Emp[]>([])
  const [services, setServices] = useState<Svc[]>([])
  const [appts, setAppts] = useState<Appt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<'day' | 'week' | 'month'>('week')
  const [anchor, setAnchor] = useState<Date>(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d })
  const [empFilter, setEmpFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [nowMin, setNowMin] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() })
  const tid = useRef(0)
  const [selectedMonthDay, setSelectedMonthDay] = useState<string | null>(null)

  const toast = useCallback((type: Toast['type'], message: string, action?: Toast['action']) => {
    const id = ++tid.current
    setToasts(p => [...p, { id, type, message, action }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), action ? 6000 : 3200)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('')
      const { data: s, error: se } = await supabase.from('salons').select('*').eq('slug', slug).single()
      if (se || !s) { setError('Salon introuvable.'); setLoading(false); return }
      setSalon(s)
      setColors(getThemeStyles((s.theme as SalonTheme) || 'luxe'))
      const [{ data: e }, { data: sv }, { data: a }] = await Promise.all([
        supabase.from('employees').select('id, first_name, photo_url, availabilities').eq('salon_id', s.id).order('first_name'),
        supabase.from('services').select('id, name, duration_minutes, price_display').eq('salon_id', s.id),
        supabase.from('appointments').select('id, salon_id, client_name, client_phone, service_id, employee_id, start_time, end_time, status, payment_status').eq('salon_id', s.id),
      ])
      setEmployees((e as Emp[]) || []); setServices((sv as Svc[]) || []); setAppts((a as Appt[]) || [])
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    const t = setInterval(() => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()) }, 60000)
    return () => clearInterval(t)
  }, [])

  const c = colors || DEFAULT_C

  const svcOf = (id: string) => services.find(s => s.id === id)
  const empOf = (id: string | null) => employees.find(e => e.id === id)
  const colorOf = (id: string | null) => { const i = employees.findIndex(e => e.id === id); return i >= 0 ? PALETTE[i % PALETTE.length] : c.textMuted }
  const durOf = (a: Appt) => svcOf(a.service_id)?.duration_minutes || 30

  const weekStart = mondayOf(anchor)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const rangeKeys = view === 'day' ? [dateKey(anchor), dateKey(anchor)] : view === 'week' ? [dateKey(weekDays[0]), dateKey(weekDays[6])] : [dateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1)), dateKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0))]

  const periodAppts = appts.filter(a => {
    const d = dayOf(a.start_time)
    if (d < rangeKeys[0] || d > rangeKeys[1]) return false
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (empFilter !== 'all' && a.employee_id !== empFilter) return false
    return true
  })

  const columns: (Emp | null)[] = empFilter === 'all' ? [...employees, null] : employees.filter(e => e.id === empFilter)
  const dayAppts = periodAppts.filter(a => dayOf(a.start_time) === dateKey(anchor))
  const revenue = periodAppts.filter(a => a.status !== 'cancelled').reduce((s, a) => s + (svcOf(a.service_id)?.price_display || 0), 0)
  const countBy = (st: string) => periodAppts.filter(a => a.status === st).length

  const isToday = dateKey(anchor) === dateKey(new Date())
  const nowTop = ((clamp(nowMin, START, END) - START) / STEP) * ROWH

  const drawerAppt = appts.find(a => a.id === drawerId) || null

  const setStatus = (id: string, next: string) => {
    const old = appts.find(a => a.id === id)
    if (!old) return
    const prev = old.status
    setAppts(p => p.map(a => a.id === id ? { ...a, status: next } : a))
    supabase.from('appointments').update({ status: next }).eq('id', id).then(({ error }) => {
      if (error) { setAppts(p => p.map(a => a.id === id ? { ...a, status: prev } : a)); toast('error', `Echec : ${error.message}`) }
      else if (next === 'cancelled') {
        toast('info', 'RDV annule.', { label: 'Retablir', onClick: () => {
          setAppts(p => p.map(a => a.id === id ? { ...a, status: prev } : a))
          supabase.from('appointments').update({ status: prev }).eq('id', id)
          toast('success', 'RDV retabli.')
        } })
      } else toast('success', `Statut : ${STATUS_META[next]?.label || next}.`)
    })
  }

  const exportCSV = () => {
    const rows = [['Date', 'Heure', 'Client', 'Telephone', 'Service', 'Coiffeur', 'Statut', 'Prix']]
    for (const a of [...periodAppts].sort((x, y) => x.start_time.localeCompare(y.start_time))) {
      rows.push([dayOf(a.start_time), clock(a.start_time), a.client_name || '', a.client_phone || '', svcOf(a.service_id)?.name || '', empOf(a.employee_id)?.first_name || 'Non assigne', STATUS_META[a.status]?.label || a.status, String(svcOf(a.service_id)?.price_display || 0)])
    }
    const csv = rows.map(r => r.map(cc => `"${String(cc).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `planning-${slug}-${rangeKeys[0]}.csv`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    toast('success', 'Export CSV telecharge.')
  }

  const nav = (dir: number) => {
    if (view === 'day') setAnchor(d => addDays(d, dir))
    else if (view === 'week') setAnchor(d => addDays(d, dir * 7))
    else setAnchor(d => { const x = new Date(d); x.setMonth(x.getMonth() + dir); return x })
  }
  const today = () => { const d = new Date(); d.setHours(12, 0, 0, 0); setAnchor(d) }

  const inputStyle: React.CSSProperties = { background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '8px 12px', fontSize: '14px', color: c.text, outline: 'none' }
  const btnStyle: React.CSSProperties = { borderRadius: '12px', border: `1px solid ${c.border}`, background: c.bgCard, color: c.textMuted, fontWeight: 700, cursor: 'pointer' }

  // Helpers pour la vue Mois
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year: number, month: number) => { const day = new Date(year, month, 1).getDay(); return day === 0 ? 6 : day - 1 }
  const monthName = anchor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const daysInMonth = getDaysInMonth(anchor.getFullYear(), anchor.getMonth())
  const firstDay = getFirstDayOfMonth(anchor.getFullYear(), anchor.getMonth())
  const monthApptsByDay = periodAppts.reduce((acc: Record<string, Appt[]>, a) => {
    const dk = dayOf(a.start_time)
    if (!acc[dk]) acc[dk] = []
    acc[dk].push(a)
    return acc
  }, {})

  if (loading) return <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.accent }}>Chargement du planning...</div>
  if (error || !salon) return <div style={{ minHeight: '100vh', background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}><div style={{ textAlign: 'center' }}><p style={{ color: '#ef4444', fontSize: '20px', marginBottom: '16px' }}>{error}</p><Link href={`/${slug}/dashboard`} style={{ color: c.accent, textDecoration: 'underline' }}>&larr; Dashboard</Link></div></div>

  const slots = Array.from({ length: (END - START) / STEP }, (_, i) => START + i * STEP)

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text }}>
      <style>{`.pl-scroll::-webkit-scrollbar{width:10px;height:10px}.pl-scroll::-webkit-scrollbar-track{background:${c.bg}}.pl-scroll::-webkit-scrollbar-thumb{background:${c.accent};border-radius:8px}.pl-scroll{scrollbar-color:${c.accent} ${c.bg};scrollbar-width:thin}.pl-closed{background-image:repeating-linear-gradient(45deg,rgba(220,38,38,.12) 0 8px,transparent 8px 16px)}`}</style>

      <div style={{ maxWidth: '1500px', margin: '0 auto', padding: '16px' }}>
        <Reveal style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', borderBottom: `1px solid ${c.border}`, paddingBottom: '20px' }}>
          <div>
            <Link href={`/${slug}/dashboard`} style={{ color: c.textMuted, textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '8px' }}>&larr; Dashboard RDV</Link>
            <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em' }}>Planning &middot; <span style={{ color: c.accent }}>{salon.name}</span></h1>
            <p style={{ color: c.textMuted, marginTop: '4px', fontSize: '14px' }}>
              {view === 'day' ? anchor.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) 
               : view === 'week' ? `Semaine du ${weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
               : monthName.charAt(0).toUpperCase() + monthName.slice(1)}
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            {/* Selecteur de vue */}
            <div style={{ display: 'flex', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${c.border}` }}>
              {(['day', 'week', 'month'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{ padding: '8px 16px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', background: view === v ? c.button : c.bgCard, color: view === v ? c.buttonText : c.textMuted }}>
                  {v === 'day' ? 'Jour' : v === 'week' ? 'Semaine' : 'Mois'}
                </button>
              ))}
            </div>
            <button onClick={() => nav(-1)} style={{ ...btnStyle, width: '40px', height: '40px' }}>&lsaquo;</button>
            <button onClick={today} style={{ ...btnStyle, padding: '0 16px', height: '40px', fontSize: '14px' }}>Aujourd'hui</button>
            <button onClick={() => nav(1)} style={{ ...btnStyle, width: '40px', height: '40px' }}>&rsaquo;</button>
            <button onClick={exportCSV} style={{ padding: '0 16px', height: '40px', borderRadius: '12px', background: withAlpha(c.accent, 0.15), border: `1px solid ${withAlpha(c.accent, 0.4)}`, color: c.accent, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>&#11015; CSV</button>
          </div>
        </Reveal>

        <Reveal delay={80} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
          {([
            { v: periodAppts.length, l: 'RDV periode', col: c.text, b: c.border },
            { v: countBy('confirmed'), l: 'Confirmes', col: '#2563eb', b: withAlpha('#2563eb', 0.3) },
            { v: countBy('completed'), l: 'Termines', col: '#16a34a', b: withAlpha('#16a34a', 0.3) },
            { v: countBy('cancelled'), l: 'Annules', col: '#dc2626', b: withAlpha('#dc2626', 0.3) },
            { v: `${revenue} EUR`, l: 'CA previsionnel', col: c.accent, b: withAlpha(c.accent, 0.3) },
          ] as any[]).map((s, i) => (
            <div key={i} style={{ background: c.bgCard, border: `1px solid ${s.b}`, borderRadius: '12px', padding: '12px' }}>
              <p style={{ fontSize: '24px', fontWeight: 700, color: s.col, margin: 0 }}>{s.v}</p>
              <p style={{ fontSize: '12px', color: c.textMuted, margin: 0 }}>{s.l}</p>
            </div>
          ))}
        </Reveal>

        <Reveal delay={140} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
          <select value={empFilter} onChange={e => setEmpFilter(e.target.value)} style={inputStyle}>
            <option value="all">Tous les coiffeurs</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle}>
            <option value="all">Tous statuts</option>
            {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </Reveal>

        {/* VUE JOUR */}
        {view === 'day' && (
          <Reveal delay={200}>
            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', overflow: 'hidden' }}>
              <div className="pl-scroll" style={{ overflowX: 'auto' }}>
                <div style={{ display: 'flex', minWidth: '720px' }}>
                  <div style={{ width: '64px', flexShrink: 0, borderRight: `1px solid ${c.border}` }}>
                    <div style={{ height: '56px', borderBottom: `1px solid ${c.border}` }} />
                    <div style={{ position: 'relative', height: GRID_H }}>
                      {slots.map(m => (<div key={m} style={{ position: 'absolute', left: 0, right: 0, paddingRight: '8px', textAlign: 'right', transform: 'translateY(-50%)', top: ((m - START) / STEP) * ROWH, fontSize: m % 60 === 0 ? '12px' : '10px', fontWeight: m % 60 === 0 ? 700 : 400, color: m % 60 === 0 ? c.text : c.textMuted }}>{fmtMin(m)}</div>))}
                    </div>
                  </div>
                  {columns.map((emp) => {
                    const colAppts = dayAppts.filter(a => emp ? a.employee_id === emp.id : !a.employee_id)
                    const positioned = layoutColumn(colAppts, durOf)
                    const ranges = emp ? openRanges(emp, DAY_NAMES[anchor.getDay()], dateKey(anchor)) : null
                    const closed = ranges === 'closed'
                    const colColor = emp ? PALETTE[employees.findIndex(e => e.id === emp.id) % PALETTE.length] : c.textMuted
                    return (
                      <div key={emp?.id || 'none'} style={{ flex: 1, minWidth: '150px', borderRight: `1px solid ${c.border}` }}>
                        <div style={{ height: '56px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px' }}>
                          {emp ? (<><Avatar emp={emp} color={colColor} size={30} /><span style={{ fontWeight: 700, color: c.text, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.first_name}</span></>) : <span style={{ fontWeight: 700, color: c.textMuted, fontSize: '14px' }}>Non assigne</span>}
                          <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: colColor }}>{colAppts.length}</span>
                        </div>
                        <div className={closed ? 'pl-closed' : ''} style={{ position: 'relative', height: GRID_H }}>
                          {Array.from({ length: (END - START) / 60 }, (_, h) => (<div key={h} style={{ position: 'absolute', left: 0, right: 0, top: h * 2 * ROWH, height: 2 * ROWH, background: h % 2 === 0 ? withAlpha(c.text, 0.04) : 'transparent' }} />))}
                          {slots.map(m => (<div key={m} style={{ position: 'absolute', left: 0, right: 0, borderTop: `1px solid ${m % 60 === 0 ? withAlpha(c.text, 0.12) : withAlpha(c.text, 0.06)}`, top: ((m - START) / STEP) * ROWH }} />))}
                          {Array.isArray(ranges) && ranges.map((r, i) => (<div key={i} style={{ position: 'absolute', left: 0, right: 0, pointerEvents: 'none', top: ((clamp(r.open, START, END) - START) / STEP) * ROWH, height: ((clamp(r.close, START, END) - clamp(r.open, START, END)) / STEP) * ROWH, background: withAlpha('#10b981', 0.08) }} />))}
                          {closed && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Ferme</div>}
                          {isToday && (<div style={{ position: 'absolute', left: 0, right: 0, zIndex: 20, pointerEvents: 'none', top: nowTop }}><div style={{ height: '2px', background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.9)' }} /><div style={{ position: 'absolute', top: '-6px', left: 0, width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} /></div>)}
                          {positioned.map(p => {
                            const col = colorOf(p.a.employee_id)
                            const st = STATUS_META[p.a.status] || STATUS_META.pending
                            const w = 100 / p.lanes
                            const short = p.height < ROWH * 1.2
                            return (
                              <button key={p.a.id} onClick={() => setDrawerId(p.a.id)} style={{ position: 'absolute', top: p.top + 2, height: p.height - 4, left: `calc(${p.lane * w}% + 3px)`, width: `calc(${w}% - 6px)`, background: withAlpha(col, 0.35), borderLeft: `4px solid ${col}`, borderRadius: '8px', padding: '4px 8px', textAlign: 'left', overflow: 'hidden', cursor: 'pointer', opacity: p.a.status === 'cancelled' ? 0.4 : 1, color: c.text }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontSize: '12px', fontWeight: 700, color: c.text }}>{clock(p.a.start_time)}</span>{emp && <Avatar emp={emp} color={col} size={16} />}</div>
                                <p style={{ fontSize: '12px', fontWeight: 700, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{p.a.client_name || 'Client'}</p>
                                {!short && <p style={{ fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, color: col }}>{svcOf(p.a.service_id)?.name || 'Service'}</p>}
                                {!short && <p style={{ fontSize: '10px', color: c.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{st.icon} {st.label}</p>}
                              </button>
                            )
                          })}
                          {colAppts.length === 0 && !closed && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted, fontSize: '12px' }}>Aucun RDV</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </Reveal>
        )}

        {/* VUE SEMAINE */}
        {view === 'week' && (
          <Reveal delay={200}>
            <div className="pl-scroll" style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px', minWidth: '900px' }}>
                {weekDays.map(d => {
                  const key = dateKey(d)
                  const list = periodAppts.filter(a => dayOf(a.start_time) === key).sort((x, y) => x.start_time.localeCompare(y.start_time))
                  const isT = key === dateKey(new Date())
                  return (
                    <div key={key} style={{ background: c.bgCard, border: `1px solid ${isT ? c.accent : c.border}`, borderRadius: '16px', padding: '12px', minHeight: '220px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: isT ? c.accent : c.text, textTransform: 'capitalize', margin: 0 }}>{d.toLocaleDateString('fr-FR', { weekday: 'short' })} {d.getDate()}</p>
                        <span style={{ fontSize: '12px', color: c.textMuted }}>{list.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {list.length === 0 && <p style={{ fontSize: '12px', color: c.textMuted }}>&mdash;</p>}
                        {list.map(a => {
                          const col = colorOf(a.employee_id)
                          return (<button key={a.id} onClick={() => setDrawerId(a.id)} style={{ width: '100%', textAlign: 'left', borderRadius: '8px', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '8px', background: withAlpha(col, 0.2), borderLeft: `3px solid ${col}`, opacity: a.status === 'cancelled' ? 0.45 : 1, cursor: 'pointer', color: c.text }}><span style={{ fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{clock(a.start_time)}</span><span style={{ fontSize: '11px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.client_name || 'Client'}</span></button>)
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Reveal>
        )}

        {/* NOUVEAU : VUE MOIS */}
        {view === 'month' && (
          <Reveal delay={200}>
            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: c.textMuted, padding: '8px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ aspectRatio: '1', minHeight: '80px' }}></div>
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const d = new Date(anchor.getFullYear(), anchor.getMonth(), day)
                  const key = dateKey(d)
                  const dayApptsList = monthApptsByDay[key] || []
                  const isT = key === dateKey(new Date())
                  const isSunday = d.getDay() === 0

                  return (
                    <button
                      key={day}
                      onClick={() => dayApptsList.length > 0 && setSelectedMonthDay(key)}
                      style={{
                        aspectRatio: '1', minHeight: '80px', borderRadius: '8px',
                        border: `1px solid ${isT ? c.accent : c.border}`,
                        background: isT ? withAlpha(c.accent, 0.1) : c.bg,
                        padding: '6px', textAlign: 'left', cursor: dayApptsList.length > 0 ? 'pointer' : 'default',
                        display: 'flex', flexDirection: 'column', gap: '2px',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => { if (dayApptsList.length > 0) e.currentTarget.style.borderColor = c.accent }}
                      onMouseLeave={e => { if (!isT) e.currentTarget.style.borderColor = c.border }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: isSunday ? '#dc2626' : isT ? c.accent : c.text }}>{day}</span>
                        {dayApptsList.length > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: c.accent, background: withAlpha(c.accent, 0.2), padding: '2px 6px', borderRadius: '8px' }}>{dayApptsList.length}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                        {dayApptsList.slice(0, 3).map(a => {
                          const col = colorOf(a.employee_id)
                          return (
                            <div key={a.id} style={{ fontSize: '10px', padding: '2px 4px', borderRadius: '4px', background: withAlpha(col, 0.2), color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {clock(a.start_time)} {a.client_name || 'Client'}
                            </div>
                          )
                        })}
                        {dayApptsList.length > 3 && (
                          <div style={{ fontSize: '10px', color: c.textMuted, padding: '2px 4px' }}>+{dayApptsList.length - 3} autres</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </Reveal>
        )}
      </div>

      {/* Drawer RDV */}
      {drawerAppt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setDrawerId(null)} />
          <div className="pl-scroll" style={{ position: 'relative', width: '100%', maxWidth: '448px', height: '100%', background: c.bgCard, borderLeft: `1px solid ${c.border}`, overflowY: 'auto', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div><h2 style={{ fontSize: '24px', fontWeight: 700, color: c.text, margin: 0 }}>{drawerAppt.client_name || 'Client'}</h2><p style={{ fontSize: '14px', color: c.textMuted, margin: 0 }}>{drawerAppt.client_phone || '&mdash;'}</p></div>
              <button onClick={() => setDrawerId(null)} style={{ width: '36px', height: '36px', borderRadius: '8px', background: c.bg, border: `1px solid ${c.border}`, color: c.text, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {([
                ['Service', `${svcOf(drawerAppt.service_id)?.name || '&mdash;'} &middot; ${svcOf(drawerAppt.service_id)?.price_display || 0} EUR`],
                ['Duree', `${durOf(drawerAppt)} min`],
                ['Creneau', `${new Date(drawerAppt.start_time).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} &middot; ${clock(drawerAppt.start_time)}`],
              ] as [string, string][]).map(([l, v], i) => (
                <div key={i} style={{ background: c.bg, borderRadius: '12px', padding: '16px', border: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '14px', color: c.textMuted }}>{l}</span><span style={{ fontWeight: 700, color: c.text }}>{v}</span></div>
              ))}
              <div style={{ background: c.bg, borderRadius: '12px', padding: '16px', border: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '14px', color: c.textMuted }}>Coiffeur</span><span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: colorOf(drawerAppt.employee_id) }}><Avatar emp={empOf(drawerAppt.employee_id)} color={colorOf(drawerAppt.employee_id)} size={22} />{empOf(drawerAppt.employee_id)?.first_name || 'Non assigne'}</span></div>
              <div style={{ background: c.bg, borderRadius: '12px', padding: '16px', border: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '14px', color: c.textMuted }}>Statut</span><span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, background: withAlpha((STATUS_META[drawerAppt.status] || STATUS_META.pending).color, 0.15), color: (STATUS_META[drawerAppt.status] || STATUS_META.pending).color }}>{(STATUS_META[drawerAppt.status] || STATUS_META.pending).label}</span></div>
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: c.text, marginBottom: '12px' }}>Actions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button onClick={() => setStatus(drawerAppt.id, 'confirmed')} style={{ padding: '12px', borderRadius: '12px', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}>✔ Confirmer</button>
              <button onClick={() => setStatus(drawerAppt.id, 'completed')} style={{ padding: '12px', borderRadius: '12px', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}>✓ Terminer</button>
              <button onClick={() => setStatus(drawerAppt.id, 'pending')} style={{ padding: '12px', borderRadius: '12px', background: c.bg, color: c.text, fontWeight: 700, fontSize: '14px', border: `1px solid ${c.border}`, cursor: 'pointer' }}>⏳ En attente</button>
              <button onClick={() => setStatus(drawerAppt.id, 'cancelled')} style={{ padding: '12px', borderRadius: '12px', background: withAlpha('#dc2626', 0.15), color: '#dc2626', border: `1px solid ${withAlpha('#dc2626', 0.4)}`, fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>✕ Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* NOUVEAU : Modale pour les RDV d'un jour (vue Mois) */}
      {selectedMonthDay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: c.text, margin: 0 }}>
                RDV du {new Date(selectedMonthDay).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button onClick={() => setSelectedMonthDay(null)} style={{ width: '36px', height: '36px', borderRadius: '8px', background: c.bg, border: `1px solid ${c.border}`, color: c.text, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(monthApptsByDay[selectedMonthDay] || []).sort((a, b) => a.start_time.localeCompare(b.start_time)).map(a => {
                const col = colorOf(a.employee_id)
                const st = STATUS_META[a.status] || STATUS_META.pending
                return (
                  <button key={a.id} onClick={() => { setSelectedMonthDay(null); setDrawerId(a.id) }} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '16px', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: c.text }}>{clock(a.start_time)} - {a.client_name || 'Client'}</span>
                      <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: withAlpha(st.color, 0.15), color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: c.textMuted }}>
                      <span>{svcOf(a.service_id)?.name || 'Service'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: col }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col, display: 'inline-block' }}></span>
                        {empOf(a.employee_id)?.first_name || 'Non assigne'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 70, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '384px' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', border: `1px solid ${t.type === 'success' ? '#16a34a' : t.type === 'error' ? '#dc2626' : c.border}`, background: t.type === 'success' ? withAlpha('#16a34a', 0.9) : t.type === 'error' ? withAlpha('#dc2626', 0.9) : c.bgCard, color: t.type === 'info' ? c.text : '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', fontSize: '14px' }}>
            <span style={{ flex: 1 }}>{t.type === 'success' ? 'OK' : t.type === 'error' ? '!' : 'i'} {t.message}</span>
            {t.action && <button onClick={() => { t.action!.onClick(); setToasts(p => p.filter(x => x.id !== t.id)) }} style={{ fontWeight: 700, color: t.type === 'info' ? c.accent : '#fff', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </div>
  )
}