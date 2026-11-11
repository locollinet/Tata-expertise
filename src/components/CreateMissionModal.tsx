import React, { useState, useEffect } from 'react';
import { X, FolderPlus, AlertCircle, Check, Sparkles, Plus, Trash2, Users, TrendingUp, Shield } from 'lucide-react';
import { api } from '../api.js';
import { AdverseParty, GuaranteeType } from '@shared/types.js';
import { ensureMissionFolderOnMac } from '../utils/localFolderSync.js';

interface CreateMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newMissionId: string) => void;
  initialValues?: Partial<{
    code: string;
    title: string;
    case_reference: string;
    guarantee_type: GuaranteeType | string;
    insurance_client: string;
    client_contact: string;
    insurer_company: string;
    insured_party: string;
    insured_contact: string;
    insured_reference: string;
    broker_name: string;
    broker_reference: string;
    client_lawyer: string;
    third_parties: string;
    stake_amount: number;
    court_reference: string;
    judicial_expert: string;
    incident_date: string;
    reception_date: string;
    description: string;
    preliminary_analysis: string;
  }> | null;
}

const GUARANTEE_OPTIONS: { value: GuaranteeType; label: string; desc: string }[] = [
  { value: 'RC', label: 'RC', desc: 'Responsabilité Civile' },
  { value: 'Dommages', label: 'Dommages', desc: 'Dommages aux biens' },
  { value: 'TRME', label: 'TRME', desc: 'Tous Risques Montage / Essais' },
  { value: 'EAD', label: 'EAD', desc: 'Engins / Automoteurs / Déraillement' },
  { value: 'Autre', label: 'Autre', desc: 'Autre garantie' },
];

