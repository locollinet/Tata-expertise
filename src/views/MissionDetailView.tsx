import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Clock, Receipt, FileText, Mail, Train, Plus, Trash2, Download,
  CheckCircle2, AlertCircle, Save, ExternalLink, Calendar, Copy, Check,
  FolderOpen, UploadCloud, Paperclip, FileSpreadsheet, Eye, ShieldCheck, Sliders, Camera,
  ChevronDown, Edit3, Archive, RotateCcw, Users, Scale, Calculator, Send, Sparkles, Package, Building2, TrendingUp, Shield, X, Search
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
  Mission,
  GuaranteeType,
  ExpertiseOperationRow,
} from '@shared/types.js';
import { MissionRatesSettings } from '../components/MissionRatesSettings.js';
import {
  syncFileToLocalMacFolder,
  syncComptaFileToMac,
  mirrorEvidenceToFirestore,
  VOLET_TO_MAC_FOLDER,
  isLocalSyncConnected,
  getLocalSyncFolderName,
  scanUntrackedMacFilesForMission,
  UntrackedMacFile,
} from '../utils/localFolderSync.js';

interface MissionDetailViewProps {
  missionId: string;
  missions?: Mission[];
  initialMission?: any;
  initialVolet?: DossierVoletKey;
  sourceTab?: 'today' | 'missions' | 'billing';
  onBack: () => void;
  onSwitchMission?: (newMissionCodeOrId: string, currentVolet?: DossierVoletKey) => void;
  onCacheMission?: (mission: any) => void;
  onOpenQuickAdd: (missionId: string, defaultTab?: 'activity' | 'expense' | 'photo') => void;
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
  missions = [],
  initialMission,
  initialVolet,
  sourceTab = 'missions',
  onBack,
  onSwitchMission,
  onCacheMission,
  onOpenQuickAdd,
  onPrepareBilling,
}) => {
  const [mission, setMission] = useState<any>(initialMission || null);
  const [loading, setLoading] = useState(!initialMission || !initialMission.activities);

  // Switcher de dossier (adapté pour 150 dossiers avec loupe et menu déroulant)
  const [allMissionsList, setAllMissionsList] = useState<Mission[]>(missions);
  const [switcherSearch, setSwitcherSearch] = useState('');
  const [includeClosedInSwitcher, setIncludeClosedInSwitcher] = useState(false);

  useEffect(() => {
    if (missions && missions.length > 0) {
      setAllMissionsList(missions);
    } else {
      api.getMissions().then((res) => {
        if (Array.isArray(res)) setAllMissionsList(res);
      }).catch(console.error);
    }
  }, [missions]);

  const filteredMissionsForSwitcher = useMemo(() => {
    const q = switcherSearch.trim().toLowerCase();
    return (allMissionsList || []).filter((m: any) => {
      if (!includeClosedInSwitcher && m.status === 'cloture' && m.id !== mission?.id && m.code !== mission?.code) {
        return false;
      }
      if (!q) return true;
      const adv = (m.adverse_parties || [])
        .map((p: any) => `${p.party_name || ''} ${p.expert_firm || ''} ${p.expert_name || ''}`)
        .join(' ')
        .toLowerCase();
      const hay = `${m.code || ''} ${m.title || ''} ${m.case_reference || ''} ${m.insurance_client || ''} ${m.insured_party || ''} ${adv}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allMissionsList, switcherSearch, includeClosedInSwitcher, mission]);

  const handleSelectOtherMission = (targetIdOrCode: string) => {
    if (!targetIdOrCode) return;
    if (targetIdOrCode === mission?.id || targetIdOrCode === mission?.code) return;
    if (onSwitchMission) {
      onSwitchMission(targetIdOrCode, activeVolet);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'missions');
      url.searchParams.set('mission', targetIdOrCode);
      if (activeVolet) url.searchParams.set('volet', activeVolet);
      window.location.href = url.toString();
    }
  };

  const handleSwitcherKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredMissionsForSwitcher.length > 0) {
        const first = filteredMissionsForSwitcher[0];
        handleSelectOtherMission(first.code || first.id);
      }
    }
  };

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

  // Volet 1 (Page de garde — Synthesis Table)
  const [editingParties, setEditingParties] = useState(false);
  const [guaranteeTypeEdit, setGuaranteeTypeEdit] = useState<string>('RC');
  const [clientName, setClientName] = useState('');
  const [clientRef, setClientRef] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [insurerCompany, setInsurerCompany] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [insuredParty, setInsuredParty] = useState('');
  const [insuredContact, setInsuredContact] = useState('');
  const [insuredRef, setInsuredRef] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [brokerRef, setBrokerRef] = useState('');
  const [clientLawyer, setClientLawyer] = useState('');
  const [courtReferenceEdit, setCourtReferenceEdit] = useState('');
  const [judicialExpertEdit, setJudicialExpertEdit] = useState('');
  const [incidentDateEdit, setIncidentDateEdit] = useState('');
  const [receptionDateEdit, setReceptionDateEdit] = useState('');
  const [descriptionEdit, setDescriptionEdit] = useState('');
  const [preliminaryAnalysisEdit, setPreliminaryAnalysisEdit] = useState('');
  const [pvDommagesDateEdit, setPvDommagesDateEdit] = useState('');
  const [expertiseOperationsEdit, setExpertiseOperationsEdit] = useState<ExpertiseOperationRow[]>([]);
  const [editingOperations, setEditingOperations] = useState(false);
  const [missionCodeEdit, setMissionCodeEdit] = useState('');
  const [missionTitleEdit, setMissionTitleEdit] = useState('');
  const [adverseParties, setAdverseParties] = useState<AdverseParty[]>([]);

  // Enjeu / Quantum
  const [showUpdateStake, setShowUpdateStake] = useState(false);
  const [newStakeAmount, setNewStakeAmount] = useState('');
  const [newStakeNote, setNewStakeNote] = useState('');

  // Pointage, Frais & Tarifs
  const [editingActId, setEditingActId] = useState<string | null>(null);
  const [editActHours, setEditActHours] = useState<string>('');
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [editExpQty, setEditExpQty] = useState<string>('');
  const [editExpUnit, setEditExpUnit] = useState<string>('');
  const [showRatesDrawer, setShowRatesDrawer] = useState(false);

  // Synchronisation Bidirectionnelle Finder Mac -> App (Détection des fichiers en écart)
  const [untrackedMacFiles, setUntrackedMacFiles] = useState<UntrackedMacFile[]>([]);
  const [untrackedTargetVolets, setUntrackedTargetVolets] = useState<Record<string, DossierVoletKey>>({});
  const [scanningMacFiles, setScanningMacFiles] = useState(false);
  const [importingMacFiles, setImportingMacFiles] = useState(false);

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
    setGuaranteeTypeEdit(data.guarantee_type || 'RC');
    setClientName(data.insurance_client || '');
    setClientRef(data.case_reference || '');
    setClientContact(data.client_contact || data.insurer_contact || '');
    setInsurerCompany(data.insurer_company || '');
    setBillingAddress(data.billing_address || '');
    setInsuredParty(data.insured_party || '');
    setInsuredContact(data.insured_contact || '');
    setInsuredRef(data.insured_reference || '');
    setBrokerName(data.broker_name || '');
    setBrokerRef(data.broker_reference || '');
    setClientLawyer(data.client_lawyer || '');
    setCourtReferenceEdit(data.court_reference || '');
    setJudicialExpertEdit(data.judicial_expert || '');
    setIncidentDateEdit(data.incident_date || '');
    setReceptionDateEdit(data.reception_date || '');
    setDescriptionEdit(data.description || '');
    setPreliminaryAnalysisEdit(data.preliminary_analysis || '');
    setPvDommagesDateEdit(data.pv_dommages_date || '');
    const ops: ExpertiseOperationRow[] = Array.isArray(data.expertise_operations) && data.expertise_operations.length > 0
      ? data.expertise_operations
      : [
          { id: 'op-1', label: '1', expertise_date: '', report_date: '', quantum: data.stake_amount ?? null, invoice_number: '', invoice_amount_ht: null, invoice_date: '' },
          { id: 'op-2', label: '2', expertise_date: '', report_date: '', quantum: null, invoice_number: '', invoice_amount_ht: null, invoice_date: '' },
          { id: 'op-3', label: '3', expertise_date: '', report_date: '', quantum: null, invoice_number: '', invoice_amount_ht: null, invoice_date: '' },
          { id: 'op-def', label: 'Définitif', expertise_date: '', report_date: '', quantum: null, invoice_number: '', invoice_amount_ht: null, invoice_date: '' },
        ];
    setExpertiseOperationsEdit(ops);
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

  const runFinderDiffScan = async (missionData: any) => {
    if (!missionData?.code || !isLocalSyncConnected()) return;
    setScanningMacFiles(true);
    try {
      const existingNames = [
        ...(missionData.documents || []).map((d: any) => d.original_name),
        ...(missionData.photos || []).map((p: any) => p.original_name),
        ...(missionData.issued_reports || []).map((r: any) => r.original_name).filter(Boolean),
      ];
      const found = await scanUntrackedMacFilesForMission(missionData.code, existingNames);
      setUntrackedMacFiles(found);
      const mapVolets: Record<string, DossierVoletKey> = {};
      for (const f of found) {
        mapVolets[f.id] = f.inferredSection;
      }
      setUntrackedTargetVolets(mapVolets);
    } catch {
      // Ignore scan error
    } finally {
      setScanningMacFiles(false);
    }
  };

  const loadData = async () => {
    try {
      const data = await api.getMission(missionId);
      setMission(data);
      onCacheMission?.(data);
      syncFormStateFromMission(data);
      runFinderDiffScan(data);
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

    const handleRefreshEvent = () => {
      loadData();
    };
    window.addEventListener('vp-mission-data-updated', handleRefreshEvent);
    window.addEventListener('vp-local-sync-changed', handleRefreshEvent);
    return () => {
      window.removeEventListener('vp-mission-data-updated', handleRefreshEvent);
      window.removeEventListener('vp-local-sync-changed', handleRefreshEvent);
    };
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
    garde: (mission.activities?.length || 0) + (mission.expenses?.length || 0) + (missionInvoices.length || 0),
    contrats: docsContrats.length,
    constatations: docsConstatations.length + allPhotos.length,
    contradictoire: docsContradictoire.length + (mission.communications?.length || 0) + (mission.registered_mails?.length || 0),
    prejudice: damageLines.length + docsPrejudice.length,
    rapports: issuedReports.length + docsRapports.length,
  };

  const handleImportUntrackedMacFiles = async (itemsToImport: UntrackedMacFile[]) => {
    if (!itemsToImport || itemsToImport.length === 0) return;
    setImportingMacFiles(true);
    try {
      // Group files by target volet so each goes into the right section
      const byVolet: Record<string, File[]> = {};
      for (const item of itemsToImport) {
        const targetVolet = untrackedTargetVolets[item.id] || item.inferredSection || 'constatations';
        if (!byVolet[targetVolet]) byVolet[targetVolet] = [];
        byVolet[targetVolet].push(item.file);
      }

      const categoryMap: Record<string, string> = {
        garde: 'autre',
        contrats: 'contrat_client',
        constatations: 'note_technique',
        contradictoire: 'procedure_dires',
        prejudice: 'justificatif_prejudice',
        rapports: 'rapport_emis',
      };

      let totalImported = 0;
      for (const [voletKey, fileList] of Object.entries(byVolet)) {
        const formData = new FormData();
        formData.append('section', voletKey === 'garde' ? 'constatations' : voletKey);
        formData.append('category', categoryMap[voletKey] || 'autre');
        for (const f of fileList) {
          formData.append('files', f);
        }
        const res = await fetch(`/api/missions/${mission.id}/documents`, {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          totalImported += fileList.length;
        }
      }

      showToast(`${totalImported} fichier(s) du Finder Mac importé(s) et numéroté(s) dans le dossier !`);
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Erreur lors de l'import depuis le Finder Mac", 'error');
    } finally {
      setImportingMacFiles(false);
    }
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
        (p) =>
          p.party_name.trim() ||
          (p.insurer_name && p.insurer_name.trim()) ||
          (p.expert_firm && p.expert_firm.trim()) ||
          (p.expert_name && p.expert_name.trim())
      );
      await api.updateMission(mission.id, {
        code: missionCodeEdit.trim(),
        title: missionTitleEdit.trim(),
        guarantee_type: guaranteeTypeEdit || 'RC',
        insurance_client: clientName.trim(),
        case_reference: clientRef.trim(),
        client_contact: clientContact.trim(),
        insurer_company: insurerCompany.trim(),
        insurer_contact: clientContact.trim(),
        billing_address: billingAddress.trim(),
        insured_party: insuredParty.trim(),
        insured_contact: insuredContact.trim(),
        insured_reference: insuredRef.trim(),
        broker_name: brokerName.trim(),
        broker_reference: brokerRef.trim(),
        client_lawyer: clientLawyer.trim(),
        court_reference: courtReferenceEdit.trim(),
        judicial_expert: judicialExpertEdit.trim(),
        incident_date: incidentDateEdit,
        reception_date: receptionDateEdit,
        description: descriptionEdit.trim(),
        preliminary_analysis: preliminaryAnalysisEdit.trim(),
        pv_dommages_date: pvDommagesDateEdit.trim(),
        expertise_operations: expertiseOperationsEdit,
        adverse_parties: cleanedParties,
      });
      setEditingParties(false);
      showToast('Fiche de synthèse (Synthesis Table) enregistrée.');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveOperationsTable = async () => {
    try {
      await api.updateMission(mission.id, {
        pv_dommages_date: pvDommagesDateEdit.trim(),
        expertise_operations: expertiseOperationsEdit,
        preliminary_analysis: preliminaryAnalysisEdit.trim(),
      });
      setEditingOperations(false);
      showToast('Tableau des opérations d’expertise et commentaires enregistrés.');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveExpenseEdit = async (expId: string) => {
    const qty = parseFloat(editExpQty.replace(',', '.'));
    const unit = parseFloat(editExpUnit.replace(',', '.'));
    if (isNaN(qty) || qty <= 0 || isNaN(unit) || unit < 0) return;
    try {
      await api.updateExpense(expId, { quantity: qty, unit_price: unit });
      setEditingExpId(null);
      showToast('Frais mis à jour.');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteExpense = async (expId: string, label: string) => {
    if (!window.confirm(`Supprimer le frais « ${label} » ?`)) return;
    try {
      await api.deleteExpense(expId);
      showToast('Frais supprimé.');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteActivity = async (actId: string, label: string) => {
    if (!window.confirm(`Supprimer le pointage « ${label} » ?`)) return;
    try {
      await api.deleteActivity(actId);
      showToast('Pointage supprimé.');
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
        subFolder: '07_Factures_Honoraires',
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

      {/* BANDEAU DE NAVIGATION & COMMUTATEUR RAPIDE DE DOSSIER (Pour 150 dossiers) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 sm:p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Partie Gauche : Bouton Retour + Loupe de recherche + Menu déroulant */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 flex-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 shadow-2xs transition-colors shrink-0 cursor-pointer"
            title="Revenir au registre des dossiers"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">
              {sourceTab === 'today'
                ? "Aujourd'hui"
                : sourceTab === 'billing'
                ? 'Factures'
                : 'Dossiers'}
            </span>
          </button>

          <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0" />

          {/* Module de bascule de dossier : Loupe + Menu Déroulant */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-0">
            {/* Barre de recherche avec loupe */}
            <div className="relative shrink-0 w-full sm:w-60 lg:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={switcherSearch}
                onChange={(e) => setSwitcherSearch(e.target.value)}
                onKeyDown={handleSwitcherKeyDown}
                placeholder="Changer de dossier (ex: 728, Alstom)..."
                className="w-full text-xs rounded-xl border-slate-200 pl-8 pr-7 py-2 bg-slate-50/80 border focus:bg-white focus:border-[#0f3854] focus:ring-1 focus:ring-[#0f3854] shadow-2xs transition-all placeholder:text-slate-400"
              />
              {switcherSearch && (
                <button
                  type="button"
                  onClick={() => setSwitcherSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5 cursor-pointer"
                  title="Effacer la recherche"
                >
                  ×
                </button>
              )}
            </div>

            {/* Menu déroulant de sélection immédiate */}
            <div className="relative flex-1 min-w-0">
              <select
                value={mission?.code || mission?.id || missionId}
                onChange={(e) => handleSelectOtherMission(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-200 shadow-2xs focus:border-[#0f3854] focus:ring-1 focus:ring-[#0f3854] py-2 pl-3 pr-8 bg-white border font-bold text-slate-900 truncate cursor-pointer hover:bg-slate-50/80 transition-colors"
                title="Sélectionner directement un autre dossier"
              >
                {filteredMissionsForSwitcher.length === 0 ? (
                  <option value="" disabled>Aucun dossier ne correspond à « {switcherSearch} »</option>
                ) : (
                  filteredMissionsForSwitcher.map((m: any) => (
                    <option key={m.id} value={m.code || m.id}>
                      {m.code} — {m.title.length > 44 ? `${m.title.slice(0, 44)}…` : m.title} ({m.insurance_client}){m.status === 'cloture' ? ' [CLOS]' : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Filtre pour inclure les dossiers clos si souhaité */}
            <label
              className="inline-flex items-center space-x-1.5 text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer select-none shrink-0 px-1 py-1"
              title="Cocher pour afficher également les dossiers d'expertise clos / archivés"
            >
              <input
                type="checkbox"
                checked={includeClosedInSwitcher}
                onChange={(e) => setIncludeClosedInSwitcher(e.target.checked)}
                className="rounded border-slate-300 text-[#0f3854] focus:ring-[#0f3854] w-3.5 h-3.5"
              />
              <span className="hidden xl:inline">Inclure clos</span>
            </label>
          </div>
        </div>

        {/* Partie Droite : Finder Mac + Scanner écarts + Bouton Archiver / Réouvrir */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-auto text-xs pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100/90 text-slate-600 text-[11px] border border-slate-200/60 shadow-2xs">
            <FolderOpen className="w-3.5 h-3.5 text-[#0f3854] shrink-0" />
            <span className="hidden sm:inline">Finder Mac :</span>
            <strong className="font-mono text-slate-800">
              {mission.code}/{activeVolet === 'garde' ? '01_Page_de_garde & 07_Factures_Honoraires' : currentVoletMeta.macFolder}
            </strong>
          </div>

          <button
            type="button"
            onClick={() => runFinderDiffScan(false)}
            disabled={scanningFinder}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-[#0f3854] border border-sky-200 transition-colors shadow-2xs cursor-pointer"
            title="Scanner le dossier Finder sur votre Mac pour détecter les nouveaux fichiers déposés manuellement et les importer dans l'application"
          >
            <RotateCcw className={`w-3 h-3 text-[#0f3854] ${scanningFinder ? 'animate-spin' : ''}`} />
            <span>{scanningFinder ? 'Scan Finder...' : 'Scanner Finder Mac'}</span>
            {untrackedMacFiles.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-extrabold">
                {untrackedMacFiles.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleToggleMissionStatus}
            className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors shadow-2xs cursor-pointer ${
              mission.status === 'cloture'
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title={mission.status === 'cloture' ? 'Réouvrir ce dossier en cours d\'instruction' : 'Archiver ce dossier'}
          >
            {mission.status === 'cloture' ? (
              <>
                <RotateCcw className="w-3 h-3 text-amber-700" />
                <span>Réouvrir</span>
              </>
            ) : (
              <>
                <Archive className="w-3 h-3 text-slate-500" />
                <span>Archiver</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* BANDEAU D'ÉCART FINDER MAC -> APPLICATION (Détection automatique des fichiers déposés dans le Finder) */}
      {untrackedMacFiles.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 shadow-xs space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start space-x-2.5">
              <FolderOpen className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-950 block">
                  {untrackedMacFiles.length} fichier(s) détecté(s) dans votre Finder Mac non encore intégré(s) dans l'application
                </span>
                <span className="text-[11px] text-amber-800">
                  Vous avez déposé ces documents directement dans les sous-dossiers Mac de <strong>{mission.code}</strong>. Voulez-vous les intégrer au dossier ?
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                disabled={importingFinderFiles}
                onClick={() => handleImportUntrackedMacFiles(untrackedMacFiles)}
                className="px-3.5 py-1.5 bg-[#0f3854] hover:bg-[#16496d] disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-2xs cursor-pointer"
              >
                {importingFinderFiles ? 'Import en cours...' : `Tout intégrer (${untrackedMacFiles.length})`}
              </button>
              <button
                type="button"
                onClick={() => setUntrackedMacFiles([])}
                className="px-2.5 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-semibold text-[11px] cursor-pointer"
              >
                Masquer
              </button>
            </div>
          </div>

          <div className="divide-y divide-amber-200/70 bg-white rounded-xl border border-amber-200 overflow-hidden">
            {untrackedMacFiles.map((uf, idx) => (
              <div key={`${uf.subFolder}-${uf.fileName}-${idx}`} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-[#0f3854] shrink-0" />
                  <span className="font-bold text-slate-900 truncate">{uf.fileName}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] shrink-0">
                    Finder : {uf.subFolder}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    ({Math.max(1, Math.round(uf.size / 1024))} Ko)
                  </span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[11px] text-slate-500">Classer dans :</span>
                  <select
                    value={uf.suggestedVolet}
                    onChange={(e) => {
                      const next = [...untrackedMacFiles];
                      next[idx] = { ...next[idx], suggestedVolet: e.target.value as VoletKey };
                      setUntrackedMacFiles(next);
                    }}
                    className="text-[11px] rounded-lg border border-slate-300 py-1 px-2 bg-slate-50 font-semibold text-slate-800"
                  >
                    {VOLETS_CONFIG.map((v) => (
                      <option key={v.key} value={v.key}>
                        {v.num}. {v.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={importingFinderFiles}
                    onClick={() => handleImportUntrackedMacFiles([uf])}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                  >
                    Intégrer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EN-TÊTE ÉLÉGANT DU DOSSIER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-[#0f3854] text-white font-mono">
                {mission.code}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                Garantie : {mission.guarantee_type || 'RC'}
              </span>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                Donneur d'ordre : {mission.insurance_client}
              </span>
              {mission.case_reference && (
                <span className="text-xs text-slate-500 font-mono">
                  (Réf. Cie : {mission.case_reference})
                </span>
              )}
              <span className="text-xs text-slate-600">
                • Assuré : <strong className="text-slate-800">{mission.insured_party}</strong>
                {mission.insured_contact ? ` (${mission.insured_contact})` : ''}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {mission.title}
            </h1>
          </div>

          {/* Actions Rapides */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenQuickAdd(mission.id, 'activity')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Clock className="w-4 h-4 text-[#0f3854]" />
              <span>Pointer du temps</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickAdd(mission.id, 'expense')}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-700" />
              <span>+ Frais / Débours ({mission.expenses?.length || 0})</span>
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

              {/* FICHE DE GARDE COMPLÈTE — SYNTHESIS TABLE (Fidèle à Expertise File Register_2026) */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-[#0f3854]" />
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      Synthesis Table — Références, Garantie, Parties & Confrères
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingParties(!editingParties)}
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#0f3854] transition-colors cursor-pointer"
                  >
                    {editingParties ? 'Fermer l’édition' : '✎ Modifier la fiche de garde'}
                  </button>
                </div>

                {editingParties ? (
                  <form onSubmit={handleSavePartiesAndRefs} className="space-y-4 text-xs bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                    {/* Ligne 1 : Référence Interne, Référence Compagnie, Garantie, Réception, Date sinistre */}
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Réf. Interne (Code VP) *</label>
                        <input
                          type="text"
                          value={missionCodeEdit}
                          onChange={(e) => setMissionCodeEdit(e.target.value)}
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-mono font-bold text-[#0f3854]"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Réf. Compagnie (V/Réf.)</label>
                        <input
                          type="text"
                          value={clientRef}
                          onChange={(e) => setClientRef(e.target.value)}
                          placeholder="ex: 11161461"
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-amber-900 mb-1">Garantie / Nature *</label>
                        <select
                          value={guaranteeType}
                          onChange={(e) => setGuaranteeType(e.target.value as GuaranteeType)}
                          className="w-full rounded-lg border-amber-300 p-2 border bg-amber-50/60 font-bold text-amber-950"
                        >
                          <option value="RC">RC (Responsabilité Civile)</option>
                          <option value="Dommages">Dommages (Doma)</option>
                          <option value="TRME">TRME (Tous Risques Montage Essais)</option>
                          <option value="EAD">EAD (Expertise Amiable / Judiciaire)</option>
                          <option value="Autre">Autre garantie</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Réception mission</label>
                        <input
                          type="date"
                          value={receptionDateEdit}
                          onChange={(e) => setReceptionDateEdit(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Date du sinistre</label>
                        <input
                          type="date"
                          value={incidentDateEdit}
                          onChange={(e) => setIncidentDateEdit(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                    </div>

                    {/* Ligne 2 : Tribunal & Expert Judiciaire */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Tribunal (si judiciaire / référé)</label>
                        <input
                          type="text"
                          value={courtReference}
                          onChange={(e) => setCourtReference(e.target.value)}
                          placeholder="ex: TJ de Nanterre (RG 26/01420) ou -"
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Expert Judiciaire désigné</label>
                        <input
                          type="text"
                          value={judicialExpert}
                          onChange={(e) => setJudicialExpert(e.target.value)}
                          placeholder="ex: M. Jean-Paul Moreau (Expert près la Cour d'Appel) ou -"
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                    </div>

                    {/* Ligne 3 : Donneur d'ordre, Interlocuteur, Compagnie, Courtier */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block font-bold text-[#0f3854] mb-1">Donneur d'ordre (Facturé) *</label>
                        <input
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          required
                          placeholder="ex: AXA XL"
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Interlocuteur Donneur d'ordre</label>
                        <input
                          type="text"
                          value={clientContact}
                          onChange={(e) => setClientContact(e.target.value)}
                          placeholder="ex: Yannick DELAUNAY"
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Compagnie (si distincte)</label>
                        <input
                          type="text"
                          value={insurerCompany}
                          onChange={(e) => setInsurerCompany(e.target.value)}
                          placeholder="ex: AXA France IARD / Lloyd's"
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-medium text-slate-700">Courtier</label>
                          <button
                            type="button"
                            onClick={() => setBrokerName('N/A')}
                            className="text-[10px] font-bold text-slate-500 hover:text-[#0f3854]"
                          >
                            N/A
                          </button>
                        </div>
                        <input
                          type="text"
                          value={brokerName}
                          onChange={(e) => setBrokerName(e.target.value)}
                          placeholder="ex: Marsh / Willis ou N/A"
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                    </div>

                    {/* Ligne 4 : Assuré, Interlocuteur Assuré, Avocat, Adresse facturation */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">Assuré *</label>
                          <div className="space-x-1">
                            <button
                              type="button"
                              onClick={() => setInsuredParty(clientName)}
                              className="text-[10px] font-bold text-[#0f3854] hover:underline"
                            >
                              = Client
                            </button>
                            <button
                              type="button"
                              onClick={() => setInsuredParty('N/A')}
                              className="text-[10px] font-bold text-slate-400 hover:text-slate-700"
                            >
                              N/A
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={insuredParty}
                          onChange={(e) => setInsuredParty(e.target.value)}
                          required
                          placeholder="ex: ALSTOM"
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Interlocuteur Assuré</label>
                        <input
                          type="text"
                          value={insuredContact}
                          onChange={(e) => setInsuredContact(e.target.value)}
                          placeholder="ex: GARNIER / I DELTOMBE MOREIRA"
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Avocat (Client / Assuré)</label>
                        <input
                          type="text"
                          value={clientLawyer}
                          onChange={(e) => setClientLawyer(e.target.value)}
                          placeholder="ex: Me Durand"
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Adresse facturation Client</label>
                        <input
                          type="text"
                          value={billingAddress}
                          onChange={(e) => setBillingAddress(e.target.value)}
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                    </div>

                    {/* Ligne 5 : Sujet, Briève description & Analyse préliminaire */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Sujet (Intitulé du dossier) *</label>
                        <input
                          type="text"
                          value={missionTitleEdit}
                          onChange={(e) => setMissionTitleEdit(e.target.value)}
                          required
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Briève description du sinistre</label>
                        <textarea
                          rows={2}
                          value={missionSummaryEdit}
                          onChange={(e) => setMissionSummaryEdit(e.target.value)}
                          placeholder="Dommages constatés, contexte technique..."
                          className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-amber-900 mb-1">Analyse préliminaire / Commentaires</label>
                        <textarea
                          rows={2}
                          value={preliminaryAnalysis}
                          onChange={(e) => setPreliminaryAnalysis(e.target.value)}
                          placeholder="Vérifications de garanties, réserves, points de vigilance..."
                          className="w-full rounded-lg border-amber-300 p-2 border bg-amber-50/40"
                        />
                      </div>
                    </div>

                    {/* Ligne 6 : Tiers / Compagnie tiers / Expert tiers / Avocat tiers */}
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          Tiers, Compagnie tiers, Expert tiers & Avocat tiers ({adverseParties.length})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAdverseParties([
                              ...adverseParties,
                              {
                                id: `adv-${Date.now()}-${adverseParties.length + 1}`,
                                party_name: '',
                                insurer_name: '',
                                expert_firm: '',
                                expert_name: '',
                                lawyer_name: '',
                              },
                            ])
                          }
                          className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-[11px] font-semibold text-[#0f3854] hover:bg-slate-50"
                        >
                          + Ajouter un Tiers
                        </button>
                      </div>

                      {adverseParties.map((ap, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                          <input
                            type="text"
                            placeholder="Tiers (ex: SGP, VINCI)"
                            value={ap.party_name || ''}
                            onChange={(e) => {
                              const next = [...adverseParties];
                              next[idx] = { ...next[idx], party_name: e.target.value };
                              setAdverseParties(next);
                            }}
                            className="rounded border-slate-300 p-1.5 border text-xs font-bold"
                          />
                          <input
                            type="text"
                            placeholder="Compagnie tiers (ex: TRC, Allianz)"
                            value={ap.insurer_name || ''}
                            onChange={(e) => {
                              const next = [...adverseParties];
                              next[idx] = { ...next[idx], insurer_name: e.target.value };
                              setAdverseParties(next);
                            }}
                            className="rounded border-slate-300 p-1.5 border text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Expert tiers (ex: Stefan LAWRUK)"
                            value={ap.expert_name || ''}
                            onChange={(e) => {
                              const next = [...adverseParties];
                              next[idx] = { ...next[idx], expert_name: e.target.value };
                              setAdverseParties(next);
                            }}
                            className="rounded border-slate-300 p-1.5 border text-xs font-semibold text-[#0f3854]"
                          />
                          <input
                            type="text"
                            placeholder="Cabinet expert (ex: SARETEC)"
                            value={ap.expert_firm || ''}
                            onChange={(e) => {
                              const next = [...adverseParties];
                              next[idx] = { ...next[idx], expert_firm: e.target.value };
                              setAdverseParties(next);
                            }}
                            className="rounded border-slate-300 p-1.5 border text-xs"
                          />
                          <div className="flex items-center space-x-1">
                            <input
                              type="text"
                              placeholder="Avocat tiers"
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
                              title="Supprimer ce tiers"
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
                        Enregistrer la Synthesis Table
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4 text-xs">
                    {/* Bandeau supérieur : Référence Interne | Compagnie | Garantie | Réception | Date sinistre | Tribunal | Expert */}
                    <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 bg-slate-50/90 p-3 rounded-xl border border-slate-200/90">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Réf. Interne</span>
                        <span className="font-mono font-extrabold text-[#0f3854] text-xs">{mission.code}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Réf. Compagnie</span>
                        <span className="font-mono font-bold text-slate-800">{mission.case_reference || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-amber-700 block">Garantie</span>
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-extrabold text-[11px] border border-amber-300">
                          {mission.guarantee_type || 'RC'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Réception mission</span>
                        <span className="font-bold text-slate-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80 inline-block">
                          {(mission.reception_date || '').split('-').reverse().join('/') || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Date du sinistre</span>
                        <span className="font-semibold text-slate-800">
                          {(mission.incident_date || '').split('-').reverse().join('/') || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Tribunal</span>
                        <span className="font-medium text-slate-700 truncate block" title={mission.court_reference || '-'}>
                          {mission.court_reference || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Expert Judiciaire</span>
                        <span className="font-medium text-slate-700 truncate block" title={mission.judicial_expert || '-'}>
                          {mission.judicial_expert || '-'}
                        </span>
                      </div>
                    </div>

                    {/* Grille 3 colonnes : Donneur d'ordre / Assuré & Courtier / Tiers & Confrères */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Donneur d'ordre & Compagnie */}
                      <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#0f3854]">
                          Donneur d'ordre & Compagnie
                        </span>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-slate-500">Donneur d'ordre :</span>
                          <strong className="text-sm font-bold text-slate-900 text-right">{mission.insurance_client}</strong>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-slate-500">Interlocuteur :</span>
                          <span className="font-semibold text-[#0f3854] text-right">{mission.insurer_contact || '—'}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-slate-500">Compagnie :</span>
                          <span className="font-medium text-slate-800 text-right">{mission.insurer_company || '—'}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-slate-200/60">
                          <span className="text-slate-500">Courtier :</span>
                          <span className="font-medium text-slate-700 text-right">
                            {mission.broker_name || '—'}
                            {mission.broker_reference ? ` (${mission.broker_reference})` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Assuré & Avocat */}
                      <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Assuré & Conseil
                        </span>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-slate-500">Assuré :</span>
                          <strong className="text-sm font-bold text-slate-900 text-right">{mission.insured_party || '—'}</strong>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-slate-500">Interlocuteur :</span>
                          <span className="font-semibold text-[#0f3854] text-right">{mission.insured_contact || '—'}</span>
                        </div>
                        {mission.insured_reference && (
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-slate-500">Réf. Assuré :</span>
                            <span className="font-mono text-slate-700">{mission.insured_reference}</span>
                          </div>
                        )}
                        <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-slate-200/60">
                          <span className="text-slate-500">Avocat :</span>
                          <span className="font-medium text-slate-700 text-right">{mission.client_lawyer || '—'}</span>
                        </div>
                      </div>

                      {/* Tiers, Compagnie tiers, Expert tiers, Avocat tiers */}
                      <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Tiers & Confrères ({adverseParties.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingParties(true)}
                            className="text-[11px] font-semibold text-[#0f3854] hover:underline"
                          >
                            + Gérer les tiers
                          </button>
                        </div>
                        {adverseParties.length === 0 ? (
                          <p className="text-slate-400 italic">Aucun tiers renseigné.</p>
                        ) : (
                          <div className="space-y-2 divide-y divide-slate-200/60">
                            {adverseParties.map((ap, i) => (
                              <div key={i} className={i > 0 ? 'pt-1.5 space-y-0.5' : 'space-y-0.5'}>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900">Tiers {i + 1} : {ap.party_name}</span>
                                  {ap.insurer_name && (
                                    <span className="px-1.5 py-0.2 rounded bg-sky-50 text-[#0f3854] border border-sky-200 font-bold text-[10px]">
                                      Cie : {ap.insurer_name}
                                    </span>
                                  )}
                                </div>
                                {(ap.expert_name || ap.expert_firm) && (
                                  <p className="text-[#0f3854] font-medium text-[11px]">
                                    Expert tiers : {ap.expert_name || '—'} {ap.expert_firm ? `(${ap.expert_firm})` : ''}
                                  </p>
                                )}
                                {ap.lawyer_name && (
                                  <p className="text-slate-500 text-[11px]">Avocat tiers : {ap.lawyer_name}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Briève description & Analyse préliminaire */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Briève description du sinistre
                        </span>
                        <p className="text-slate-800 whitespace-pre-line font-medium">
                          {mission.summary || 'Aucune description renseignée.'}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">
                          Analyse préliminaire / Notes de cadrage
                        </span>
                        <p className="text-slate-800 whitespace-pre-line">
                          {mission.preliminary_analysis || 'Aucune note d’analyse préliminaire.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* TABLEAU DE BORD : OPÉRATIONS D'EXPERTISE | RAPPORTS | QUANTUM | FACTURES + PV DOMMAGES */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0f3854]">
                        Suivi chronologique : Opérations d'expertise · Rapports · Quantum · Factures
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Exactement comme dans votre tableau Excel (Synthesis Table) : suivez vos réunions, dates de rapports, quantum et factures associées.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingOperations(!editingOperations)}
                      className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#0f3854] self-start sm:self-auto cursor-pointer"
                    >
                      {editingOperations ? 'Fermer' : '✎ Mettre à jour le tableau / PV Dommages'}
                    </button>
                  </div>

                  {editingOperations ? (
                    <form onSubmit={handleSaveOperationsTable} className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse bg-white rounded-lg overflow-hidden border border-slate-200">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                              <th className="py-2 px-2 text-center w-20">Étape</th>
                              <th className="py-2 px-2 text-left">Date Opération d'expertise</th>
                              <th className="py-2 px-2 text-left">Date Rapport émis</th>
                              <th className="py-2 px-2 text-right">Quantum (€)</th>
                              <th className="py-2 px-2 text-left">N° Facture</th>
                              <th className="py-2 px-2 text-right">Montant Facture (€)</th>
                              <th className="py-2 px-2 text-left">Date Facture</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {operationsRows.map((row, idx) => (
                              <tr key={row.step}>
                                <td className="p-1.5 text-center font-bold text-slate-800 bg-slate-50">{row.step}</td>
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    placeholder="JJ/MM/AAAA"
                                    value={row.operation_date || ''}
                                    onChange={(e) => {
                                      const next = [...operationsRows];
                                      next[idx] = { ...next[idx], operation_date: e.target.value };
                                      setOperationsRows(next);
                                    }}
                                    className="w-full border border-slate-200 rounded px-2 py-1 bg-amber-50/40 font-medium"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    placeholder="JJ/MM/AAAA"
                                    value={row.report_date || ''}
                                    onChange={(e) => {
                                      const next = [...operationsRows];
                                      next[idx] = { ...next[idx], report_date: e.target.value };
                                      setOperationsRows(next);
                                    }}
                                    className="w-full border border-slate-200 rounded px-2 py-1 bg-amber-50/40 font-medium"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    placeholder="ex: 838222.02"
                                    value={row.quantum !== undefined && row.quantum !== null ? String(row.quantum) : ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const next = [...operationsRows];
                                      next[idx] = {
                                        ...next[idx],
                                        quantum: val.trim() === '' ? null : parseFloat(val.replace(',', '.')) || 0,
                                      };
                                      setOperationsRows(next);
                                    }}
                                    className="w-full border border-slate-200 rounded px-2 py-1 text-right font-mono"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    placeholder="ex: 2026-071"
                                    value={row.invoice_number || ''}
                                    onChange={(e) => {
                                      const next = [...operationsRows];
                                      next[idx] = { ...next[idx], invoice_number: e.target.value };
                                      setOperationsRows(next);
                                    }}
                                    className="w-full border border-slate-200 rounded px-2 py-1 font-mono font-bold text-[#0f3854]"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    placeholder="ex: 5105.16"
                                    value={row.invoice_amount !== undefined && row.invoice_amount !== null ? String(row.invoice_amount) : ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const next = [...operationsRows];
                                      next[idx] = {
                                        ...next[idx],
                                        invoice_amount: val.trim() === '' ? null : parseFloat(val.replace(',', '.')) || 0,
                                      };
                                      setOperationsRows(next);
                                    }}
                                    className="w-full border border-slate-200 rounded px-2 py-1 text-right font-semibold"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    placeholder="JJ/MM/AAAA"
                                    value={row.invoice_date || ''}
                                    onChange={(e) => {
                                      const next = [...operationsRows];
                                      next[idx] = { ...next[idx], invoice_date: e.target.value };
                                      setOperationsRows(next);
                                    }}
                                    className="w-full border border-slate-200 rounded px-2 py-1"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        <div className="flex items-center space-x-2">
                          <label className="font-bold text-slate-800">PV Dommages (Date ou statut) :</label>
                          <input
                            type="text"
                            placeholder="ex: 15/11/2026 ou XX/XX/2026"
                            value={pvDommagesDate}
                            onChange={(e) => setPvDommagesDate(e.target.value)}
                            className="border border-amber-300 bg-amber-50 rounded-lg px-2.5 py-1 font-bold text-slate-900"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setEditingOperations(false)}
                            className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-600"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 bg-[#0f3854] text-white rounded-lg font-bold"
                          >
                            Enregistrer le suivi
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-2">
                      <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700">
                              <th className="py-2 px-3 text-center font-bold w-24">Opérations d'expertise</th>
                              <th className="py-2 px-3 text-center font-bold">Date réunion / expertise</th>
                              <th className="py-2 px-3 text-center font-bold">Rapports</th>
                              <th className="py-2 px-3 text-right font-bold">Quantum</th>
                              <th className="py-2 px-3 text-center font-bold">N° Facture</th>
                              <th className="py-2 px-3 text-right font-bold">Montant Facture</th>
                              <th className="py-2 px-3 text-center font-bold">Date Facture</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {operationsRows.map((row) => {
                              const hasData =
                                row.operation_date ||
                                row.report_date ||
                                row.quantum !== null && row.quantum !== undefined ||
                                row.invoice_number;
                              const isDefinitif = row.step === 'Définitif';
                              return (
                                <tr
                                  key={row.step}
                                  className={`${isDefinitif ? 'bg-amber-50/60 font-semibold' : hasData ? 'bg-white' : 'bg-slate-50/30 text-slate-400'}`}
                                >
                                  <td className="py-2 px-3 text-center font-bold text-slate-800 border-r border-slate-100">
                                    {row.step}
                                  </td>
                                  <td className="py-2 px-3 text-center font-semibold text-[#0f3854] bg-amber-50/30">
                                    {row.operation_date || '—'}
                                  </td>
                                  <td className="py-2 px-3 text-center font-semibold text-[#0f3854] bg-amber-50/30">
                                    {row.report_date || '—'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                    {row.quantum !== null && row.quantum !== undefined
                                      ? `${Number(row.quantum).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`
                                      : '—'}
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono font-bold text-[#0f3854] bg-amber-50/30">
                                    {row.invoice_number || '—'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold text-slate-900 bg-amber-50/30">
                                    {row.invoice_amount !== null && row.invoice_amount !== undefined
                                      ? `${Number(row.invoice_amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`
                                      : '—'}
                                  </td>
                                  <td className="py-2 px-3 text-center text-slate-700 bg-amber-50/30">
                                    {row.invoice_date || '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs">
                        <span className="font-bold text-slate-800">PV Dommages :</span>
                        <span className="font-mono font-bold text-amber-950">
                          {mission.pv_dommages_date || pvDommagesDate || 'Non renseigné'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* POINTAGE DU DOSSIER (TEMPS) & FRAIS / DÉBOURS DU DOSSIER (CÔTE À CÔTE) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 1. POINTAGE DU TEMPS */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-[#0f3854]" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Pointage du temps ({mission.activities?.length || 0} lignes)
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowRatesDrawer(!showRatesDrawer)}
                        className="text-xs text-slate-500 hover:text-slate-800 px-2 py-0.5 rounded bg-slate-100"
                        title="Modifier les tarifs horaires et kilométriques de ce dossier"
                      >
                        {mission.custom_hourly_rate || 190} €/h
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenQuickAdd(mission.id, 'activity')}
                        className="px-2.5 py-1 rounded-lg bg-[#0f3854] text-white text-xs font-bold hover:bg-[#16496d] cursor-pointer"
                      >
                        + Pointer du temps
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
                    <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden text-xs max-h-72 overflow-y-auto">
                      {(mission.activities || []).map((act: any) => (
                        <div key={act.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 gap-2">
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 block truncate">
                              {ACTIVITY_CATEGORY_LABELS[act.category as keyof typeof ACTIVITY_CATEGORY_LABELS] || act.label}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {(act.date || '').split('-').reverse().join('/')}
                              {act.notes ? ` • ${act.notes}` : ''}
                            </span>
                          </div>
                          <div className="text-right flex items-center space-x-2 shrink-0">
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
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingActId(act.id);
                                    setEditActHours(String(act.hours));
                                  }}
                                  className="text-right hover:underline"
                                  title="Cliquer pour ajuster les heures"
                                >
                                  <span className="font-bold text-slate-900 block">
                                    {Number(act.total_ht).toFixed(2).replace('.', ',')} € HT
                                  </span>
                                  <span
                                    className={`text-[10px] font-semibold ${
                                      act.status === 'facture'
                                        ? 'text-emerald-700'
                                        : act.status === 'brouillon_facture'
                                        ? 'text-amber-700'
                                        : 'text-[#0f3854]'
                                    }`}
                                  >
                                    {act.hours}h •{' '}
                                    {act.status === 'facture'
                                      ? 'Facturé'
                                      : act.status === 'brouillon_facture'
                                      ? 'En brouillon'
                                      : 'À facturer'}
                                  </span>
                                </button>
                                {act.status !== 'facture' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteActivity(act.id)}
                                    className="text-slate-300 hover:text-rose-600 p-1"
                                    title="Supprimer ce pointage"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. FRAIS & DÉBOURS DU DOSSIER (Tous les frais rattachés au dossier : à facturer, en brouillon, facturés) */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Receipt className="w-4 h-4 text-emerald-700" />
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Frais & Débours du dossier ({mission.expenses?.length || 0})
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Total :{' '}
                        {((mission.expenses || []).reduce((s: number, e: any) => s + Number(e.total_ht || 0), 0))
                          .toFixed(2)
                          .replace('.', ',')}{' '}
                        € HT
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenQuickAdd(mission.id, 'expense')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer"
                      >
                        + Ajouter un frais / km
                      </button>
                    </div>
                  </div>

                  {(mission.expenses || []).length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl space-y-1.5">
                      <p>Aucun frais ou déplacement enregistré sur ce dossier.</p>
                      <button
                        type="button"
                        onClick={() => onOpenQuickAdd(mission.id, 'expense')}
                        className="text-emerald-700 font-bold hover:underline"
                      >
                        + Saisir un billet de train, hôtel, repas, péage ou km →
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden text-xs max-h-72 overflow-y-auto">
                      {(mission.expenses || []).map((exp: any) => (
                        <div key={exp.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 gap-2">
                          {editingExpId === exp.id ? (
                            <div className="flex flex-wrap items-center gap-1.5 w-full">
                              <input
                                type="text"
                                value={editExpLabel}
                                onChange={(e) => setEditExpLabel(e.target.value)}
                                className="flex-1 min-w-[140px] border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
                              />
                              <input
                                type="text"
                                value={editExpQty}
                                onChange={(e) => setEditExpQty(e.target.value)}
                                placeholder="Qté"
                                className="w-14 border border-slate-300 rounded px-1.5 py-1 text-center text-xs"
                              />
                              <input
                                type="text"
                                value={editExpUnitPrice}
                                onChange={(e) => setEditExpUnitPrice(e.target.value)}
                                placeholder="PU HT"
                                className="w-20 border border-slate-300 rounded px-1.5 py-1 text-right text-xs font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveExpenseEdit(exp)}
                                className="px-2 py-1 bg-emerald-700 text-white rounded text-[10px] font-bold"
                              >
                                OK
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingExpId(null)}
                                className="px-1.5 py-1 bg-slate-100 text-slate-600 rounded text-[10px]"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="min-w-0">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-semibold text-slate-900 truncate">{exp.label}</span>
                                  {exp.category !== 'km' && (
                                    <span
                                      className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-bold shrink-0"
                                      title="Ce débours est automatiquement synchronisé dans votre Livre Comptable (Frais liés aux dossiers)"
                                    >
                                      Sync Compta
                                    </span>
                                  )}
                                  {exp.receipt_path && (
                                    <a
                                      href={`/uploads/${exp.receipt_path}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[#0f3854] hover:underline text-[10px] font-bold shrink-0"
                                      title="Voir le justificatif joint"
                                    >
                                      [Justif]
                                    </a>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 block">
                                  {(exp.date || '').split('-').reverse().join('/')} • {exp.quantity} ×{' '}
                                  {Number(exp.unit_price).toFixed(2).replace('.', ',')} € HT
                                  {exp.vat_amount > 0 ? ` (TVA ${Number(exp.vat_amount).toFixed(2).replace('.', ',')} €)` : ''}
                                </span>
                              </div>

                              <div className="text-right flex items-center space-x-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingExpId(exp.id);
                                    setEditExpLabel(exp.label);
                                    setEditExpQty(String(exp.quantity));
                                    setEditExpUnitPrice(String(exp.unit_price));
                                  }}
                                  className="text-right hover:underline"
                                  title="Cliquer pour modifier ce frais"
                                >
                                  <span className="font-bold text-slate-900 block">
                                    {Number(exp.total_ht).toFixed(2).replace('.', ',')} € HT
                                  </span>
                                  <span
                                    className={`text-[10px] font-semibold ${
                                      exp.status === 'facture'
                                        ? 'text-emerald-700'
                                        : exp.status === 'brouillon_facture'
                                        ? 'text-amber-700'
                                        : 'text-[#0f3854]'
                                    }`}
                                  >
                                    {exp.status === 'facture'
                                      ? 'Facturé'
                                      : exp.status === 'brouillon_facture'
                                      ? 'En brouillon'
                                      : 'À facturer'}
                                  </span>
                                </button>
                                {exp.status !== 'facture' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteExpense(exp.id)}
                                    className="text-slate-300 hover:text-rose-600 p-1"
                                    title="Supprimer ce frais"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                      Toutes les notes d'honoraires émises sur {mission.code} (classées dans Finder sous <code className="font-mono text-slate-700">07_Factures_Honoraires</code>).
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
                          <th className="py-2.5 px-3 font-semibold">Numéro Global</th>
                          <th className="py-2.5 px-3 font-semibold">Date & Heure</th>
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
                          const timePart = inv.created_at && inv.created_at.includes('T')
                            ? inv.created_at.split('T')[1]?.slice(0, 5)
                            : null;
                          return (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-bold text-[#0f3854] font-mono">{inv.invoice_number}</td>
                              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                {(inv.date || '').split('-').reverse().join('/')}
                                {timePart && <span className="text-[10px] text-slate-400 ml-1">({timePart})</span>}
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
