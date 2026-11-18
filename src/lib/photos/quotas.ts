// src/lib/photos/quotas.ts
import { createClient } from '@/lib/supabase/client';

// ============================================================================
// CONSTANTES DE QUOTAS (Strictement définies par le cahier des charges)
// ============================================================================

export const PHOTO_QUOTAS = {
  manager: {
    profile: 1,    // 1 photo de profil
    salon: 5,      // 5 photos du salon
    photobook: 10, // 10 photos photobook
    total: 16,     // 16 photos au total
  },
  employee: {
    profile: 1,    // 1 photo de profil
    salon: 0,      // 0 photos du salon (réservé au manager)
    photobook: 5,  // 5 photos photobook
    total: 6,      // 6 photos au total
  },
} as const;

export type UserRole = 'manager' | 'employee';
export type PhotoCategory = 'profile' | 'salon' | 'photobook';

export interface QuotaCheckResult {
  canUpload: boolean;
  currentCount: number;
  maxCount: number;
  remaining: number;
  category: PhotoCategory;
  message: string;
}

// ============================================================================
// FONCTIONS DE VÉRIFICATION
// ============================================================================

/**
 * Compte le nombre de photos existantes pour un salon/employé donné, par catégorie.
 */
export async function countPhotosByCategory(
  salonId: string,
  category: PhotoCategory,
  employeeId?: string | null
): Promise<number> {
  const supabase = createClient();

  const query = supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('salon_id', salonId)
    .eq('category', category);

  // Si c'est une photo de profil employé, on filtre par employee_id
  if (category === 'profile' && employeeId) {
    query.eq('employee_id', employeeId);
  }

  // Pour les photos "salon", on exclut les photos de profil employé
  if (category === 'salon') {
    query.is('employee_id', null);
  }

  const { count, error } = await query;

  if (error) {
    console.error('Erreur lors du comptage des photos:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Vérifie si un utilisateur peut uploader une photo dans une catégorie donnée.
 * @returns Un objet détaillé avec le statut et les messages
 */
export async function checkPhotoQuota(
  salonId: string,
  userRole: UserRole,
  category: PhotoCategory,
  employeeId?: string | null
): Promise<QuotaCheckResult> {
  const quotas = PHOTO_QUOTAS[userRole];
  const maxCount = quotas[category];
  const currentCount = await countPhotosByCategory(salonId, category, employeeId);
  const remaining = Math.max(0, maxCount - currentCount);

  const categoryLabels: Record<PhotoCategory, string> = {
    profile: 'photo de profil',
    salon: 'photo du salon',
    photobook: 'photo du photobook',
  };

  return {
    canUpload: remaining > 0,
    currentCount,
    maxCount,
    remaining,
    category,
    message:
      remaining > 0
        ? `${currentCount}/${maxCount} ${categoryLabels[category]}s utilisées`
        : `Quota atteint : ${maxCount}/${maxCount} ${categoryLabels[category]}s. Supprimez une photo avant d'en ajouter une nouvelle.`,
  };
}

/**
 * Vérifie le quota total (toutes catégories confondues) pour un utilisateur.
 */
export async function checkTotalQuota(
  salonId: string,
  userRole: UserRole,
  employeeId?: string | null
): Promise<{ canUpload: boolean; currentTotal: number; maxTotal: number }> {
  const supabase = createClient();
  const maxTotal = PHOTO_QUOTAS[userRole].total;

  const query = supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('salon_id', salonId);

  if (employeeId) {
    // Pour un employé, on compte ses photos de profil + photobook
    query.or(`employee_id.eq.${employeeId},and(employee_id.is.null,category.eq.photobook)`);
  } else {
    // Pour un manager, on compte tout SAUF les photos de profil employé
    query.is('employee_id', null);
  }

  const { count } = await query;
  const currentTotal = count || 0;

  return {
    canUpload: currentTotal < maxTotal,
    currentTotal,
    maxTotal,
  };
}