// src/app/api/admin/invite-manager/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { salonId, email, password } = await request.json()

    if (!salonId || !email) {
      return NextResponse.json({ error: 'salonId et email sont requis' }, { status: 400 })
    }

    // Initialisation du client Admin (nécessite la clé de service, jamais exposée au frontend)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let userId: string

    if (password && password.length >= 6) {
      // Mode 1 : Création manuelle avec mot de passe
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // On le confirme directement pour qu'il puisse se connecter
      })
      if (error) throw new Error(error.message)
      userId = data.user.id
    } else {
      // Mode 2 : Envoi d'une invitation par email
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login`,
      })
      if (error) throw new Error(error.message)
      userId = data.user.id
    }

    // Mettre à jour le salon avec l'ID du nouveau gérant
    const { error: updateError } = await supabaseAdmin
      .from('salons')
      .update({ manager_id: userId })
      .eq('id', salonId)

    if (updateError) throw new Error(updateError.message)

    return NextResponse.json({ success: true, message: password ? 'Gérant créé avec succès' : 'Invitation envoyée par email' })
  } catch (error: any) {
    console.error('Erreur invitation gérant:', error)
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 })
  }
}