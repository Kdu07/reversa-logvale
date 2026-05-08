export type UserRole = 'operator' | 'client' | 'manager'
export type ReturnStatus = 'awaiting_decision' | 'decided' | 'processed'
export type ReturnDecision = 'return_to_stock' | 'store_for_handling' | 'discard' | 'repackage'
export type DecisionSource = 'client' | 'auto'
export type IdentifierType = 'access_key' | 'postal_code' | 'illegible'
export type PhotoType = 'box' | 'item'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  phone: string | null
  active: boolean
  terms_accepted_at: string | null
  created_at: string
  updated_at: string
}

export interface AuthUser {
  id: string
  email: string
  profile: Profile
}

export interface Depositor {
  id: string
  cnpj: string
  razao_social: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface Return {
  id: string
  identifier_type: IdentifierType
  access_key: string | null
  postal_code: string | null
  illegible_token: string | null
  rv: string
  item_count: number
  depositor_id: string | null
  invoice_xml_url: string | null
  status: ReturnStatus
  received_at: string
  received_by: string
  decision: ReturnDecision | null
  decided_at: string | null
  decided_by: string | null
  decided_by_type: DecisionSource | null
  return_invoice_xml_url: string | null
  processed_at: string | null
  processed_by: string | null
  warning_sent_at: string | null
  created_at: string
  updated_at: string
}

export interface ReturnPhoto {
  id: string
  return_id: string
  photo_type: PhotoType
  storage_path: string
  position: number
  created_at: string
}

export interface InvoiceCache {
  access_key: string
  xml_url: string
  emitter_cnpj: string
  invoice_number: string | null
  emitted_at: string | null
  raw_response: Record<string, unknown> | null
  fetched_at: string
}

export const ROLE_HOME: Record<UserRole, string> = {
  operator: '/operador',
  client:   '/cliente',
  manager:  '/admin',
}
