// src/app/api/send-confirmation/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { clientName, clientEmail, salonName, serviceName, date, time, employeeName } = await request.json()

    if (!clientEmail) {
      return NextResponse.json({ error: 'Email manquant' }, { status: 400 })
    }

    const { data, error } = await resend.emails.send({
      from: 'MonSalon <onboarding@resend.dev>',
      to: [clientEmail],
      subject: `Confirmation de votre rendez-vous chez ${salonName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 12px;">
          <h2 style="color: #000000; text-align: center;">✅ Rendez-vous confirmé !</h2>
          <p style="color: #525252; font-size: 16px;">Bonjour <strong>${clientName}</strong>,</p>
          <p style="color: #525252; font-size: 16px;">Votre rendez-vous est bien enregistré.</p>
          
          <div style="background-color: #fafafa; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 8px 0;"><strong>📅 Date :</strong> ${date}</p>
            <p style="margin: 8px 0;"><strong>🕒 Heure :</strong> ${time}</p>
            <p style="margin: 8px 0;"><strong>✂️ Prestation :</strong> ${serviceName}</p>
            <p style="margin: 8px 0;"><strong>👤 Coiffeur :</strong> ${employeeName || 'Le premier disponible'}</p>
            <p style="margin: 8px 0;"><strong>📍 Salon :</strong> ${salonName}</p>
          </div>

          <p style="color: #525252; font-size: 14px; text-align: center; margin-top: 24px;">
            💡 Nous vous enverrons un rappel par email 24h avant votre rendez-vous.
          </p>
          <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin-top: 32px;">
            Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Erreur Resend:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('Email envoyé avec succès à', clientEmail)
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('Erreur critique envoi email:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}