import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Clock, Receipt, FileText, Mail, Train, Plus, Trash2, Download,
  CheckCircle2, AlertCircle, Save, ExternalLink, Calendar, Copy, Check,
  FolderOpen, UploadCloud, Paperclip, FileSpreadsheet, Eye, ShieldCheck, Sliders, Camera,
  ChevronDown, Edit3, Archive, RotateCcw, Users, Scale, Calculator, Send, Sparkles, Package, Building2, TrendingUp
} from 'lucide-react';
import { api } from '../api.js';
import {
  ACTIVITY_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS,
  DossierVoletKey,
  AdverseParty,
  DamageLine,
  IssuedReport,
  MissionDocument,
} from '@shared/types.js';
import { MissionRatesSettings } from '../components/MissionRatesSettings.js';
import {
  syncFileToLocalMacFolder,
  syncComptaFileToMac,
  mirrorEvidenceToFirestore,
  VOLET_TO_MAC_FOLDER,
  isLocalSyncConnected,
  getLocalSyncFolderName,
} from '../utils/localFolderSync.js';

interface MissionDetailViewProps {
  missionId: string;
  initialMission?: any;
  sourceTab?: 'today' | 'missions' | 'billing';
  onBack: () => void;
  onCacheMission?: (mission: any) => void;
  onOpenQuickAdd: (missionId: string) => void;
  onPrepareBilling: (missionId: string) => void;
}

const VOLETS_CONFIG: Array<{
  key: DossierVoletKey;
  num: string;
  label: string;
  shortDesc: string;
  macFolder: string;
}> = [
  {
    key: 'garde',
    num: '01',
    label: 'Page de garde',
    shortDesc: 'Références, parties & confrères, enjeu, factures, pointage',
    macFolder: '01_Page_de_garde',
  },
  {
    key: 'contrats',
    num: '02',
    label: 'Contrats',
    shortDesc: 'Polices client & assuré, environnement contractuel',
    macFolder: '02_Contrats',
  },
  {
    key: 'constatations',
    num: '03',
    label: 'Constatations immédiates',
    shortDesc: 'Jour J, visites terrain, photos en vrac & extractions',
    macFolder: '03_Constatations_immediates',
  },
  {
    key: 'contradictoire',
    num: '04',
    label: 'Contradictoire',
    shortDesc: 'Mises en cause, convocations, dires, courriers LRAR',
    macFolder: '04_Contradictoire',
  },
  {
    key: 'prejudice',
    num: '05',
    label: 'Comptes du préjudice',
    shortDesc: 'Chiffrage réclamé / retenu & pièces justificatives liées',
    macFolder: '05_Comptes_du_prejudice',
  },
  {
    key: 'rapports',
    num: '06',
    label: 'Rapports émis',
    shortDesc: 'Rapports diffusés + pièces jointes (.zip avocats) & rédaction',
    macFolder: '06_Rapports_emis',
  },
];

