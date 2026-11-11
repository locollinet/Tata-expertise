// Types métier partagés pour l'application Rocco — VP Expertise

export type MissionStatus = 
  | 'en_cours' 
  | 'attente_pieces' 
  | 'reunion_planifiee' 
  | 'rapport_remis' 
  | 'accord_en_cours' 
  | 'cloture';

export type DossierVoletKey =
  | 'garde'          // 1. Page de garde (File Register)
  | 'contrats'       // 2. Contrats client / Assuré
  | 'constatations'  // 3. Constatations immédiates (Jour J, visites terrain, extractions techniques & enregistreurs)
  | 'contradictoire' // 4. Respect du contradictoire (Mises en cause, convocations, dires, LRAR)
  | 'prejudice'      // 5. Comptes du préjudice (Tableau de décompte + justificatifs liés)
  | 'rapports';      // 6. Rapports émis (Packages datés + PJ numérotées + projet de rapport)

export type GuaranteeType =
  | 'RC'
  | 'Dommages'
  | 'TRME'
  | 'EAD'
  | 'Autre';

export interface AdverseParty {
  id?: string;
  party_name: string;    // Ex: SGP, VINCI...
  insurer_name?: string; // Compagnie tiers (ex: TRC, AXA, Allianz...)
  expert_firm?: string;  // Cabinet du confrère (ex: SARETEC, Polyexpert, Stelliant...)
  expert_name?: string;  // Nom du confrère (ex: Stefan LAWRUK)
  lawyer_name?: string;  // Avocat tiers éventuel
  reference?: string;    // Référence éventuelle de la partie adverse / confrère
}

export interface ExpertiseOperationRow {
  id: string;
  label: string;         // Ex: "1", "2", "3", "4", "5", "Définitif"
  expertise_date?: string; // Date d'opération d'expertise (ex: 2026-07-22)
  report_date?: string;    // Date d'émission du rapport (ex: 2026-07-28)
  quantum?: number | null; // Quantum évalué (ex: 838222.02)
  invoice_number?: string; // Numéro de facture liée (ex: 2026-071)
  invoice_amount_ht?: number | null; // Montant HT (ex: 5105.16)
  invoice_date?: string;   // Date de facture (ex: 2026-07-28)
}

export interface StakeEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  amount: number;        // Montant estimatif du préjudice en €
  note?: string;         // Ex: "Estimation à l'ouverture", "Réévaluation après chiffrage contradictoire"
}

export interface DamageLine {
  id: string;
  mission_id: string;
  mission_code: string;
  category: string;        // Ex: Matériel roulant, Infrastructure, Perte d'exploitation, Frais de secours, Autre
  label: string;           // Poste / Désignation
  claimed_amount: number;  // Montant réclamé (€ HT)
  claimed_amount_ht?: number; // Alias
  retained_amount: number; // Montant retenu par Valentine (€ HT)
  retained_amount_ht?: number; // Alias
  comment?: string;        // Observation / analyse (ex: réfaction maintenance courante)
  notes?: string;          // Alias
  piece_numbers: number[]; // Numéros de pièces jointes liées (ex: [4, 12])
  order_index: number;
  created_at: string;
}

export interface IssuedReport {
  id: string;
  mission_id: string;
  mission_code: string;
  report_type: string;     // Ex: Rapport préliminaire, Rapport d'étape, Rapport définitif, Note technique
  title: string;           // Ex: Rapport du 12 juillet 2026
  sent_date: string;       // YYYY-MM-DD
  issued_date?: string;    // Alias
  recipient: string;       // Mandant / Destinataire
  filename?: string | null;
  original_name?: string | null;
  attached_piece_numbers: number[]; // Liste des pièces numérotées envoyées dans ce package
  notes?: string;
  created_at: string;
}

export interface Mission {
  id: string;
  code: string; // N/Réf. Ex: VP2026922
  title: string; // Ex: ALSTOM - SGP Ligne 18...
  case_reference: string; // Réf. Client / Compagnie (V/Réf.) Ex: 11161461
  guarantee_type?: GuaranteeType | string; // Garantie / Type de mission : RC | Dommages | TRME | EAD | Autre
  status: MissionStatus;
  insurance_client: string; // Donneur d'ordre / Client (facturé) Ex: AXA XL
  client_contact?: string; // Interlocuteur donneur d'ordre Ex: Yannick DELAUNAY
  insurer_company?: string; // Compagnie (si distincte du donneur d'ordre)
  insurer_contact?: string; // Interlocuteur compagnie / assureur (alias)
  insured_party?: string; // Assuré Ex: ALSTOM (ou "= Client" / "N/A")
  insured_contact?: string; // Interlocuteur assuré Ex: GARNIER / I DELTOMBE MOREIRA
  insured_reference?: string; // Réf. Assuré
  broker_name?: string; // Courtier (ou "N/A")
  broker_reference?: string; // Réf. Courtier
  client_lawyer?: string; // Avocat (du client / assuré)
  third_parties?: string; // Texte libre historique (rétrocompatibilité)
  adverse_parties?: AdverseParty[]; // Parties adverses structurées avec compagnie tiers, confrères, avocat tiers
  stake_amount?: number | null; // Enjeu / Quantum actuel du dossier (€)
  initial_stake_amount?: number | null; // Enjeu initial (€)
  stake_history?: StakeEntry[]; // Historique de l'évolution de l'enjeu
  court_reference?: string; // Tribunal Ex: Tribunal Judiciaire de Nanterre
  judicial_expert?: string; // Expert judiciaire désigné (si expertise judiciaire)
  incident_date?: string;
  reception_date: string;
  description: string; // Briève description
  preliminary_analysis?: string; // Analyse préliminaire / Commentaires (Synthesis Table)
  pv_dommages_date?: string; // Date PV Dommages (Synthesis Table)
  expertise_operations?: ExpertiseOperationRow[]; // Tableau Opérations d'expertise / Rapports / Quantum / Factures
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
  total_billed_ht?: number;
  invoices_count?: number;
  last_invoice_date?: string | null;
  last_invoice_number?: string | null;
  activities?: Activity[];
  expenses?: Expense[];
  attendees?: Attendee[];
  communications?: Communication[];
  registered_mails?: RegisteredMail[];
  travels?: TravelOrder[];
  damage_lines?: DamageLine[];
  issued_reports?: IssuedReport[];
  documents?: MissionDocument[];
  photos?: Photo[];
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
  piece_number?: number;
  section?: DossierVoletKey;
  is_selected_for_report?: boolean;
  created_by?: string;
  created_at: string;
}

