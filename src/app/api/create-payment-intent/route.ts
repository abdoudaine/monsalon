// src/app/api/create-payment-intent/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Initialisation de Stripe (utilise une clé placeholder si non définie, pour éviter le crash en dev)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-06-29',
  typescript: true,
})

const RESERVATION_FEE_CENTS = 100 // 1.00 EUR
const CURRENCY = 'eur'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { salonSlug, serviceId, startTime, endTime, clientName, clientPhone } = body

    if (!salonSlug || !serviceId || !startTime || !endTime) {
      return NextResponse.json({ error: 'Donnees manquantes' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Trouver le salon
    const { data: salon, error: salonError } = await supabaseAdmin
      .from('salons')
      .select('id, slug')
      .eq('slug', salonSlug)
      .single()

    if (salonError || !salon) {
      return NextResponse.json({ error: 'Salon introuvable' }, { status: 404 })
    }

    // 2. Créer le RDV en statut 'pending' (on le confirme après succès du paiement)
    const { data: appointment, error: apptError } = await supabaseAdmin
      .from('appointments')
      .insert({
        salon_id: salon.id,
        service_id: serviceId,
        start_time: startTime,
        end_time: endTime,
        status: 'pending',
        payment_status: 'pending',
        client_name: clientName || null,
        client_phone: clientPhone || null,
      })
      .select('id')
      .single()

    if (apptError || !appointment) {
      return NextResponse.json({ error: 'Erreur creation RDV' }, { status: 500 })
    }

    // 3. Créer le PaymentIntent Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: RESERVATION_FEE_CENTS,
      currency: CURRENCY,
      automatic_payment_methods: { enabled: true },
      metadata: {
        appointmentId: appointment.id,
        salonSlug,
        platform: 'monsalon',
        feeType: 'reservation',
      },
      description: `Frais de reservation - Salon ${salonSlug}`,
    })

    // 4. Enregistrer la tentative de paiement en base
    await supabaseAdmin.from('payments').insert({
      appointment_id: appointment.id,
      amount: 1.0,
      provider: 'stripe',
      stripe_payment_intent_id: paymentIntent.id,
      status: 'pending',
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      appointmentId: appointment.id,
      amount: 1.0,
    })
  } catch (error) {
    console.error('Erreur critique create-payment-intent:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne du serveur'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}