import React, { useState, useEffect } from 'react';
import { X, FolderPlus, AlertCircle, Check, Sparkles, Plus, Trash2, Users, TrendingUp } from 'lucide-react';
import { api } from '../api.js';
import { AdverseParty } from '@shared/types.js';
import { ensureMissionFolderOnMac } from '../utils/localFolderSync.js';

interface CreateMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newMissionId: string) => void;
  initialValues?: Partial<{
    code: string;
    title: string;
    case_reference: string;
    insurance_client: string;
    client_contact: string;
    insured_party: string;
    insured_reference: string;
    broker_name: string;
    broker_reference: string;
    third_parties: string;
    stake_amount: number;
    court_reference: string;
    incident_date: string;
    reception_date: string;
    description: string;
  }> | null;
}

export const CreateMissionModal: React.FC<CreateMissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialValues,
}) => {
  const currentYear = new Date().getFullYear();
  const [code, setCode] = useState(`VP${currentYear}105`);
  const [title, setTitle] = useState('');
  const [insuranceClient, setInsuranceClient] = useState('AXA XL');
  const [caseReference, setCaseReference] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [insuredParty, setInsuredParty] = useState('');
  const [insuredReference, setInsuredReference] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [brokerReference, setBrokerReference] = useState('');
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [adverseParties, setAdverseParties] = useState<AdverseParty[]>([
    { id: 'adv-1', party_name: '', expert_firm: '', expert_name: '', lawyer_name: '', reference: '' },
  ]);
  const [courtReference, setCourtReference] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [receptionDate, setReceptionDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [currentStep, setCurrentStep] = useState('Réception du mandat et ouverture du dossier.');
  const [nextAction, setNextAction] = useState('Prise de contact avec les confrères et fixation réunion contradictoire.');
  const [nextDeadline, setNextDeadline] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialValues && isOpen) {
      if (initialValues.title) setTitle(initialValues.title);
      if (initialValues.case_reference) setCaseReference(initialValues.case_reference);
      if (initialValues.insurance_client) setInsuranceClient(initialValues.insurance_client);
      if (initialValues.client_contact) setClientContact(initialValues.client_contact);
      if (initialValues.insured_party) setInsuredParty(initialValues.insured_party);
      if (initialValues.insured_reference) setInsuredReference(initialValues.insured_reference);
      if (initialValues.broker_name) setBrokerName(initialValues.broker_name);
      if (initialValues.broker_reference) setBrokerReference(initialValues.broker_reference);
      if (initialValues.stake_amount !== undefined) setStakeAmount(String(initialValues.stake_amount));
      if (initialValues.third_parties) {
        setAdverseParties([
          {
            id: 'adv-init',
            party_name: initialValues.third_parties,
            expert_firm: '',
            expert_name: '',
            lawyer_name: '',
            reference: '',
          },
        ]);
      }
      if (initialValues.court_reference) setCourtReference(initialValues.court_reference);
      if (initialValues.incident_date) setIncidentDate(initialValues.incident_date);
      if (initialValues.reception_date) setReceptionDate(initialValues.reception_date);
      if (initialValues.description) setDescription(initialValues.description);
      if (initialValues.code) setCode(initialValues.code);
    }
  }, [initialValues, isOpen]);

  if (!isOpen) return null;

  const handleAddAdverseParty = () => {
    setAdverseParties((prev) => [
      ...prev,
      { id: `adv-${Date.now()}-${prev.length + 1}`, party_name: '', expert_firm: '', expert_name: '', lawyer_name: '', reference: '' },
    ]);
  };

  const handleUpdateAdverseParty = (index: number, field: keyof AdverseParty, value: string) => {
    setAdverseParties((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  };

  const handleRemoveAdverseParty = (index: number) => {
    setAdverseParties((prev) => (prev.length <= 1 ? [{ id: 'adv-1', party_name: '', expert_firm: '', expert_name: '', lawyer_name: '', reference: '' }] : prev.filter((_, idx) => idx !== index)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code || !title || !caseReference || !insuranceClient) {
      setError("N/Réf. (Code VP), le titre, le Client et la Référence Client sont obligatoires.");
      return;
    }

    const cleanedAdverse = adverseParties.filter(
      (p) => p.party_name.trim() || (p.expert_firm && p.expert_firm.trim()) || (p.expert_name && p.expert_name.trim())
    );
    const parsedStake = stakeAmount.trim() ? Number(stakeAmount.replace(/\s+/g, '').replace(',', '.')) : null;

    setLoading(true);
    try {
      const res = await api.createMission({
        code: code.trim(),
        title: title.trim(),
        case_reference: caseReference.trim(),
        insurance_client: insuranceClient.trim(),
        client_contact: clientContact.trim() || undefined,
        insured_party: insuredParty.trim() || undefined,
        insured_reference: insuredReference.trim() || undefined,
        broker_name: brokerName.trim() || undefined,
        broker_reference: brokerReference.trim() || undefined,
        adverse_parties: cleanedAdverse,
        third_parties: cleanedAdverse.map((p) => p.party_name).filter(Boolean).join(' / ') || undefined,
        stake_amount: parsedStake !== null && !isNaN(parsedStake) ? parsedStake : null,
        court_reference: courtReference.trim() || undefined,
        incident_date: incidentDate || undefined,
        reception_date: receptionDate,
        description: description.trim() || title.trim(),
        current_step: currentStep.trim(),
        next_action: nextAction.trim(),
        next_deadline: nextDeadline || undefined,
        billing_address: billingAddress.trim() || undefined,
        custom_hourly_rate: 190,
        custom_travel_rate: 135,
        custom_km_rate: 0.95,
      });
      // Crée automatiquement le sous-dossier Dossiers/<Code> et ses 6 volets sur le Mac
      await ensureMissionFolderOnMac(code.trim());
      onSuccess(res.id);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border border-slate-200 text-xs">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0f3854]/10 text-[#0f3854] flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Ouvrir un nouveau dossier d'expertise</h2>
              <p className="text-[11px] text-slate-500">Crée la Page de garde et prépare les 6 volets sur votre Mac</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {initialValues && (
          <div className="mx-6 mt-4 p-2.5 bg-cyan-50 border border-cyan-200 text-cyan-900 rounded-lg flex items-center space-x-2 text-xs">
            <Sparkles className="w-4 h-4 text-cyan-600 shrink-0" />
            <span>Champs pré-remplis par Rocco depuis votre document. Vérifiez les informations avant création.</span>
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 1. Identification & Enjeu */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">N/Réf. (Code VP) *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="w-full rounded-lg border-slate-300 p-2 border bg-white font-bold text-[#0f3854]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Titre de l'affaire / Sinistre *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex: ALSTOM - SGP Ligne 18 - Trémie OA-08"
                required
                className="w-full rounded-lg border-slate-300 p-2 border bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center space-x-1">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                <span>Enjeu estimé (€)</span>
              </label>
              <input
                type="number"
                step="1000"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="ex: 200000 ou 3000000"
                className="w-full rounded-lg border-amber-300 bg-amber-50/40 p-2 border font-semibold text-slate-900"
              />
            </div>
          </div>

          {/* 2. Parties prenantes & Références (Client, Assuré, Courtier) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0f3854]">
                Parties prenantes & Références (Client facturé, Assuré, Courtier)
              </span>
              <span className="text-[11px] text-slate-500">Seuls le Client et sa référence figurent sur la facture</span>
            </div>

            {/* Ligne Client (Facturé) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Client (facturé) *</label>
                <input
                  type="text"
                  value={insuranceClient}
                  onChange={(e) => setInsuranceClient(e.target.value)}
                  placeholder="ex: AXA XL, HELVETIA, ALBINGIA..."
                  required
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Référence Client (V/Réf.) *</label>
                <input
                  type="text"
                  value={caseReference}
                  onChange={(e) => setCaseReference(e.target.value)}
                  placeholder="ex: 11161461"
                  required
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Interlocuteur Client</label>
                <input
                  type="text"
                  value={clientContact}
                  onChange={(e) => setClientContact(e.target.value)}
                  placeholder="ex: Yannick DELAUNAY"
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
            </div>

            {/* Ligne Assuré + Courtier */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Assuré</label>
                <input
                  type="text"
                  value={insuredParty}
                  onChange={(e) => setInsuredParty(e.target.value)}
                  placeholder="ex: ALSTOM, FORWARDIS..."
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Référence Assuré</label>
                <input
                  type="text"
                  value={insuredReference}
                  onChange={(e) => setInsuredReference(e.target.value)}
                  placeholder="Optionnel"
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Courtier (optionnel)</label>
                <input
                  type="text"
                  value={brokerName}
                  onChange={(e) => setBrokerName(e.target.value)}
                  placeholder="ex: Marsh, Willis..."
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Référence Courtier</label>
                <input
                  type="text"
                  value={brokerReference}
                  onChange={(e) => setBrokerReference(e.target.value)}
                  placeholder="Optionnel"
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Adresse de facturation du client</label>
              <textarea
                rows={2}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Nom du client facturé, adresse postale complète..."
                className="w-full rounded-lg border-slate-300 p-2 border bg-white"
              />
            </div>
          </div>

          {/* 3. Parties adverses & Confrères mandatés */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-[#0f3854]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0f3854]">
                  Parties adverses & Confrères experts
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddAdverseParty}
                className="inline-flex items-center space-x-1 text-xs font-semibold text-[#0f3854] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter une partie adverse</span>
              </button>
            </div>

            <div className="space-y-2">
              {adverseParties.map((adv, idx) => (
                <div key={adv.id || idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Partie adverse</label>
                    <input
                      type="text"
                      value={adv.party_name || ''}
                      onChange={(e) => handleUpdateAdverseParty(idx, 'party_name', e.target.value)}
                      placeholder="ex: SNCF Réseau, VINCI..."
                      className="w-full rounded border-slate-200 p-1.5 border text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Cabinet Confrère</label>
                    <input
                      type="text"
                      value={adv.expert_firm || ''}
                      onChange={(e) => handleUpdateAdverseParty(idx, 'expert_firm', e.target.value)}
                      placeholder="ex: Saretec, Polyexpert..."
                      className="w-full rounded border-slate-200 p-1.5 border text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Nom du Confrère</label>
                    <input
                      type="text"
                      value={adv.expert_name || ''}
                      onChange={(e) => handleUpdateAdverseParty(idx, 'expert_name', e.target.value)}
                      placeholder="ex: M. Pechereau"
                      className="w-full rounded border-slate-200 p-1.5 border text-xs font-medium"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-end space-x-1">
                    <div className="flex-1">
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Avocat (opt.)</label>
                      <input
                        type="text"
                        value={adv.lawyer_name || ''}
                        onChange={(e) => handleUpdateAdverseParty(idx, 'lawyer_name', e.target.value)}
                        placeholder="Me ..."
                        className="w-full rounded border-slate-200 p-1.5 border text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAdverseParty(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600"
                      title="Retirer cette ligne"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Dates & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Date de réception mission *</label>
              <input
                type="date"
                value={receptionDate}
                onChange={(e) => setReceptionDate(e.target.value)}
                required
                className="w-full rounded-lg border-slate-300 p-2 border bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Date du sinistre</label>
              <input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full rounded-lg border-slate-300 p-2 border bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Prochaine échéance</label>
              <input
                type="date"
                value={nextDeadline}
                onChange={(e) => setNextDeadline(e.target.value)}
                className="w-full rounded-lg border-slate-300 p-2 border bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Résumé du sinistre</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Circonstances, matériels concernés..."
                className="w-full rounded-lg border-slate-300 p-2 border bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Prochaine étape à mener</label>
              <textarea
                rows={2}
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="ex: Convocation expertise contradictoire..."
                className="w-full rounded-lg border-slate-300 p-2 border bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#0f3854] hover:bg-[#16496d] text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? "Création..." : "Ouvrir le dossier"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
