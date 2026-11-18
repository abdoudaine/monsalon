'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { getThemeStyles, type SalonTheme } from '@/lib/themes'

interface Employee {
  id: string
  salon_id: string
  user_id: string | null
  first_name: string
  phone: string | null
  photo_url: string | null
  specialities: string[] | null
  availabilities: any
  created_at: string
}

function withAlpha(hex: string, a: number): string {
  if (!hex) return `rgba(0,0,0,${a})`
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function ManagerEmployeesPage() {
  const params = useParams()
  const slug = params.salonSlug as string
  const supabase = createClient()

  const [salonId, setSalonId] = useState<string | null>(null)
  const [colors, setColors] = useState<any>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [phone, setPhone] = useState('')
  const [specialities, setSpecialities] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // NOUVEAU : état pour la modale d'invitation
  const [inviteEmployee, setInviteEmployee] = useState<Employee | null>(null)

  const DEFAULT_C = { bg: '#09090b', bgCard: '#18181b', text: '#fafafa', textMuted: '#a1a1aa', accent: '#fbbf24', border: '#27272a', button: '#f59e0b', buttonText: '#000000' }
  const c = colors || DEFAULT_C

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: salonData, error } = await supabase
        .from('salons')
        .select('id, theme')
        .eq('slug', slug)
        .single()

      if (salonData && !error) {
        setSalonId(salonData.id)
        setColors(getThemeStyles((salonData.theme as SalonTheme) || 'luxe'))
        await loadEmployees(salonData.id)
      }
      setLoading(false)
    }
    fetchData()
  }, [slug, supabase])

  const loadEmployees = async (sId: string) => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('salon_id', sId)
      .order('first_name')

    if (!error && data) {
      setEmployees(data as Employee[])
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setFirstName('')
    setPhone('')
    setSpecialities('')
    setShowForm(false)
    setError('')
  }

  const handleCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const handleEdit = (employee: Employee) => {
    setEditingId(employee.id)
    setFirstName(employee.first_name)
    setPhone(employee.phone || '')
    setSpecialities(employee.specialities?.join(', ') || '')
    setShowForm(true)
    setError('')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !salonId) {
      setError('Le prenom est obligatoire.')
      return
    }

    setSaving(true)
    setError('')
    setSuccessMsg('')

    const specsArray = specialities.split(',').map(s => s.trim()).filter(s => s.length > 0)
    const employeeData = {
      salon_id: salonId,
      first_name: firstName.trim(),
      phone: phone.trim() || null,
      specialities: specsArray.length > 0 ? specsArray : null,
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('employees').update(employeeData).eq('id', editingId)
        if (error) throw error
        setSuccessMsg('Employe modifie avec succes !')
      } else {
        const { error } = await supabase.from('employees').insert(employeeData)
        if (error) throw error
        setSuccessMsg('Employe ajoute a l\'equipe !')
      }
      await loadEmployees(salonId)
      setTimeout(() => resetForm(), 1500)
    } catch (err: any) {
      console.error('Erreur sauvegarde:', err)
      setError(err.message || 'Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (employeeId: string, employeeName: string) => {
    if (!confirm(`Retirer "${employeeName}" de l'equipe ?`)) return

    const { error } = await supabase.from('employees').delete().eq('id', employeeId)
    if (error) {
      setError('Erreur lors de la suppression : ' + error.message)
    } else {
      setSuccessMsg('Employe retire de l\'equipe.')
      if (salonId) await loadEmployees(salonId)
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  // NOUVEAU : ouvrir la modale d'invitation
  const openInvite = (employee: Employee) => {
    setInviteEmployee(employee)
    setError('')
    setSuccessMsg('')
  }

  // NOUVEAU : copier le lien depuis la modale
  const copyInviteLink = (employee: Employee) => {
    const link = `${window.location.origin}/${slug}/employe/${employee.id}`
    navigator.clipboard.writeText(link)
    setSuccessMsg(`Lien copie pour ${employee.first_name} !`)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '12px', color: c.text, fontSize: '16px', outline: 'none' }
  const btnStyle: React.CSSProperties = { borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.accent }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span style={{ fontWeight: 500, letterSpacing: '0.05em' }}>Chargement de l'equipe...</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, padding: '16px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px', paddingBottom: '24px', borderBottom: `1px solid ${c.border}` }}>
          <div>
            <Link href={`/${slug}/dashboard`} style={{ color: c.textMuted, textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '8px' }}>
              &larr; Retour au tableau de bord
            </Link>
            <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em', margin: 0 }}>
              Gestion de l'<span style={{ color: c.accent }}>Equipe</span>
            </h1>
            <p style={{ color: c.textMuted, marginTop: '4px', fontSize: '14px' }}>
              {employees.length} membre{employees.length > 1 ? 's' : ''} dans l'equipe
            </p>
          </div>
          <button
            onClick={handleCreate}
            style={{ ...btnStyle, padding: '12px 24px', background: c.button, color: c.buttonText, display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content', fontSize: '16px', fontWeight: 700 }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>+</span> Ajouter un membre
          </button>
        </div>

        {/* Messages */}
        {successMsg && (
          <div style={{ marginBottom: '24px', background: withAlpha('#16a34a', 0.15), border: `1px solid ${withAlpha('#16a34a', 0.4)}`, color: '#16a34a', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✅</span> {successMsg}
          </div>
        )}
        {error && (
          <div style={{ marginBottom: '24px', background: withAlpha('#dc2626', 0.15), border: `1px solid ${withAlpha('#dc2626', 0.4)}`, color: '#dc2626', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Liste des employés */}
        {employees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 16px', background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: c.text, marginBottom: '8px' }}>Aucun membre dans l'equipe</h3>
            <p style={{ color: c.textMuted, marginBottom: '24px' }}>Ajoutez votre premier collaborateur.</p>
            <button onClick={handleCreate} style={{ ...btnStyle, padding: '12px 24px', background: c.button, color: c.buttonText, fontSize: '16px', fontWeight: 700 }}>
              Ajouter un membre
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {employees.map((emp) => (
              <div key={emp.id} style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '24px', transition: 'border-color 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700, color: c.accent, overflow: 'hidden', border: `2px solid ${c.border}`, flexShrink: 0 }}>
                    {emp.photo_url ? (
                      <img src={emp.photo_url} alt={emp.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      emp.first_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontWeight: 700, color: c.text, fontSize: '18px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.first_name}</h3>
                    {emp.phone && (
                      <p style={{ fontSize: '14px', color: c.textMuted, marginTop: '4px', margin: 0 }}>📞 {emp.phone}</p>
                    )}
                  </div>
                </div>

                {emp.specialities && emp.specialities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                    {emp.specialities.map((spec, idx) => (
                      <span key={idx} style={{ fontSize: '12px', padding: '4px 8px', background: withAlpha(c.accent, 0.1), color: c.accent, borderRadius: '6px', border: `1px solid ${withAlpha(c.accent, 0.2)}` }}>
                        {spec}
                      </span>
                    ))}
                  </div>
                )}

                {/* Boutons d'action : Modifier / Inviter (QR) / Supprimer */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleEdit(emp)} style={{ ...btnStyle, flex: 1, padding: '8px', background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                    ✏️ Modifier
                  </button>
                  <button onClick={() => openInvite(emp)} style={{ ...btnStyle, flex: 1, padding: '8px', background: withAlpha('#2563eb', 0.1), color: '#2563eb', border: `1px solid ${withAlpha('#2563eb', 0.3)}` }} title="Inviter cet employe (QR code)">
                    📱 Inviter
                  </button>
                  <button onClick={() => handleDelete(emp.id, emp.first_name)} style={{ ...btnStyle, padding: '8px 12px', background: withAlpha('#dc2626', 0.1), color: '#dc2626', border: `1px solid ${withAlpha('#dc2626', 0.3)}` }} title="Supprimer">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Formulaire (inchangée) */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '24px', maxWidth: '448px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: c.text, marginBottom: '24px', margin: '0 0 24px 0' }}>
                {editingId ? 'Modifier le membre' : 'Nouveau membre'}
              </h2>

              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Prenom *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    style={inputStyle}
                    placeholder="Ex: Karim, Sofia, Amine..."
                    required
                    autoFocus
                  />
                  <p style={{ fontSize: '12px', color: c.textMuted, marginTop: '8px' }}>
                    L'employe pourra completer son profil plus tard depuis son espace.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Telephone (optionnel)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={inputStyle}
                    placeholder="06 12 34 56 78"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: c.textMuted, marginBottom: '8px' }}>Specialites (separees par des virgules)</label>
                  <input
                    type="text"
                    value={specialities}
                    onChange={(e) => setSpecialities(e.target.value)}
                    style={inputStyle}
                    placeholder="Ex: Coupe, Coloration, Barbe"
                  />
                </div>

                {error && (
                  <div style={{ background: withAlpha('#dc2626', 0.15), border: `1px solid ${withAlpha('#dc2626', 0.4)}`, color: '#dc2626', padding: '12px', borderRadius: '12px', fontSize: '14px' }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', paddingTop: '16px' }}>
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={saving}
                    style={{ ...btnStyle, flex: 1, padding: '12px', background: c.bg, color: c.textMuted, border: `1px solid ${c.border}`, opacity: saving ? 0.5 : 1 }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !firstName.trim()}
                    style={{ ...btnStyle, flex: 1, padding: '12px', background: c.button, color: c.buttonText, opacity: (saving || !firstName.trim()) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        Enregistrement...
                      </>
                    ) : (
                      editingId ? 'Modifier' : 'Ajouter'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* NOUVEAU : Modale d'invitation employé (QR Code + lien) */}
        {inviteEmployee && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '16px' }}>
            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '28px', maxWidth: '420px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', textAlign: 'center' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: c.text, margin: '0 0 8px 0' }}>
                Inviter <span style={{ color: c.accent }}>{inviteEmployee.first_name}</span>
              </h2>
              <p style={{ fontSize: '14px', color: c.textMuted, margin: '0 0 24px 0' }}>
                Faites-lui scanner ce QR code avec son telephone, ou envoyez-lui le lien.
              </p>

              {/* QR Code sur fond blanc (contraste maximal pour le scan) */}
              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '20px' }}>
                <QRCodeSVG
                  value={`${window.location.origin}/${slug}/employe/${inviteEmployee.id}`}
                  size={180}
                  level="M"
                  includeMargin={true}
                />
              </div>

              {/* Le lien */}
              <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '10px', padding: '12px', marginBottom: '20px', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '12px', color: c.accent }}>
                {`${window.location.origin}/${slug}/employe/${inviteEmployee.id}`}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => copyInviteLink(inviteEmployee)}
                  style={{ ...btnStyle, flex: 1, padding: '12px', background: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: '14px' }}
                >
                  📋 Copier le lien
                </button>
                <button
                  onClick={() => setInviteEmployee(null)}
                  style={{ ...btnStyle, flex: 1, padding: '12px', background: c.bg, color: c.textMuted, border: `1px solid ${c.border}`, fontWeight: 600, fontSize: '14px' }}
                >
                  Fermer
                </button>
              </div>

              <p style={{ fontSize: '12px', color: c.textMuted, marginTop: '20px', lineHeight: 1.5 }}>
                👉 Une fois le lien ouvert, <strong style={{ color: c.text }}>{inviteEmployee.first_name}</strong> choisira son mot de passe et accederra a son espace perso (planning + ses reservations).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}