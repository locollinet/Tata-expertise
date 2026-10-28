import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  FileText, 
  Upload, 
  Trash2, 
  CheckCircle, 
  ExternalLink, 
  ShieldCheck, 
  Plus, 
  Clock, 
  Image as ImageIcon,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase.js';
import { EvidenceItem } from '@shared/types.js';

interface FirebaseEvidenceManagerProps {
  missionId: string;
  missionCode: string;
  onRefreshLocal?: () => void;
}

export const FirebaseEvidenceManager: React.FC<FirebaseEvidenceManagerProps> = ({
  missionId,
  missionCode,
  onRefreshLocal,
}) => {
  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'photo' | 'document' | 'constat'>('all');
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [evidenceType, setEvidenceType] = useState<'photo' | 'document' | 'constat'>('photo');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isForReport, setIsForReport] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const collectionPath = `missions/${missionId}/evidences`;

  // Real-time Firestore sync
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, collectionPath));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: EvidenceItem[] = [];
        snapshot.forEach((doc) => {
          items.push(doc.data() as EvidenceItem);
        });
        // Sort by order_index or created_at
        items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        setEvidences(items);
        setLoading(false);
      },
      (error) => {
        console.warn('Firestore subscription error (using local cache or offline):', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [missionId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      if (file.type.startsWith('image/')) {
        setEvidenceType('photo');
        setPreviewUrl(URL.createObjectURL(file));
      } else if (file.type.includes('pdf')) {
        setEvidenceType('document');
        setPreviewUrl(null);
      }
    }
  };

  const handleSaveEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Veuillez sélectionner un fichier');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Veuillez saisir un intitulé');
      return;
    }

    setUploading(true);
    setErrorMsg(null);

    try {
      const user = auth.currentUser;
      const uid = user?.uid || 'user-expert-valentine';
      const evidenceId = `evid-${Date.now()}`;

      // Convert image to data URL for fast display and offline persistence
      let fileDataUrl = '';
      if (selectedFile.type.startsWith('image/')) {
        fileDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(selectedFile);
        });
      }

      // Also upload to local server static folder for DOCX report generator integration
      let serverPath = '';
      try {
        const formData = new FormData();
        formData.append('mission_id', missionId);
        formData.append('caption', caption || title);
        formData.append('photo', selectedFile);
        const res = await fetch('/api/photos', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          const json = await res.json();
          serverPath = json.filename || '';
          if (onRefreshLocal) onRefreshLocal();
        }
      } catch (err) {
        console.warn("Upload local serveur optionnel:", err);
      }

      const evidenceDoc: EvidenceItem = {
        id: evidenceId,
        mission_id: missionId,
        mission_code: missionCode,
        title: title.trim(),
        type: evidenceType,
        file_url: fileDataUrl || (serverPath ? `/uploads/${serverPath}` : ''),
        filename: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        caption: caption.trim() || title.trim(),
        taken_at: new Date().toISOString(),
        order_index: evidences.length + 1,
        is_selected_for_report: isForReport,
        created_by: uid,
        created_at: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, collectionPath, evidenceId), evidenceDoc);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `${collectionPath}/${evidenceId}`);
      }

      // Reset form
      setShowUploadModal(false);
      setSelectedFile(null);
      setTitle('');
      setCaption('');
      setPreviewUrl(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erreur lors de l'enregistrement de la preuve");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleReport = async (item: EvidenceItem) => {
    try {
      const docRef = doc(db, collectionPath, item.id);
      await updateDoc(docRef, {
        is_selected_for_report: !item.is_selected_for_report,
      });
    } catch (err) {
      console.warn("Mise à jour Firestore:", err);
    }
  };

  const handleDeleteEvidence = async (item: EvidenceItem) => {
    if (!confirm(`Supprimer définitivement la preuve "${item.title}" ?`)) return;
    try {
      await deleteDoc(doc(db, collectionPath, item.id));
    } catch (err) {
      console.warn("Suppression Firestore:", err);
    }
  };

  const filteredEvidences = evidences.filter((ev) => {
    if (activeFilter === 'all') return true;
    return ev.type === activeFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header card with action */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">
                Registre des Preuves Cloud & Clichés de Constatations
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Stockage pérenne certifié sur Google Cloud Firebase Firestore · Dossier {missionCode}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center space-x-2 bg-[#0f3854] hover:bg-[#16496d] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Déposer une preuve (Photo / PDF)</span>
            </button>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-slate-100">
          {[
            { id: 'all', label: `Toutes les preuves (${evidences.length})` },
            { id: 'photo', label: `Photos terrain (${evidences.filter(e => e.type === 'photo').length})` },
            { id: 'document', label: `Pièces PDF (${evidences.filter(e => e.type === 'document').length})` },
            { id: 'constat', label: `Constats (${evidences.filter(e => e.type === 'constat').length})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeFilter === f.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Evidence Items */}
      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f3854]"></div>
        </div>
      ) : filteredEvidences.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
          <Camera className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">Aucune preuve déposée pour ce dossier</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Déposez des photos haute définition de pièces mécaniques (essieux, bogies, rails, dalles) ou des pièces d'expertise PDF.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center space-x-1.5 bg-[#0f3854] text-white px-3.5 py-1.5 rounded-lg text-xs font-medium"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Déposer le premier document</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvidences.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col group hover:border-slate-300 transition-all"
            >
              {/* Media Preview */}
              <div className="h-44 bg-slate-100 relative overflow-hidden flex items-center justify-center border-b border-slate-100">
                {item.file_url && item.type === 'photo' ? (
                  <img
                    src={item.file_url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                  />
                ) : (
                  <div className="text-center p-4">
                    <FileText className="w-12 h-12 text-[#0f3854]/40 mx-auto mb-2" />
                    <span className="text-xs font-semibold text-slate-600 truncate block max-w-[200px]">
                      {item.filename}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                      {item.mime_type || 'Document PDF'}
                    </span>
                  </div>
                )}

                {/* Badge for report inclusion */}
                <button
                  onClick={() => handleToggleReport(item)}
                  title={item.is_selected_for_report ? "Sélectionnée pour le rapport Word" : "Non incluse dans le rapport"}
                  className={`absolute top-2 right-2 px-2 py-1 rounded-md text-[11px] font-semibold flex items-center space-x-1 shadow-xs transition-colors ${
                    item.is_selected_for_report
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/90 text-slate-600 hover:bg-white'
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>{item.is_selected_for_report ? 'Dans rapport' : 'Hors rapport'}</span>
                </button>
              </div>

              {/* Information body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{item.title}</h4>
                  {item.caption && (
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {item.caption}
                    </p>
                  )}
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
                    <Clock className="w-3 h-3" />
                    <span>Déposé le {new Date(item.created_at).toLocaleDateString('fr-FR')}</span>
                    {item.file_size && (
                      <>
                        <span>·</span>
                        <span>{Math.round(item.file_size / 1024)} Ko</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
                  {item.file_url ? (
                    <a
                      href={item.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[#0f3854] hover:underline flex items-center space-x-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Visualiser</span>
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Archivé</span>
                  )}

                  <button
                    onClick={() => handleDeleteEvidence(item)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                    title="Supprimer la preuve"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-[#0f3854]" />
                <h3 className="text-base font-bold text-slate-900">
                  Déposer une preuve sur Firebase Cloud
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveEvidence} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Type de pièce
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'photo', label: 'Photo terrain' },
                    { id: 'document', label: 'Document PDF' },
                    { id: 'constat', label: 'Constat / Dire' },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setEvidenceType(t.id as any)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                        evidenceType === t.id
                          ? 'bg-[#0f3854] text-white border-[#0f3854]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fichier à téléverser (Photo JPG/PNG ou Document PDF) *
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileSelect}
                  required
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0f3854] file:text-white hover:file:bg-[#16496d] cursor-pointer border border-slate-200 rounded-lg p-1.5"
                />
              </div>

              {previewUrl && (
                <div className="rounded-lg overflow-hidden border border-slate-200 max-h-40 flex items-center justify-center bg-slate-50">
                  <img src={previewUrl} alt="Aperçu" className="max-h-40 object-contain" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Intitulé de la preuve *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Cliché macro — Fissuration amorce d'essieu N°2"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3854]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Légende technique / Observations
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Ex: Constat contradictoire réalisé en présence des parties. Amorçage de fatigue sous charge cyclique..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3854]"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="includeReport"
                  checked={isForReport}
                  onChange={(e) => setIsForReport(e.target.checked)}
                  className="rounded text-[#0f3854] focus:ring-[#0f3854] h-4 w-4"
                />
                <label htmlFor="includeReport" className="text-xs text-slate-700 font-medium">
                  Inclure automatiquement cette photo dans le projet de rapport Word (.docx)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0f3854] hover:bg-[#16496d] rounded-lg shadow-2xs transition-colors flex items-center space-x-1.5"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>Enregistrer la preuve</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
