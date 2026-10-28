// Types métier partagés pour l'application VP Expertise

export type MissionStatus = 
  | 'en_cours' 
  | 'attente_pieces' 
  | 'reunion_planifiee' 
  | 'rapport_remis' 
  | 'accord_en_cours' 
  | 'cloture';

export interface Mission {
  id: string;
  code: string; // Ex: VP2026922
  title: string; // Ex: ALSTOM - SGP Ligne 18...
  case_reference: string; // Ex: 11161461
  status: MissionStatus;
  insurance_client: string; // Ex: AXA XL
  client_contact?: string; // Ex: Yannick DELAUNAY
  insured_party?: string; // Ex: ALSTOM
  third_parties?: string; // Ex: SGP / VINCI
  court_reference?: string; // Ex: Tribunal Judiciaire de Nanterre
  incident_date?: string;
  reception_date: string;
  description: string;
  current_step: string;
  next_action: string;
  next_deadline?: string;
  billing_contact_name?: string;
  billing_address?: string;
  custom_hourly_rate?: number; // Défaut: 190 €/h
  custom_travel_rate?: number; // Défaut: 135 €/h
  custom_km_rate?: number; // Défaut: 0.95 €/km
  custom_billing_threshold?: number; // Défaut: 3500 €
  custom_vat_rate?: number; // Défaut: 0.20
  unbilled_hours?: number;
  unbilled_expenses?: number;
  total_unbilled_ht?: number;
  created_at: string;
  updated_at: string;
}

export interface EvidenceItem {
  id: string;
  mission_id: string;
  mission_code: string;
  title: string;
  type: 'photo' | 'document' | 'constat';
  file_url?: string;
  filename: string;
  file_size?: number;
  mime_type?: string;
  caption?: string;
  taken_at?: string;
  order_index?: number;
  is_selected_for_report?: boolean;
  created_by?: string;
  created_at: string;
}

export type ActivityCategory = 
  | 'etude_documents'
  | 'analyse'
  | 'expertise'
  | 'visio'
  | 'reunion'
  | 'redaction'
  | 'deplacement';

export type ActivityStatus = 
  | 'a_facturer'
  | 'reserve'
  | 'facture'
  | 'non_facturable';

export interface Activity {
  id: string;
  mission_id: string;
  mission_code: string;
  date: string; // YYYY-MM-DD
  category: ActivityCategory;
  label: string;
  hours: number;
  hourly_rate: number;
  total_ht: number;
  billable: boolean;
  status: ActivityStatus;
  invoice_id?: string | null;
  notes?: string | null;
  created_at: string;
}

export type ExpenseCategory = 
  | 'km'
  | 'train'
  | 'hotel'
  | 'repas'
  | 'peage_parking'
  | 'taxi'
  | 'autre';

export type ExpenseStatus = 
  | 'a_facturer'
  | 'reserve'
  | 'facture'
  | 'refuse';

export interface Expense {
  id: string;
  mission_id: string;
  mission_code: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  label: string;
  quantity: number;
  unit_price: number;
  total_ht: number;
  vat_amount: number;
  total_ttc: number;
  receipt_filename?: string | null;
  status: ExpenseStatus;
  invoice_id?: string | null;
  is_refacturable: boolean;
  created_at: string;
}

export type InvoiceStatus = 
  | 'brouillon'
  | 'emis'
  | 'regle_partiel'
  | 'regle'
  | 'annule';

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  activity_id?: string | null;
  expense_id?: string | null;
  description: string;
  quantity: number;
  time_spent?: number | null;
  unit_price_ht: number;
  total_ht: number;
  order_index: number;
}