export type ActivityCategory = 
  | 'etude_documents'
  | 'expertise'
  | 'reunion_assureurs'
  | 'reunion_assure'
  | 'redaction'
  | 'deplacement'
  // Compatibilité rétroactive
  | 'analyse'
  | 'visio'
  | 'reunion'
  | 'echanges_tel';

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  etude_documents: 'Étude de documents, analyse, gestion du dossier',
  expertise: 'Expertise',
  reunion_assureurs: 'Réunion avec les assureurs',
  reunion_assure: 'Réunion avec l’assuré',
  redaction: 'Rédaction Expert',
  deplacement: 'Déplacement expert',
  // Alias de rétrocompatibilité
  analyse: 'Étude de documents, analyse, gestion du dossier',
  visio: 'Réunion avec les assureurs',
  reunion: 'Expertise',
  echanges_tel: 'Étude de documents, analyse, gestion du dossier',
};

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
  | 'train'
  | 'km'
  | 'peage'
  | 'location_voiture'
  | 'repas'
  | 'hotel'
  | 'parking'
  | 'taxi'
  | 'autre'
  // Compatibilité rétroactive
  | 'peage_parking';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  train: 'Frais de déplacement (train)',
  km: 'Frais kilométriques',
  peage: 'Péage',
  location_voiture: 'Voiture de location',
  repas: 'Repas',
  hotel: 'Hôtel',
  parking: 'Parking',
  taxi: 'Taxi',
  autre: 'Autre frais',
  peage_parking: 'Parking / Péage',
};

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
  vat_rate?: number;
  vat_amount: number;
  total_ttc: number;
  receipt_filename?: string | null;
  receipt_original_name?: string | null;
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
  presence_type?: 'site' | 'visio';
}

export interface Photo {
  id: string;
  mission_id: string;
  filename: string;
  original_name: string;
  caption: string;
  taken_at?: string;
  order_index: number;
  piece_number?: number;
  sub_section?: 'jour_j' | 'terrain' | 'extractions';
  is_selected_for_report: boolean;
  created_at: string;
}

export type DocumentCategory = 
  | 'contrat_client'
  | 'contrat'
  | 'constatation_jour_j'
  | 'photo_terrain'
  | 'extraction_technique'
  | 'emargement_pv'
  | 'note_technique'
  | 'procedure_dires'
  | 'courrier_adverse'
  | 'justificatif_prejudice'
  | 'devis_facture'
  | 'rapport_emis'
  | 'rapport_technique'
  | 'capture_ecran'
  | 'justificatif_frais'
  | 'autre';

export interface MissionDocument {
  id: string;
  mission_id: string;
  mission_code: string;
  piece_number?: number;
  section?: DossierVoletKey;
  sub_section?: string;
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
  body_Summary?: string;
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

export type RecurringFrequency = 'ponctuel' | 'mensuel' | 'trimestriel' | 'annuel';

export interface RecurringExpense {
  id: string;
  object: string; // Ex: Abonnement mobile, Loyer mensuel, URSSAF, Expert comptable
  party: string; // Ex: SFR, Pecheux, URSSAF IDF, CORGECO
  category: string; // Ex: telecom, loyer, charges_sociales, assurance, comptabilite, logiciel, transport, autre
  frequency: RecurringFrequency;
  day_of_month: number; // 1..28
  amount_ht: number;
  vat_rate: number; // 0, 0.055, 0.10, 0.20
  vat_amount: number;
  amount_ttc: number;
  active: boolean;
  comment?: string;
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
  vat_rate?: number;
  vat_amount: number;
  amount_ttc: number;
  frequency?: RecurringFrequency;
  recurring_expense_id?: string | null;
  receipt_filename?: string | null;
  receipt_original_name?: string | null;
  comment?: string;
}

export interface BankStatementItem {
  id: string;
  date: string; // YYYY-MM-DD
  raw_label: string;
  amount: number; // Positif (crédit) ou négatif (débit)
  type: 'credit' | 'debit';
  status: 'matched' | 'unmatched_bank' | 'unmatched_book';
  matched_entity_type?: 'invoice' | 'accounting_entry' | 'expense';
  matched_entity_id?: string;
  matched_entity_label?: string;
  suggested_category?: ExpenseCategory | string;
  confidence?: number;
}

export interface BankReconciliationReport {
  id: string;
  month: string; // YYYY-MM
  filename: string;
  generated_at: string;
  total_bank_credits: number;
  total_bank_debits: number;
  total_book_credits: number;
  total_book_debits: number;
  discrepancy: number;
  is_balanced: boolean;
  matched_count: number;
  unmatched_bank_count: number;
  unmatched_book_count: number;
  items: BankStatementItem[];
  unmatched_book_items: Array<{
    id: string;
    type: 'recette' | 'depense';
    label: string;
    amount: number;
    date: string;
    invoice_number?: string;
    mission_code?: string;
  }>;
  summary_message: string;
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
