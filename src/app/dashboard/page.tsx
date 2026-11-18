import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Récupérer le profil utilisateur
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
        <h2 className="text-3xl font-bold text-white mb-2">
          Bienvenue sur ton Dashboard
        </h2>
        <p className="text-gray-400">
          Connecté en tant que <span className="text-amber-400 font-medium">{user.email}</span>
        </p>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Carte 1 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="text-gray-400 text-sm mb-2">Rôle</div>
          <div className="text-2xl font-bold text-white capitalize">
            {profile?.role || 'client'}
          </div>
        </div>

        {/* Carte 2 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="text-gray-400 text-sm mb-2">Nom</div>
          <div className="text-2xl font-bold text-white">
            {profile?.full_name || 'Non défini'}
          </div>
        </div>

        {/* Carte 3 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="text-gray-400 text-sm mb-2">Téléphone</div>
          <div className="text-2xl font-bold text-white">
            {profile?.phone || 'Non défini'}
          </div>
        </div>
      </div>

      {/* Message d'information */}
      <div className="bg-amber-500/10 border border-amber-500/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-amber-400 mb-2">
          🚧 En construction
        </h3>
        <p className="text-gray-300">
          Cette page sera bientôt personnalisée selon ton rôle :
        </p>
        <ul className="mt-3 space-y-2 text-gray-400">
          <li>• <span className="text-white">Super Admin</span> : Gestion de tous les salons</li>
          <li>• <span className="text-white">Manager</span> : Gestion de ton salon</li>
          <li>• <span className="text-white">Employé</span> : Ton calendrier</li>
          <li>• <span className="text-white">Client</span> : Tes rendez-vous</li>
        </ul>
      </div>
    </div>
  )
}