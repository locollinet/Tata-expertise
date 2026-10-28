import { Mission, Activity, Expense, Invoice, CreditNote, ReportDraft, Attendee, Photo, Communication, TravelOrder, RegisteredMail, AccountingEntry, DashboardSummary } from '@shared/types.js';

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

  // Missions
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
  updateMission: (id: string, data: Partial<Mission>) => fetchJSON<{ message: string }>(`/missions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Activities
  addActivity: (data: Partial<Activity>) => fetchJSON<{ id: string; total_ht: number; message: string }>('/activities', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteActivity: (id: string) => fetchJSON<{ message: string }>(`/activities/${id}`, {
    method: 'DELETE',
  }),

  // Expenses
  addExpense: (data: Partial<Expense>) => fetchJSON<{ id: string; total_ht: number; total_ttc: number; message: string }>('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteExpense: (id: string) => fetchJSON<{ message: string }>(`/expenses/${id}`, {
    method: 'DELETE',
  }),

  // Invoices
  getInvoices: () => fetchJSON<Invoice[]>('/invoices'),
  getInvoice: (id: string) => fetchJSON<Invoice>(`/invoices/${id}`),
  prepareInvoice: (data: { mission_id: string; activity_ids: string[]; expense_ids: string[]; subject?: string; advance_amount?: number; date?: string }) =>
    fetchJSON<{ invoiceId: string; nextNum: string; totalHT: number; vatAmount: number; totalTTC: number; netPayable: number; message: string }>('/invoices/prepare', {
      method: 'POST',
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

  // Attendees
  addAttendee: (data: Partial<Attendee>) => fetchJSON<{ id: string; message: string }>('/attendees', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteAttendee: (id: string) => fetchJSON<{ message: string }>(`/attendees/${id}`, { method: 'DELETE' }),

  // Communications
  getCommunications: (missionId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (missionId) params.set('mission_id', missionId);
    if (status) params.set('status', status);
    return fetchJSON<Communication[]>(`/communications?${params.toString()}`);
  },
  addCommunication: (data: Partial<Communication>) => fetchJSON<{ id: string; message: string }>('/communications', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateCommunication: (id: string, data: Partial<Communication>) => fetchJSON<{ message: string }>(`/communications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
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

  // Accounting
  getAccountingEntries: (month: string) => fetchJSON<{
    month: string;
    entries: AccountingEntry[];
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
  addAccountingEntry: (data: Partial<AccountingEntry>) => fetchJSON<{ id: string; message: string }>('/compta/entries', {
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
