import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, Clock, Receipt, FileText, Mail, Train, Plus, Trash2, Download,
  CheckCircle2, AlertCircle, Save, ExternalLink, Calendar, Copy, Check,
  FolderOpen, UploadCloud, Paperclip, FileSpreadsheet, Eye, ShieldCheck, Sliders
} from 'lucide-react';
import { api } from '../api.js';
import { FirebaseEvidenceManager } from '../components/FirebaseEvidenceManager.js';
import { MissionRatesSettings } from '../components/MissionRatesSettings.js';

interface MissionDetailViewProps {
  missionId: string;
  onBack: () => void;
  onOpenQuickAdd: (missionId: string) => void;
  onPrepareBilling: (missionId: string) => void;
}

export const MissionDetailView: React.FC<MissionDetailViewProps> = ({
  missionId,
  onBack,
  onOpenQuickAdd,
  onPrepareBilling,
}) => {
  const [mission, setMission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const initialSubtab = new URLSearchParams(window.location.search).get('subtab') as 'overview' | 'time' | 'evidences' | 'rates' | 'docs' | 'report' | 'comms' | 'travel' | null;
  const [activeTab, setActiveTab] = useState<'overview' | 'time' | 'evidences' | 'rates' | 'docs' | 'report' | 'comms' | 'travel'>(initialSubtab || 'time');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Document Upload & Dropzone state
  const [docCategory, setDocCategory] = useState<string>('photo_terrain');
  const [docCaption, setDocCaption] = useState('');
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [docFilter, setDocFilter] = useState('all');

  // New attendee form state
  const [showAddAttendee, setShowAddAttendee] = useState(false);
  const [attName, setAttName] = useState('');
  const [attOrg, setAttOrg] = useState('');
  const [attRole, setAttRole] = useState('');
  const [attPresence, setAttPresence] = useState<'site' | 'visio'>('site');
  const [showBatchAttendees, setShowBatchAttendees] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchPresence, setBatchPresence] = useState<'site' | 'visio'>('visio');
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Report draft edit state
  const [reportFacts, setReportFacts] = useState('');
  const [reportObs, setReportObs] = useState('');
  const [reportAnalysis, setReportAnalysis] = useState('');
  const [reportConc, setReportConc] = useState('');
  const [rawFieldNotes, setRawFieldNotes] = useState('');
  const [reportSaved, setReportSaved] = useState(false);

  // New photo upload state
  const [showAddPhoto, setShowAddPhoto] = useState(false);
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // New communication form state
  const [showAddComm, setShowAddComm] = useState(false);
  const [commSender, setCommSender] = useState('');
  const [commSubject, setCommSubject] = useState('');
  const [commBody, setCommBody] = useState('');
  const [commUrgency, setCommUrgency] = useState<'normale' | 'urgente'>('normale');

  const loadData = async () => {
    try {
      const data = await api.getMission(missionId);
      setMission(data);
      if (data.report_draft) {
        setReportFacts(data.report_draft.section_facts || '');
        setReportObs(data.report_draft.section_observations || '');
        setReportAnalysis(data.report_draft.section_analysis || '');
        setReportConc(data.report_draft.section_conclusions || '');
        setRawFieldNotes(data.report_draft.raw_field_notes || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [missionId]);

  if (loading || !mission) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f3854]"></div>
      </div>
    );
  }

  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('mission_id', mission.id);
      formData.append('caption', photoCaption.trim() || photoFile.name);
      formData.append('photo', photoFile);

      const res = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de l'upload");
      }
      setPhotoFile(null);
      setPhotoCaption('');
      setShowAddPhoto(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleTogglePhotoReport = async (photo: any) => {
    try {
      await api.updatePhoto(photo.id, {
        is_selected_for_report: !photo.is_selected_for_report,
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Voulez-vous supprimer cette photo ?")) return;
    try {
      await api.deletePhoto(photoId);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUploadDocuments = async (filesToUpload: FileList | File[]) => {
    if (!filesToUpload || filesToUpload.length === 0) return;
    setUploadingDocs(true);
    try {
      const formData = new FormData();
      formData.append('category', docCategory);
      formData.append('caption', docCaption);
      for (let i = 0; i < filesToUpload.length; i++) {
        formData.append('files', filesToUpload[i]);
      }
      const res = await fetch(`/api/missions/${mission.id}/documents`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors du téléversement");
      }
      setDocCaption('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Voulez-vous supprimer cette pièce du dossier ?")) return;
    try {
      await api.deleteDocument(docId);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleDocReport = async (doc: any) => {
    try {
      await api.updateDocument(doc.id, {
        is_selected_for_report: !doc.is_selected_for_report,
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveReport = async () => {
    try {
      await api.updateReportDraft(mission.id, {
        title: `Projet de rapport d'expertise — ${mission.title}`,
        section_facts: reportFacts,
        section_observations: reportObs,
        section_analysis: reportAnalysis,
        section_conclusions: reportConc,
        raw_field_notes: rawFieldNotes,
      });
      setReportSaved(true);
      setTimeout(() => setReportSaved(false), 2500);
      loadData();
    } catch (err: any) {
      alert("Erreur lors de la sauvegarde du rapport : " + err.message);
    }
  };

  const handleBatchAttendees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchText.trim()) return;
    setBatchSubmitting(true);
    try {
      // Split by line or comma
      const lines = batchText
        .split(/[\n,]+/)
        .map(l => l.trim().replace(/^[-•*]\s*/, ''))
        .filter(l => l.length > 0);

      for (const line of lines) {
        // Match patterns like "Jean Dupont (SNCF)", "Jean Dupont - SNCF", or just "Jean Dupont"
        const match = line.match(/^([^(—\-]+?)(?:\s*[\(\[—\-]\s*([^\)\]]+)[\)\]]?)?$/);
        const name = match ? match[1].trim() : line;
        const org = (match && match[2]) ? match[2].trim() : (mission.client_contact || mission.insurance_client || 'Partie prenante');
        
        if (name) {
          await api.addAttendee({
            mission_id: mission.id,
            name,
            organization: org,
            role: 'Participant',
            present_on_site: batchPresence === 'site',
            present_remote: batchPresence === 'visio',
          });
        }
      }

      setBatchText('');
      setShowBatchAttendees(false);
      loadData();
    } catch (err: any) {
      alert("Erreur lors de l'ajout groupé : " + err.message);
    } finally {
      setBatchSubmitting(false);
    }
  };

  const handleAddAttendee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attName || !attOrg) return;
    try {
      await api.addAttendee({
        mission_id: mission.id,
        name: attName,
        organization: attOrg,
        role: attRole,
        present_on_site: attPresence === 'site',
        present_remote: attPresence === 'visio',
      });
      setAttName('');
      setAttOrg('');
      setAttRole('');
      setShowAddAttendee(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commSender || !commSubject || !commBody) return;
    try {
      await api.addCommunication({
        mission_id: mission.id,
        sender: commSender,
        subject: commSubject,
        body: commBody,
        urgency: commUrgency,
      });
      setCommSender('');
      setCommSubject('');
      setCommBody('');
      setShowAddComm(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCopyDraftReply = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const missionThreshold = mission.custom_billing_threshold || 3500;
  const hasHighUnbilled = (mission.total_unbilled_ht || 0) >= missionThreshold;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top navigation & back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux dossiers</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onOpenQuickAdd(mission.id)}
            className="inline-flex items-center space-x-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#0f3854]" />
            <span>+ Temps / Frais</span>
          </button>
          <button
            onClick={() => onPrepareBilling(mission.id)}
            className="inline-flex items-center space-x-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white px-3.5 py-1.5 rounded-lg text-xs font-medium shadow-2xs transition-colors"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Facturer ce dossier</span>
          </button>
        </div>
      </div>

      {/* Mission Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-base font-bold text-[#0f3854] bg-[#0f3854]/10 px-2.5 py-0.5 rounded-md">
                {mission.code}
              </span>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Réf : {mission.case_reference}
              </span>
              <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                Reçu le {mission.reception_date.split('-').reverse().join('/')}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 leading-snug">{mission.title}</h1>
            
            {/* Tariff strip with quick edit */}
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">Taux appliqués :</span>
              <span className="tabular-nums font-semibold text-slate-800">{mission.custom_hourly_rate || 190} €/h</span>
              <span>(expert)</span>
              <span>·</span>
              <span className="tabular-nums font-semibold text-slate-800">{mission.custom_travel_rate || 135} €/h</span>
              <span>(trajet)</span>
              <span>·</span>
              <span className="tabular-nums font-semibold text-slate-800">{mission.custom_km_rate || 0.95} €/km</span>
              <span>·</span>
              <span className="text-slate-500">Seuil d'alerte :</span>
              <span className="tabular-nums font-semibold text-slate-800">{missionThreshold.toLocaleString('fr-FR')} € HT</span>
              <button
                onClick={() => setActiveTab('rates')}
                className="ml-1 text-[11px] text-[#0f3854] hover:underline font-semibold"
              >
                (Modifier les taux)
              </button>
            </div>
          </div>

          {/* Quick unbilled badge */}
          <div className="text-right shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              En attente de facturation
            </span>
            <div className="flex items-baseline justify-end space-x-1 mt-0.5">
              <span className="text-lg font-bold text-slate-900">
                {(mission.total_unbilled_ht || 0).toFixed(2).replace('.', ',')} €
              </span>
              <span className="text-xs text-slate-500">HT</span>
            </div>
            <span className="text-[11px] text-slate-500 block">
              {(mission.unbilled_hours || 0).toFixed(1).replace('.', ',')} h à facturer
            </span>
          </div>
        </div>

        {/* Next action banner */}
        {mission.next_action && (
          <div className="mt-4 p-3 bg-sky-50/70 border border-sky-100 rounded-xl flex items-center justify-between text-xs text-sky-900">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                <span className="font-semibold">Prochaine action : </span>
                {mission.next_action}
              </span>
            </div>
            {mission.next_deadline && (
              <span className="font-medium bg-white px-2.5 py-0.5 rounded-full border border-sky-200 text-sky-800">
                Échéance : {mission.next_deadline.split('-').reverse().join('/')}
              </span>
            )}
          </div>
        )}

        {/* High billing alert */}
        {hasHighUnbilled && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <span className="font-semibold">Seuil de facturation dépassé : </span>
                {(mission.total_unbilled_ht || 0).toFixed(2).replace('.', ',')} € HT non facturés sur ce dossier (seuil d'alerte configuré : {missionThreshold.toLocaleString('fr-FR')} €).
              </span>
            </div>
            <button
              onClick={() => onPrepareBilling(mission.id)}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-lg shadow-2xs transition-colors shrink-0"
            >
              Préparer la note d'honoraires
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-2 mt-6 border-b border-slate-200 overflow-x-auto pb-px">
          {[
            { id: 'time', label: 'Temps & Frais', icon: Clock, count: (mission.activities?.length || 0) + (mission.expenses?.length || 0) },
            { id: 'evidences', label: 'Photos terrain & Émargements', icon: Camera },
            { id: 'rates', label: 'Tarifs & Seuil', icon: Sliders },
            { id: 'docs', label: 'Pièces & Documents', icon: FolderOpen, count: mission.documents?.length || 0 },
            { id: 'report', label: 'Notes techniques & Rapport', icon: FileText, count: mission.photos?.length || 0 },
            { id: 'comms', label: 'Dires, Convocations & Courriers', icon: Mail, count: mission.communications?.length || 0 },
            { id: 'travel', label: 'Visites sur site & Logistique', icon: Train, count: (mission.travels?.length || 0) + (mission.registered_mails?.length || 0) },
            { id: 'overview', label: 'Synthèse & Parties', icon: Calendar },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center space-x-1.5 py-2.5 px-3 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-[#0f3854] text-[#0f3854]'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
                {t.count !== undefined && t.count > 0 && (
                  <span className="ml-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-semibold">
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab: PREUVES CLOUD (FIREBASE) */}
      {activeTab === 'evidences' && (
        <FirebaseEvidenceManager
          missionId={mission.id}
          missionCode={mission.code}
          onRefreshLocal={loadData}
        />
      )}

      {/* Tab: TARIFS & SEUIL DOSSIER */}
      {activeTab === 'rates' && (
        <MissionRatesSettings
          mission={mission}
          onUpdated={loadData}
        />
      )}

      {/* Tab 1: TEMPS & FRAIS */}
      {activeTab === 'time' && (
        <div className="space-y-6">
          {/* Activities list */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#0f3854]" />
                <span>Pointages de temps ({mission.activities?.length || 0})</span>
              </h2>
              <button
                onClick={() => onOpenQuickAdd(mission.id)}
                className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter du temps</span>
              </button>
            </div>

            {mission.activities?.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Aucun temps pointé sur ce dossier.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                      <th className="py-2.5 px-3 font-semibold">Date</th>
                      <th className="py-2.5 px-3 font-semibold">Catégorie</th>
                      <th className="py-2.5 px-3 font-semibold">Libellé</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Heures</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Taux HT</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total HT</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mission.activities.map((act: any) => (
                      <tr key={act.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {act.date.split('-').reverse().join('/')}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-medium capitalize">
                          {act.category.replace('_', ' ')}
                        </td>
                        <td className="py-2 px-3 text-slate-900 font-medium">
                          {act.label}
                          {act.notes && <span className="block text-[11px] text-slate-400">{act.notes}</span>}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-slate-800">
                          {act.hours.toString().replace('.', ',')} h
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600">
                          {act.hourly_rate} €
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {act.total_ht.toFixed(2).replace('.', ',')} €
                        </td>
                        <td className="py-2 px-3 text-center">
                          {act.status === 'facture' ? (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">Facturé</span>
                          ) : act.status === 'reserve' ? (
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">Réservé brouillon</span>
                          ) : (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">À facturer</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Expenses list */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Notes de frais & Déplacements ({mission.expenses?.length || 0})</span>
              </h2>
              <button
                onClick={() => onOpenQuickAdd(mission.id)}
                className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter un frais</span>
              </button>
            </div>

            {mission.expenses?.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Aucun frais rattaché à ce dossier.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                      <th className="py-2.5 px-3 font-semibold">Date</th>
                      <th className="py-2.5 px-3 font-semibold">Nature</th>
                      <th className="py-2.5 px-3 font-semibold">Libellé</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Qté</th>
                      <th className="py-2.5 px-3 font-semibold text-right">P.U. HT</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total HT</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total TTC</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mission.expenses.map((exp: any) => (
                      <tr key={exp.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {exp.date.split('-').reverse().join('/')}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-medium capitalize">
                          {exp.category === 'km' ? 'Kilomètres' : exp.category}
                        </td>
                        <td className="py-2 px-3 text-slate-900 font-medium">
                          {exp.label}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-slate-800">
                          {exp.quantity}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600">
                          {exp.unit_price.toFixed(2).replace('.', ',')} €
                        </td>
                        <td className="py-2 px-3 text-right text-slate-700">
                          {exp.total_ht.toFixed(2).replace('.', ',')} €
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-800">
                          {exp.total_ttc.toFixed(2).replace('.', ',')} €
                        </td>
                        <td className="py-2 px-3 text-center">
                          {exp.status === 'facture' ? (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">Facturé</span>
                          ) : exp.status === 'reserve' ? (
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">Réservé</span>
                          ) : (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">À facturer</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: PIÈCES & DOCUMENTS DU DOSSIER */}
      {activeTab === 'docs' && (
        <div className="space-y-6">
          {/* Universal Dropzone Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <FolderOpen className="w-4 h-4 text-[#0f3854]" />
                  <span>Dépôt de documents & pièces justificatives</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Injectez vos photos de terrain, captures d'écran, rapports PDF, dires d'avocats, feuilles d'émargement ou justificatifs.
                </p>
              </div>
            </div>

            {/* Drag and Drop Container */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleUploadDocuments(e.dataTransfer.files);
                }
              }}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                isDragging
                  ? 'border-[#0f3854] bg-sky-50/60 scale-[1.01]'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              }`}
            >
              <UploadCloud className="w-10 h-10 text-[#0f3854] mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-800">
                Glissez-déposez vos fichiers ici (Photos, Captures, PDF, Word, Excel...)
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-3">
                ou sélectionnez des fichiers depuis votre ordinateur ou smartphone
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto">
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className="text-xs rounded-lg border-slate-300 bg-white py-1.5 px-2.5 border text-slate-700 w-full sm:w-auto"
                >
                  <option value="photo_terrain">Photo / Cliché terrain</option>
                  <option value="capture_ecran">Capture d'écran (visio, note)</option>
                  <option value="procedure_dires">Pièce de procédure / Dires</option>
                  <option value="emargement_pv">Feuille d'émargement / PV</option>
                  <option value="note_technique">Note technique / Rapport</option>
                  <option value="justificatif_frais">Justificatif de frais</option>
                  <option value="autre">Autre document</option>
                </select>

                <input
                  type="text"
                  value={docCaption}
                  onChange={(e) => setDocCaption(e.target.value)}
                  placeholder="Légende ou description (facultatif)"
                  className="text-xs rounded-lg border-slate-300 bg-white py-1.5 px-2.5 border text-slate-700 w-full sm:flex-1"
                />

                <label className="cursor-pointer px-4 py-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0 flex items-center space-x-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>{uploadingDocs ? "Envoi..." : "Parcourir"}</span>
                  <input
                    type="file"
                    multiple
                    disabled={uploadingDocs}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleUploadDocuments(e.target.files);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Documents Gallery & Filter */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900">
                Documents rattachés au dossier ({mission.documents?.length || 0})
              </h3>

              {/* Filter pills */}
              <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
                {[
                  { id: 'all', label: 'Tous' },
                  { id: 'photo_terrain', label: 'Photos' },
                  { id: 'capture_ecran', label: 'Captures' },
                  { id: 'procedure_dires', label: 'Dires & Procédure' },
                  { id: 'emargement_pv', label: 'Émargement & PV' },
                  { id: 'note_technique', label: 'Notes & Rapports' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setDocFilter(f.id)}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                      docFilter === f.id
                        ? 'bg-[#0f3854] text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {mission.documents?.length === 0 ? (
              <div className="p-8 text-center border border-slate-100 rounded-xl bg-slate-50/50 text-slate-400 text-xs space-y-1">
                <Paperclip className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                <p className="font-semibold text-slate-600">Aucun document rattaché pour le moment</p>
                <p>Déposez des photos, des captures ou des PDF ci-dessus pour les centraliser dans ce dossier.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {mission.documents
                  ?.filter((d: any) => docFilter === 'all' || d.category === docFilter)
                  .map((doc: any) => {
                    const isImg = doc.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(doc.filename);
                    const isPdf = doc.mime_type?.includes('pdf') || /\.pdf$/i.test(doc.filename);
                    const isDocx = /\.docx?$/i.test(doc.filename);
                    const isXlsx = /\.xlsx?$/i.test(doc.filename);
                    const formattedSize = doc.file_size ? `${Math.round(doc.file_size / 1024)} Ko` : '';

                    return (
                      <div
                        key={doc.id}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between text-xs space-y-2 hover:border-slate-300 transition-all group"
                      >
                        {/* Preview / Icon thumbnail */}
                        <div className="aspect-video bg-white rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center relative">
                          {isImg ? (
                            <img
                              src={`/uploads/${doc.filename}`}
                              alt={doc.caption}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : isPdf ? (
                            <div className="text-center p-2">
                              <span className="text-rose-600 font-extrabold text-xs block uppercase bg-rose-50 px-2 py-1 rounded border border-rose-200">PDF</span>
                              <span className="text-[10px] text-slate-500 mt-1 block truncate max-w-[140px]">{doc.original_name}</span>
                            </div>
                          ) : isDocx ? (
                            <div className="text-center p-2">
                              <span className="text-sky-600 font-extrabold text-xs block uppercase bg-sky-50 px-2 py-1 rounded border border-sky-200">DOCX</span>
                              <span className="text-[10px] text-slate-500 mt-1 block truncate max-w-[140px]">{doc.original_name}</span>
                            </div>
                          ) : isXlsx ? (
                            <div className="text-center p-2">
                              <span className="text-emerald-600 font-extrabold text-xs block uppercase bg-emerald-50 px-2 py-1 rounded border border-emerald-200">EXCEL</span>
                              <span className="text-[10px] text-slate-500 mt-1 block truncate max-w-[140px]">{doc.original_name}</span>
                            </div>
                          ) : (
                            <div className="text-center p-2">
                              <Paperclip className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                              <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">{doc.original_name}</span>
                            </div>
                          )}

                          {/* Quick preview overlay */}
                          <a
                            href={`/uploads/${doc.filename}`}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                            title="Ouvrir le fichier"
                          >
                            <Eye className="w-5 h-5 drop-shadow" />
                          </a>
                        </div>

                        {/* Title and metadata */}
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-slate-900 truncate" title={doc.caption || doc.original_name}>
                              {doc.caption || doc.original_name}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                            <span className="capitalize">{doc.category.replace('_', ' ')}</span>
                            <span>{formattedSize}</span>
                          </div>
                        </div>

                        {/* Toggle for Report inclusion if image */}
                        {isImg && (
                          <label className="flex items-center space-x-1.5 cursor-pointer pt-1 border-t border-slate-200 text-slate-600">
                            <input
                              type="checkbox"
                              checked={doc.is_selected_for_report === 1 || doc.is_selected_for_report === true}
                              onChange={() => handleToggleDocReport(doc)}
                              className="rounded border-slate-300 text-[#0f3854] focus:ring-[#0f3854]"
                            />
                            <span className="text-[10px] font-medium">Inclure au rapport Word</span>
                          </label>
                        )}

                        {/* Actions footer */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px]">
                          <a
                            href={`/uploads/${doc.filename}`}
                            download={doc.original_name}
                            className="text-[#0f3854] hover:underline font-medium inline-flex items-center space-x-0.5"
                          >
                            <Download className="w-3 h-3" />
                            <span>Télécharger</span>
                          </a>

                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors"
                            title="Supprimer la pièce"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: NOTES, PHOTOS & RAPPORT */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* Attendees section */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Participants aux réunions & opérations ({mission.attendees?.length || 0})</h3>
                <p className="text-xs text-slate-500">Réutilisés automatiquement dans le rapport d'expertise pour éviter les ressaisies.</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => { setShowBatchAttendees(!showBatchAttendees); setShowAddAttendee(false); }}
                  className="inline-flex items-center space-x-1 bg-sky-50 hover:bg-sky-100 text-[#0f3854] border border-sky-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  <span>+ Coller liste (Visio / Émargement)</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddAttendee(!showAddAttendee); setShowBatchAttendees(false); }}
                  className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter un par un</span>
                </button>
              </div>
            </div>

            {/* Batch Attendees Form (From visio screenshot or attendance sheet) */}
            {showBatchAttendees && (
              <form onSubmit={handleBatchAttendees} className="p-4 bg-sky-50/60 border border-sky-200 rounded-xl space-y-3 text-xs animate-in fade-in">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold">
                      Collez la liste des participants (un par ligne ou séparés par des virgules) :
                    </label>
                    <span className="text-[11px] text-slate-500">Formats reconnus : Nom (Société) ou Nom - Société</span>
                  </div>
                  <textarea
                    rows={4}
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder={`Exemple :\nPhilippe Robert (SNCF Voyageurs)\nMarc Dupuis - Regiorail\nAntoine Chenu (Europorte)\nSophie Blanc (Bessé)`}
                    required
                    className="w-full rounded-md border-slate-300 text-xs py-2 px-2.5 bg-white border font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={batchPresence === 'visio'}
                        onChange={() => setBatchPresence('visio')}
                        className="text-[#0f3854]"
                      />
                      <span className="font-medium text-slate-700">En visio-conférence (Écran de visio)</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={batchPresence === 'site'}
                        onChange={() => setBatchPresence('site')}
                        className="text-[#0f3854]"
                      />
                      <span className="font-medium text-slate-700">Présents sur site (Feuille d'émargement)</span>
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowBatchAttendees(false)}
                      disabled={batchSubmitting}
                      className="px-3 py-1.5 border border-slate-300 rounded text-slate-600 bg-white hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={batchSubmitting || !batchText.trim()}
                      className="px-4 py-1.5 bg-[#0f3854] text-white rounded font-medium disabled:bg-slate-300"
                    >
                      {batchSubmitting ? "Import en cours..." : "Importer les participants"}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {showAddAttendee && (
              <form onSubmit={handleAddAttendee} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Nom & Prénom *</label>
                    <input
                      type="text"
                      value={attName}
                      onChange={(e) => setAttName(e.target.value)}
                      placeholder="ex: Jean Dupont"
                      required
                      className="w-full rounded-md border-slate-300 text-xs py-1.5 px-2 bg-white border"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Organisme / Partie *</label>
                    <input
                      type="text"
                      value={attOrg}
                      onChange={(e) => setAttOrg(e.target.value)}
                      placeholder="ex: SNCF Réseau / Alstom"
                      required
                      className="w-full rounded-md border-slate-300 text-xs py-1.5 px-2 bg-white border"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Qualité / Rôle</label>
                    <input
                      type="text"
                      value={attRole}
                      onChange={(e) => setAttRole(e.target.value)}
                      placeholder="ex: Expert technique"
                      className="w-full rounded-md border-slate-300 text-xs py-1.5 px-2 bg-white border"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={attPresence === 'site'}
                        onChange={() => setAttPresence('site')}
                        className="text-[#0f3854]"
                      />
                      <span>Présent sur site</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={attPresence === 'visio'}
                        onChange={() => setAttPresence('visio')}
                        className="text-[#0f3854]"
                      />
                      <span>En visio-conférence</span>
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAttendee(false)}
                      className="px-3 py-1 border border-slate-300 rounded text-slate-600"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-[#0f3854] text-white rounded font-medium"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {mission.attendees?.map((att: any) => (
                <div key={att.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{att.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      att.present_on_site ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                    }`}>
                      {att.present_on_site ? 'Sur site' : 'Visio'}
                    </span>
                  </div>
                  <p className="text-slate-600 font-medium">{att.organization}</p>
                  {att.role && <p className="text-slate-400">{att.role}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Photo Gallery & Field Clichés */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Photographies & Clichés de terrain ({mission.photos?.length || 0})</h3>
                <p className="text-xs text-slate-500">Sélectionnez et légendez les photographies à incorporer au rapport Word.</p>
              </div>
              <button
                onClick={() => setShowAddPhoto(!showAddPhoto)}
                className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter une photo</span>
              </button>
            </div>

            {showAddPhoto && (
              <form onSubmit={handleUploadPhoto} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Fichier image (JPG, PNG) *</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)}
                      required
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-white file:text-slate-700 file:border file:border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Légende du cliché *</label>
                    <input
                      type="text"
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                      placeholder="ex: Vue générale du bogie avant gauche"
                      className="w-full rounded-md border-slate-300 text-xs py-1.5 px-2 bg-white border"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPhoto(false)}
                    className="px-3 py-1 border border-slate-300 rounded text-slate-600"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingPhoto || !photoFile}
                    className="px-4 py-1 bg-[#0f3854] text-white rounded font-medium disabled:bg-slate-300"
                  >
                    {uploadingPhoto ? "Téléversement..." : "Ajouter la photo"}
                  </button>
                </div>
              </form>
            )}

            {mission.photos?.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Aucune photo enregistrée pour ce dossier.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {mission.photos.map((photo: any) => (
                  <div key={photo.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                    <div className="aspect-video bg-slate-200 rounded-lg overflow-hidden relative">
                      <img
                        src={`/uploads/${photo.filename}`}
                        alt={photo.caption}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback icon placeholder if image file not on disk
                          (e.target as any).style.display = 'none';
                        }}
                      />
                    </div>

                    <div className="flex items-start justify-between gap-1">
                      <p className="font-medium text-slate-800 line-clamp-2">{photo.caption}</p>
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Supprimer la photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <label className="flex items-center space-x-1.5 cursor-pointer pt-1 border-t border-slate-200 text-slate-600">
                      <input
                        type="checkbox"
                        checked={photo.is_selected_for_report === 1 || photo.is_selected_for_report === true}
                        onChange={() => handleTogglePhotoReport(photo)}
                        className="rounded border-slate-300 text-[#0f3854] focus:ring-[#0f3854]"
                      />
                      <span className="text-[11px] font-medium">Intégrer au rapport Word</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sas Apple Notes (Notes brutes de terrain) */}
          <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200/90 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <h3 className="text-sm font-bold text-slate-900">Sas de notes brutes de terrain (Apple Notes / Dictée vocale)</h3>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Collez vos notes prises sur le pouce sur iPhone en vrac. Conservez-les ici comme mémoire vive ou injectez-les directement dans les constatations du rapport.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (!rawFieldNotes.trim()) return;
                    setReportObs(prev => prev ? `${prev}\n\n--- Extrait Notes Terrain ---\n${rawFieldNotes}` : rawFieldNotes);
                    alert("Notes insérées dans le paragraphe 2 (Constatations matérielles) !");
                  }}
                  disabled={!rawFieldNotes.trim()}
                  className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
                  title="Copie le texte des notes brutes dans la section 2 du rapport ci-dessous"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                  <span>Insérer dans Constatations</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveReport}
                  className="inline-flex items-center space-x-1 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Sauvegarder</span>
                </button>
              </div>
            </div>

            <textarea
              rows={4}
              value={rawFieldNotes}
              onChange={(e) => setRawFieldNotes(e.target.value)}
              placeholder="Collez ici votre note iPhone brute (ex: 'Rendez-vous gare de triage 14h. Bogie avant droit fissuré au niveau de la crapaudine. Vitesse estimée 24 km/h lors du déraillement. Pièces saisies : boulon de fixation cisaillé. Voir photos 1 à 4...')"
              className="w-full text-xs rounded-xl border border-amber-200 bg-white p-3 font-sans text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          </div>

          {/* Structured Draft Report Editor */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Éditeur du projet de rapport technique (Trame personnalisable)</h3>
                <p className="text-xs text-slate-500">Exportable en document Word (.docx) avec vos participants et vos photos sélectionnées.</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveReport}
                  className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  {reportSaved ? <Check className="w-4 h-4 text-emerald-600" /> : <Save className="w-4 h-4" />}
                  <span>{reportSaved ? "Enregistré !" : "Sauvegarder"}</span>
                </button>

                <a
                  href={`/api/reports/${mission.id}/docx`}
                  download
                  className="inline-flex items-center space-x-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger le DOCX</span>
                </a>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  1. Rappel des faits & Cadre contractuel
                </label>
                <textarea
                  rows={3}
                  value={reportFacts}
                  onChange={(e) => setReportFacts(e.target.value)}
                  placeholder="Date, lieu, convoi impliqué, circonstances du sinistre..."
                  className="w-full text-xs rounded-lg border-slate-200 focus:border-[#0f3854] focus:ring-[#0f3854] p-2.5 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  2. Constatations matérielles & Visite sur site
                </label>
                <textarea
                  rows={4}
                  value={reportObs}
                  onChange={(e) => setReportObs(e.target.value)}
                  placeholder="État des matériels, bogies, rails, organes de choc et de traction, mesures relevées..."
                  className="w-full text-xs rounded-lg border-slate-200 focus:border-[#0f3854] focus:ring-[#0f3854] p-2.5 bg-slate-50/50"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#0f3854] uppercase tracking-wider">
                    3. Analyse technique & Examen des responsabilités (Contrôle experte)
                  </label>
                  <span className="text-[10px] text-slate-400 italic">Section réservée au jugement de l'experte</span>
                </div>
                <textarea
                  rows={5}
                  value={reportAnalysis}
                  onChange={(e) => setReportAnalysis(e.target.value)}
                  placeholder="Analyse métallurgique, conformité aux référentiels SNCF / EPSF, examen des causes racines..."
                  className="w-full text-xs rounded-lg border-sky-200 focus:border-[#0f3854] focus:ring-[#0f3854] p-2.5 bg-sky-50/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  4. Conclusions provisoires & Recommandations
                </label>
                <textarea
                  rows={3}
                  value={reportConc}
                  onChange={(e) => setReportConc(e.target.value)}
                  placeholder="Propositions de dires, investigations complémentaires ou protocoles d'accord..."
                  className="w-full text-xs rounded-lg border-slate-200 focus:border-[#0f3854] focus:ring-[#0f3854] p-2.5 bg-slate-50/50"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: COMMUNICATIONS */}
      {activeTab === 'comms' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Espace d'échanges & Concentration</h3>
              <p className="text-xs text-slate-500">Rattachez vos emails utiles au dossier et préparez vos réponses sans interruption.</p>
            </div>
            <button
              onClick={() => setShowAddComm(!showAddComm)}
              className="inline-flex items-center space-x-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white px-3.5 py-1.5 rounded-lg text-xs font-medium shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Rattacher un message</span>
            </button>
          </div>

          {showAddComm && (
            <form onSubmit={handleAddComm} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs">
              <h4 className="font-bold text-slate-800 text-sm">Nouveau message rattaché</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Expéditeur *</label>
                  <input
                    type="text"
                    value={commSender}
                    onChange={(e) => setCommSender(e.target.value)}
                    placeholder="ex: Jean Dupont <j.dupont@alstom.com>"
                    required
                    className="w-full rounded-md border-slate-300 text-xs py-1.5 px-2 bg-white border"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Priorité</label>
                  <select
                    value={commUrgency}
                    onChange={(e: any) => setCommUrgency(e.target.value)}
                    className="w-full rounded-md border-slate-300 text-xs py-1.5 px-2 bg-white border"
                  >
                    <option value="normale">Normale</option>
                    <option value="urgente">Urgente (Alerte sur cockpit)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Objet *</label>
                <input
                  type="text"
                  value={commSubject}
                  onChange={(e) => setCommSubject(e.target.value)}
                  placeholder="ex: Transmission note technique"
                  required
                  className="w-full rounded-md border-slate-300 text-xs py-1.5 px-2 bg-white border"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Contenu du message ou extrait .eml *</label>
                <textarea
                  rows={4}
                  value={commBody}
                  onChange={(e) => setCommBody(e.target.value)}
                  placeholder="Copier-coller le texte du mail..."
                  required
                  className="w-full rounded-md border-slate-300 text-xs p-2 bg-white border"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddComm(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0f3854] text-white rounded font-medium"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {mission.communications?.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
                Aucun message rattaché à ce dossier.
              </div>
            ) : (
              mission.communications.map((comm: any) => (
                <div key={comm.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">{comm.subject}</span>
                        {comm.urgency === 'urgente' && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Urgent
                          </span>
                        )}
                        <span className="text-slate-400 text-xs">{comm.date}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">De : {comm.sender}</p>
                    </div>

                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md capitalize">
                      {comm.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 whitespace-pre-line bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {comm.body}
                  </p>

                  {/* Draft Reply Assistant */}
                  {comm.draft_reply && (
                    <div className="p-3.5 bg-sky-50/60 border border-sky-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0f3854] flex items-center space-x-1.5">
                          <span>Brouillon de réponse suggéré (à relire et envoyer) :</span>
                        </span>
                        <button
                          onClick={() => handleCopyDraftReply(comm.id, comm.draft_reply)}
                          className="inline-flex items-center space-x-1 text-xs text-[#0f3854] hover:text-[#174d71] font-semibold"
                        >
                          {copiedId === comm.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === comm.id ? "Copié !" : "Copier le texte"}</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-800 whitespace-pre-line bg-white p-2.5 rounded-lg border border-sky-100">
                        {comm.draft_reply}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: VISITES SUR SITE & LRAR */}
      {activeTab === 'travel' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Train className="w-4 h-4 text-indigo-600" />
              <span>Visites de chantier & Interventions sur site ({mission.travels?.length || 0})</span>
            </h3>

            {mission.travels?.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Aucune visite sur site enregistrée pour ce dossier.</p>
            ) : (
              <div className="space-y-3">
                {mission.travels.map((travel: any) => (
                  <div key={travel.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{travel.destination}</span>
                      <span className="bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full text-[10px]">
                        Du {travel.start_date.split('-').reverse().join('/')} au {travel.end_date.split('-').reverse().join('/')}
                      </span>
                    </div>
                    {travel.train_info && (
                      <p className="text-slate-600">
                        <span className="font-semibold text-slate-500">Trajet : </span>
                        {travel.train_info}
                      </p>
                    )}
                    {travel.notes && (
                      <p className="text-slate-600">
                        <span className="font-semibold text-slate-500">Consignes : </span>
                        {travel.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Mail className="w-4 h-4 text-slate-600" />
              <span>Suivi des courriers recommandés (LRAR) ({mission.registered_mails?.length || 0})</span>
            </h3>

            {mission.registered_mails?.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Aucun courrier recommandé enregistré.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {mission.registered_mails.map((mail: any) => (
                  <div key={mail.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{mail.recipient}</p>
                      <p className="text-slate-600">{mail.subject}</p>
                      {mail.tracking_number && (
                        <p className="text-slate-400 text-[11px] font-mono">N° suivi : {mail.tracking_number}</p>
                      )}
                    </div>
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold capitalize">
                      {mail.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: SYNTHÈSE & PARTIES */}
      {activeTab === 'overview' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <h3 className="text-sm font-bold text-slate-900">Fiche de Synthèse du Sinistre</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Description du sinistre</span>
                <p className="text-slate-800 font-medium mt-1">{mission.description || "—"}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Cadre judiciaire / Juridiction</span>
                <p className="text-slate-800 font-medium mt-1">{mission.court_reference || "Cadre amiable"}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Adresse de facturation</span>
                <p className="text-slate-800 font-medium mt-1 whitespace-pre-line">{mission.billing_address || "Non renseignée"}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Tarifs applicables au dossier</span>
                <p className="text-slate-800 font-medium mt-1">
                  Expertise & Rédaction : {mission.custom_hourly_rate || 190} €/h HT<br />
                  Temps de déplacement : {mission.custom_travel_rate || 135} €/h HT<br />
                  Frais kilométriques : {mission.custom_km_rate || 0.95} €/km
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
