import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const RESERVATION_FEE_CENTS = 100; // 1,00 €
const CURRENCY = 'eur';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { salonSlug, serviceId, startTime, endTime, clientName, clientPhone } = body;

    // 1. Validation des données
    if (!salonSlug || !serviceId || !startTime || !endTime) {
      return NextResponse.json({ error: 'Données manquantes pour la réservation' }, { status: 400 });
    }

    // 2. Client Supabase ADMIN (pour bypasser les règles RLS et créer le RDV même si l'utilisateur n'est pas connecté)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 3. Vérifier que le salon existe
    const { data: salon, error: salonError } = await supabaseAdmin
      .from('salons')
      .select('id, slug')
      .eq('slug', salonSlug)
      .single();

    if (salonError || !salon) {
      return NextResponse.json({ error: 'Salon introuvable' }, { status: 404 });
    }

    // 4. Créer le rendez-vous en base de données
    const { data: appointment, error: apptError } = await supabaseAdmin
      .from('appointments')
      .insert({
        salon_id: salon.id,
        client_id: null, // Client non connecté (anonyme)
        service_id: serviceId,
        start_time: startTime,
        end_time: endTime,
        status: 'pending',
        payment_status: 'pending',
      })
      .select('id')
      .single();

    if (apptError || !appointment) {
      console.error('Erreur création RDV:', apptError);
      return NextResponse.json({ error: 'Erreur lors de la création du rendez-vous en base de données' }, { status: 500 });
    }

    const appointmentId = appointment.id;

    // 5. Créer le Payment Intent Stripe
    const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: RESERVATION_FEE_CENTS.toString(),
        currency: CURRENCY,
        automatic_payment_methods: 'enabled',
        metadata: JSON.stringify({
          salonSlug,
          appointmentId,
          platform: 'monsalon',
          feeType: 'reservation',
          clientName: clientName || 'Anonyme',
          clientPhone: clientPhone || 'Non fourni',
        }),
        description: `Frais de réservation - Salon ${salonSlug}`,
      }),
    });

    const paymentIntent = await stripeResponse.json();

    if (!stripeResponse.ok) {
      // Rollback : supprimer le RDV créé si Stripe échoue
      await supabaseAdmin.from('appointments').delete().eq('id', appointmentId);
      console.error('Erreur Stripe:', paymentIntent);
      return NextResponse.json({ error: 'Erreur lors de la communication avec Stripe' }, { status: 502 });
    }

    if (!paymentIntent.client_secret) {
      await supabaseAdmin.from('appointments').delete().eq('id', appointmentId);
      return NextResponse.json({ error: 'client_secret manquant dans la réponse Stripe' }, { status: 500 });
    }

    // 6. Enregistrer la tentative de paiement dans la table `payments`
    await supabaseAdmin.from('payments').insert({
      appointment_id: appointmentId,
      amount: 1.00,
      provider: 'stripe',
      stripe_payment_intent_id: paymentIntent.id,
      status: 'pending',
    });

    // 7. Réussite : renvoyer les données au frontend
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      appointmentId: appointmentId,
      amount: 1.00,
    });

  } catch (error) {
    console.error('Erreur critique dans create-payment-intent:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne du serveur';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}