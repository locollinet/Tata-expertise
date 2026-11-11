import { Mission, Activity, Expense, Invoice, CreditNote, ReportDraft, Attendee, Photo, Communication, TravelOrder, RegisteredMail, AccountingEntry, DashboardSummary, BankReconciliationReport, DamageLine, IssuedReport } from '@shared/types.js';

const BASE_URL = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    let errMsg = `Erreur HTTP ${res.status}`;
    try {
      const errData = await res.json();
      if (errData.error) errMsg = errData.error;
    } catch {}
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  // Dashboard
  getDashboard: () => fetchJSON<DashboardSummary>('/dashboard'),

  // Missions / Dossiers
  getMissions: (query?: string, status?: string) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (status) params.set('status', status);
    return fetchJSON<Mission[]>(`/missions?${params.toString()}`);
  },
  getMission: (id: string) => fetchJSON<any>(`/missions/${id}`),
  createMission: (data: Partial<Mission>) => fetchJSON<{ id: string; message: string }>('/missions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateMission: (id: string, data: Partial<Mission> & { stake_note?: string; stake_date?: string }) => fetchJSON<{ message: string; stake_history?: any[]; adverse_parties?: any[] }>(`/missions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Activities
  addActivity: (data: Partial<Activity>) => fetchJSON<{ id: string; total_ht: number; message: string }>('/activities', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateActivity: (id: string, data: Partial<Activity>) => fetchJSON<{ id: string; hours: number; total_ht: number; message: string }>(`/activities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteActivity: (id: string) => fetchJSON<{ message: string }>(`/activities/${id}`, {
    method: 'DELETE',
  }),

  // Expenses
  addExpense: async (data: Partial<Expense> & { receiptFile?: File | null }) => {
    if (data.receiptFile) {
      const fd = new FormData();
      if (data.mission_id) fd.append('mission_id', data.mission_id);
      if (data.date) fd.append('date', data.date);
      if (data.category) fd.append('category', data.category);
      if (data.label) fd.append('label', data.label);
      if (data.quantity !== undefined) fd.append('quantity', String(data.quantity));
      if (data.unit_price !== undefined) fd.append('unit_price', String(data.unit_price));
      if (data.vat_rate !== undefined) fd.append('vat_rate', String(data.vat_rate));
      if (data.is_refacturable !== undefined) fd.append('is_refacturable', String(data.is_refacturable));
      fd.append('receipt', data.receiptFile);
      const res = await fetch(`${BASE_URL}/expenses`, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur HTTP ${res.status}`);
      }
      return res.json();
    }
    return fetchJSON<{ id: string; total_ht: number; total_ttc: number; receipt_filename?: string; receipt_original_name?: string; message: string }>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateExpense: (id: string, data: Partial<Expense>) => fetchJSON<{ id: string; total_ht: number; total_ttc: number; message: string }>(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteExpense: (id: string) => fetchJSON<{ message: string }>(`/expenses/${id}`, {
    method: 'DELETE',
  }),
  uploadExpenseReceipt: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('receipt', file);
    const res = await fetch(`/api/expenses/${id}/receipt`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error("Erreur lors de l'upload du justificatif");
    return res.json() as Promise<{ message: string; receipt_filename: string; receipt_original_name: string }>;
  },
  removeExpenseReceipt: (id: string) => fetchJSON<{ message: string }>(`/expenses/${id}/receipt`, {
    method: 'DELETE',
  }),

  // Invoices
  getInvoices: () => fetchJSON<Invoice[]>('/invoices'),
  getInvoice: (id: string) => fetchJSON<Invoice>(`/invoices/${id}`),
  prepareInvoice: (data: { mission_id: string; activity_ids: string[]; expense_ids: string[]; subject?: string; advance_amount?: number; group_by_category?: boolean; date?: string }) =>
    fetchJSON<{ invoiceId: string; nextNum: string; totalHT: number; vatAmount: number; totalTTC: number; netPayable: number; message: string }>('/invoices/prepare', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateInvoice: (id: string, data: { subject?: string; advance_amount?: number; date?: string; lines?: any[] }) =>
    fetchJSON<{ message: string; totalHT: number; vatAmount: number; totalTTC: number; netPayable: number }>(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  emitInvoice: (id: string) => fetchJSON<{ message: string }>(`/invoices/${id}/emit`, { method: 'POST' }),
  cancelInvoice: (id: string) => fetchJSON<{ message: string }>(`/invoices/${id}/cancel`, { method: 'POST' }),
  recordPayment: (id: string, data: { payment_date?: string; payment_method?: string; paid_amount?: number; split_details?: any }) =>
    fetchJSON<{ message: string; status: string }>(`/invoices/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Credit Notes (Avoirs)
  getCreditNotes: () => fetchJSON<CreditNote[]>('/credit-notes'),
  createCreditNote: (data: { original_invoice_id: string; reason: string; date?: string }) =>
    fetchJSON<{ id: string; credit_number: string; message: string }>('/credit-notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Reports
  getReportDraft: (missionId: string) => fetchJSON<ReportDraft>(`/reports/${missionId}`),
  updateReportDraft: (missionId: string, data: Partial<ReportDraft>) =>
    fetchJSON<{ message: string }>(`/reports/${missionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  saveReportDraft: (missionId: string, data: Partial<ReportDraft>) =>
    fetchJSON<{ message: string }>(`/reports/${missionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Volet 5 : Comptes du préjudice
  getDamageLines: (missionId: string) => fetchJSON<DamageLine[]>(`/missions/${missionId}/damage-lines`),
  addDamageLine: (missionId: string, data: Partial<DamageLine>) =>
    fetchJSON<{ id: string; message: string }>(`/missions/${missionId}/damage-lines`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDamageLine: (id: string, data: Partial<DamageLine>) =>
    fetchJSON<{ message: string }>(`/damage-lines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteDamageLine: (id: string) =>
    fetchJSON<{ message: string }>(`/damage-lines/${id}`, {
      method: 'DELETE',
    }),

  // Volet 6 : Rapports émis (Packages datés + PJ numérotées)
  getIssuedReports: (missionId: string) => fetchJSON<IssuedReport[]>(`/missions/${missionId}/issued-reports`),
  addIssuedReport: async (missionId: string, data: (Partial<IssuedReport> & { file?: File | null }) | FormData) => {
    let fd: FormData;
    if (data instanceof FormData) {
      fd = data;
    } else {
      fd = new FormData();
      if (data.report_type) fd.append('report_type', data.report_type);
      if (data.title) fd.append('title', data.title);
      if (data.sent_date) fd.append('sent_date', data.sent_date);
      if (data.recipient) fd.append('recipient', data.recipient);
      if (data.notes) fd.append('notes', data.notes);
      if (data.attached_piece_numbers) fd.append('attached_piece_numbers', JSON.stringify(data.attached_piece_numbers));
      if (data.file) fd.append('file', data.file);
    }

    const res = await fetch(`${BASE_URL}/missions/${missionId}/issued-reports`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur HTTP ${res.status}`);
    }
    return res.json();
  },
  updateIssuedReport: (id: string, data: Partial<IssuedReport>) =>
    fetchJSON<{ message: string }>(`/issued-reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteIssuedReport: (id: string) =>
    fetchJSON<{ message: string }>(`/issued-reports/${id}`, {
      method: 'DELETE',
    }),

  // Photos
  updatePhoto: (id: string, data: Partial<Photo>) =>
    fetchJSON<{ message: string }>(`/photos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletePhoto: (id: string) => fetchJSON<{ message: string }>(`/photos/${id}`, { method: 'DELETE' }),

  // Documents
  getDocuments: (missionId: string) => fetchJSON<any[]>(`/missions/${missionId}/documents`),
  updateDocument: (id: string, data: any) =>
    fetchJSON<{ message: string }>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteDocument: (id: string) => fetchJSON<{ message: string }>(`/documents/${id}`, { method: 'DELETE' }),
  deleteMissionDocument: (id: string) => fetchJSON<{ message: string }>(`/documents/${id}`, { method: 'DELETE' }),

  // Attendees
  addAttendee: (dataOrMissionId: Partial<Attendee> | string, legacyData?: Partial<Attendee>) => {
    const payload = typeof dataOrMissionId === 'string'
      ? { ...legacyData, mission_id: dataOrMissionId }
      : dataOrMissionId;
    return fetchJSON<{ id: string; message: string }>('/attendees', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  deleteAttendee: (id: string) => fetchJSON<{ message: string }>(`/attendees/${id}`, { method: 'DELETE' }),

  // Communications
  getCommunications: (missionId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (missionId) params.set('mission_id', missionId);
    if (status) params.set('status', status);
    return fetchJSON<Communication[]>(`/communications?${params.toString()}`);
  },
  addCommunication: (dataOrMissionId: Partial<Communication> | string, legacyData?: Partial<Communication>) => {
    const payload = typeof dataOrMissionId === 'string'
      ? { ...legacyData, mission_id: dataOrMissionId }
      : dataOrMissionId;
    return fetchJSON<{ id: string; message: string }>('/communications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateCommunication: (id: string, data: Partial<Communication>) => fetchJSON<{ message: string }>(`/communications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  toggleCommunicationReplied: (id: string, replied: boolean) =>
    fetchJSON<{ message: string }>(`/communications/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: replied ? 'traite' : 'a_traiter' }),
    }),
  deleteCommunication: (id: string) =>
    fetchJSON<{ message: string }>(`/communications/${id}`, {
      method: 'DELETE',
    }),

  // Travels
  addTravel: (data: Partial<TravelOrder>) => fetchJSON<{ id: string; message: string }>('/travels', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateTravel: (id: string, data: Partial<TravelOrder>) => fetchJSON<{ message: string }>(`/travels/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Registered Mails (LRAR)
  addLRAR: (data: Partial<RegisteredMail>) => fetchJSON<{ id: string; message: string }>('/lrar', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateLRAR: (id: string, data: Partial<RegisteredMail>) => fetchJSON<{ message: string }>(`/lrar/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteLRAR: (id: string) => fetchJSON<{ message: string }>(`/lrar/${id}`, {
    method: 'DELETE',
  }),

  // Accounting & Recurring Expenses
  getAccountingEntries: (month: string) => fetchJSON<{
    month: string;
    entries: AccountingEntry[];
    recurring_expenses: any[];
    vat_breakdown: Array<{
      label: string;
      rate_label: string;
      base_ht: number;
      vat_amount: number;
      total_ttc: number;
      count: number;
    }>;
    summary: {
      depenses_ht: number;
      depenses_tva: number;
      depenses_ttc: number;
      recettes_ht: number;
      recettes_tva: number;
      recettes_ttc: number;
      tva_nette_a_payer: number;
    };
  }>(`/compta/entries?month=${month}`),
  addAccountingEntry: async (data: (Partial<AccountingEntry> & { category?: string; receiptFile?: File | null }) | FormData) => {
    if (data instanceof FormData) {
      const res = await fetch(`${BASE_URL}/compta/entries`, { method: 'POST', body: data });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur HTTP ${res.status}`);
      }
      return res.json();
    }
    if (data.receiptFile) {
      const fd = new FormData();
      if (data.month) fd.append('month', data.month);
      if (data.type) fd.append('type', data.type);
      if (data.piece_number) fd.append('piece_number', data.piece_number);
      if (data.date) fd.append('date', data.date);
      if (data.invoice_number) fd.append('invoice_number', data.invoice_number);
      if (data.mission_code) fd.append('mission_code', data.mission_code);
      if (data.object) fd.append('object', data.object);
      if (data.party) fd.append('party', data.party);
      if (data.amount_ht !== undefined) fd.append('amount_ht', String(data.amount_ht));
      if (data.vat_rate !== undefined) fd.append('vat_rate', String(data.vat_rate));
      if (data.vat_amount !== undefined) fd.append('vat_amount', String(data.vat_amount));
      if (data.amount_ttc !== undefined) fd.append('amount_ttc', String(data.amount_ttc));
      if (data.frequency) fd.append('frequency', data.frequency);
      if (data.category) fd.append('category', data.category);
      if (data.comment) fd.append('comment', data.comment);
      fd.append('receipt', data.receiptFile);

      const res = await fetch(`${BASE_URL}/compta/entries`, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur HTTP ${res.status}`);
      }
      return res.json();
    }
    return fetchJSON<{ id: string; receipt_filename?: string; receipt_original_name?: string; message: string }>('/compta/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateAccountingEntry: async (id: string, data: (Partial<AccountingEntry> & { update_recurring_template?: boolean }) | FormData) => {
    if (data instanceof FormData) {
      const res = await fetch(`${BASE_URL}/compta/entries/${id}`, { method: 'PUT', body: data });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur HTTP ${res.status}`);
      }
      return res.json();
    }
    return fetchJSON<{ message: string; receipt_filename?: string; receipt_original_name?: string }>(`/compta/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  uploadAccountingReceipt: async (entryId: string, file: File) => {
    const fd = new FormData();
    fd.append('receipt', file);
    const res = await fetch(`${BASE_URL}/compta/entries/${entryId}/receipt`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur HTTP ${res.status}`);
    }
    return res.json() as Promise<{ receipt_filename: string; receipt_original_name: string; message: string }>;
  },
  uploadAccountingEntryReceipt: async (entryId: string, file: File) => {
    const fd = new FormData();
    fd.append('receipt', file);
    const res = await fetch(`${BASE_URL}/compta/entries/${entryId}/receipt`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur HTTP ${res.status}`);
    }
    return res.json() as Promise<{ receipt_filename: string; receipt_original_name: string; message: string }>;
  },
  deleteAccountingReceipt: (entryId: string) =>
    fetchJSON<{ message: string }>(`/compta/entries/${entryId}/receipt`, {
      method: 'DELETE',
    }),
  deleteAccountingEntry: (id: string) =>
    fetchJSON<{ message: string }>(`/compta/entries/${id}`, {
      method: 'DELETE',
    }),
  getRecurringExpenses: () => fetchJSON<any[]>('/compta/recurring'),
  addRecurringExpense: (data: any) => fetchJSON<{ id: string; message: string }>('/compta/recurring', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateRecurringExpense: (id: string, data: any) => fetchJSON<{ message: string }>(`/compta/recurring/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteRecurringExpense: (id: string) => fetchJSON<{ message: string }>(`/compta/recurring/${id}`, {
    method: 'DELETE',
  }),

  // Rapprochement Bancaire IA ("Tout est carré")
  reconcileBankStatement: async (month: string, file: File): Promise<BankReconciliationReport> => {
    const formData = new FormData();
    formData.append('month', month);
    formData.append('statement', file);
    const res = await fetch('/api/compta/bank-reconciliation', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur de rapprochement bancaire (${res.status})`);
    }
    return res.json();
  },
  addAccountingEntryFromBank: (data: {
    month: string;
    date: string;
    object: string;
    party: string;
    amount_ttc: number;
    vat_rate?: number;
    category?: string;
    comment?: string;
  }) => fetchJSON<{ id: string; message: string }>('/compta/entries-from-bank', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // AI Assistant (Gemini Flash & Ingestion Terrain)
  askAssistant: (data: { message: string; history?: any[]; missionId?: string }) => fetchJSON<{
    reply: string;
    model: string;
    hasKey: boolean;
  }>('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  ingestDocument: async (formData: FormData) => {
    const res = await fetch('/api/assistant/ingest', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur d'ingestion (${res.status})`);
    }
    return res.json();
  },
  commitAssistantAction: (data: any) => fetchJSON<{
    success: boolean;
    message: string;
    id?: string;
    mission_code?: string;
  }>('/assistant/commit-action', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};
