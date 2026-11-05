import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Clock, Receipt, FileText, Mail, Train, Plus, Trash2, Download,
  CheckCircle2, AlertCircle, Save, ExternalLink, Calendar, Copy, Check,
  FolderOpen, UploadCloud, Paperclip, FileSpreadsheet, Eye, ShieldCheck, Sliders, Camera,
  ChevronDown, Edit3, Archive, RotateCcw, Users, Scale, Calculator, Send, Sparkles, Package, Building2, TrendingUp, Shield, X
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
  initialVolet?: DossierVoletKey;
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
  macFolder: string;
}> = [
  { key: 'garde', num: '01', label: 'Page de garde', macFolder: '01_Page_de_garde' },
  { key: 'contrats', num: '02', label: 'Contrats', macFolder: '02_Contrats' },
  { key: 'constatations', num: '03', label: 'Constatations', macFolder: '03_Constatations_immediates' },
  { key: 'contradictoire', num: '04', label: 'Contradictoire', macFolder: '04_Contradictoire' },
  { key: 'prejudice', num: '05', label: 'Comptes du préjudice', macFolder: '05_Comptes_du_prejudice' },
  { key: 'rapports', num: '06', label: 'Rapports émis', macFolder: '06_Rapports_emis' },
];

export const MissionDetailView: React.FC<MissionDetailViewProps> = ({
  missionId,
  initialMission,
  initialVolet,
  sourceTab = 'missions',
  onBack,
  onCacheMission,
  onOpenQuickAdd,
  onPrepareBilling,
}) => {
  const [mission, setMission] = useState<any>(initialMission || null);
  const [loading, setLoading] = useState(!initialMission || !initialMission.activities);

  const rawSubtab = new URLSearchParams(window.location.search).get('subtab');
  const rawVolet = new URLSearchParams(window.location.search).get('volet');
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

  const [activeVolet, setActiveVolet] = useState<DossierVoletKey>(initialVolet || resolveInitialVolet(rawVolet || rawSubtab));

  useEffect(() => {
    if (initialVolet) {
      setActiveVolet(initialVolet);
    }
  }, [initialVolet]);

  const [previewDoc, setPreviewDoc] = useState<MissionDocument | null>(null);
  const [reclassifyingDocId, setReclassifyingDocId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Upload state
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [docOptionalNote, setDocOptionalNote] = useState('');
  const [constatSubSection, setConstatSubSection] = useState<'jour_j' | 'visite_terrain' | 'extractions'>('visite_terrain');

  // Volet 1 (Page de garde)
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

  // Enjeu
  const [showUpdateStake, setShowUpdateStake] = useState(false);
  const [newStakeAmount, setNewStakeAmount] = useState('');
  const [newStakeNote, setNewStakeNote] = useState('');

  // Pointage & Tarifs
  const [editingActId, setEditingActId] = useState<string | null>(null);
  const [editActHours, setEditActHours] = useState<string>('');
  const [showRatesDrawer, setShowRatesDrawer] = useState(false);

  // Volet 3 (Constatations)
  const [showAddAttendee, setShowAddAttendee] = useState(false);
  const [attName, setAttName] = useState('');
  const [attOrg, setAttOrg] = useState('');
  const [attRole, setAttRole] = useState('');
  const [attPresence, setAttPresence] = useState<'site' | 'visio'>('site');
  const [attEmail, setAttEmail] = useState('');
  const [rawFieldNotes, setRawFieldNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Volet 4 (Contradictoire)
  const [showAddComm, setShowAddComm] = useState(false);
  const [commSender, setCommSender] = useState('');
  const [commSubject, setCommSubject] = useState('');
  const [commBody, setCommBody] = useState('');
  const [commUrgency, setCommUrgency] = useState<'normale' | 'urgente'>('normale');

  // Suivi LRAR & Mises en cause
  const [showAddLRAR, setShowAddLRAR] = useState(false);
  const [lrarRecipient, setLrarRecipient] = useState('');
  const [lrarSubject, setLrarSubject] = useState('');
  const [lrarTracking, setLrarTracking] = useState('');
  const [lrarDate, setLrarDate] = useState(new Date().toISOString().slice(0, 10));
  const [lrarStatus, setLrarStatus] = useState<'a_preparer' | 'prepare' | 'expedie' | 'distribue'>('a_preparer');
  const [lrarNotes, setLrarNotes] = useState('');

  // Volet 5 (Comptes du préjudice)
  const [showAddDamageLine, setShowAddDamageLine] = useState(false);
  const [dmgCategory, setDmgCategory] = useState<'materiel' | 'exploitation' | 'frais_annexes' | 'autre'>('materiel');
  const [dmgLabel, setDmgLabel] = useState('');
  const [dmgClaimed, setDmgClaimed] = useState('');
  const [dmgRetained, setDmgRetained] = useState('');
  const [dmgNotes, setDmgNotes] = useState('');
  const [dmgSelectedPieces, setDmgSelectedPieces] = useState<number[]>([]);
  const [editingDamageId, setEditingDamageId] = useState<string | null>(null);

  // Volet 6 (Rapports émis)
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

  const [reportFacts, setReportFacts] = useState('');
  const [reportObs, setReportObs] = useState('');
  const [reportAnalysis, setReportAnalysis] = useState('');
  const [reportConc, setReportConc] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
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
  const docsContrats = allDocuments.filter((d) => d.section === 'contrats' || ['contrat', 'contrat_client'].includes(d.category));
  const docsConstatations = allDocuments.filter(
    (d) => d.section === 'constatations' || (!d.section && ['photo_terrain', 'constatation_jour_j', 'extraction_technique', 'emargement_pv', 'autre'].includes(d.category))
  );
  const docsContradictoire = allDocuments.filter(
    (d) => d.section === 'contradictoire' || ['courrier_adverse', 'procedure_dires'].includes(d.category)
  );
  const docsPrejudice = allDocuments.filter(
    (d) => d.section === 'prejudice' || (!d.section && ['devis_facture', 'justificatif_prejudice', 'rapport_technique'].includes(d.category))
  );
  const docsRapports = allDocuments.filter((d) => d.section === 'rapports' || d.category === 'rapport_emis');

  const voletCounts: Record<DossierVoletKey, number> = {
    garde: (mission.activities?.length || 0) + (missionInvoices.length || 0),
    contrats: docsContrats.length,
    constatations: docsConstatations.length + allPhotos.length,
    contradictoire: docsContradictoire.length + (mission.communications?.length || 0) + (mission.registered_mails?.length || 0),
    prejudice: damageLines.length + docsPrejudice.length,
    rapports: issuedReports.length + docsRapports.length,
  };

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
      const count = files.length;
      showToast(`${count} document${count > 1 ? 's' : ''} numéroté${count > 1 ? 's' : ''} et classé${count > 1 ? 's' : ''} dans ${macSubFolder}`);
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
        (p) => p.party_name.trim() || (p.expert_firm && p.expert_firm.trim()) || (p.expert_name && p.expert_name.trim())
      );
      await api.updateMission(mission.id, {
        code: missionCodeEdit.trim(),
        title: missionTitleEdit.trim(),
        insurance_client: clientName.trim(),
        case_reference: clientRef.trim(),
        client_contact: clientContact.trim(),
        insurer_contact: clientContact.trim(),
        billing_address: billingAddress.trim(),
        insured_party: insuredParty.trim(),
        insured_reference: insuredRef.trim(),
        broker_name: brokerName.trim(),
        broker_reference: brokerRef.trim(),
        adverse_parties: cleanedParties,
      });
      setEditingParties(false);
      showToast('Références et parties enregistrées.');
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
        stake_note: newStakeNote.trim() || 'Actualisation de l’enjeu',
      });
      setShowUpdateStake(false);
      setNewStakeNote('');
      showToast(`Enjeu actualisé : ${num.toLocaleString('fr-FR')} € HT`);
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
      showToast(nextStatus === 'cloture' ? 'Dossier archivé.' : 'Dossier remis en cours.');
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
          claimed_amount: claimed,
          retained_amount: retained,
          claimed_amount_ht: claimed,
          retained_amount_ht: retained,
          piece_numbers: dmgSelectedPieces,
          comment: dmgNotes.trim() || undefined,
          notes: dmgNotes.trim() || undefined,
        });
        showToast('Ligne de préjudice mise à jour.');
      } else {
        await api.addDamageLine(mission.id, {
          category: dmgCategory,
          label: dmgLabel.trim(),
          claimed_amount: claimed,
          retained_amount: retained,
          claimed_amount_ht: claimed,
          retained_amount_ht: retained,
          piece_numbers: dmgSelectedPieces,
          comment: dmgNotes.trim() || undefined,
          notes: dmgNotes.trim() || undefined,
        });
        showToast('Poste de préjudice ajouté.');
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
      formData.append('sent_date', repDate);
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
      showToast('Rapport diffusé archivé.');
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
      showToast('Notes et trame sauvegardées.');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleCopyAttendees = () => {
    const attendees: any[] = mission.attendees || [];
    if (attendees.length === 0) {
      showToast('Aucun participant à copier.', 'error');
      return;
    }
    const onSite = attendees.filter((a: any) => a.present_on_site || a.presence_type === 'site');
    const remote = attendees.filter((a: any) => !a.present_on_site && (a.present_remote || a.presence_type === 'visio'));
    const other = attendees.filter((a: any) => !a.present_on_site && !a.present_remote && a.presence_type !== 'site' && a.presence_type !== 'visio');

    let text = `FEUILLE D'ÉMARGEMENT — DOSSIER ${mission.code} (${mission.title})\n`;
    text += `Date d'export : ${new Date().toLocaleDateString('fr-FR')}\n\n`;

    if (onSite.length > 0) {
      text += `PRÉSENTS SUR SITE (${onSite.length}) :\n`;
      onSite.forEach((a: any) => {
        text += `• ${a.name} (${a.organization || 'Non précisé'})${a.role ? ` — ${a.role}` : ''}${a.email ? ` [${a.email}]` : ''}\n`;
      });
      text += '\n';
    }

    if (remote.length > 0) {
      text += `PRÉSENTS EN VISIOCONFÉRENCE (${remote.length}) :\n`;
      remote.forEach((a: any) => {
        text += `• ${a.name} (${a.organization || 'Non précisé'})${a.role ? ` — ${a.role}` : ''}${a.email ? ` [${a.email}]` : ''}\n`;
      });
      text += '\n';
    }

    if (other.length > 0) {
      text += `AUTRES PARTICIPANTS (${other.length}) :\n`;
      other.forEach((a: any) => {
        text += `• ${a.name} (${a.organization || 'Non précisé'})${a.role ? ` — ${a.role}` : ''}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    showToast('Feuille d\'émargement copiée dans le presse-papier !');
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const handleCreateLRAR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lrarRecipient.trim() || !lrarSubject.trim()) {
      showToast('Destinataire et objet requis', 'error');
      return;
    }
    try {
      await api.addLRAR({
        mission_id: mission.id,
        recipient: lrarRecipient.trim(),
        subject: lrarSubject.trim(),
        tracking_number: lrarTracking.trim() || undefined,
        status: lrarStatus,
        sent_date: lrarDate || new Date().toISOString().slice(0, 10),
        notes: lrarNotes.trim() || undefined,
      });
      setLrarRecipient('');
      setLrarSubject('');
      setLrarTracking('');
      setLrarNotes('');
      setShowAddLRAR(false);
      showToast('Courrier recommandé enregistré.');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de l\'enregistrement', 'error');
    }
  };

  // KPIs
  const totalUnbilledHT = mission.total_unbilled_ht || 0;
  const unbilledHours = mission.unbilled_hours || 0;
  const totalBilledHT = mission.total_billed_ht || 0;
  const stakeAmount = mission.stake_amount || 0;
  const stakeHistory = Array.isArray(mission.stake_history) ? mission.stake_history : [];
  const nextInvoiceSubjectDate = (mission.last_invoice_date || mission.reception_date || '')
    .split('-')
    .reverse()
    .join('/');

  const totalClaimedHT = damageLines.reduce((acc, l) => acc + (Number(l.claimed_amount_ht ?? l.claimed_amount ?? 0)), 0);
  const totalRetainedHT = damageLines.reduce((acc, l) => acc + (Number(l.retained_amount_ht ?? l.retained_amount ?? 0)), 0);

  const currentVoletMeta = VOLETS_CONFIG.find((v) => v.key === activeVolet) || VOLETS_CONFIG[0];

  // Table des pièces avec prévisualisation immédiate et reclassement en 1 clic
  const renderPieceTable = (docs: MissionDocument[], emptyText: string) => {
    if (docs.length === 0) {
      return (
        <div className="py-8 px-4 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
          {emptyText}
        </div>
      );
    }
    return (
      <div className="border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-medium">
              <th className="py-2.5 px-3.5 w-24">N° Pièce</th>
              <th className="py-2.5 px-3.5">Fichier</th>
              <th className="py-2.5 px-3.5">Note</th>
              <th className="py-2.5 px-3.5 w-24">Date</th>
              <th className="py-2.5 px-3.5 w-44">Reclasser vers</th>
              <th className="py-2.5 px-3.5 text-right w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {docs.map((doc) => {
              const currentSection = doc.section || activeVolet;
              return (
                <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#0f3854]/10 text-[#0f3854] font-mono">
                      Pièce {doc.piece_number || '—'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="hover:text-[#0f3854] hover:underline inline-flex items-center space-x-1.5 text-left cursor-pointer"
                      title="Cliquer pour prévisualiser immédiatement le document"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{doc.original_name}</span>
                    </button>
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-600">
                    {doc.caption && doc.caption !== doc.original_name ? doc.caption : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap">
                    {(doc.created_at || '').slice(0, 10).split('-').reverse().join('/')}
                  </td>
                  <td className="py-2.5 px-3.5">
                    <select
                      value={currentSection}
                      disabled={reclassifyingDocId === doc.id}
                      onChange={async (e) => {
                        const newSection = e.target.value as DossierVoletKey;
                        if (newSection !== currentSection) {
                          setReclassifyingDocId(doc.id);
                          try {
                            await api.updateDocument(doc.id, { section: newSection });
                            const voletLabels: Record<string, string> = {
                              contrats: 'Volet 02 (Contrats)',
                              constatations: 'Volet 03 (Constatations)',
                              contradictoire: 'Volet 04 (Contradictoire)',
                              prejudice: 'Volet 05 (Comptes du préjudice)',
                              rapports: 'Volet 06 (Rapports émis)',
                            };
                            showToast(`Pièce ${doc.piece_number || ''} reclassée dans ${voletLabels[newSection] || newSection}`);
                            await loadData();
                          } catch (err: any) {
                            showToast("Erreur lors du déplacement de la pièce", 'error');
                          } finally {
                            setReclassifyingDocId(null);
                          }
                        }
                      }}
                      className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg py-1 px-2 hover:border-[#0f3854] focus:ring-1 focus:ring-[#0f3854] transition-all cursor-pointer"
                      title="Changer le volet de classement sans supprimer le fichier"
                    >
                      <option value="contrats">📁 02. Contrats</option>
                      <option value="constatations">📁 03. Constatations</option>
                      <option value="contradictoire">📁 04. Contradictoire</option>
                      <option value="prejudice">📁 05. Préjudice</option>
                      <option value="rapports">📁 06. Rapports émis</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3.5 text-right whitespace-nowrap space-x-2">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="inline-flex items-center space-x-1 text-[#0f3854] hover:underline font-semibold"
                      title="Prévisualiser sans télécharger"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Aperçu</span>
                    </button>
                    <a
                      href={`/uploads/${doc.filename}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-500 hover:text-slate-800 font-medium inline-flex items-center space-x-1"
                      title="Ouvrir dans un nouvel onglet"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`Voulez-vous retirer la pièce « ${doc.original_name} » ?`)) {
                          await api.deleteMissionDocument(doc.id);
                          showToast('Pièce retirée.');
                          loadData();
                        }
                      }}
                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                      title="Supprimer la pièce"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Dropzone épurée
  const renderVoletDropzone = (voletKey: DossierVoletKey, helperText: string, subSec?: string) => {
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
            ? 'border-[#0f3854] bg-sky-50/50'
            : 'border-slate-300/80 bg-slate-50/40 hover:bg-slate-50/80 hover:border-slate-400'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-[#0f3854] flex items-center justify-center shrink-0 shadow-2xs">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                Glisser-déposer des pièces ({helperText})
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Numérotation automatique (prochaine : Pièce n°{(allDocuments.length || 0) + 1}) • Sans légende obligatoire
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={docOptionalNote}
              onChange={(e) => setDocOptionalNote(e.target.value)}
              placeholder="Note facultative..."
              className="text-xs rounded-lg border-slate-300 bg-white px-2.5 py-1.5 border w-36 sm:w-44 focus:border-[#0f3854]"
            />
            <label className="px-3 py-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center space-x-1.5 shadow-2xs transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span>{uploadingDocs ? 'Dépôt...' : 'Parcourir'}</span>
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
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center space-x-2 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : 'bg-rose-900 text-white border-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-rose-300 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* TOP NAVIGATION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>
            {sourceTab === 'today'
              ? "Aujourd'hui"
              : sourceTab === 'billing'
              ? 'Factures'
              : 'Dossiers'}
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 text-slate-600 text-[11px]">
            <FolderOpen className="w-3.5 h-3.5 text-[#0f3854]" />
            <span>Finder Mac : <strong className="font-mono text-slate-800">{mission.code}/{currentVoletMeta.macFolder}</strong></span>
          </div>

          <button
            type="button"
            onClick={handleToggleMissionStatus}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
              mission.status === 'cloture'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {mission.status === 'cloture' ? (
              <>
                <RotateCcw className="w-3 h-3" />
                <span>Réouvrir</span>
              </>
            ) : (
              <>
                <Archive className="w-3 h-3" />
                <span>Archiver</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* EN-TÊTE ÉLÉGANT DU DOSSIER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-[#0f3854] text-white font-mono">
                {mission.code}
              </span>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                Client : {mission.insurance_client}
              </span>
              {mission.case_reference && (
                <span className="text-xs text-slate-500 font-mono">
                  (V/Réf : {mission.case_reference})
                </span>
              )}
              <span className="text-xs text-slate-600">
                • Assuré : <strong className="text-slate-800">{mission.insured_party}</strong>
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {mission.title}
            </h1>
          </div>

          {/* Actions Rapides */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenQuickAdd(mission.id)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Clock className="w-4 h-4 text-[#0f3854]" />
              <span>Pointer du temps</span>
            </button>

            <button
              type="button"
              onClick={() => onPrepareBilling(mission.id)}
              className="px-4 py-2 bg-[#0f3854] hover:bg-[#16496d] text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-sky-200" />
              <span>Facturer ({totalUnbilledHT.toFixed(0)} € HT)</span>
            </button>
          </div>
        </div>
      </div>

      {/* DISPOSITION PRINCIPALE : NAVIGATION 6 VOLETS + CONTENU */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* SIDEBAR DES 6 VOLETS (Design sobre et épuré) */}
        <aside className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-2 space-y-1 lg:sticky lg:top-20">
          <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Structure du dossier
          </div>

          {VOLETS_CONFIG.map((v) => {
            const isActive = activeVolet === v.key;
            const count = voletCounts[v.key];
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setActiveVolet(v.key)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                  isActive
                    ? 'bg-[#0f3854] text-white font-bold shadow-xs'
                    : 'hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span
                    className={`font-mono text-xs font-extrabold ${
                      isActive ? 'text-sky-200' : 'text-slate-400'
                    }`}
                  >
                    {v.num}
                  </span>
                  <span className="text-xs truncate">{v.label}</span>
                </div>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* CONTENU DU VOLET ACTIF */}
        <section className="lg:col-span-9 space-y-5">
          {/* =====================================================================
              VOLET 1 : 01. PAGE DE GARDE
             ===================================================================== */}
          {activeVolet === 'garde' && (
            <div className="space-y-5">
              {/* 3 KPIS EN TÊTE (ENJEU · FACTURÉ · EN COURS) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Enjeu estimé */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold text-slate-600">Enjeu estimé</span>
                    <button
                      type="button"
                      onClick={() => setShowUpdateStake(!showUpdateStake)}
                      className="text-[#0f3854] hover:underline font-semibold text-[11px]"
                    >
                      {showUpdateStake ? 'Fermer' : 'Actualiser'}
                    </button>
                  </div>
                  <div>
                    <span className="text-xl sm:text-2xl font-extrabold text-slate-900">
                      {stakeAmount > 0 ? `${stakeAmount.toLocaleString('fr-FR')} €` : 'Non chiffré'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold ml-1">HT</span>
                  </div>
                  {stakeHistory.length > 0 ? (
                    <span className="text-[10px] text-slate-400 mt-1 block truncate">
                      Dernière maj : {stakeHistory[stakeHistory.length - 1].note || 'Estimé'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 mt-1 block">Préjudice global estimé</span>
                  )}
                </div>

                {/* Déjà facturé */}
                <div
                  onClick={() => {
                    const el = document.getElementById('dossier-invoices-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between hover:border-[#0f3854]/40 hover:shadow-xs transition-all cursor-pointer group"
                  title="Cliquer pour voir l'historique complet des factures de ce dossier"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold text-slate-600">Déjà facturé</span>
                    <span className="text-[11px] text-[#0f3854] font-semibold group-hover:underline">
                      {missionInvoices.length} fact. ↓
                    </span>
                  </div>
                  <div>
                    <span className="text-xl sm:text-2xl font-extrabold text-[#0f3854]">
                      {totalBilledHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold ml-1">HT</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                    {stakeAmount > 0
                      ? `${((totalBilledHT / stakeAmount) * 100).toFixed(1)}% de l'enjeu • Voir les factures ↓`
                      : 'Historique des factures ↓'}
                  </span>
                </div>

                {/* En cours non facturé */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold text-slate-600">En cours non facturé</span>
                    <span className="text-[11px] text-slate-400">{unbilledHours.toFixed(1).replace('.', ',')} h</span>
                  </div>
                  <div>
                    <span className="text-xl sm:text-2xl font-extrabold text-slate-900">
                      {totalUnbilledHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold ml-1">HT</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPrepareBilling(mission.id)}
                    className="text-[11px] text-[#0f3854] hover:underline font-bold text-left mt-1 block"
                  >
                    Générer la facture →
                  </button>
                </div>
              </div>

              {/* Formulaire actualisation de l'enjeu (pliable) */}
              {showUpdateStake && (
                <form
                  onSubmit={handleUpdateStake}
                  className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Actualiser l'enjeu estimé du dossier</span>
                    <button type="button" onClick={() => setShowUpdateStake(false)} className="text-slate-400 hover:text-slate-600 text-xs">×</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Nouvel enjeu (€ HT) *</label>
                      <input
                        type="text"
                        value={newStakeAmount}
                        onChange={(e) => setNewStakeAmount(e.target.value)}
                        placeholder="ex: 450000"
                        required
                        className="w-full rounded-lg border-slate-300 p-2 border bg-slate-50 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Motif ou étape</label>
                      <input
                        type="text"
                        value={newStakeNote}
                        onChange={(e) => setNewStakeNote(e.target.value)}
                        placeholder="ex: Réception devis Alstom"
                        className="w-full rounded-lg border-slate-300 p-2 border bg-slate-50"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowUpdateStake(false)}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600"
                    >
                      Annuler
                    </button>
                    <button type="submit" className="px-4 py-1.5 bg-[#0f3854] text-white rounded-lg font-semibold">
                      Enregistrer
                    </button>
                  </div>
                </form>
              )}

              {/* FICHE D'IDENTITÉ : PARTIES & CONFRÈRES */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-[#0f3854]" />
                    <h2 className="text-sm font-bold text-slate-900">Parties prenantes & Confrères</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingParties(!editingParties)}
                    className="text-xs font-semibold text-[#0f3854] hover:underline cursor-pointer"
                  >
                    {editingParties ? 'Fermer' : 'Modifier'}
                  </button>
                </div>

                {editingParties ? (
                  <form onSubmit={handleSavePartiesAndRefs} className="space-y-4 text-xs bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">N/Réf. (Code VP) *</label>
                        <input
                          type="text"
                          value={missionCodeEdit}
                          onChange={(e) => setMissionCodeEdit(e.target.value)}
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-mono font-bold"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">Intitulé du dossier *</label>
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
                        <label className="block font-bold text-[#0f3854] mb-1">Client (facturé) *</label>
                        <input
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#0f3854] mb-1">Réf. Client (V/Réf.)</label>
                        <input
                          type="text"
                          value={clientRef}
                          onChange={(e) => setClientRef(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Interlocuteur</label>
                        <input
                          type="text"
                          value={clientContact}
                          onChange={(e) => setClientContact(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Adresse de facturation du Client</label>
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
                        <label className="block font-medium text-slate-700 mb-1">Courtier</label>
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

                    {/* Parties adverses & Confrères */}
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">Parties adverses & Confrères</span>
                        <button
                          type="button"
                          onClick={() =>
                            setAdverseParties([
                              ...adverseParties,
                              { id: `adv-${Date.now()}-${adverseParties.length + 1}`, party_name: '', expert_firm: '', expert_name: '', lawyer_name: '' },
                            ])
                          }
                          className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-[11px] font-semibold text-[#0f3854] hover:bg-slate-50"
                        >
                          + Ajouter
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
                            placeholder="Cabinet (ex: Saretec)"
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
                              placeholder="Avocat (facultatif)"
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
                    {/* Client */}
                    <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0f3854]">
                        Client (Mandant)
                      </span>
                      <p className="text-sm font-bold text-slate-900">{mission.insurance_client}</p>
                      <p className="text-slate-600">
                        V/Réf : <span className="font-mono font-bold text-slate-800">{mission.case_reference || '—'}</span>
                      </p>
                      {mission.insurer_contact && (
                        <p className="text-slate-500">{mission.insurer_contact}</p>
                      )}
                    </div>

                    {/* Assuré & Courtier */}
                    <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Assuré & Courtier
                      </span>
                      <p className="text-sm font-bold text-slate-900">{mission.insured_party}</p>
                      {mission.insured_reference && (
                        <p className="text-slate-600">
                          Réf. Assuré : <span className="font-mono">{mission.insured_reference}</span>
                        </p>
                      )}
                      <p className="text-slate-500 pt-1 border-t border-slate-200/60">
                        Courtier : {mission.broker_name || 'Sans courtier'}
                        {mission.broker_reference && ` (${mission.broker_reference})`}
                      </p>
                    </div>

                    {/* Confrères */}
                    <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Confrères & Parties adverses ({adverseParties.length})
                      </span>
                      {adverseParties.length === 0 ? (
                        <p className="text-slate-400 italic">Aucun confrère renseigné.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {adverseParties.map((ap, i) => (
                            <div key={i} className="text-xs">
                              <span className="font-bold text-slate-900">{ap.party_name}</span>
                              {(ap.expert_name || ap.expert_firm) && (
                                <p className="text-[#0f3854] font-medium">
                                  {ap.expert_name || 'Expert'} {ap.expert_firm ? `(${ap.expert_firm})` : ''}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* FACTURES DU DOSSIER (Section dédiée avec historique complet) */}
              <div id="dossier-invoices-section" className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Receipt className="w-4 h-4 text-[#0f3854]" />
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                        Historique des factures de ce dossier ({missionInvoices.length})
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Toutes les notes d'honoraires émises sur {mission.code} (acomptes, notes intermédiaires et soldes).
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 self-start sm:self-auto">
                    <span className="text-xs font-bold text-[#0f3854] bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100">
                      Total facturé : {totalBilledHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT
                    </span>
                    <button
                      type="button"
                      onClick={() => onPrepareBilling(mission.id)}
                      className="px-3 py-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
                    >
                      + Émettre une note d'honoraires →
                    </button>
                  </div>
                </div>

                {missionInvoices.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl space-y-2">
                    <p>Aucune note d'honoraires émise pour le moment sur ce dossier.</p>
                    <button
                      type="button"
                      onClick={() => onPrepareBilling(mission.id)}
                      className="text-[#0f3854] font-bold hover:underline"
                    >
                      Générer la première facture pour {mission.code} →
                    </button>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <th className="py-2.5 px-3 font-semibold">Numéro</th>
                          <th className="py-2.5 px-3 font-semibold">Date</th>
                          <th className="py-2.5 px-3 font-semibold">Objet / Période</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Montant HT</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Net à payer TTC</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Statut</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Fichier Word</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {missionInvoices.map((inv: any) => {
                          const net = inv.net_payable ?? inv.total_ttc ?? 0;
                          return (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-bold text-[#0f3854] font-mono">{inv.invoice_number}</td>
                              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                {(inv.date || '').split('-').reverse().join('/')}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate">
                                {inv.subject || `Mission d'expertise`}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                                {Number(inv.total_ht || 0).toFixed(2).replace('.', ',')} €
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                {Number(net).toFixed(2).replace('.', ',')} €
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    inv.status === 'regle'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : inv.status === 'brouillon'
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : inv.status === 'annule'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-sky-50 text-sky-800 border border-sky-200'
                                  }`}
                                >
                                  {inv.status === 'regle' ? 'Réglée' : inv.status === 'brouillon' ? 'Brouillon' : inv.status === 'annule' ? 'Avoir' : 'Émise'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadInvoiceDocx(inv)}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                                >
                                  <Download className="w-3 h-3 text-slate-500" />
                                  <span>.docx</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span>
                    Prochaine note : objet pré-rempli à partir du{' '}
                    <strong className="text-slate-700">{nextInvoiceSubjectDate}</strong>
                  </span>
                  <span className="font-semibold text-slate-600">
                    Compteur en cours non facturé : {unbilledHours.toFixed(1).replace('.', ',')} h ({totalUnbilledHT.toFixed(2).replace('.', ',')} € HT)
                  </span>
                </div>
              </div>

              {/* POINTAGE DU TEMPS */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-[#0f3854]" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Pointage du dossier ({mission.activities?.length || 0} lignes)
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowRatesDrawer(!showRatesDrawer)}
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        {mission.custom_hourly_rate || 190} €/h
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenQuickAdd(mission.id)}
                        className="text-xs font-bold text-[#0f3854] hover:underline"
                      >
                        + Pointer
                      </button>
                    </div>
                  </div>

                  {showRatesDrawer && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <MissionRatesSettings mission={mission} onUpdated={loadData} />
                    </div>
                  )}

                  {(mission.activities || []).length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl">
                      Aucun temps pointé sur ce dossier.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden text-xs max-h-60 overflow-y-auto">
                      {(mission.activities || []).map((act: any) => (
                        <div key={act.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                          <div>
                            <span className="font-semibold text-slate-900 block">
                              {ACTIVITY_CATEGORY_LABELS[act.category as keyof typeof ACTIVITY_CATEGORY_LABELS] || act.label}
                            </span>
                            <span className="text-[11px] text-slate-400">
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
                                  className="w-12 border border-[#0f3854] rounded px-1 py-0.5 text-right font-bold"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveActivityHours(act.id)}
                                  className="px-1.5 py-0.5 bg-[#0f3854] text-white rounded text-[10px]"
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
                                  {Number(act.total_ht).toFixed(2).replace('.', ',')} €
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {act.hours}h ({act.status === 'facture' ? 'Facturé' : 'À facturer'})
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* =====================================================================
              VOLET 2 : 02. CONTRATS
             ===================================================================== */}
          {activeVolet === 'contrats' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Contrats & Polices d'assurance
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Environnement contractuel du sinistre (polices, conditions générales et conventions).
                </p>
              </div>

              {renderVoletDropzone('contrats', 'Contrats, conventions')}
              {renderPieceTable(docsContrats, 'Aucun contrat déposé dans ce dossier.')}
            </div>
          )}

          {/* =====================================================================
              VOLET 3 : 03. CONSTATATIONS
             ===================================================================== */}
          {activeVolet === 'constatations' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Constatations immédiates & Données terrain
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Photos en vrac (sans légende obligatoire), extractions techniques (enregistreurs, bandes) et relevés du jour J.
                    </p>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                    {[
                      { id: 'jour_j', label: 'Jour J' },
                      { id: 'visite_terrain', label: 'Photos terrain' },
                      { id: 'extractions', label: 'Extractions techniques & Relevés' },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setConstatSubSection(st.id as any)}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                          constatSubSection === st.id
                            ? 'bg-white text-[#0f3854] font-bold shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {renderVoletDropzone('constatations', constatSubSection.replace('_', ' '), constatSubSection)}
                {renderPieceTable(docsConstatations, 'Aucun document de constatation déposé.')}

                {/* Galerie Photos */}
                {allPhotos.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <span className="text-xs font-bold text-slate-700">Photos terrain ({allPhotos.length})</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {allPhotos.map((ph: any) => (
                        <div key={ph.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-1.5 space-y-1 text-xs">
                          <a href={`/uploads/${ph.filename}`} target="_blank" rel="noreferrer">
                            <img
                              src={`/uploads/${ph.filename}`}
                              alt={ph.caption || 'Photo terrain'}
                              className="w-full h-24 object-cover rounded-lg"
                            />
                          </a>
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[11px] text-slate-600 truncate">{ph.caption || ph.filename}</span>
                            <button
                              type="button"
                              onClick={async () => {
                                await api.deletePhoto(ph.id);
                                loadData();
                              }}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Participants & Notes terrain */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                      <Users className="w-4 h-4 text-[#0f3854]" />
                      <span>Participants & Émargement ({mission.attendees?.length || 0})</span>
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleCopyAttendees}
                        className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Copier la feuille d'émargement complète formatée pour le rapport ou vos emails"
                      >
                        {copySuccess ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copySuccess ? 'Copié !' : 'Copier'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddAttendee(!showAddAttendee)}
                        className="text-xs font-bold text-[#0f3854] hover:underline cursor-pointer"
                      >
                        {showAddAttendee ? 'Fermer' : '+ Ajouter'}
                      </button>
                    </div>
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
                          email: attEmail.trim() || undefined,
                          present_on_site: attPresence === 'site',
                          present_remote: attPresence === 'visio',
                          presence_type: attPresence,
                        });
                        setAttName('');
                        setAttOrg('');
                        setAttRole('');
                        setAttEmail('');
                        setShowAddAttendee(false);
                        showToast('Participant ajouté.');
                        loadData();
                      }}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Nom & Prénom *"
                          value={attName}
                          onChange={(e) => setAttName(e.target.value)}
                          required
                          className="rounded-lg border-slate-300 p-1.5 border bg-white font-medium"
                        />
                        <input
                          type="text"
                          placeholder="Société / Organisme (ex: Saretec, SNCF...)"
                          value={attOrg}
                          onChange={(e) => setAttOrg(e.target.value)}
                          className="rounded-lg border-slate-300 p-1.5 border bg-white"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Rôle (ex: Confrère adverse, Avocat, Conducteur...)"
                          value={attRole}
                          onChange={(e) => setAttRole(e.target.value)}
                          className="rounded-lg border-slate-300 p-1.5 border bg-white"
                        />
                        <input
                          type="email"
                          placeholder="Email (facultatif)"
                          value={attEmail}
                          onChange={(e) => setAttEmail(e.target.value)}
                          className="rounded-lg border-slate-300 p-1.5 border bg-white"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center space-x-1">
                          <span className="text-[11px] text-slate-500 font-semibold mr-1">Présence :</span>
                          <button
                            type="button"
                            onClick={() => setAttPresence('site')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                              attPresence === 'site'
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            📍 Sur site
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttPresence('visio')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                              attPresence === 'visio'
                                ? 'bg-sky-600 text-white shadow-2xs'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            💻 En visio
                          </button>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setShowAddAttendee(false)}
                            className="px-2.5 py-1 border border-slate-300 rounded-md bg-white text-slate-600 hover:bg-slate-100"
                          >
                            Annuler
                          </button>
                          <button type="submit" className="px-3 py-1 bg-[#0f3854] text-white rounded-md font-semibold hover:bg-[#16496d]">
                            Ajouter
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  <div className="divide-y divide-slate-100 text-xs">
                    {(mission.attendees || []).length === 0 ? (
                      <p className="py-3 text-center text-slate-400 italic">Aucun participant saisi pour cette réunion.</p>
                    ) : (
                      (mission.attendees || []).map((att: any) => (
                        <div key={att.id} className="py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center space-x-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                att.present_on_site || att.presence_type === 'site'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-sky-50 text-sky-700 border border-sky-200'
                              }`}
                            >
                              {att.present_on_site || att.presence_type === 'site' ? '📍 Sur site' : '💻 En visio'}
                            </span>
                            <div className="truncate">
                              <span className="text-slate-900 font-bold">{att.name}</span>
                              {att.organization && (
                                <span className="text-slate-500 font-medium"> ({att.organization})</span>
                              )}
                              {att.role && (
                                <span className="text-slate-400 text-[11px] block sm:inline sm:ml-1">
                                  — {att.role}
                                </span>
                              )}
                              {att.email && (
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  {att.email}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              await api.deleteAttendee(att.id);
                              loadData();
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1 shrink-0"
                            title="Supprimer ce participant"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Notes terrain */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Notes de visite terrain</h3>
                    <button
                      type="button"
                      onClick={handleSaveReportDraft}
                      disabled={savingNotes}
                      className="px-3 py-1 bg-[#0f3854] text-white rounded-lg text-xs font-semibold"
                    >
                      {savingNotes ? '...' : 'Enregistrer'}
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={rawFieldNotes}
                    onChange={(e) => setRawFieldNotes(e.target.value)}
                    placeholder="Relevés de cotes, numéros de série, observations brutes..."
                    className="w-full text-xs rounded-xl border-slate-200 p-2.5 border bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              VOLET 4 : 04. CONTRADICTOIRE
             ===================================================================== */}
          {/* =====================================================================
              VOLET 4 : 04. CONTRADICTOIRE
             ===================================================================== */}
          {activeVolet === 'contradictoire' && (
            <div className="space-y-5">
              {/* 1. DIRES, CONVOCATIONS & ÉCHANGES CONTRADICTOIRES */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-[#0f3854]" />
                      <span>Dires, Convocations & Échanges contradictoires ({(mission.communications || []).length})</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Consignez les dires de vos confrères, convocations officielles et courriers d'avocats.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddComm(!showAddComm)}
                    className="px-3.5 py-1.5 bg-[#0f3854] text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-[#16496d] transition-colors"
                  >
                    {showAddComm ? 'Fermer' : '+ Noter un dire / échange'}
                  </button>
                </div>

                {showAddComm && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!commSubject.trim()) return;
                      await api.addCommunication(mission.id, {
                        sender: commSender.trim() || 'Confrère',
                        subject: commSubject.trim(),
                        body: commBody.trim() || commSubject.trim(),
                        body_Summary: commBody.trim() || commSubject.trim(),
                        urgency: commUrgency,
                      });
                      setCommSender('');
                      setCommSubject('');
                      setCommBody('');
                      setCommUrgency('normale');
                      setShowAddComm(false);
                      showToast('Échange contradictoire enregistré.');
                      loadData();
                    }}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Émetteur / Confrère (ex: Saretec - M. Pechereau) *"
                        value={commSender}
                        onChange={(e) => setCommSender(e.target.value)}
                        required
                        className="rounded-lg border-slate-300 p-2 border bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Objet (ex: Dire n°2 sur le rapport préliminaire) *"
                        value={commSubject}
                        onChange={(e) => setCommSubject(e.target.value)}
                        required
                        className="sm:col-span-2 rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                      />
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Synthèse du dire, argument contradictoire soulevé ou délai imposé..."
                      value={commBody}
                      onChange={(e) => setCommBody(e.target.value)}
                      className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] text-slate-500 font-medium">Degré d'urgence :</span>
                        <select
                          value={commUrgency}
                          onChange={(e: any) => setCommUrgency(e.target.value)}
                          className="rounded-md border-slate-300 p-1 border bg-white text-xs font-semibold"
                        >
                          <option value="normale">Normal (délai standard)</option>
                          <option value="urgente">🔥 Urgent (délai butoir proche)</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowAddComm(false)}
                          className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-100"
                        >
                          Annuler
                        </button>
                        <button type="submit" className="px-4 py-1.5 bg-[#0f3854] text-white rounded-lg font-semibold hover:bg-[#16496d]">
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Liste des échanges contradictoires */}
                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/30 text-xs">
                  {(mission.communications || []).length === 0 ? (
                    <p className="py-6 text-center text-slate-400 italic">
                      Aucun dire, convocation ou échange contradictoire noté sur ce dossier.
                    </p>
                  ) : (
                    (mission.communications || []).map((comm: any) => {
                      const isReplied = comm.status === 'repondu' || comm.status === 'traite';
                      const isUrgent = comm.urgency === 'urgente';
                      return (
                        <div key={comm.id} className="p-3.5 bg-white hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isReplied
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {isReplied ? '✓ Répondu' : '⏳ En attente de réponse'}
                              </span>
                              {isUrgent && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  🔥 Urgent
                                </span>
                              )}
                              <span className="text-[11px] font-mono text-slate-400">
                                {(comm.date || comm.created_at || '').slice(0, 10).split('-').reverse().join('/')}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="font-bold text-[#0f3854]">{comm.sender}</span>
                            </div>

                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                              {comm.subject}
                            </h4>

                            {comm.body && comm.body !== comm.subject && (
                              <p className="text-slate-600 text-[11px] leading-relaxed">
                                {comm.body}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center space-x-2 pt-2 sm:pt-0">
                            <button
                              type="button"
                              onClick={async () => {
                                await api.toggleCommunicationReplied(comm.id, !isReplied);
                                loadData();
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                isReplied
                                  ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                  : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold'
                              }`}
                            >
                              {isReplied ? 'Rouvrir' : 'Marquer comme répondu'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await api.deleteCommunication(comm.id);
                                loadData();
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Supprimer cet échange"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 2. SUIVI DES RECOMMANDÉS (LRAR) & MISES EN CAUSE */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <Send className="w-4 h-4 text-[#0f3854]" />
                      <span>Suivi des Recommandés (LRAR) & Mises en cause ({(mission.registered_mails || []).length})</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Traçabilité des lettres recommandées avec accusé de réception adressées aux confrères et parties adverses.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddLRAR(!showAddLRAR)}
                    className="px-3.5 py-1.5 bg-[#0f3854] text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-[#16496d] transition-colors"
                  >
                    {showAddLRAR ? 'Fermer' : '+ Préparer un recommandé'}
                  </button>
                </div>

                {showAddLRAR && (
                  <form onSubmit={handleCreateLRAR} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Destinataire (Confrère ou Partie adverse) *</label>
                        <input
                          type="text"
                          placeholder="ex: Cabinet Saretec — M. Pechereau"
                          value={lrarRecipient}
                          onChange={(e) => setLrarRecipient(e.target.value)}
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-medium"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Objet du recommandé *</label>
                        <input
                          type="text"
                          placeholder="ex: Convocation avec sommation à réunion d'expertise"
                          value={lrarSubject}
                          onChange={(e) => setLrarSubject(e.target.value)}
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">N° Suivi La Poste (13 caractères)</label>
                        <input
                          type="text"
                          placeholder="ex: 1A 123 456 7890 1"
                          value={lrarTracking}
                          onChange={(e) => setLrarTracking(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Date d'envoi</label>
                        <input
                          type="date"
                          value={lrarDate}
                          onChange={(e) => setLrarDate(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Statut d'expédition</label>
                        <select
                          value={lrarStatus}
                          onChange={(e: any) => setLrarStatus(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                        >
                          <option value="a_preparer">✉ À préparer</option>
                          <option value="prepare">Prêt à l'envoi</option>
                          <option value="expedie">✈ Expédié</option>
                          <option value="distribue">✓ Distribué / AR Reçu</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Observations / Numéro de pli</label>
                      <input
                        type="text"
                        placeholder="ex: LRAR avec avis de réception contenant convocation du 12 mai"
                        value={lrarNotes}
                        onChange={(e) => setLrarNotes(e.target.value)}
                        className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddLRAR(false)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-100"
                      >
                        Annuler
                      </button>
                      <button type="submit" className="px-4 py-1.5 bg-[#0f3854] text-white rounded-lg font-semibold hover:bg-[#16496d]">
                        Enregistrer le recommandé
                      </button>
                    </div>
                  </form>
                )}

                {/* Tableau de suivi des LRAR */}
                <div className="border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-medium">
                        <th className="py-2.5 px-3.5">N° Suivi La Poste</th>
                        <th className="py-2.5 px-3.5">Destinataire & Objet</th>
                        <th className="py-2.5 px-3.5 w-28">Date d'envoi</th>
                        <th className="py-2.5 px-3.5 w-32 text-center">Statut</th>
                        <th className="py-2.5 px-3.5 text-right w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(mission.registered_mails || []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                            Aucun courrier recommandé enregistré pour ce dossier.
                          </td>
                        </tr>
                      ) : (
                        (mission.registered_mails || []).map((mail: any) => {
                          const trackingClean = (mail.tracking_number || '').replace(/\s+/g, '');
                          return (
                            <tr key={mail.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3.5 font-mono">
                                {trackingClean ? (
                                  <a
                                    href={`https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(trackingClean)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-bold text-[#0f3854] hover:underline inline-flex items-center space-x-1"
                                    title="Suivre en direct sur laposte.fr"
                                  >
                                    <span>{mail.tracking_number}</span>
                                    <ExternalLink className="w-3 h-3 text-slate-400" />
                                  </a>
                                ) : (
                                  <span className="text-slate-400 italic">Sans N° de suivi</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5">
                                <span className="font-bold text-slate-900 block">{mail.recipient}</span>
                                <span className="text-slate-600 text-[11px]">{mail.subject}</span>
                                {mail.notes && <span className="text-slate-400 text-[10px] block">{mail.notes}</span>}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap">
                                {(mail.sent_date || mail.created_at || '').slice(0, 10).split('-').reverse().join('/')}
                              </td>
                              <td className="py-2.5 px-3.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    mail.status === 'distribue'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : mail.status === 'expedie'
                                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}
                                >
                                  {mail.status === 'distribue'
                                    ? '✓ AR Reçu'
                                    : mail.status === 'expedie'
                                    ? '✈ Expédié'
                                    : '✉ À préparer'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 text-right whitespace-nowrap space-x-1.5">
                                {mail.status === 'a_preparer' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await api.updateLRAR(mail.id, { status: 'expedie' });
                                      loadData();
                                    }}
                                    className="text-[11px] text-[#0f3854] hover:underline font-semibold"
                                  >
                                    Expédier
                                  </button>
                                )}
                                {mail.status === 'expedie' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await api.updateLRAR(mail.id, { status: 'distribue' });
                                      loadData();
                                    }}
                                    className="text-[11px] text-emerald-700 hover:underline font-semibold"
                                  >
                                    AR reçu
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await api.deleteLRAR(mail.id);
                                    showToast('Courrier recommandé retiré.');
                                    loadData();
                                  }}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                  title="Supprimer ce suivi LRAR"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. PIÈCES TRANSMISES & DIRES OFFICIELS */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Pièces du contradictoire & Dires formels déposés ({docsContradictoire.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mises en cause, convocations, dires officiels et accusés de réception LRAR scannés.
                  </p>
                </div>

                {renderVoletDropzone('contradictoire', 'Convocations, dires, accusés LRAR')}
                {renderPieceTable(docsContradictoire, 'Aucune pièce contradictoire déposée.')}
              </div>
            </div>
          )}

          {/* =====================================================================
              VOLET 5 : 05. COMPTES DU PRÉJUDICE
             ===================================================================== */}
          {activeVolet === 'prejudice' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Comptes du préjudice
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tableau de chiffrage contradictoire et pièces justificatives reliées.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {totalRetainedHT > 0 && totalRetainedHT !== stakeAmount && (
                    <button
                      type="button"
                      onClick={async () => {
                        await api.updateMission(mission.id, {
                          stake_amount: totalRetainedHT,
                          stake_note: 'Aligné sur les Comptes du préjudice',
                        });
                        showToast(`Enjeu mis à jour : ${totalRetainedHT.toLocaleString('fr-FR')} €`);
                        loadData();
                      }}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Reporter comme Enjeu ({totalRetainedHT.toLocaleString('fr-FR')} €)
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
                    className="px-3.5 py-1.5 bg-[#0f3854] text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    + Ajouter un poste
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
                        <option value="materiel">Dommages matériels</option>
                        <option value="exploitation">Pertes d'exploitation</option>
                        <option value="frais_annexes">Frais annexes</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block font-semibold text-slate-700 mb-1">Désignation du poste *</label>
                      <input
                        type="text"
                        value={dmgLabel}
                        onChange={(e) => setDmgLabel(e.target.value)}
                        placeholder="ex: Remplacement essieux et remise en état bogie"
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
                        placeholder="0.00"
                        required
                        className="w-full rounded-lg border-slate-300 p-2 border bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Montant retenu (€ HT)</label>
                      <input
                        type="text"
                        value={dmgRetained}
                        onChange={(e) => setDmgRetained(e.target.value)}
                        placeholder="Identique au réclamé si vide"
                        className="w-full rounded-lg border-slate-300 p-2 border bg-white font-bold text-[#0f3854]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Observation / Vétusté</label>
                      <input
                        type="text"
                        value={dmgNotes}
                        onChange={(e) => setDmgNotes(e.target.value)}
                        placeholder="ex: Abattement vétusté 10%"
                        className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                      />
                    </div>
                  </div>

                  {allDocuments.length > 0 && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Pièces liées :
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
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                active
                                  ? 'bg-[#0f3854] text-white border-[#0f3854]'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              Pièce {pNum}
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
                      Enregistrer
                    </button>
                  </div>
                </form>
              )}

              {/* Tableau de Chiffrage */}
              <div className="border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-medium">
                      <th className="py-2.5 px-3.5">Poste</th>
                      <th className="py-2.5 px-3.5">Catégorie</th>
                      <th className="py-2.5 px-3.5 text-right">Réclamé HT</th>
                      <th className="py-2.5 px-3.5 text-right text-[#0f3854]">Retenu Expert HT</th>
                      <th className="py-2.5 px-3.5">Pièces liées</th>
                      <th className="py-2.5 px-3.5 text-right w-16">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {damageLines.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Aucun poste de préjudice saisi.
                        </td>
                      </tr>
                    ) : (
                      damageLines.map((line) => (
                        <tr key={line.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3.5">
                            <span className="font-bold text-slate-900 block">{line.label}</span>
                            {(line.notes || line.comment) && (
                              <span className="text-[11px] text-slate-500">{line.notes || line.comment}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-500 capitalize">{line.category.replace('_', ' ')}</td>
                          <td className="py-2.5 px-3.5 text-right font-medium text-slate-700">
                            {Number(line.claimed_amount_ht ?? line.claimed_amount ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-extrabold text-[#0f3854]">
                            {Number(line.retained_amount_ht ?? line.retained_amount ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </td>
                          <td className="py-2.5 px-3.5">
                            <div className="flex flex-wrap gap-1">
                              {(line.piece_numbers || []).map((num) => (
                                <span
                                  key={num}
                                  className="px-1.5 py-0.2 rounded bg-sky-50 text-[#0f3854] font-mono text-[10px] font-bold"
                                >
                                  P.{num}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDamageId(line.id);
                                setDmgCategory(line.category as any);
                                setDmgLabel(line.label);
                                setDmgClaimed(String(line.claimed_amount_ht ?? line.claimed_amount ?? ''));
                                setDmgRetained(String(line.retained_amount_ht ?? line.retained_amount ?? ''));
                                setDmgNotes(line.notes || line.comment || '');
                                setDmgSelectedPieces(line.piece_numbers || []);
                                setShowAddDamageLine(true);
                              }}
                              className="text-slate-400 hover:text-slate-700 p-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await api.deleteDamageLine(line.id);
                                loadData();
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1"
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
                      <tr className="bg-slate-50/80 border-t-2 border-slate-200 font-extrabold text-xs">
                        <td colSpan={2} className="py-3 px-3.5 text-slate-800">TOTAL</td>
                        <td className="py-3 px-3.5 text-right text-slate-700">
                          {totalClaimedHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                        </td>
                        <td className="py-3 px-3.5 text-right text-[#0f3854] text-sm">
                          {totalRetainedHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {renderVoletDropzone('prejudice', 'Devis, factures, justificatifs de chiffrage')}
              {renderPieceTable(docsPrejudice, 'Aucun devis ou facture déposé.')}
            </div>
          )}

          {/* =====================================================================
              VOLET 6 : 06. RAPPORTS ÉMIS
             ===================================================================== */}
          {activeVolet === 'rapports' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Rapports diffusés & Packages Avocats (.zip)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Téléchargez en 1 clic le rapport et ses pièces jointes numérotées, même des années plus tard.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDraftEditor(!showDraftEditor)}
                    className="px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                  >
                    {showDraftEditor ? 'Masquer trame' : 'Trame de rapport'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddIssuedReport(!showAddIssuedReport)}
                    className="px-3.5 py-1.5 bg-[#0f3854] text-white rounded-lg text-xs font-bold"
                  >
                    + Archiver un rapport
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
                      <label className="block font-semibold text-slate-700 mb-1">Type *</label>
                      <select
                        value={repType}
                        onChange={(e: any) => setRepType(e.target.value)}
                        className="w-full rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                      >
                        <option value="preliminaire">Préliminaire</option>
                        <option value="intermediaire">D'étape / Intermédiaire</option>
                        <option value="final">Définitif / Clôture</option>
                        <option value="note_synthese">Note technique</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Titre du rapport *</label>
                      <input
                        type="text"
                        value={repTitle}
                        onChange={(e) => setRepTitle(e.target.value)}
                        placeholder="ex: Rapport d'étape suite à la visite contradictoire"
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
                      <label className="block font-semibold text-slate-700 mb-1">Destinataires</label>
                      <input
                        type="text"
                        value={repRecipient}
                        onChange={(e) => setRepRecipient(e.target.value)}
                        placeholder={`ex: ${mission.insurance_client}`}
                        className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Fichier (Word ou PDF)</label>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setRepFile(e.target.files ? e.target.files[0] : null)}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-white file:text-[#0f3854]"
                      />
                    </div>
                  </div>

                  {allDocuments.length > 0 && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Cocher les Pièces jointes à ce package :
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
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                selected
                                  ? 'bg-[#0f3854] text-white border-[#0f3854]'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              Pièce {pNum}
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
                      {submittingReportPkg ? '...' : 'Archiver'}
                    </button>
                  </div>
                </form>
              )}

              {issuedReports.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl">
                  Aucun rapport diffusé archivé.
                </p>
              ) : (
                <div className="space-y-3">
                  {issuedReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/40 hover:bg-white transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.2 rounded text-[10px] font-bold uppercase bg-[#0f3854]/10 text-[#0f3854]">
                            {rep.report_type}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            Envoyé le {((rep.sent_date || rep.issued_date || '')).split('-').reverse().join('/')}
                          </span>
                          {rep.recipient && (
                            <span className="text-xs text-slate-500">• {rep.recipient}</span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{rep.title}</h3>
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          {(rep.attached_piece_numbers || []).map((num) => (
                            <span
                              key={num}
                              className="px-1.5 py-0.2 rounded bg-white border border-slate-200 text-[10px] font-bold text-[#0f3854]"
                            >
                              P.{num}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`/api/issued-reports/${rep.id}/package-zip`}
                          download
                          className="px-3 py-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 shadow-2xs"
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
                          className="p-1.5 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Trame de rapport Word */}
              {showDraftEditor && (
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Trame de rapport Word</h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveReportDraft}
                        className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold"
                      >
                        Sauvegarder
                      </button>
                      <a
                        href={`/api/missions/${mission.id}/report-docx`}
                        download
                        className="px-3 py-1.5 bg-[#0f3854] text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger Word (.docx)</span>
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">1. Faits & Contexte</label>
                      <textarea
                        rows={3}
                        value={reportFacts}
                        onChange={(e) => setReportFacts(e.target.value)}
                        className="w-full rounded-lg border-slate-200 p-2 border bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">2. Constatations</label>
                      <textarea
                        rows={3}
                        value={reportObs}
                        onChange={(e) => setReportObs(e.target.value)}
                        className="w-full rounded-lg border-slate-200 p-2 border bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">3. Analyse & Causes</label>
                      <textarea
                        rows={3}
                        value={reportAnalysis}
                        onChange={(e) => setReportAnalysis(e.target.value)}
                        className="w-full rounded-lg border-slate-200 p-2 border bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">4. Chiffrage & Conclusions</label>
                      <textarea
                        rows={3}
                        value={reportConc}
                        onChange={(e) => setReportConc(e.target.value)}
                        className="w-full rounded-lg border-slate-200 p-2 border bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Modal de prévisualisation immédiate de document (sans téléchargement parasite) */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden">
            {/* Header modal */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center space-x-2.5 min-w-0 pr-3">
                <span className="font-mono text-xs font-bold text-[#0f3854] bg-[#0f3854]/10 px-2.5 py-1 rounded-lg">
                  Pièce {previewDoc.piece_number || '—'}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {previewDoc.original_name}
                  </h3>
                  {previewDoc.caption && (
                    <p className="text-xs text-slate-500 truncate">{previewDoc.caption}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <a
                  href={`/uploads/${previewDoc.filename}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Nouvel onglet</span>
                </a>
                <a
                  href={`/uploads/${previewDoc.filename}`}
                  download={previewDoc.original_name}
                  className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Télécharger</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewer content */}
            <div className="flex-1 p-2 sm:p-4 bg-slate-100/60 overflow-auto flex items-center justify-center min-h-[400px]">
              {previewDoc.mime_type?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(previewDoc.filename) ? (
                <img
                  src={`/uploads/${previewDoc.filename}`}
                  alt={previewDoc.original_name}
                  className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-sm border border-slate-200 bg-white"
                />
              ) : previewDoc.mime_type === 'application/pdf' || /\.pdf$/i.test(previewDoc.filename) ? (
                <iframe
                  src={`/uploads/${previewDoc.filename}`}
                  title={previewDoc.original_name}
                  className="w-full h-[75vh] rounded-lg border border-slate-200 bg-white"
                />
              ) : (
                <div className="text-center p-8 bg-white rounded-xl border border-slate-200 space-y-3">
                  <FileText className="w-12 h-12 text-[#0f3854] mx-auto opacity-70" />
                  <p className="text-xs text-slate-600">
                    Ce format de fichier ({previewDoc.original_name.split('.').pop()?.toUpperCase()}) n'est pas visualisable directement dans le navigateur.
                  </p>
                  <a
                    href={`/uploads/${previewDoc.filename}`}
                    download={previewDoc.original_name}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0f3854] text-white rounded-lg text-xs font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger pour l'ouvrir sur votre Mac</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