export const MissionDetailView: React.FC<MissionDetailViewProps> = ({
  missionId,
  initialMission,
  sourceTab = 'missions',
  onBack,
  onCacheMission,
  onOpenQuickAdd,
  onPrepareBilling,
}) => {
  const [mission, setMission] = useState<any>(initialMission || null);
  const [loading, setLoading] = useState(!initialMission || !initialMission.activities);

  // Map legacy subtab query param if any, defaulting to 'garde' (1. Page de garde)
  const rawSubtab = new URLSearchParams(window.location.search).get('subtab');
  const resolveInitialVolet = (s: string | null): DossierVoletKey => {
    if (!s) return 'garde';
    if (['garde', 'contrats', 'constatations', 'contradictoire', 'prejudice', 'rapports'].includes(s)) {
      return s as DossierVoletKey;
    }
    if (s === 'evidences') return 'constatations';
    if (s === 'comms') return 'contradictoire';
    if (s === 'report') return 'rapports';
    return 'garde';
  };

  const [activeVolet, setActiveVolet] = useState<DossierVoletKey>(resolveInitialVolet(rawSubtab));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Global & Volet Document Upload state (sans légende obligatoire)
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [docOptionalNote, setDocOptionalNote] = useState('');
  const [constatSubSection, setConstatSubSection] = useState<'jour_j' | 'visite_terrain' | 'extractions'>('visite_terrain');

  // Volet 1 (Page de garde) — Parties & Références editing
  const [editingParties, setEditingParties] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientRef, setClientRef] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [insuredParty, setInsuredParty] = useState('');
  const [insuredRef, setInsuredRef] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [brokerRef, setBrokerRef] = useState('');
  const [missionCodeEdit, setMissionCodeEdit] = useState('');
  const [missionTitleEdit, setMissionTitleEdit] = useState('');
  const [adverseParties, setAdverseParties] = useState<AdverseParty[]>([]);

  // Volet 1 — Enjeu du dossier update state
  const [showUpdateStake, setShowUpdateStake] = useState(false);
  const [newStakeAmount, setNewStakeAmount] = useState('');
  const [newStakeNote, setNewStakeNote] = useState('');

  // Volet 1 — Inline edit activity hours
  const [editingActId, setEditingActId] = useState<string | null>(null);
  const [editActHours, setEditActHours] = useState<string>('');
  const [showRatesDrawer, setShowRatesDrawer] = useState(false);

  // Volet 1 — New travel / site visit form
  const [showAddTravel, setShowAddTravel] = useState(false);
  const [travelDest, setTravelDest] = useState('');
  const [travelStart, setTravelStart] = useState(new Date().toISOString().slice(0, 10));
  const [travelTransport, setTravelTransport] = useState('Train SNCF');
  const [travelReg, setTravelReg] = useState('');

  // Volet 3 (Constatations) — Attendees & Field notes
  const [showAddAttendee, setShowAddAttendee] = useState(false);
  const [attName, setAttName] = useState('');
  const [attOrg, setAttOrg] = useState('');
  const [attRole, setAttRole] = useState('');
  const [attPresence, setAttPresence] = useState<'site' | 'visio'>('site');
  const [rawFieldNotes, setRawFieldNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Volet 4 (Contradictoire) — New communication / dire / LRAR
  const [showAddComm, setShowAddComm] = useState(false);
  const [commSender, setCommSender] = useState('');
  const [commSubject, setCommSubject] = useState('');
  const [commBody, setCommBody] = useState('');
  const [commUrgency, setCommUrgency] = useState<'normale' | 'urgente'>('normale');

  // Volet 5 (Comptes du préjudice) — New / Edit damage line
  const [showAddDamageLine, setShowAddDamageLine] = useState(false);
  const [dmgCategory, setDmgCategory] = useState<'materiel' | 'exploitation' | 'frais_annexes' | 'autre'>('materiel');
  const [dmgLabel, setDmgLabel] = useState('');
  const [dmgClaimed, setDmgClaimed] = useState('');
  const [dmgRetained, setDmgRetained] = useState('');
  const [dmgNotes, setDmgNotes] = useState('');
  const [dmgSelectedPieces, setDmgSelectedPieces] = useState<number[]>([]);
  const [editingDamageId, setEditingDamageId] = useState<string | null>(null);

  // Volet 6 (Rapports émis) — New Issued Report package + Draft editor
  const [showAddIssuedReport, setShowAddIssuedReport] = useState(false);
  const [repType, setRepType] = useState<'preliminaire' | 'intermediaire' | 'final' | 'note_synthese'>('intermediaire');
  const [repTitle, setRepTitle] = useState('');
  const [repDate, setRepDate] = useState(new Date().toISOString().slice(0, 10));
  const [repRecipient, setRepRecipient] = useState('');
  const [repNotes, setRepNotes] = useState('');
  const [repSelectedPieces, setRepSelectedPieces] = useState<number[]>([]);
  const [repFile, setRepFile] = useState<File | null>(null);
  const [submittingReportPkg, setSubmittingReportPkg] = useState(false);
  const [showDraftEditor, setShowDraftEditor] = useState(false);

  // Report draft sections
  const [reportFacts, setReportFacts] = useState('');
  const [reportObs, setReportObs] = useState('');
  const [reportAnalysis, setReportAnalysis] = useState('');
  const [reportConc, setReportConc] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const syncFormStateFromMission = (data: any) => {
    setClientName(data.insurance_client || '');
    setClientRef(data.case_reference || '');
    setClientContact(data.insurer_contact || '');
    setBillingAddress(data.billing_address || '');
    setInsuredParty(data.insured_party || '');
    setInsuredRef(data.insured_reference || '');
    setBrokerName(data.broker_name || '');
    setBrokerRef(data.broker_reference || '');
    setMissionCodeEdit(data.code || '');
    setMissionTitleEdit(data.title || '');
    setAdverseParties(Array.isArray(data.adverse_parties) ? data.adverse_parties : []);
    setNewStakeAmount(data.stake_amount ? String(data.stake_amount) : '');
    if (data.report_draft) {
      setReportFacts(data.report_draft.section_facts || '');
      setReportObs(data.report_draft.section_observations || '');
      setReportAnalysis(data.report_draft.section_analysis || '');
      setReportConc(data.report_draft.section_conclusions || '');
      setRawFieldNotes(data.report_draft.raw_field_notes || '');
    }
  };

  const loadData = async () => {
    try {
      const data = await api.getMission(missionId);
      setMission(data);
      onCacheMission?.(data);
      syncFormStateFromMission(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialMission && (!mission || mission.id !== missionId)) {
      setMission(initialMission);
      syncFormStateFromMission(initialMission);
      setLoading(!initialMission.activities);
    }
    loadData();
  }, [missionId]);

  if (!mission) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f3854]"></div>
      </div>
    );
  }

  const allDocuments: MissionDocument[] = mission.documents || [];
  const allPhotos: any[] = mission.photos || [];
  const damageLines: DamageLine[] = mission.damage_lines || [];
  const issuedReports: IssuedReport[] = mission.issued_reports || [];
  const missionInvoices: any[] = mission.invoices || [];

  // Filter documents by volet
  const docsContrats = allDocuments.filter((d) => d.section === 'contrats' || d.category === 'contrat');
  const docsConstatations = allDocuments.filter(
    (d) => d.section === 'constatations' || (!d.section && ['photo_terrain', 'autre'].includes(d.category))
  );
  const docsContradictoire = allDocuments.filter(
    (d) => d.section === 'contradictoire' || d.category === 'courrier_adverse'
  );
  const docsPrejudice = allDocuments.filter(
    (d) => d.section === 'prejudice' || (!d.section && ['devis_facture', 'rapport_technique'].includes(d.category))
  );
  const docsRapports = allDocuments.filter((d) => d.section === 'rapports');

  // Counts per volet for badges
  const voletCounts: Record<DossierVoletKey, number> = {
    garde: (mission.activities?.length || 0) + (missionInvoices.length || 0),
    contrats: docsContrats.length,
    constatations: docsConstatations.length + allPhotos.length + (mission.attendees?.length || 0),
    contradictoire: docsContradictoire.length + (mission.communications?.length || 0),
    prejudice: damageLines.length + docsPrejudice.length,
    rapports: issuedReports.length + docsRapports.length,
  };

  // Universal upload handler for any Volet (with automatic Pièce n° numbering & Mac folder sync)
  const handleUploadFilesToVolet = async (
    files: FileList | File[],
    targetVolet: DossierVoletKey,
    subSec?: string
  ) => {
    if (!files || files.length === 0) return;
    setUploadingDocs(true);
    try {
      const sectionMap: Record<DossierVoletKey, string> = {
        garde: 'contrats',
        contrats: 'contrats',
        constatations: 'constatations',
        contradictoire: 'contradictoire',
        prejudice: 'prejudice',
        rapports: 'rapports',
      };
      const categoryMap: Record<DossierVoletKey, string> = {
        garde: 'autre',
        contrats: 'contrat',
        constatations: 'photo_terrain',
        contradictoire: 'courrier_adverse',
        prejudice: 'devis_facture',
        rapports: 'rapport_technique',
      };

      const formData = new FormData();
      formData.append('section', sectionMap[targetVolet]);
      formData.append('category', categoryMap[targetVolet]);
      if (subSec) formData.append('sub_section', subSec);
      if (docOptionalNote.trim()) formData.append('caption', docOptionalNote.trim());

      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const res = await fetch(`/api/missions/${mission.id}/documents`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors du dépôt des pièces');
      }
      const result = await res.json();
      const createdDocs: MissionDocument[] = result.documents || [];

      const macSubFolder = VOLET_TO_MAC_FOLDER[targetVolet] || '03_Constatations_immediates';
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const pieceNum = createdDocs[i]?.piece_number;
        const macFileName = pieceNum ? `Piece_${pieceNum}_${f.name}` : f.name;
        await syncFileToLocalMacFolder({
          missionCode: mission.code,
          subFolder: macSubFolder,
          fileName: macFileName,
          data: f,
        });
        await mirrorEvidenceToFirestore({
          missionId: mission.id,
          missionCode: mission.code,
          file: f,
          title: docOptionalNote.trim() || f.name,
          caption: docOptionalNote.trim() || f.name,
          type: f.type.startsWith('image/') ? 'photo' : 'document',
          isSelectedForReport: false,
        });
      }

      setDocOptionalNote('');
      const nums = createdDocs.map((d) => `Pièce n°${d.piece_number}`).join(', ');
      showToast(
        `${files.length} fichier(s) classé(s) (${nums || 'numérotés'}) et synchronisé(s) dans Dossiers/${mission.code}/${macSubFolder}`
      );
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleSavePartiesAndRefs = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanedParties = adverseParties.filter(
        (p) => p.party_name.trim() || p.expert_firm.trim() || p.expert_name.trim()
      );
      await api.updateMission(mission.id, {
        code: missionCodeEdit.trim(),
        title: missionTitleEdit.trim(),
        insurance_client: clientName.trim(),
        case_reference: clientRef.trim(),
        insurer_contact: clientContact.trim(),
        billing_address: billingAddress.trim(),
        insured_party: insuredParty.trim(),
        insured_reference: insuredRef.trim(),
        broker_name: brokerName.trim(),
        broker_reference: brokerRef.trim(),
        adverse_parties: cleanedParties,
      });
      setEditingParties(false);
      showToast('Parties, références et confrères enregistrés !');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateStake = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(newStakeAmount.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(num) || num < 0) return;
    try {
      await api.updateMission(mission.id, {
        stake_amount: num,
        stake_note: newStakeNote.trim() || 'Mise à jour de l’enjeu estimé',
      });
      setShowUpdateStake(false);
      setNewStakeNote('');
      showToast(`Enjeu du dossier actualisé à ${num.toLocaleString('fr-FR')} € HT.`);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveActivityHours = async (actId: string) => {
    const numHours = parseFloat(editActHours.replace(',', '.'));
    if (isNaN(numHours) || numHours <= 0) return;
    try {
      await api.updateActivity(actId, { hours: numHours });
      setEditingActId(null);
      showToast('Heures mises à jour.');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleMissionStatus = async () => {
    try {
      const nextStatus = mission.status === 'cloture' ? 'en_cours' : 'cloture';
      await api.updateMission(mission.id, { status: nextStatus });
      showToast(
        nextStatus === 'cloture'
          ? 'Dossier clôturé / archivé.'
          : 'Dossier réouvert et remis en cours !'
      );
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDownloadInvoiceDocx = async (inv: any) => {
    try {
      const res = await fetch(`/api/invoices/${inv.id}/docx`);
      if (!res.ok) throw new Error('Erreur lors de la génération Word');
      const blob = await res.blob();
      const fileName = `Facture_${inv.invoice_number}.docx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      await syncFileToLocalMacFolder({
        missionCode: mission.code,
        subFolder: '01_Page_de_garde',
        fileName,
        data: blob,
      });
      await syncComptaFileToMac({
        month: (inv.date || '').slice(0, 7),
        subFolder: 'Factures_emises',
        fileName,
        data: blob,
      });
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveDamageLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmgLabel.trim()) return;
    const claimed = parseFloat(dmgClaimed.replace(/\s/g, '').replace(',', '.')) || 0;
    const retained =
      dmgRetained.trim() !== ''
        ? parseFloat(dmgRetained.replace(/\s/g, '').replace(',', '.'))
        : claimed;
    try {
      if (editingDamageId) {
        await api.updateDamageLine(editingDamageId, {
          category: dmgCategory,
          label: dmgLabel.trim(),
          claimed_amount_ht: claimed,
          retained_amount_ht: retained,
          piece_numbers: dmgSelectedPieces,
          notes: dmgNotes.trim() || undefined,
        });
        showToast('Ligne de préjudice mise à jour.');
      } else {
        await api.addDamageLine(mission.id, {
          category: dmgCategory,
          label: dmgLabel.trim(),
          claimed_amount_ht: claimed,
          retained_amount_ht: retained,
          piece_numbers: dmgSelectedPieces,
          notes: dmgNotes.trim() || undefined,
        });
        showToast('Poste ajouté aux Comptes du préjudice.');
      }
      setShowAddDamageLine(false);
      setEditingDamageId(null);
      setDmgLabel('');
      setDmgClaimed('');
      setDmgRetained('');
      setDmgNotes('');
      setDmgSelectedPieces([]);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateIssuedReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repTitle.trim()) return;
    setSubmittingReportPkg(true);
    try {
      const formData = new FormData();
      formData.append('report_type', repType);
      formData.append('title', repTitle.trim());
      formData.append('issued_date', repDate);
      formData.append('recipient', repRecipient.trim() || mission.insurance_client);
      formData.append('attached_piece_numbers', JSON.stringify(repSelectedPieces));
      if (repNotes.trim()) formData.append('notes', repNotes.trim());
      if (repFile) formData.append('file', repFile);

      await api.addIssuedReport(mission.id, formData);

      if (repFile) {
        await syncFileToLocalMacFolder({
          missionCode: mission.code,
          subFolder: '06_Rapports_emis',
          fileName: `${repDate}_${repFile.name}`,
          data: repFile,
        });
      }

      setShowAddIssuedReport(false);
      setRepTitle('');
      setRepNotes('');
      setRepSelectedPieces([]);
      setRepFile(null);
      showToast('Rapport émis et liste des pièces jointes archivés avec succès !');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingReportPkg(false);
    }
  };

  const handleSaveReportDraft = async () => {
    setSavingNotes(true);
    try {
      await api.saveReportDraft(mission.id, {
        section_facts: reportFacts,
        section_observations: reportObs,
        section_analysis: reportAnalysis,
        section_conclusions: reportConc,
        raw_field_notes: rawFieldNotes,
      });
      showToast('Notes et trame de rapport sauvegardées.');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  // Totals for Volet 1 & Volet 5
  const totalUnbilledHT = mission.total_unbilled_ht || 0;
  const totalBilledHT = mission.total_billed_ht || 0;
  const stakeAmount = mission.stake_amount || 0;
  const stakeHistory = Array.isArray(mission.stake_history) ? mission.stake_history : [];
  const nextInvoiceSubjectDate = (mission.last_invoice_date || mission.reception_date || '')
    .split('-')
    .reverse()
    .join('/');

  const totalClaimedHT = damageLines.reduce((acc, l) => acc + (Number(l.claimed_amount_ht) || 0), 0);
  const totalRetainedHT = damageLines.reduce((acc, l) => acc + (Number(l.retained_amount_ht) || 0), 0);

  const currentVoletMeta = VOLETS_CONFIG.find((v) => v.key === activeVolet) || VOLETS_CONFIG[0];

  // Reusable Piece List Table component for Volets 2, 3, 4, 5, 6
  const renderPieceTable = (docs: MissionDocument[], emptyText: string) => {
    if (docs.length === 0) {
      return (
        <div className="p-6 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
          {emptyText}
        </div>
      );
    }
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <th className="py-2.5 px-3 font-bold w-24">N° Pièce</th>
              <th className="py-2.5 px-3 font-semibold">Nom du document / Fichier</th>
              <th className="py-2.5 px-3 font-semibold">Note / Observation (optionnel)</th>
              <th className="py-2.5 px-3 font-semibold w-28">Date d'ajout</th>
              <th className="py-2.5 px-3 font-semibold text-right w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {docs.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50/80">
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-[#0f3854] text-white font-mono">
                    Pièce n°{doc.piece_number || '—'}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-semibold text-slate-900">
                  <a
                    href={`/uploads/${doc.filename}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#0f3854] hover:underline inline-flex items-center space-x-1.5"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{doc.original_name}</span>
                  </a>
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  {doc.caption && doc.caption !== doc.original_name ? doc.caption : <span className="text-slate-400">—</span>}
                </td>
                <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                  {(doc.created_at || '').slice(0, 10).split('-').reverse().join('/')}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1.5">
                  <a
                    href={`/uploads/${doc.filename}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Ouvrir</span>
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteMissionDocument(doc.id);
                      showToast('Pièce retirée du dossier.');
                      loadData();
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600"
                    title="Supprimer cette pièce"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Reusable Dropzone for Volets 2, 3, 4, 5
  const renderVoletDropzone = (voletKey: DossierVoletKey, helperLabel: string, subSec?: string) => {
    const macFolder = VOLET_TO_MAC_FOLDER[voletKey];
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleUploadFilesToVolet(e.dataTransfer.files, voletKey, subSec);
          }
        }}
        className={`p-4 rounded-xl border-2 border-dashed transition-all ${
          isDraggingOver
            ? 'border-[#0f3854] bg-sky-50/70'
            : 'border-slate-300 bg-slate-50/60 hover:bg-slate-50'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#0f3854]/10 text-[#0f3854] flex items-center justify-center shrink-0 mt-0.5">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                Glissez-déposez vos fichiers ici en vrac ({helperLabel})
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Numérotation séquentielle automatique (<strong className="text-slate-700">Pièce n°{(allDocuments.length || 0) + 1}</strong>) • Aucune légende obligatoire • Copie Mac :{' '}
                <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-mono text-[#0f3854]">
                  Dossiers/{mission.code}/{macFolder}/
                </code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={docOptionalNote}
              onChange={(e) => setDocOptionalNote(e.target.value)}
              placeholder="Note facultative..."
              className="text-xs rounded-lg border-slate-300 bg-white px-2.5 py-1.5 border w-44"
            />
            <label className="px-3.5 py-2 bg-[#0f3854] hover:bg-[#16496d] text-white rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center space-x-1.5 shadow-2xs">
              <Plus className="w-3.5 h-3.5" />
              <span>{uploadingDocs ? 'Dépôt...' : 'Choisir des fichiers'}</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleUploadFilesToVolet(e.target.files, voletKey, subSec);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center space-x-2 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* TOP BAR : Back button + Mac Sync Status + Status Archive Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-[#0f3854] bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>
            {sourceTab === 'today'
              ? "Retour à Aujourd'hui"
              : sourceTab === 'billing'
              ? 'Retour aux Factures'
              : 'Retour aux Dossiers'}
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] text-slate-600">
            <FolderOpen className="w-3.5 h-3.5 text-[#0f3854]" />
            <span>
              Arborescence Mac :{' '}
              <strong className="font-mono text-slate-800">
                {isLocalSyncConnected() ? `${getLocalSyncFolderName()}/` : ''}Dossiers/{mission.code}/{currentVoletMeta.macFolder}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleMissionStatus}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              mission.status === 'cloture'
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {mission.status === 'cloture' ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réouvrir ce dossier</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                <span>Clôturer / Archiver</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* STICKY DOSSIER HEADER BANNER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-extrabold bg-[#0f3854] text-white font-mono">
                N/Réf : {mission.code}
              </span>
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-sky-50 text-[#0f3854] border border-sky-200">
                Client : {mission.insurance_client}
              </span>
              {mission.case_reference && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 font-mono">
                  Réf. Client : {mission.case_reference}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800">
                Assuré : {mission.insured_party}
              </span>
              {stakeAmount > 0 && (
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                  Enjeu : {stakeAmount.toLocaleString('fr-FR')} € HT
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">{mission.title}</h1>
          </div>

          {/* 3 Primary Dossier Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenQuickAdd(mission.id)}
              className="px-3.5 py-2 bg-[#0f3854] hover:bg-[#16496d] text-white rounded-xl text-xs font-bold shadow-2xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>Pointer Temps / Frais</span>
            </button>

            <button
              type="button"
              onClick={() => onPrepareBilling(mission.id)}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>
                Facturer ({totalUnbilledHT.toFixed(0)} € HT à facturer)
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT : 6 VOLETS SIDEBAR (LEFT) + ACTIVE VOLET CONTENT (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT NAVIGATION : Les 6 Volets du Dossier (Structure Finder de Valentine) */}
        <aside className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-2xs p-3 space-y-1.5 lg:sticky lg:top-20">
          <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Structure du dossier (6 volets)
            </span>
            <span className="text-[10px] font-mono text-slate-400">{allDocuments.length} pièce(s)</span>
          </div>

          {VOLETS_CONFIG.map((v) => {
            const isActive = activeVolet === v.key;
            const count = voletCounts[v.key];
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setActiveVolet(v.key)}
                className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start justify-between gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-[#0f3854] text-white shadow-xs'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-start space-x-2.5 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-extrabold font-mono shrink-0 mt-0.5 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#0f3854]'
                    }`}
                  >
                    {v.num}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>
                      {v.label}
                    </p>
                    <p
                      className={`text-[10px] line-clamp-1 mt-0.5 ${
                        isActive ? 'text-sky-100' : 'text-slate-500'
                      }`}
                    >
                      {v.shortDesc}
                    </p>
                  </div>
                </div>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      isActive ? 'bg-sky-400/30 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* RIGHT PANE : Active Volet Content */}
        <section className="lg:col-span-9 space-y-6">
          {/* =====================================================================
              VOLET 1 : 01. PAGE DE GARDE (Ancien File Register Excel)
             ===================================================================== */}
          {activeVolet === 'garde' && (
            <div className="space-y-6">
              {/* BLOC A : PARTIES, RÉFÉRENCES & CONFRÈRES */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0f3854] block">
                      Volet 01 • Page de garde (File Register)
                    </span>
                    <h2 className="text-sm font-bold text-slate-900">
                      Parties au dossier, Références croisées & Confrères adverses
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingParties(!editingParties)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{editingParties ? 'Fermer l’édition' : 'Modifier les parties / réf.'}</span>
                  </button>
                </div>

                {editingParties ? (
                  <form onSubmit={handleSavePartiesAndRefs} className="space-y-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">N/Réf. (Code VP Expertise) *</label>
                        <input
                          type="text"
                          value={missionCodeEdit}
                          onChange={(e) => setMissionCodeEdit(e.target.value)}
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-mono font-bold"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">Intitulé du sinistre / Affaire *</label>
                        <input
                          type="text"
                          value={missionTitleEdit}
                          onChange={(e) => setMissionTitleEdit(e.target.value)}
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block font-bold text-[#0f3854] mb-1">Client (qui vous mandate & paie) *</label>
                        <input
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#0f3854] mb-1">Réf. Client (V/Réf. sur facture)</label>
                        <input
                          type="text"
                          value={clientRef}
                          onChange={(e) => setClientRef(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Interlocuteur / Gestionnaire Client</label>
                        <input
                          type="text"
                          value={clientContact}
                          onChange={(e) => setClientContact(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Adresse de facturation du Client (pour en-tête Word)</label>
                      <input
                        type="text"
                        value={billingAddress}
                        onChange={(e) => setBillingAddress(e.target.value)}
                        className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Assuré *</label>
                        <input
                          type="text"
                          value={insuredParty}
                          onChange={(e) => setInsuredParty(e.target.value)}
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Réf. Assuré</label>
                        <input
                          type="text"
                          value={insuredRef}
                          onChange={(e) => setInsuredRef(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Courtier (facultatif)</label>
                        <input
                          type="text"
                          value={brokerName}
                          onChange={(e) => setBrokerName(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Réf. Courtier</label>
                        <input
                          type="text"
                          value={brokerRef}
                          onChange={(e) => setBrokerRef(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-mono"
                        />
                      </div>
                    </div>

                    {/* Adverse Parties & Confrères editor */}
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          Parties adverses & Confrères (Cabinets d'expertise & noms des confrères)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAdverseParties([
                              ...adverseParties,
                              { party_name: '', expert_firm: '', expert_name: '', lawyer_name: '' },
                            ])
                          }
                          className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-[11px] font-semibold text-[#0f3854] hover:bg-slate-100"
                        >
                          + Ajouter une partie adverse / confrère
                        </button>
                      </div>

                      {adverseParties.map((ap, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                          <input
                            type="text"
                            placeholder="Partie adverse (ex: Alstom)"
                            value={ap.party_name}
                            onChange={(e) => {
                              const next = [...adverseParties];
                              next[idx] = { ...next[idx], party_name: e.target.value };
                              setAdverseParties(next);
                            }}
                            className="rounded border-slate-300 p-1.5 border text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Cabinet confrère (ex: Saretec)"
                            value={ap.expert_firm}
                            onChange={(e) => {
                              const next = [...adverseParties];
                              next[idx] = { ...next[idx], expert_firm: e.target.value };
                              setAdverseParties(next);
                            }}
                            className="rounded border-slate-300 p-1.5 border text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Nom confrère (ex: M. Pechereau)"
                            value={ap.expert_name}
                            onChange={(e) => {
                              const next = [...adverseParties];
                              next[idx] = { ...next[idx], expert_name: e.target.value };
                              setAdverseParties(next);
                            }}
                            className="rounded border-slate-300 p-1.5 border text-xs font-semibold"
                          />
                          <div className="flex items-center space-x-1">
                            <input
                              type="text"
                              placeholder="Avocat / Conseil (facultatif)"
                              value={ap.lawyer_name || ''}
                              onChange={(e) => {
                                const next = [...adverseParties];
                                next[idx] = { ...next[idx], lawyer_name: e.target.value };
                                setAdverseParties(next);
                              }}
                              className="flex-1 rounded border-slate-300 p-1.5 border text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => setAdverseParties(adverseParties.filter((_, i) => i !== idx))}
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingParties(false)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 bg-white"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-[#0f3854] text-white rounded-lg font-semibold"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Col 1 : Client */}
                    <div className="p-3.5 rounded-xl bg-sky-50/50 border border-sky-100 space-y-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0f3854]">
                        1. Client (Facturé)
                      </span>
                      <p className="text-sm font-bold text-slate-900">{mission.insurance_client}</p>
                      <p className="text-slate-600">
                        <span className="font-semibold">Réf. Client (V/Réf.) :</span>{' '}
                        <span className="font-mono font-bold text-slate-800">{mission.case_reference || 'Non renseignée'}</span>
                      </p>
                      {mission.insurer_contact && (
                        <p className="text-slate-600">
                          <span className="font-semibold">Interlocuteur :</span> {mission.insurer_contact}
                        </p>
                      )}
                      {mission.billing_address && (
                        <p className="text-[11px] text-slate-500 pt-1 border-t border-sky-100">
                          {mission.billing_address}
                        </p>
                      )}
                    </div>

                    {/* Col 2 : Assuré & Courtier */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                        2. Assuré & Courtier
                      </span>
                      <p className="text-sm font-bold text-slate-900">{mission.insured_party}</p>
                      {mission.insured_reference && (
                        <p className="text-slate-600">
                          <span className="font-semibold">Réf. Assuré :</span>{' '}
                          <span className="font-mono">{mission.insured_reference}</span>
                        </p>
                      )}
                      <div className="pt-1.5 mt-1.5 border-t border-slate-200/80">
                        <p className="text-slate-700">
                          <span className="font-semibold">Courtier :</span>{' '}
                          {mission.broker_name || <span className="text-slate-400">Aucun courtier</span>}
                        </p>
                        {mission.broker_reference && (
                          <p className="text-slate-600">
                            <span className="font-semibold">Réf. Courtier :</span>{' '}
                            <span className="font-mono">{mission.broker_reference}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Col 3 : Parties adverses & Confrères */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                        3. Parties adverses & Confrères ({adverseParties.length})
                      </span>
                      {adverseParties.length === 0 ? (
                        <p className="text-slate-400 italic">
                          Aucune partie adverse ou confrère renseigné. Cliquez sur « Modifier les parties » pour en ajouter.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {adverseParties.map((ap, i) => (
                            <div key={i} className="p-2 bg-white rounded-lg border border-slate-200 text-[11px]">
                              <p className="font-bold text-slate-900">{ap.party_name || 'Partie adverse'}</p>
                              <p className="text-[#0f3854] font-semibold">
                                Confrère : {ap.expert_name || '—'}{' '}
                                {ap.expert_firm ? `(${ap.expert_firm})` : ''}
                              </p>
                              {ap.lawyer_name && (
                                <p className="text-slate-500">Conseil : {ap.lawyer_name}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* BLOC B : ENJEU DU DOSSIER (ÉVOLUTIF) & RATIO HONORAIRES FACTURÉS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                      <h3 className="text-sm font-bold text-slate-900">Enjeu financier du dossier (Préjudice estimé)</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowUpdateStake(!showUpdateStake)}
                      className="text-xs font-semibold text-[#0f3854] hover:underline cursor-pointer"
                    >
                      {showUpdateStake ? 'Fermer' : 'Actualiser l’enjeu'}
                    </button>
                  </div>

                  <div className="flex items-baseline justify-between bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5">
                    <div>
                      <span className="text-[11px] font-semibold text-amber-900 block">Enjeu actuel estimé</span>
                      <span className="text-2xl font-extrabold text-slate-900">
                        {stakeAmount > 0 ? `${stakeAmount.toLocaleString('fr-FR')} € HT` : 'Non chiffré'}
                      </span>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-500 block">Déjà facturé sur ce dossier :</span>
                      <span className="font-bold text-[#0f3854]">
                        {totalBilledHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT
                      </span>
                      {stakeAmount > 0 && (
                        <span className="block text-[11px] text-emerald-700 font-semibold">
                          Ratio honoraires / enjeu : {((totalBilledHT / stakeAmount) * 100).toFixed(2).replace('.', ',')}%
                        </span>
                      )}
                    </div>
                  </div>

                  {showUpdateStake && (
                    <form onSubmit={handleUpdateStake} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Nouvel enjeu (€ HT) *</label>
                          <input
                            type="text"
                            value={newStakeAmount}
                            onChange={(e) => setNewStakeAmount(e.target.value)}
                            placeholder="ex: 450000"
                            required
                            className="w-full rounded border-slate-300 p-1.5 border bg-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Motif / Étape</label>
                          <input
                            type="text"
                            value={newStakeNote}
                            onChange={(e) => setNewStakeNote(e.target.value)}
                            placeholder="ex: Chiffrage après devis réparation"
                            className="w-full rounded border-slate-300 p-1.5 border bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button type="submit" className="px-3 py-1.5 bg-[#0f3854] text-white rounded font-semibold">
                          Enregistrer dans l'historique de l'enjeu
                        </button>
                      </div>
                    </form>
                  )}

                  {stakeHistory.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Historique d'évolution de l'enjeu (Début ➔ Aujourd'hui)
                      </span>
                      <div className="divide-y divide-slate-100 text-xs max-h-28 overflow-y-auto">
                        {stakeHistory.map((sh: any, i: number) => (
                          <div key={i} className="py-1 flex items-center justify-between text-[11px]">
                            <span className="text-slate-600">
                              <strong className="font-mono text-slate-700">
                                {(sh.date || '').split('-').reverse().join('/')}
                              </strong>{' '}
                              — {sh.note || 'Estimation'}
                            </span>
                            <span className="font-bold text-slate-900">
                              {Number(sh.amount).toLocaleString('fr-FR')} € HT
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* HISTORIQUE DES FACTURES ÉMISES SUR CE DOSSIER */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Receipt className="w-4 h-4 text-[#0f3854]" />
                        <h3 className="text-sm font-bold text-slate-900">
                          Factures d'honoraires du dossier ({missionInvoices.length})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => onPrepareBilling(mission.id)}
                        className="text-xs font-bold text-[#0f3854] hover:underline cursor-pointer"
                      >
                        + Préparer une facture →
                      </button>
                    </div>

                    {missionInvoices.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 text-center">
                        Aucune facture émise sur ce dossier pour le moment.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                              <th className="py-2 px-2.5 font-semibold">N° Facture</th>
                              <th className="py-2 px-2.5 font-semibold">Date</th>
                              <th className="py-2 px-2.5 font-semibold text-right">Montant HT</th>
                              <th className="py-2 px-2.5 font-semibold text-center">Statut</th>
                              <th className="py-2 px-2.5 font-semibold text-right">Word</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {missionInvoices.map((inv: any) => (
                              <tr key={inv.id} className="hover:bg-slate-50">
                                <td className="py-2 px-2.5 font-bold text-[#0f3854]">{inv.invoice_number}</td>
                                <td className="py-2 px-2.5 text-slate-600">
                                  {(inv.date || '').split('-').reverse().join('/')}
                                </td>
                                <td className="py-2 px-2.5 text-right font-semibold">
                                  {Number(inv.total_ht).toFixed(2).replace('.', ',')} €
                                </td>
                                <td className="py-2 px-2.5 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      inv.status === 'regle'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : inv.status === 'brouillon'
                                        ? 'bg-amber-50 text-amber-800'
                                        : 'bg-sky-50 text-sky-800'
                                    }`}
                                  >
                                    {inv.status === 'regle' ? 'Réglée' : inv.status === 'brouillon' ? 'Brouillon' : 'Émise'}
                                  </span>
                                </td>
                                <td className="py-2 px-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadInvoiceDocx(inv)}
                                    className="text-[#0f3854] hover:underline font-semibold inline-flex items-center space-x-1"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>.docx</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 bg-sky-50/70 border border-sky-200/80 rounded-xl text-[11px] text-slate-700 flex items-center justify-between">
                    <span>
                      Objet auto de la prochaine facture :{' '}
                      <strong className="text-[#0f3854]">
                        « Mission d’expertise depuis le {nextInvoiceSubjectDate} »
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* BLOC C : POINTAGE DU DOSSIER (TEMPS & FRAIS) + TARIFS & VISITES */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Pointage du dossier : Temps passés ({mission.activities?.length || 0}) & Frais de mission ({mission.expenses?.length || 0})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Les justificatifs de frais de déplacement sont automatiquement classés à part dans votre dossier Mac{' '}
                      <code className="font-mono text-[#0f3854]">Compta/&lt;Mois&gt;/Justificatifs/</code>.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRatesDrawer(!showRatesDrawer)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center space-x-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5 text-[#0f3854]" />
                      <span>Tarifs ({mission.custom_hourly_rate || 190} €/h) & Visites</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenQuickAdd(mission.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#0f3854] text-white text-xs font-semibold hover:bg-[#16496d] inline-flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter un pointage / frais</span>
                    </button>
                  </div>
                </div>

                {showRatesDrawer && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                    <MissionRatesSettings mission={mission} onUpdated={loadData} />
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Table des temps */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                      Temps pointés sur ce dossier
                    </span>
                    {(mission.activities || []).length === 0 ? (
                      <p className="text-xs text-slate-400 p-4 bg-slate-50 rounded-xl text-center">
                        Aucun temps pointé.
                      </p>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                        {(mission.activities || []).map((act: any) => (
                          <div key={act.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                            <div>
                              <span className="font-semibold text-slate-900 block">
                                {ACTIVITY_CATEGORY_LABELS[act.category as keyof typeof ACTIVITY_CATEGORY_LABELS] || act.label}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {(act.date || '').split('-').reverse().join('/')}
                                {act.notes ? ` • ${act.notes}` : ''}
                              </span>
                            </div>
                            <div className="text-right flex items-center space-x-2">
                              {editingActId === act.id ? (
                                <div className="flex items-center space-x-1">
                                  <input
                                    type="text"
                                    value={editActHours}
                                    onChange={(e) => setEditActHours(e.target.value)}
                                    className="w-14 border border-[#0f3854] rounded px-1.5 py-0.5 text-right font-bold"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveActivityHours(act.id)}
                                    className="px-2 py-0.5 bg-[#0f3854] text-white rounded text-[10px]"
                                  >
                                    OK
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingActId(act.id);
                                    setEditActHours(String(act.hours));
                                  }}
                                  className="text-right hover:underline"
                                >
                                  <span className="font-bold text-slate-900 block">
                                    {Number(act.total_ht).toFixed(2).replace('.', ',')} € HT
                                  </span>
                                  <span className="text-[11px] text-[#0f3854]">
                                    {act.hours}h × {act.hourly_rate} € ({act.status === 'facture' ? 'Facturé' : 'À facturer'})
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Table des frais */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                      Frais & Déplacements liés au dossier
                    </span>
                    {(mission.expenses || []).length === 0 ? (
                      <p className="text-xs text-slate-400 p-4 bg-slate-50 rounded-xl text-center">
                        Aucun frais enregistré.
                      </p>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                        {(mission.expenses || []).map((exp: any) => (
                          <div key={exp.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                            <div>
                              <span className="font-semibold text-slate-900 block">{exp.label}</span>
                              <span className="text-[11px] text-slate-500">
                                {(exp.date || '').split('-').reverse().join('/')} • {exp.quantity} × {Number(exp.unit_price).toFixed(2)} €
                              </span>
                            </div>
                            <div className="text-right flex items-center space-x-2">
                              {exp.receipt_filename && (
                                <a
                                  href={`/uploads/${exp.receipt_filename}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold"
                                >
                                  📎 Justif
                                </a>
                              )}
                              <div>
                                <span className="font-bold text-slate-900 block">
                                  {Number(exp.total_ht).toFixed(2).replace('.', ',')} € HT
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {exp.status === 'facture' ? 'Facturé' : 'À facturer'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              VOLET 2 : 02. CONTRATS
             ===================================================================== */}
          {activeVolet === 'contrats' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-5">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0f3854] block">
                  Volet 02 • Dossiers/{mission.code}/02_Contrats
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Contrats du Client & de l'Assuré (Environnement contractuel du sinistre)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Polices d'assurance, conditions générales et particulières, contrats de maintenance ou d'exploitation ferroviaire utiles à l'analyse des responsabilités.
                </p>
              </div>

              {renderVoletDropzone('contrats', 'Polices, contrats, conventions')}
              {renderPieceTable(
                docsContrats,
                "Aucun contrat déposé dans ce volet pour l'instant. Glissez-déposez vos PDF ou Word ci-dessus."
              )}
            </div>
          )}

          {/* =====================================================================
              VOLET 3 : 03. CONSTATATIONS IMMÉDIATES
             ===================================================================== */}
          {activeVolet === 'constatations' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0f3854] block">
                      Volet 03 • Dossiers/{mission.code}/03_Constatations_immediates
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      Constatations immédiates : Jour J, Visites terrain & Extractions techniques
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Déposez vos photos de visite, feuilles de présence, témoignages et extractions (Durandal, boîte noire) en vrac sans légende obligatoire.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                    {[
                      { id: 'jour_j', label: 'Jour J & Ouverture' },
                      { id: 'visite_terrain', label: 'Visites terrain & Photos' },
                      { id: 'extractions', label: 'Extractions (Durandal...)' },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setConstatSubSection(st.id as any)}
                        className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                          constatSubSection === st.id
                            ? 'bg-white text-[#0f3854] shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {renderVoletDropzone(
                  'constatations',
                  constatSubSection === 'jour_j'
                    ? 'Signalement Jour J, premiers constats, témoignages'
                    : constatSubSection === 'extractions'
                    ? 'Relevés Durandal, boîte noire, télémétrie'
                    : 'Photos terrain en vrac, feuilles d’émargement',
                  constatSubSection
                )}

                {/* Pièces numérotées de constatations */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Pièces de constatations enregistrées ({docsConstatations.length})
                  </h3>
                  {renderPieceTable(
                    docsConstatations,
                    'Aucune pièce de constatation déposée. Glissez vos photos ou documents en vrac ci-dessus.'
                  )}
                </div>

                {/* Galerie visuelle rapide des photos terrain */}
                {allPhotos.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Aperçu visuel des photos terrain ({allPhotos.length})
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {allPhotos.map((ph: any) => (
                        <div key={ph.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2 space-y-1.5 text-xs">
                          <a href={`/uploads/${ph.filename}`} target="_blank" rel="noreferrer">
                            <img
                              src={`/uploads/${ph.filename}`}
                              alt={ph.caption || 'Photo terrain'}
                              className="w-full h-28 object-cover rounded-lg"
                            />
                          </a>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-slate-700 truncate">
                              {ph.caption || ph.filename}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                await api.deletePhoto(ph.id);
                                loadData();
                              }}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Participants aux réunions & Sas de notes terrain */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                      <Users className="w-4 h-4 text-[#0f3854]" />
                      <span>Participants / Émargement visite ({mission.attendees?.length || 0})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddAttendee(!showAddAttendee)}
                      className="text-xs font-semibold text-[#0f3854] hover:underline"
                    >
                      + Ajouter participant
                    </button>
                  </div>

                  {showAddAttendee && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!attName.trim()) return;
                        await api.addAttendee(mission.id, {
                          name: attName.trim(),
                          organization: attOrg.trim(),
                          role: attRole.trim(),
                          presence_type: attPresence,
                        });
                        setAttName('');
                        setAttOrg('');
                        setAttRole('');
                        setShowAddAttendee(false);
                        loadData();
                      }}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Nom & Prénom *"
                          value={attName}
                          onChange={(e) => setAttName(e.target.value)}
                          required
                          className="rounded border-slate-300 p-1.5 border bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Société / Cabinet"
                          value={attOrg}
                          onChange={(e) => setAttOrg(e.target.value)}
                          className="rounded border-slate-300 p-1.5 border bg-white"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button type="submit" className="px-3 py-1 bg-[#0f3854] text-white rounded font-semibold">
                          Ajouter
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="divide-y divide-slate-100 text-xs">
                    {(mission.attendees || []).map((att: any) => (
                      <div key={att.id} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900">{att.name}</span>{' '}
                          <span className="text-slate-500">({att.organization})</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await api.deleteAttendee(att.id);
                            loadData();
                          }}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sas de notes brutes terrain */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Notes brutes de visite terrain</h3>
                    <button
                      type="button"
                      onClick={handleSaveReportDraft}
                      disabled={savingNotes}
                      className="px-3 py-1 bg-[#0f3854] text-white rounded-lg text-xs font-semibold"
                    >
                      {savingNotes ? 'Sauvegarde...' : 'Enregistrer les notes'}
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={rawFieldNotes}
                    onChange={(e) => setRawFieldNotes(e.target.value)}
                    placeholder="Saisissez ou dictez vos relevés bruts sur site (cotes, numéros de série, observations immédiates)..."
                    className="w-full text-xs rounded-xl border-slate-300 p-3 border bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              VOLET 4 : 04. CONTRADICTOIRE
             ===================================================================== */}
          {activeVolet === 'contradictoire' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0f3854] block">
                      Volet 04 • Dossiers/{mission.code}/04_Contradictoire
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      Contradictoire : Mises en cause, Convocations, Dires & Courriers LRAR
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Centralisez toutes les pièces du contradictoire et suivez les échanges avec les confrères et conseils.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddComm(!showAddComm)}
                    className="px-3.5 py-2 bg-[#0f3854] text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    + Noter un dire / courrier / convocation
                  </button>
                </div>

                {showAddComm && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!commSubject.trim()) return;
                      await api.addCommunication(mission.id, {
                        sender: commSender.trim() || 'Confrère / Partie',
                        subject: commSubject.trim(),
                        body_Summary: commBody.trim(),
                        urgency: commUrgency,
                      });
                      setCommSender('');
                      setCommSubject('');
                      setCommBody('');
                      setShowAddComm(false);
                      showToast('Échange contradictoire enregistré.');
                      loadData();
                    }}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Émetteur / Destinataire (ex: Saretec - M. Pechereau)"
                        value={commSender}
                        onChange={(e) => setCommSender(e.target.value)}
                        className="rounded-lg border-slate-300 p-2 border bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Objet (ex: Convocation expertise contradictoire LRAR) *"
                        value={commSubject}
                        onChange={(e) => setCommSubject(e.target.value)}
                        required
                        className="sm:col-span-2 rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                      />
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Synthèse ou points clés du dire / courrier..."
                      value={commBody}
                      onChange={(e) => setCommBody(e.target.value)}
                      className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowAddComm(false)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                      >
                        Annuler
                      </button>
                      <button type="submit" className="px-4 py-1.5 bg-[#0f3854] text-white rounded-lg font-semibold">
                        Enregistrer
                      </button>
                    </div>
                  </form>
                )}

                {renderVoletDropzone('contradictoire', 'Convocations, mises en cause, dires, accusés LRAR')}

                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Pièces du contradictoire numérotées ({docsContradictoire.length})
                  </h3>
                  {renderPieceTable(
                    docsContradictoire,
                    'Aucune pièce contradictoire déposée dans ce volet.'
                  )}
                </div>

                {(mission.communications || []).length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Journal des échanges, mises en cause & dires ({mission.communications.length})
                    </h3>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                      {mission.communications.map((c: any) => (
                        <div key={c.id} className="p-3 flex items-start justify-between hover:bg-slate-50">
                          <div>
                            <p className="font-bold text-slate-900">
                              {c.subject}{' '}
                              <span className="font-normal text-slate-500">
                                — {c.sender} ({(c.received_date || '').split('-').reverse().join('/')})
                              </span>
                            </p>
                            {c.body_Summary && <p className="text-slate-600 mt-0.5">{c.body_Summary}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              await api. toggleCommunicationReplied(c.id, !c.replied);
                              loadData();
                            }}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                              c.replied
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {c.replied ? 'Traité / Répondu' : 'À traiter'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              VOLET 5 : 05. COMPTES DU PRÉJUDICE
             ===================================================================== */}
          {activeVolet === 'prejudice' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0f3854] block">
                      Volet 05 • Dossiers/{mission.code}/05_Comptes_du_prejudice
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      Comptes du préjudice : Tableau de chiffrage & Devis / Factures liés
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ventilez les montants réclamés et retenus par poste et reliez chaque ligne aux pièces numérotées du dossier.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {totalRetainedHT > 0 && totalRetainedHT !== stakeAmount && (
                      <button
                        type="button"
                        onClick={async () => {
                          await api.updateMission(mission.id, {
                            stake_amount: totalRetainedHT,
                            stake_note: 'Alignement sur le total retenu des Comptes du préjudice',
                          });
                          showToast(`Enjeu du dossier mis à jour à ${totalRetainedHT.toLocaleString('fr-FR')} € HT !`);
                          loadData();
                        }}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Reporter {totalRetainedHT.toLocaleString('fr-FR')} € comme nouvel Enjeu
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDamageId(null);
                        setDmgLabel('');
                        setDmgClaimed('');
                        setDmgRetained('');
                        setDmgNotes('');
                        setDmgSelectedPieces([]);
                        setShowAddDamageLine(!showAddDamageLine);
                      }}
                      className="px-3.5 py-2 bg-[#0f3854] text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      + Ajouter un poste de préjudice
                    </button>
                  </div>
                </div>

                {showAddDamageLine && (
                  <form onSubmit={handleSaveDamageLine} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Catégorie</label>
                        <select
                          value={dmgCategory}
                          onChange={(e: any) => setDmgCategory(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                        >
                          <option value="materiel">Dommages matériels / Remise en état</option>
                          <option value="exploitation">Pertes d'exploitation / Immobilisation</option>
                          <option value="frais_annexes">Frais annexes / Relevage / Acheminement</option>
                          <option value="autre">Autre poste</option>
                        </select>
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block font-semibold text-slate-700 mb-1">Désignation du poste *</label>
                        <input
                          type="text"
                          value={dmgLabel}
                          onChange={(e) => setDmgLabel(e.target.value)}
                          placeholder="ex: Remise en état bogie moteur et remplacement essieux (Devis Alstom)"
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Montant réclamé (€ HT) *</label>
                        <input
                          type="text"
                          value={dmgClaimed}
                          onChange={(e) => setDmgClaimed(e.target.value)}
                          placeholder="ex: 245000"
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Montant retenu Expert (€ HT)</label>
                        <input
                          type="text"
                          value={dmgRetained}
                          onChange={(e) => setDmgRetained(e.target.value)}
                          placeholder="Laisser vide si identique au réclamé"
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-bold text-[#0f3854]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Observation / Vétusté / Réfaction</label>
                        <input
                          type="text"
                          value={dmgNotes}
                          onChange={(e) => setDmgNotes(e.target.value)}
                          placeholder="ex: Abattement vétusté 15% sur pièces d'usure"
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                    </div>

                    {allDocuments.length > 0 && (
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Pièces justificatives rattachées à ce poste (cliquez pour cocher) :
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {allDocuments.map((d) => {
                            const pNum = d.piece_number || 0;
                            if (!pNum) return null;
                            const active = dmgSelectedPieces.includes(pNum);
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() =>
                                  setDmgSelectedPieces((prev) =>
                                    prev.includes(pNum) ? prev.filter((x) => x !== pNum) : [...prev, pNum]
                                  )
                                }
                                className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                                  active
                                    ? 'bg-[#0f3854] text-white border-[#0f3854]'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                Pièce n°{pNum} — {d.original_name.slice(0, 28)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowAddDamageLine(false)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                      >
                        Annuler
                      </button>
                      <button type="submit" className="px-4 py-1.5 bg-[#0f3854] text-white rounded-lg font-semibold">
                        Enregistrer le poste
                      </button>
                    </div>
                  </form>
                )}

                {/* Tableau de chiffrage des Comptes du préjudice */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2.5 px-3 font-semibold">Poste / Désignation</th>
                        <th className="py-2.5 px-3 font-semibold">Catégorie</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Réclamé HT</th>
                        <th className="py-2.5 px-3 font-semibold text-right text-[#0f3854]">Retenu Expert HT</th>
                        <th className="py-2.5 px-3 font-semibold">Pièces liées</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {damageLines.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            Aucun poste de préjudice saisi. Cliquez sur « + Ajouter un poste de préjudice ».
                          </td>
                        </tr>
                      ) : (
                        damageLines.map((line) => (
                          <tr key={line.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">{line.label}</span>
                              {line.notes && <span className="text-[11px] text-slate-500">{line.notes}</span>}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 capitalize">{line.category.replace('_', ' ')}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                              {Number(line.claimed_amount_ht).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                            </td>
                            <td className="py-2.5 px-3 text-right font-extrabold text-[#0f3854]">
                              {Number(line.retained_amount_ht).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap gap-1">
                                {(line.piece_numbers || []).map((num) => (
                                  <span
                                    key={num}
                                    className="px-1.5 py-0.5 rounded bg-sky-50 text-[#0f3854] border border-sky-200 font-mono text-[10px] font-bold"
                                  >
                                    Pièce n°{num}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDamageId(line.id);
                                  setDmgCategory(line.category);
                                  setDmgLabel(line.label);
                                  setDmgClaimed(String(line.claimed_amount_ht));
                                  setDmgRetained(String(line.retained_amount_ht));
                                  setDmgNotes(line.notes || '');
                                  setDmgSelectedPieces(line.piece_numbers || []);
                                  setShowAddDamageLine(true);
                                }}
                                className="p-1 text-slate-500 hover:text-[#0f3854]"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await api.deleteDamageLine(line.id);
                                  loadData();
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {damageLines.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-200 font-extrabold text-xs">
                          <td colSpan={2} className="py-2.5 px-3 text-slate-900">
                            TOTAL DES COMPTES DU PRÉJUDICE
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-800">
                            {totalClaimedHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#0f3854] text-sm">
                            {totalRetainedHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {renderVoletDropzone('prejudice', 'Devis, factures de réparation, justificatifs d’immobilisation')}

                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Pièces justificatives du préjudice ({docsPrejudice.length})
                  </h3>
                  {renderPieceTable(
                    docsPrejudice,
                    'Aucun devis ou facture de préjudice déposé dans ce volet.'
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              VOLET 6 : 06. RAPPORTS ÉMIS (Packages datés + .zip Avocats + Rédaction)
             ===================================================================== */}
          {activeVolet === 'rapports' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0f3854] block">
                      Volet 06 • Dossiers/{mission.code}/06_Rapports_emis
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      Rapports émis & Packages de Pièces Jointes (Traçabilité Avocats / Juridique)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Chaque rapport envoyé conserve la liste exacte des pièces numérotées qui l'accompagnaient : en 1 clic (même 3 ans plus tard), téléchargez le package complet <code>.zip</code> pour les avocats.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowDraftEditor(!showDraftEditor)}
                      className="px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      {showDraftEditor ? 'Masquer l’éditeur Word' : 'Éditeur de projet de rapport'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddIssuedReport(!showAddIssuedReport)}
                      className="px-3.5 py-2 bg-[#0f3854] text-white rounded-xl text-xs font-bold cursor-pointer flex items-center space-x-1.5"
                    >
                      <Package className="w-4 h-4" />
                      <span>+ Archiver un rapport émis & ses PJ</span>
                    </button>
                  </div>
                </div>

                {showAddIssuedReport && (
                  <form
                    onSubmit={handleCreateIssuedReport}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Type de rapport *</label>
                        <select
                          value={repType}
                          onChange={(e: any) => setRepType(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                        >
                          <option value="preliminaire">Rapport préliminaire</option>
                          <option value="intermediaire">Rapport d'étape / intermédiaire</option>
                          <option value="final">Rapport définitif / clôture</option>
                          <option value="note_synthese">Note technique / Synthèse</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">Intitulé du rapport diffusé *</label>
                        <input
                          type="text"
                          value={repTitle}
                          onChange={(e) => setRepTitle(e.target.value)}
                          placeholder="ex: Rapport préliminaire n°1 suite à visite sur site"
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Date d'envoi *</label>
                        <input
                          type="date"
                          value={repDate}
                          onChange={(e) => setRepDate(e.target.value)}
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Destinataires (Client, Courtier, Avocat...)</label>
                        <input
                          type="text"
                          value={repRecipient}
                          onChange={(e) => setRepRecipient(e.target.value)}
                          placeholder={`ex: ${mission.insurance_client}${mission.broker_name ? ` + ${mission.broker_name}` : ''}`}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Fichier du rapport (Word ou PDF)</label>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => setRepFile(e.target.files ? e.target.files[0] : null)}
                          className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-white file:text-[#0f3854]"
                        />
                      </div>
                    </div>

                    {allDocuments.length > 0 && (
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Cochez les Pièces numérotées annexées à cet envoi (pour constituer le package avocats) :
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {allDocuments.map((d) => {
                            const pNum = d.piece_number || 0;
                            if (!pNum) return null;
                            const selected = repSelectedPieces.includes(pNum);
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() =>
                                  setRepSelectedPieces((prev) =>
                                    prev.includes(pNum) ? prev.filter((x) => x !== pNum) : [...prev, pNum]
                                  )
                                }
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                                  selected
                                    ? 'bg-[#0f3854] text-white border-[#0f3854]'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                Pièce n°{pNum} — {d.original_name.slice(0, 30)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowAddIssuedReport(false)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={submittingReportPkg}
                        className="px-4 py-1.5 bg-[#0f3854] text-white rounded-lg font-semibold"
                      >
                        {submittingReportPkg ? 'Enregistrement...' : 'Archiver ce package de rapport'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Liste des packages de rapports diffusés */}
                {issuedReports.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                    Aucun rapport diffusé enregistré pour le moment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {issuedReports.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[#0f3854] text-white">
                              {rep.report_type}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-600">
                              Envoyé le {(rep.issued_date || '').split('-').reverse().join('/')}
                            </span>
                            {rep.recipient && (
                              <span className="text-xs text-slate-500">• Destinataire : {rep.recipient}</span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-slate-900">{rep.title}</h3>
                          {rep.notes && <p className="text-xs text-slate-600">{rep.notes}</p>}

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] font-semibold text-slate-500">Pièces jointes à cet envoi :</span>
                            {(rep.attached_piece_numbers || []).length === 0 ? (
                              <span className="text-[11px] text-slate-400 italic">Aucune pièce numérotée listée</span>
                            ) : (
                              rep.attached_piece_numbers.map((num) => {
                                const docObj = allDocuments.find((d) => d.piece_number === num);
                                return (
                                  <span
                                    key={num}
                                    className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-[#0f3854]"
                                  >
                                    Pièce n°{num}
                                    {docObj ? ` (${docObj.original_name.slice(0, 22)})` : ''}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={`/api/issued-reports/${rep.id}/package-zip`}
                            download
                            className="px-3.5 py-2 bg-[#0f3854] hover:bg-[#16496d] text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 shadow-2xs"
                            title="Télécharger une archive .zip contenant le rapport + toutes ses pièces numérotées + le bordereau"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Package Avocat (.zip)</span>
                          </a>
                          <button
                            type="button"
                            onClick={async () => {
                              await api.deleteIssuedReport(rep.id);
                              loadData();
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Éditeur de trame de rapport Word (pliable) */}
                {showDraftEditor && (
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">
                        Préparation / Trame de rapport Word (.docx)
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveReportDraft}
                          className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Sauvegarder le brouillon
                        </button>
                        <a
                          href={`/api/missions/${mission.id}/report-docx`}
                          download
                          className="px-3.5 py-1.5 bg-[#0f3854] text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Générer le Word (.docx)</span>
                        </a>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">1. Rappel des faits & Contexte</label>
                        <textarea
                          rows={4}
                          value={reportFacts}
                          onChange={(e) => setReportFacts(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2.5 border"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">2. Constatations techniques</label>
                        <textarea
                          rows={4}
                          value={reportObs}
                          onChange={(e) => setReportObs(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2.5 border"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">3. Analyse des causes & Responsabilités</label>
                        <textarea
                          rows={4}
                          value={reportAnalysis}
                          onChange={(e) => setReportAnalysis(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2.5 border"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">4. Chiffrage & Conclusions</label>
                        <textarea
                          rows={4}
                          value={reportConc}
                          onChange={(e) => setReportConc(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2.5 border"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
