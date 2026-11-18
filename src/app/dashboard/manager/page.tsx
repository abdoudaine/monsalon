'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ManagerDashboardPage() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const supabase = createClient()

  useEffect(() => { loadAppointments() }, [])

  const loadAppointments = async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id, start_time, end_time, status,
        services (name, price_display, duration_minutes),
        profiles!appointments_client_id_fkey (full_name)
      `)
      .order('start_time', { ascending: true })
    if (!error && data) setAppointments(data)
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
    if (!error) loadAppointments()
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  const statusLabels: Record<string, string> = {
    pending: 'En attente', confirmed: 'Confirmé', completed: 'Terminé', cancelled: 'Annulé',
  }

  const filtered = filter === 'all' ? appointments : appointments.filter(a => a.status === filter)

  return (
    <div className="space-y-8">
      <div className="border-b border-gentlemen-gold/20 pb-6">
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-gentlemen-text">
          Gestion des <span className="text-gentlemen-gold">Rendez-vous</span>
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: appointments.length, color: 'text-gentlemen-goldLight' },
          { label: 'En attente', value: appointments.filter(a => a.status === 'pending').length, color: 'text-yellow-400' },
          { label: 'Confirmés', value: appointments.filter(a => a.status === 'confirmed').length, color: 'text-green-400' },
          { label: 'Terminés', value: appointments.filter(a => a.status === 'completed').length, color: 'text-blue-400' },
        ].map((s, i) => (
          <div key={i} className="bg-gentlemen-card rounded-xl p-5 border border-gentlemen-gold/10">
            <div className="text-gentlemen-muted text-xs uppercase tracking-wider font-semibold">{s.label}</div>
            <div className={`text-2xl sm:text-3xl font-display font-bold mt-2 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'Tous' },
          { key: 'pending', label: 'En attente' },
          { key: 'confirmed', label: 'Confirmés' },
          { key: 'completed', label: 'Terminés' },
          { key: 'cancelled', label: 'Annulés' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f.key
                ? 'bg-gentlemen-gold text-gentlemen-bg'
                : 'bg-gentlemen-card text-gentlemen-muted border border-gentlemen-gold/20 hover:border-gentlemen-gold/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="bg-gentlemen-card rounded-2xl border border-gentlemen-gold/10 overflow-hidden">
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-4 border-gentlemen-gold border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gentlemen-muted">Aucun rendez-vous</div>
        ) : (
          <div className="divide-y divide-gentlemen-gold/10">
            {filtered.map((apt) => {
              const date = new Date(apt.start_time)
              return (
                <div key={apt.id} className="p-4 sm:p-6 hover:bg-gentlemen-bg/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="text-gentlemen-text font-semibold text-lg">{apt.services?.name}</span>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColors[apt.status]}`}>
                          {statusLabels[apt.status]}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-gentlemen-muted">
                        <span>📅 {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                        <span>🕐 {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>⏱ {apt.services?.duration_minutes} min</span>
                        {apt.profiles?.full_name && <span>👤 {apt.profiles.full_name}</span>}
                      </div>
                    </div>
                    <div className="text-gentlemen-gold font-bold text-lg">{apt.services?.price_display}€</div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gentlemen-gold/10">
                    {apt.status === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(apt.id, 'confirmed')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
                          ✅ Confirmer
                        </button>
                        <button onClick={() => updateStatus(apt.id, 'cancelled')} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition">
                          ❌ Annuler
                        </button>
                      </>
                    )}
                    {apt.status === 'confirmed' && (
                      <button onClick={() => updateStatus(apt.id, 'completed')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
                        ✔️ Marquer terminé
                      </button>
                    )}
                    {apt.status === 'completed' && (
                      <span className="text-gentlemen-muted text-sm italic">Rendez-vous terminé</span>
                    )}
                    {apt.status === 'cancelled' && (
                      <span className="text-red-400 text-sm italic">Rendez-vous annulé</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}