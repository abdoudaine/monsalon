// src/app/api/cron/send-reminders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const isDev = process.env.NODE_ENV === 'development'

    // 1. Sécurité : en production, on exige le header d'authentification
    const authHeader = request.headers.get('authorization')
    if (!isDev && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 2. Calculer la fenetre "demain" (00:00 -> 23:59)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const dayAfter = new Date(tomorrow)
    dayAfter.setDate(dayAfter.getDate() + 1)

    // 3. En dev, on peut forcer la re-lecture (parametre ?force=true)
    const force = isDev && request.nextUrl.searchParams.get('force') === 'true'

    // 4. Recuperer les RDV de demain qui veulent un rappel et pas encore envoye
    let query = supabaseAdmin
      .from('appointments')
      .select('id, start_time, client_name, client_email, services (name), salons (name)')
      .gte('start_time', tomorrow.toISOString())
      .lt('start_time', dayAfter.toISOString())
      .eq('wants_reminder', true)
      .neq('status', 'cancelled')
      .neq('status', 'completed')
      .not('client_email', 'is', null)

    if (!force) {
      query = query.eq('reminder_sent', false)
    }

    const { data: appts, error: queryError } = await query

    if (queryError) throw new Error(queryError.message)
    if (!appts || appts.length === 0) {
      return NextResponse.json({ success: true, message: 'Aucun rappel a envoyer', sent: 0 })
    }

    // 5. Envoyer chaque email de rappel
    let sentCount = 0
    const failures: string[] = []

    for (const appt of appts) {
      const dateObj = new Date(appt.start_time)
      const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

      const { error: sendError } = await resend.emails.send({
        from: 'MonSalon <onboarding@resend.dev>',
        to: [appt.client_email],
        subject: `⏰ Rappel : votre rendez-vous demain chez ${appt.salons?.name || 'votre salon'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 12px;">
            <div style="background-color: #f59e0b; color: #000; text-align: center; padding: 12px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px;">
              <h2 style="margin: 0;">⏰ Rappel de rendez-vous</h2>
            </div>
            <p style="color: #525252; font-size: 16px;">Bonjour <strong>${appt.client_name || ''}</strong>,</p>
            <p style="color: #525252; font-size: 16px;">Nous vous rappelons que votre rendez-vous a lieu <strong>demain</strong>.</p>

            <div style="background-color: #fafafa; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 8px 0;"><strong>📅 Demain :</strong> ${dateStr}</p>
              <p style="margin: 8px 0;"><strong>🕒 Heure :</strong> ${timeStr}</p>
              <p style="margin: 8px 0;"><strong>✂️ Prestation :</strong> ${appt.services?.name || 'Coupe'}</p>
              <p style="margin: 8px 0;"><strong>📍 Salon :</strong> ${appt.salons?.name || 'MonSalon'}</p>
            </div>

            <p style="color: #525252; font-size: 14px; text-align: center;">
              En cas d'empechement, merci de prevenir le salon au plus tot.
            </p>
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin-top: 24px;">
              Cet email a ete envoye automatiquement. Merci de ne pas y repondre.
            </p>
          </div>
        `,
      })

      if (sendError) {
        failures.push(`${appt.client_email}: ${sendError.message}`)
      } else {
        // 6. Marquer le RDV comme "rappel envoye" pour eviter les doublons
        await supabaseAdmin.from('appointments').update({ reminder_sent: true }).eq('id', appt.id)
        sentCount++
      }
    }

    console.log(`Cron rappels : ${sentCount} envoyes, ${failures.length} echecs`)
    return NextResponse.json({ success: true, sent: sentCount, failures })
  } catch (err: any) {
    console.error('Erreur critique cron rappels:', err)
    return NextResponse.json({ error: err.message || 'Erreur interne' }, { status: 500 })
  }
}

// En dev uniquement : autoriser le GET pour tester depuis le navigateur
export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development'
  if (!isDev) {
    return NextResponse.json({ error: 'Utilisez POST avec authentification' }, { status: 405 })
  }
  return POST(request)
}