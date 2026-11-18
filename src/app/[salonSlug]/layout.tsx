import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getThemeStyles, type SalonTheme } from '@/lib/themes'

export default async function SalonLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { salonSlug: string }
}) {
  const supabase = await createClient()

  const { data: salon } = await supabase
    .from('salons')
    .select('*')
    .eq('slug', params.salonSlug)
    .single()

  if (!salon) notFound()

  const themeKey = (salon.theme as SalonTheme) || 'luxe'
  const colors = getThemeStyles(themeKey)

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
      {/* Navigation */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: colors.bgCard,
        borderBottom: `1px solid ${colors.border}`,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href={`/${params.salonSlug}`} style={{ fontSize: '20px', fontWeight: 700, color: colors.text, textDecoration: 'none' }}>
            {salon.name}
          </a>
          <div style={{ display: 'flex', gap: '12px' }}>
            <a href={`/${params.salonSlug}`} style={{
              padding: '8px 16px', borderRadius: '8px',
              color: colors.textMuted, textDecoration: 'none',
            }}>
              Accueil
            </a>
            <a href={`/${params.salonSlug}/reservation`} style={{
              padding: '8px 16px', borderRadius: '8px',
              background: colors.button, color: colors.buttonText,
              fontWeight: 600, textDecoration: 'none',
            }}>
              Réserver
            </a>
          </div>
        </div>
      </nav>
      {children}
    </div>
  )
}