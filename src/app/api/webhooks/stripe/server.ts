// src/lib/stripe/server.ts
import Stripe from 'stripe'

// Le client Stripe ne s'initialise qu'avec une vraie clé secrète.
// Tant que NEXT_PUBLIC_PAYMENT_ENABLED=false, on ne l'utilise pas côté client.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-06-29',
  typescript: true,
})

export const PAYMENT_ENABLED = process.env.NEXT_PUBLIC_PAYMENT_ENABLED === 'true'
export const BOOKING_FEE_EUR = 1 // Frais de reservation en euros