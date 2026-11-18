import { createClient } from '@/lib/supabase/server'
import { getTheme, THEME_STYLES, type SalonTheme } from '@/lib/themes'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function SalonPublicPage(props: {
  params: Promise<{ salonSlug: string }> | { salonSlug: string }
}) {
  const params = await Promise.resolve(props.params)
  const slug = params.salonSlug

  const supabase = await createClient()

  const { data: salon, error } = await supabase
    .from('salons')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !salon) {
    notFound()
  }

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('salon_id', salon.id)
    .order('name')

  const { data: employees } = await supabase
    .from('employees')
    .select('id, first_name, photo_url, specialities')
    .eq('salon_id', salon.id)
    .order('first_name')

  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('salon_id', salon.id)
    .order('created_at', { ascending: false })

  const themeKey = (salon.theme as SalonTheme) || 'luxe'
  const theme = getTheme(salon.theme)
  const colors = THEME_STYLES[themeKey]
  const hours = salon.settings?.opening_hours || {}

  const dayOrder = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
  const sortedHours = dayOrder
    .filter(day => hours[day] !== undefined)
    .map(day => [day, hours[day]] as [string, any])

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
      {/* Hero */}
      <section style={{ position: 'relative', height: '80vh', minHeight: '600px', background: colors.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '16px', maxWidth: '896px', margin: '0 auto' }}>
          <div style={{ display: 'inline-block', padding: '8px 16px', borderRadius: '9999px', border: `1px solid ${colors.accent}40`, color: colors.accent, fontSize: '14px', marginBottom: '24px', backdropFilter: 'blur(4px)', background: `${colors.accent}10` }}>
            ✂️ Salon de coiffure premium
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 700, marginBottom: '24px', textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            {salon.name}
          </h1>
          <p style={{ fontSize: '20px', color: colors.textMuted, marginBottom: '40px', maxWidth: '672px', margin: '0 auto 40px' }}>
            L'art de la coiffure, l'élégance en plus
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', alignItems: 'center' }}>
            <Link
              href={`/${slug}/reservation`}
              style={{ padding: '16px 32px', background: colors.button, color: colors.buttonText, fontWeight: 700, borderRadius: '12px', textDecoration: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', transition: 'transform 0.2s' }}
            >
              Réserver un créneau
            </Link>
            <Link
              href={`/${slug}/mes-reservations`}
              style={{ padding: '16px 32px', background: colors.card, border: `2px solid ${colors.accent}40`, color: colors.text, fontWeight: 700, borderRadius: '12px', textDecoration: 'none', transition: 'transform 0.2s' }}
            >
              Mes réservations
            </Link>
          </div>
        </div>
      </section>

      {/* Galerie Photos */}
      {photos && photos.length > 0 && (
        <section style={{ padding: '64px 16px', maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '12px' }}>
              Notre <span style={{ color: colors.accent }}>Galerie</span>
            </h2>
            <p style={{ color: colors.textMuted }}>Découvrez l'ambiance de notre salon</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            {photos.map((photo: any) => (
              <div
                key={photo.id}
                style={{ aspectRatio: '1', borderRadius: '16px', overflow: 'hidden', border: `2px solid ${colors.border}`, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', transition: 'transform 0.3s' }}
              >
                <img
                  src={photo.url}
                  alt={`Photo ${salon.name}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Services */}
      <section style={{ padding: '80px 16px', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '12px' }}>
            Nos <span style={{ color: colors.accent }}>Services</span>
          </h2>
          <p style={{ color: colors.textMuted }}>Des prestations de qualité, des prix transparents</p>
        </div>
        
        {services && services.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {services.map((service: any) => (
              <div
                key={service.id}
                style={{ background: colors.card, borderRadius: '16px', padding: '24px', border: `2px solid ${colors.border}`, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', transition: 'transform 0.3s' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, color: colors.text }}>{service.name}</h3>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: colors.accent }}>
                    {service.price_display}€
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', color: colors.textMuted, fontSize: '14px', marginBottom: '8px' }}>
                  <svg style={{ width: '16px', height: '16px', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {service.duration_minutes} minutes
                </div>
                {service.category && (
                  <div style={{ fontSize: '12px', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '12px', borderTop: `1px solid ${colors.border}20` }}>
                    {service.category === 'adult' ? '👤 Adulte' : service.category === 'child' ? '👶 Enfant' : '👥 Mixte'}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: colors.textMuted, padding: '48px 0' }}>Services bientôt disponibles</p>
        )}
      </section>

      {/* Équipe + Horaires */}
      <section style={{ padding: '80px 16px', background: colors.card }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '48px' }}>
          <div>
            <h2 style={{ fontSize: '30px', fontWeight: 700, marginBottom: '32px' }}>
              Notre <span style={{ color: colors.accent }}>Équipe</span>
            </h2>
            {employees && employees.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {employees.map((emp: any) => (
                  <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: colors.bg, borderRadius: '12px', border: `1px solid ${colors.border}` }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: colors.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700, border: `2px solid ${colors.accent}30`, overflow: 'hidden', flexShrink: 0, color: colors.accent }}>
                      {emp.photo_url ? (
                        <img src={emp.photo_url} alt={emp.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        emp.first_name?.charAt(0)?.toUpperCase() || '?'
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontWeight: 700, fontSize: '18px', color: colors.text }}>{emp.first_name || 'Coiffeur'}</h3>
                      {emp.specialities && emp.specialities.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                          {emp.specialities.map((spec: string, idx: number) => (
                            <span key={idx} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', background: `${colors.accent}15`, color: colors.accent, border: `1px solid ${colors.accent}30` }}>
                              {spec}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: colors.textMuted }}>Équipe bientôt présentée</p>
            )}
          </div>

          <div>
            <h2 style={{ fontSize: '30px', fontWeight: 700, marginBottom: '32px' }}>
              <span style={{ color: colors.accent }}>Horaires</span> d'ouverture
            </h2>
            <div style={{ background: colors.bg, borderRadius: '16px', padding: '24px', border: `1px solid ${colors.border}` }}>
              {sortedHours.length > 0 ? (
                sortedHours.map(([jour, horaire]) => (
                  <div key={jour} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${colors.border}20` }}>
                    <span style={{ fontWeight: 500, textTransform: 'capitalize', color: colors.text }}>{jour}</span>
                    <span style={{ color: horaire?.is_open ? colors.accent : colors.textMuted, fontWeight: horaire?.is_open ? 600 : 400 }}>
                      {horaire?.is_open ? `${horaire.open} - ${horaire.close}` : 'Fermé'}
                    </span>
                  </div>
                ))
              ) : (
                <p style={{ color: colors.textMuted }}>Horaires bientôt disponibles</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Réservation */}
      <section style={{ padding: '80px 16px' }}>
        <div style={{ maxWidth: '896px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>
            Prêt à <span style={{ color: colors.accent }}>réserver</span> ?
          </h2>
          <p style={{ color: colors.textMuted, marginBottom: '32px', fontSize: '18px' }}>
            Choisissez votre créneau et réservez en quelques clics
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', alignItems: 'center' }}>
            <Link
              href={`/${slug}/reservation`}
              style={{ padding: '20px 48px', background: colors.button, color: colors.buttonText, fontWeight: 700, borderRadius: '12px', textDecoration: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', fontSize: '18px', transition: 'transform 0.2s' }}
            >
              Commencer la réservation
            </Link>
            <Link
              href={`/${slug}/mes-reservations`}
              style={{ padding: '20px 48px', background: colors.card, border: `2px solid ${colors.accent}40`, color: colors.text, fontWeight: 700, borderRadius: '12px', textDecoration: 'none', fontSize: '18px', transition: 'transform 0.2s' }}
            >
              Voir mes réservations
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: colors.card, padding: '32px 16px', textAlign: 'center', color: colors.textMuted, borderTop: `1px solid ${colors.border}` }}>
        <p>© 2026 {salon.name} - Propulsé par <span style={{ color: colors.accent }}>MonSalon</span></p>
      </footer>

      {/* Bouton flottant mobile */}
      <Link
        href={`/${slug}/reservation`}
        style={{ position: 'fixed', bottom: '24px', right: '24px', padding: '16px 24px', background: colors.button, color: colors.buttonText, fontWeight: 700, borderRadius: '9999px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
        className="sm:hidden"
      >
        <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Réserver</span>
      </Link>
    </div>
  )
}