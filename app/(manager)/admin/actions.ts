'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { dashboardRpcArgs, type DashboardFilters } from '@/lib/admin-dashboard/filters'
import { mapAdminDashboard, type AdminDashboardRpc } from '@/lib/admin-dashboard/rpc'
import type { AdminDashboardData } from '@/lib/admin-dashboard/types'

/**
 * Dados do dashboard do admin (/admin) numa única chamada à RPC
 * `get_admin_dashboard` (migration 025). A RPC também confere se quem chama é
 * gerente ativo; a checagem aqui só evita a ida ao banco.
 */
export async function getAdminDashboardAction(
  filters: DashboardFilters,
): Promise<AdminDashboardData | { error: string }> {
  try {
    const user = await getCurrentUser()
    if (user.profile.role !== 'manager') return { error: 'Acesso negado' }

    const supabase = createClient()
    const { data, error } = await supabase.rpc('get_admin_dashboard', dashboardRpcArgs(filters))
    if (error) return { error: error.message }
    if (!data)  return { error: 'Resposta vazia do banco' }

    return mapAdminDashboard(data as AdminDashboardRpc, filters)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro interno' }
  }
}
