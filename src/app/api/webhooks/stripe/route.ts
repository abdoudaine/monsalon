// src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { createClient } from '@supabase/supabase-js'

// IMPORTANT : on desactive le body parser pour garder le payload brut (signature)
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.text()
  // CORRECTION : request.headers.get() et non headers().get() (pas de await casse)
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as any
      const appointmentId = paymentIntent.metadata?.appointmentId
      if (appointmentId) {
        await supabaseAdmin
          .from('payments')
          .update({ status: 'succeeded' })
          .eq('stripe_payment_intent_id', paymentIntent.id)
        await supabaseAdmin
          .from('appointments')
          .update({ status: 'confirmed', payment_status: 'succeeded' })
          .eq('id', appointmentId)
        console.log('RDV confirme et paye via Webhook:', appointmentId)
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const failedIntent = event.data.object as any
      const failedApptId = failedIntent.metadata?.appointmentId
      if (failedApptId) {
        await supabaseAdmin
          .from('payments')
          .update({ status: 'failed' })
          .eq('stripe_payment_intent_id', failedIntent.id)
        await supabaseAdmin
          .from('appointments')
          .update({ payment_status: 'failed' })
          .eq('id', failedApptId)
        console.log('Paiement echoue pour le RDV:', failedApptId)
      }
      break
    }

    default:
      console.log('Unhandled event type:', event.type)
  }

  return NextResponse.json({ received: true })
}