export const CreateMissionModal: React.FC<CreateMissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialValues,
}) => {
  const currentYear = new Date().getFullYear();
  const [code, setCode] = useState(`VP${currentYear}105`);
  const [title, setTitle] = useState('');
  const [guaranteeType, setGuaranteeType] = useState<string>('RC');
  const [insuranceClient, setInsuranceClient] = useState('AXA XL');
  const [caseReference, setCaseReference] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [insurerCompany, setInsurerCompany] = useState('');
  const [insuredParty, setInsuredParty] = useState('');
  const [insuredContact, setInsuredContact] = useState('');
  const [insuredReference, setInsuredReference] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [brokerReference, setBrokerReference] = useState('');
  const [clientLawyer, setClientLawyer] = useState('');
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [adverseParties, setAdverseParties] = useState<AdverseParty[]>([
    { id: 'adv-1', party_name: '', insurer_name: '', expert_firm: '', expert_name: '', lawyer_name: '', reference: '' },
  ]);
  const [courtReference, setCourtReference] = useState('');
  const [judicialExpert, setJudicialExpert] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [receptionDate, setReceptionDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [preliminaryAnalysis, setPreliminaryAnalysis] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialValues && isOpen) {
      if (initialValues.title) setTitle(initialValues.title);
      if (initialValues.case_reference) setCaseReference(initialValues.case_reference);
      if (initialValues.guarantee_type) setGuaranteeType(initialValues.guarantee_type);
      if (initialValues.insurance_client) setInsuranceClient(initialValues.insurance_client);
      if (initialValues.client_contact) setClientContact(initialValues.client_contact);
      if (initialValues.insurer_company) setInsurerCompany(initialValues.insurer_company);
      if (initialValues.insured_party) setInsuredParty(initialValues.insured_party);
      if (initialValues.insured_contact) setInsuredContact(initialValues.insured_contact);
      if (initialValues.insured_reference) setInsuredReference(initialValues.insured_reference);
      if (initialValues.broker_name) setBrokerName(initialValues.broker_name);
      if (initialValues.broker_reference) setBrokerReference(initialValues.broker_reference);
      if (initialValues.client_lawyer) setClientLawyer(initialValues.client_lawyer);
      if (initialValues.stake_amount !== undefined) setStakeAmount(String(initialValues.stake_amount));
      if (initialValues.third_parties) {
        setAdverseParties([
          {
            id: 'adv-init',
            party_name: initialValues.third_parties,
            insurer_name: '',
            expert_firm: '',
            expert_name: '',
            lawyer_name: '',
            reference: '',
          },
        ]);
      }
      if (initialValues.court_reference) setCourtReference(initialValues.court_reference);
      if (initialValues.judicial_expert) setJudicialExpert(initialValues.judicial_expert);
      if (initialValues.incident_date) setIncidentDate(initialValues.incident_date);
      if (initialValues.reception_date) setReceptionDate(initialValues.reception_date);
      if (initialValues.description) setDescription(initialValues.description);
      if (initialValues.preliminary_analysis) setPreliminaryAnalysis(initialValues.preliminary_analysis);
      if (initialValues.code) setCode(initialValues.code);
    }
  }, [initialValues, isOpen]);

  if (!isOpen) return null;

  const handleAddAdverseParty = () => {
    setAdverseParties((prev) => [
      ...prev,
      { id: `adv-${Date.now()}-${prev.length + 1}`, party_name: '', insurer_name: '', expert_firm: '', expert_name: '', lawyer_name: '', reference: '' },
    ]);
  };

  const handleUpdateAdverseParty = (index: number, field: keyof AdverseParty, value: string) => {
    setAdverseParties((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  };

  const handleRemoveAdverseParty = (index: number) => {
    setAdverseParties((prev) =>
      prev.length <= 1
        ? [{ id: 'adv-1', party_name: '', insurer_name: '', expert_firm: '', expert_name: '', lawyer_name: '', reference: '' }]
        : prev.filter((_, idx) => idx !== index)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code || !title || !caseReference || !insuranceClient) {
      setError("Référence interne (Code VP), le Sujet, le Donneur d'ordre et la Référence Compagnie sont obligatoires.");
      return;
    }

    const cleanedAdverse = adverseParties.filter(
      (p) =>
        p.party_name.trim() ||
        (p.insurer_name && p.insurer_name.trim()) ||
        (p.expert_firm && p.expert_firm.trim()) ||
        (p.expert_name && p.expert_name.trim())
    );
    const parsedStake = stakeAmount.trim() ? Number(stakeAmount.replace(/\s+/g, '').replace(',', '.')) : null;

    setLoading(true);
    try {
      const res = await api.createMission({
        code: code.trim(),
        title: title.trim(),
        case_reference: caseReference.trim(),
        guarantee_type: guaranteeType || 'RC',
        insurance_client: insuranceClient.trim(),
        client_contact: clientContact.trim() || undefined,
        insurer_company: insurerCompany.trim() || undefined,
        insured_party: insuredParty.trim() || undefined,
        insured_contact: insuredContact.trim() || undefined,
        insured_reference: insuredReference.trim() || undefined,
        broker_name: brokerName.trim() || undefined,
        broker_reference: brokerReference.trim() || undefined,
        client_lawyer: clientLawyer.trim() || undefined,
        adverse_parties: cleanedAdverse,
        third_parties: cleanedAdverse.map((p) => p.party_name).filter(Boolean).join(' / ') || undefined,
        stake_amount: parsedStake !== null && !isNaN(parsedStake) ? parsedStake : null,
        court_reference: courtReference.trim() || undefined,
        judicial_expert: judicialExpert.trim() || undefined,
        incident_date: incidentDate || undefined,
        reception_date: receptionDate,
        description: description.trim() || title.trim(),
        preliminary_analysis: preliminaryAnalysis.trim() || undefined,
        current_step: 'Ouverture du dossier',
        next_action: '',
        billing_address: billingAddress.trim() || undefined,
        custom_hourly_rate: 190,
        custom_travel_rate: 135,
        custom_km_rate: 0.95,
      });
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto border border-slate-200 text-xs">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0f3854]/10 text-[#0f3854] flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Ouvrir un nouveau dossier d'expertise (Synthesis Table)</h2>
              <p className="text-[11px] text-slate-500">Crée la Fiche de garde conforme à votre Expertise File Register et prépare les sous-dossiers sur votre Mac</p>
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
          {/* 1. Références & Garantie (Ligne du haut de la Synthesis Table) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0f3854] flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-600" />
                <span>1. Références, Garantie & Juridiction</span>
              </span>
              <div className="flex items-center space-x-1">
                <span className="text-[11px] font-semibold text-slate-600 mr-1">Garantie * :</span>
                {GUARANTEE_OPTIONS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGuaranteeType(g.value)}
                    title={g.desc}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                      guaranteeType === g.value
                        ? 'bg-[#0f3854] text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Réf. Interne *</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white font-bold text-[#0f3854]"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Réf. Compagnie *</label>
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
                <label className="block text-slate-700 font-semibold mb-1">Réception mission *</label>
                <input
                  type="date"
                  value={receptionDate}
                  onChange={(e) => setReceptionDate(e.target.value)}
                  required
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Tribunal (opt.)</label>
                <input
                  type="text"
                  value={courtReference}
                  onChange={(e) => setCourtReference(e.target.value)}
                  placeholder="ex: TJ Nanterre ou -"
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Expert Judiciaire (opt.)</label>
                <input
                  type="text"
                  value={judicialExpert}
                  onChange={(e) => setJudicialExpert(e.target.value)}
                  placeholder="Nom de l'expert ou -"
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1 flex items-center space-x-1">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                  <span>Quantum / Enjeu (€)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="ex: 838222.02"
                  className="w-full rounded-lg border-amber-300 bg-amber-50/40 p-2 border font-semibold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* 2. Donneur d'ordre, Compagnie, Courtier, Assuré, Avocat */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0f3854]">
                2. Donneur d'ordre, Compagnie, Courtier, Assuré & Avocat
              </span>
              <span className="text-[11px] text-slate-500">Le Donneur d'ordre et la Réf. Compagnie servent à la facturation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Donneur d'ordre (Client facturé) *</label>
                <input
                  type="text"
                  value={insuranceClient}
                  onChange={(e) => setInsuranceClient(e.target.value)}
                  placeholder="ex: AXA XL, HELVETIA, ALSTOM..."
                  required
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Interlocuteur Donneur d'ordre</label>
                <input
                  type="text"
                  value={clientContact}
                  onChange={(e) => setClientContact(e.target.value)}
                  placeholder="ex: Yannick DELAUNAY"
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Compagnie (si distincte)</label>
                <input
                  type="text"
                  value={insurerCompany}
                  onChange={(e) => setInsurerCompany(e.target.value)}
                  placeholder="Optionnel"
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
            </div>

            {/* Ligne Assuré + Interlocuteur Assuré + Courtier + Avocat */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-600 font-medium">Assuré</label>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setInsuredParty(insuranceClient || '= Client')}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-semibold"
                      title="Le client est directement l'assuré (ex: Alstom en direct)"
                    >
                      = Client
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInsuredParty('N/A');
                        setInsuredContact('');
                      }}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-semibold"
                    >
                      N/A
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={insuredParty}
                  onChange={(e) => setInsuredParty(e.target.value)}
                  placeholder="ex: ALSTOM, TRANSDEV..."
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Interlocuteur Assuré</label>
                <input
                  type="text"
                  value={insuredContact}
                  onChange={(e) => setInsuredContact(e.target.value)}
                  placeholder="ex: GARNIER / I DELTOMBE MOREIRA"
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-600 font-medium">Courtier</label>
                  <button
                    type="button"
                    onClick={() => setBrokerName('N/A')}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-semibold"
                  >
                    N/A
                  </button>
                </div>
                <input
                  type="text"
                  value={brokerName}
                  onChange={(e) => setBrokerName(e.target.value)}
                  placeholder="ex: Marsh, Willis ou vide"
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Avocat (Client / Assuré)</label>
                <input
                  type="text"
                  value={clientLawyer}
                  onChange={(e) => setClientLawyer(e.target.value)}
                  placeholder="ex: Me ..."
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Adresse de facturation du client (pour la note d'honoraires Word)</label>
              <textarea
                rows={2}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="ex: AXA XL — Tour Majunga, La Défense 9, 6 Place de la Pyramide, 92800 PUTEAUX"
                className="w-full rounded-lg border-slate-300 p-2 border bg-white"
              />
            </div>
          </div>

          {/* 3. Tiers, Compagnie tiers, Expert tiers, Avocat tiers */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-[#0f3854]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0f3854]">
                  3. Tiers / Parties adverses (Tiers, Compagnie tiers, Expert tiers, Avocat tiers)
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddAdverseParty}
                className="inline-flex items-center space-x-1 text-xs font-semibold text-[#0f3854] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter un tiers</span>
              </button>
            </div>

            <div className="space-y-2">
              {adverseParties.map((adv, idx) => (
                <div key={adv.id || idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Tiers {idx + 1}</label>
                    <input
                      type="text"
                      value={adv.party_name || ''}
                      onChange={(e) => handleUpdateAdverseParty(idx, 'party_name', e.target.value)}
                      placeholder="ex: SGP, VINCI..."
                      className="w-full rounded border-slate-200 p-1.5 border text-xs font-semibold"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Compagnie tiers</label>
                    <input
                      type="text"
                      value={adv.insurer_name || ''}
                      onChange={(e) => handleUpdateAdverseParty(idx, 'insurer_name', e.target.value)}
                      placeholder="ex: TRC, Allianz..."
                      className="w-full rounded border-slate-200 p-1.5 border text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Expert tiers (Nom)</label>
                    <input
                      type="text"
                      value={adv.expert_name || ''}
                      onChange={(e) => handleUpdateAdverseParty(idx, 'expert_name', e.target.value)}
                      placeholder="ex: Stefan LAWRUK"
                      className="w-full rounded border-slate-200 p-1.5 border text-xs font-medium"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Cabinet</label>
                    <input
                      type="text"
                      value={adv.expert_firm || ''}
                      onChange={(e) => handleUpdateAdverseParty(idx, 'expert_firm', e.target.value)}
                      placeholder="ex: SARETEC"
                      className="w-full rounded border-slate-200 p-1.5 border text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-end space-x-1">
                    <div className="flex-1">
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Avocat tiers</label>
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
                      title="Retirer ce tiers"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Date du sinistre, Sujet, Briève description & Analyse préliminaire */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0f3854] block">
              4. Date du sinistre, Sujet, Briève description & Analyse préliminaire
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Date du sinistre</label>
                <input
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-slate-700 font-semibold mb-1">Sujet *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ex: SGP Ligne 18 - Effondrement d'une dalle dans une trémie (couverture de la trémie OA-08)"
                  required
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Briève description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ex: Dommages à l'infrastructure ALSTOM sise en dessous — Incertitude quant au fait qu'il s'agisse d'un ouvrage provisoire ou définitif"
                  className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Analyse préliminaire / Commentaires (optionnel)</label>
                <textarea
                  rows={2}
                  value={preliminaryAnalysis}
                  onChange={(e) => setPreliminaryAnalysis(e.target.value)}
                  placeholder="Notes libres, contexte technique ou réserves initiales..."
                  className="w-full rounded-lg border-amber-200 bg-amber-50/30 p-2 border"
                />
              </div>
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
