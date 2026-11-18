'use client'

import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getThemeStyles, type SalonTheme } from '@/lib/themes'

function withAlpha(hex: string, a: number): string {
  if (!hex) return `rgba(0,0,0,${a})`
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function QRCodePage() {
  const params = useParams()
  const slug = params.salonSlug as string
  const qrRef = useRef<SVGSVGElement>(null)

  const [salonName, setSalonName] = useState('')
  const [colors, setColors] = useState<any>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [downloadFormat, setDownloadFormat] = useState<'svg' | 'png'>('png')
  const [loading, setLoading] = useState(true)

  const DEFAULT_C = { bg: '#09090b', bgCard: '#18181b', text: '#fafafa', textMuted: '#a1a1aa', accent: '#fbbf24', border: '#27272a', button: '#f59e0b', buttonText: '#000000' }
  const c = colors || DEFAULT_C

  useEffect(() => {
    const loadSalon = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data } = await supabase
        .from('salons')
        .select('name, theme')
        .eq('slug', slug)
        .single()

      if (data) {
        setSalonName(data.name)
        setColors(getThemeStyles((data.theme as SalonTheme) || 'luxe'))
      }

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      const reservationUrl = `${baseUrl}/${slug}/reservation`
      setQrUrl(reservationUrl)
      setLoading(false)
    }

    loadSalon()
  }, [slug])

  const downloadSVG = () => {
    if (!qrRef.current) return
    const svgData = new XMLSerializer().serializeToString(qrRef.current)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `qr-code-${slug}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadPNG = () => {
    if (!qrRef.current) return
    const svgData = new XMLSerializer().serializeToString(qrRef.current)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      canvas.width = 512
      canvas.height = 512
      if (ctx) {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, 512, 512)
      }
      const pngUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = pngUrl
      link.download = `qr-code-${slug}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${salonName}</title>
          <style>
            body { margin: 0; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: Arial, sans-serif; background: white; }
            h1 { color: #000; margin-bottom: 10px; font-size: 28px; }
            p { color: #666; margin-bottom: 30px; font-size: 14px; }
            .qr-container { border: 2px solid #000; padding: 20px; border-radius: 12px; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>${salonName}</h1>
          <p>Scannez ce QR code pour reserver votre rendez-vous</p>
          <div class="qr-container">
            ${new XMLSerializer().serializeToString(qrRef.current!)}
          </div>
          <p style="margin-top: 30px; font-size: 12px;">${qrUrl}</p>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `
    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  const btnStyle: React.CSSProperties = { borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }
  const cardStyle: React.CSSProperties = { background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '24px' }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.accent }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span style={{ fontWeight: 500, letterSpacing: '0.05em' }}>Generation du QR code...</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, padding: '16px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: `1px solid ${c.border}` }}>
          <Link href={`/${slug}/dashboard`} style={{ color: c.textMuted, textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '8px' }}>
            &larr; Retour au tableau de bord
          </Link>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em', margin: 0 }}>
            QR Code de <span style={{ color: c.accent }}>{salonName}</span>
          </h1>
          <p style={{ color: c.textMuted, marginTop: '8px', fontSize: '14px' }}>
            Affichez ce QR code dans votre salon pour permettre aux clients de reserver facilement.
          </p>
        </div>

        {/* Contenu principal */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          
          {/* QR Code (Fond blanc garanti pour la lisibilite du scan) */}
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px' }}>
              <QRCodeSVG
                value={qrUrl}
                size={256}
                level="H"
                includeMargin={true}
                imageSettings={{ src: '', height: 0, width: 0, excavate: false }}
                ref={qrRef}
              />
            </div>
            <p style={{ color: '#525252', fontSize: '14px', marginTop: '24px', textAlign: 'center', fontWeight: 600 }}>
              Scannez pour reserver
            </p>
          </div>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* URL */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: c.text, marginBottom: '12px', marginTop: 0 }}>Lien de reservation</h3>
              <p style={{ color: c.accent, fontSize: '14px', wordBreak: 'break-all', fontFamily: 'monospace', background: c.bg, padding: '12px', borderRadius: '8px', margin: 0 }}>
                {qrUrl}
              </p>
              <p style={{ color: c.textMuted, fontSize: '12px', marginTop: '8px' }}>
                Ce lien est accessible a tous et permet de reserver sans inscription.
              </p>
            </div>

            {/* Format de telechargement */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: c.text, marginBottom: '16px', marginTop: 0 }}>Telecharger le QR code</h3>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  onClick={() => setDownloadFormat('png')}
                  style={{ 
                    ...btnStyle, flex: 1, padding: '8px 16px', 
                    background: downloadFormat === 'png' ? c.button : c.bg, 
                    color: downloadFormat === 'png' ? c.buttonText : c.textMuted,
                    border: `1px solid ${downloadFormat === 'png' ? c.button : c.border}`
                  }}
                >
                  PNG (Image)
                </button>
                <button
                  onClick={() => setDownloadFormat('svg')}
                  style={{ 
                    ...btnStyle, flex: 1, padding: '8px 16px', 
                    background: downloadFormat === 'svg' ? c.button : c.bg, 
                    color: downloadFormat === 'svg' ? c.buttonText : c.textMuted,
                    border: `1px solid ${downloadFormat === 'svg' ? c.button : c.border}`
                  }}
                >
                  SVG (Vectoriel)
                </button>
              </div>

              <button
                onClick={downloadFormat === 'png' ? downloadPNG : downloadSVG}
                style={{ ...btnStyle, width: '100%', padding: '12px', background: c.button, color: c.buttonText, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <span>&#11015;</span> Telecharger en {downloadFormat.toUpperCase()}
              </button>
            </div>

            {/* Impression */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: c.text, marginBottom: '12px', marginTop: 0 }}>Impression rapide</h3>
              <p style={{ color: c.textMuted, fontSize: '14px', marginBottom: '16px' }}>
                Imprimez directement ce QR code pour l'afficher dans votre salon.
              </p>
              <button
                onClick={handlePrint}
                style={{ ...btnStyle, width: '100%', padding: '12px', background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <span>&#128424;</span> Imprimer le QR code
              </button>
            </div>

            {/* Conseils */}
            <div style={{ ...cardStyle, background: withAlpha(c.accent, 0.1), border: `1px solid ${withAlpha(c.accent, 0.3)}` }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: c.accent, marginBottom: '12px', marginTop: 0 }}>&#128161; Conseils d'utilisation</h3>
              <ul style={{ color: c.text, fontSize: '14px', margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
                <li>Placez le QR code a l'entree de votre salon</li>
                <li>Ajoutez-le sur vos cartes de visite</li>
                <li>Partagez-le sur vos reseaux sociaux</li>
                <li>Imprimez-le en grand format (A4 minimum)</li>
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}