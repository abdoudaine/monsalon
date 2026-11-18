# 🚀 PROJET : MonSalon (SaaS Multi-tenants pour salons de coiffure)

## CONTEXTE GÉNÉRAL
- **Nom de domaine** : `monsalon.fr` (Structure : `monsalon.fr/[slug-du-salon]`)
- **Concept** : Application SaaS B2B2C de réservation pour salons de coiffure
- **Modèle économique** : Gratuit pour les salons. Le client paie 1,00 € fixe par session de réservation (via Stripe/Apple Pay/Google Pay), quel que soit le nombre de personnes. Revenu net admin : ~0,73 € après frais Stripe.
- **Stack** : Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL, Auth, Storage, RLS), PWA, Vercel
- **Workflow** : 100% local d'abord. Aucun push GitHub/Vercel tant que le projet n'est pas terminé et testé.

## ACTEURS & RÔLES
1. **Super Admin** : Accès total, création de salons, stats globales
2. **Gestionnaire** : Gère son salon (services, employés, thèmes, fermetures, QR code)
3. **Employé** : Gère son calendrier, absences, photos
4. **Client** : S'inscrit (téléphone), prend RDV, paie 1,00 €, gère ses RDV

## FONCTIONNALITÉS CLÉS
- **Prise de RDV** : Cible (Adulte/Enfant -12 ans) → Service (Coupe, Barbe, Coupe+Barbe, Spéciale) → Coiffeur → Créneau → Paiement
- Un client peut réserver plusieurs créneaux en une session (famille)
- Modification/Annulation gratuite jusqu'à J-1 (24h avant)
- RDV jour même possible si créneau libre
- Walk-ins non prioritaires

## QUOTAS PHOTOS (stricts)
- Gérant : 1 photo profil + 5 photos salon/équipe + 10 photos photobook = 16 max
- Employé : 1 photo profil + 5 photos photobook = 6 max
- Le système bloque l'upload si quota atteint et propose remplacement

## 6 THÈMES PRÉDÉFINIS
1. **LUXE** : Noir & Or (premium)
2. **URBAN** : Noir & Blanc massif (minimaliste moderne)
3. **CLASSIQUE** : Beige & Vert foncé (chaleureux)
4. **DARK** : Gris foncé & Photos (immersif masculin)
5. **ROSE GOLD** : Nude & Rose (féminin/mixte élégant)
6. **VIBRANT** : Violet & Corail (créatif/jeune)

## ARCHITECTURE MULTI-TENANTS
- Une seule codebase, une seule BDD
- Routing dynamique : `app/[salonSlug]/...`
- Isolation stricte via RLS

## STRUCTURE BDD (Supabase)
- `profiles` : id, role, phone, full_name
- `salons` : id, name, slug, manager_id, theme (enum), settings (JSON), is_closed, closure_image_url
- `employees` : id, salon_id, user_id, photo_url, specialities
- `services` : id, salon_id, name, category (adult/child), duration_minutes, price_display
- `photos` : id, salon_id, employee_id, url, category (profile/salon/photobook), order
- `appointments` : id, salon_id, client_id, employee_id, service_id, start_time, end_time, status, payment_status
- `payments` : id, appointment_id, amount (1.00), provider, stripe_payment_intent_id, status, created_at

## SÉCURITÉ
- Variables d'environnement dans `.env.local` (jamais hardcodées)
- Clés Supabase : `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client), `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement)
- Clés Stripe : `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client), `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` (serveur uniquement)
- Middleware Next.js pour protéger routes admin/manager
- Vérification rôles dans chaque Server Action
- Webhook Stripe avec vérification signature
- Rate limiting sur endpoints critiques

## RÈGLES STRICTES POUR L'IA
1. **Code complet uniquement** : Toujours fournir le fichier entier, jamais de snippets ou `// ... reste du code`
2. **Fichier par fichier** : Approche méthodique
3. **Respect absolu du contexte** : Ne rien inventer, alerter si contradiction
4. **Git local** : Rappeler de faire `git commit` avant modifications majeures