export interface InvoicePayerSplit {
  payer_name: string;
  percentage: number;
  amount_ht: number;
  amount_ttc: number;
  paid: boolean;
  paid_date?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string; // Ex: 2026-097
  mission_id: string;
  mission_code: string;
  client_name: string;
  client_address: string;
  subject: string;
  case_title: string;
  client_ref: string;
  our_ref: string;
  date: string; // YYYY-MM-DD
  total_ht: number;
  vat_rate: number; // 0.20
  vat_amount: number;
  total_ttc: number;
  advance_amount: number;
  net_payable: number;
  status: InvoiceStatus;
  payment_date?: string | null;
  payment_method?: string | null;
  paid_amount: number;
  split_details?: InvoicePayerSplit[] | null;
  lines?: InvoiceLine[];
  docx_path?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditNote {
  id: string;
  credit_number: string; // Ex: AV-2026-001
  original_invoice_id: string;
  original_invoice_number: string;
  mission_id: string;
  mission_code: string;
  date: string;
  reason: string;
  total_ht: number;
  vat_amount: number;
  total_ttc: number;
  created_at: string;
}

export interface Attendee {
  id: string;
  mission_id: string;
  name: string;
  organization: string;
  role: string;
  email?: string;
  phone?: string;
  present_on_site: boolean;
  present_remote: boolean;
}

export interface Photo {
  id: string;
  mission_id: string;
  filename: string;
  original_name: string;
  caption: string;
  taken_at?: string;
  order_index: number;
  is_selected_for_report: boolean;
  created_at: string;
}

export type DocumentCategory = 
  | 'photo_terrain'
  | 'capture_ecran'
  | 'procedure_dires'
  | 'emargement_pv'
  | 'note_technique'
  | 'justificatif_frais'
  | 'autre';

export interface MissionDocument {
  id: string;
  mission_id: string;
  mission_code: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  category: DocumentCategory;
  caption: string;
  is_selected_for_report: boolean;
  created_at: string;
}

export interface ReportDraft {
  id: string;
  mission_id: string;
  mission_code: string;
  title: string;
  version: number;
  section_facts: string;
  section_observations: string;
  section_analysis: string; // Analyse technique experte
  section_conclusions: string;
  raw_field_notes?: string; // Notes brutes de terrain Apple Notes
  attendees?: Attendee[];
  selected_photos?: Photo[];
  created_at: string;
  updated_at: string;
}

export interface Communication {
  id: string;
  mission_id: string;
  mission_code: string;
  direction: 'in' | 'out';
  sender: string;
  recipient: string;
  date: string;
  subject: string;
  body: string;
  importance: 'haute' | 'normale' | 'basse';
  urgency: 'urgente' | 'normale';
  status: 'a_traiter' | 'en_cours' | 'repondu' | 'archive';
  next_action?: string;
  draft_reply?: string;
  created_at: string;
}

export interface TravelChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface TravelOrder {
  id: string;
  mission_id: string;
  mission_code: string;
  destination: string;
  start_date: string;
  end_date: string;
  train_info?: string;
  hotel_info?: string;
  notes?: string;
  checklist: TravelChecklistItem[];
  status: 'prevu' | 'confirme' | 'effectue' | 'annule';
  created_at: string;
}

export interface RegisteredMail {
  id: string;
  mission_id: string;
  mission_code: string;
  recipient: string;
  subject: string;
  tracking_number?: string;
  status: 'a_preparer' | 'prepare' | 'expedie' | 'distribue';
  sent_date?: string;
  notes?: string;
  created_at: string;
}

export interface AccountingEntry {
  id: string;
  month: string; // YYYY-MM
  type: 'depense' | 'recette';
  piece_number?: string;
  date: string;
  invoice_number?: string;
  mission_code?: string;
  object: string;
  party: string;
  amount_ht: number;
  vat_amount: number;
  amount_ttc: number;
  comment?: string;
}

export interface DashboardSummary {
  urgent_actions: Array<{
    id: string;
    mission_code: string;
    mission_title: string;
    label: string;
    deadline?: string;
    type: 'rappel_facturation' | 'echeance' | 'email_urgent' | 'rapport_a_finaliser' | 'deplacement';
  }>;
  total_unbilled_ht: number;
  missions_over_threshold_count: number;
  unbilled_hours_total: number;
  pending_emails_count: number;
  active_missions_count: number;
  monthly_revenue_ht: number;
  latest_invoices: Invoice[];
  upcoming_travels: TravelOrder[];
}
