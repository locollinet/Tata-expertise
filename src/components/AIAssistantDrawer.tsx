import React, { useState, useRef, useEffect } from 'react';
import {
  Bot, Sparkles, Send, X, Copy, Check, RotateCcw, AlertCircle,
  ChevronRight, Camera, Paperclip, FileText, Receipt, FolderPlus,
  ArrowRight, UploadCloud, CheckCircle2
} from 'lucide-react';
import { api } from '../api.js';
import { Mission } from '@shared/types.js';

interface ActionCardData {
  action_type: 'expense' | 'document' | 'new_mission' | 'activity';
  confidence: number;
  matched_mission_id?: string | null;
  matched_mission_code?: string | null;
  summary: string;
  filename?: string | null;
  original_filename?: string | null;
  payload: {
    date?: string;
    category?: string;
    label?: string;
    supplier?: string;
    amount_ht?: number;
    vat_rate?: number;
    vat_amount?: number;
    total_ttc?: number;
    notes?: string;
    document_title?: string;
    document_category?: string;
    deadline?: string;
    new_mission_title?: string;
    new_mission_case_reference?: string;
    new_mission_client?: string;
    new_mission_insured?: string;
    new_mission_court?: string;
    hours?: number;
  };
  committed?: boolean;
  committedMessage?: string;
  cancelled?: boolean;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  model?: string;
  hasKey?: boolean;
  attachedFile?: { name: string; size: number; url?: string };
  actionCard?: ActionCardData;
}

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMissionId?: string | null;
  missions?: Mission[];
  onNavigateToMission?: (codeOrId: string) => void;
  onOpenCreateMissionWithData?: (data: any) => void;
  onRefreshData?: () => void;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  selectedMissionId,
  missions = [],
  onNavigateToMission,
  onOpenCreateMissionWithData,
  onRefreshData,
}) => {
  const currentMission = selectedMissionId
    ? missions.find((m) => m.id === selectedMissionId)
    : null;

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittingActionId, setSubmittingActionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Bonjour Valentine !\n\nJe suis votre **assistant opérationnel & terrain VP Expertise**.\n\nVous pouvez :\n* 📷 **Prendre en photo un reçu de train ou note de frais** (reçu CB, billet SNCF, hôtel, repas) pour l'enregistrer en 1 clic.\n* 📄 **Déposer un Dire d'avocat ou un PV** pour l'analyser et le classer dans le bon dossier.\n* 💬 **Me poser des questions libres** sur vos seuils de facturation, échéances ou chiffre d'affaires.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, selectedFile]);

  // Clean preview blob URL on unmount or file change
  useEffect(() => {
    return () => {
      if (filePreview && filePreview.startsWith('blob:')) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  if (!isOpen) return null;

  // Client-side lightweight image compression (turns 5MB phone photos into ~250KB in 50ms)
  const compressImageIfNeeded = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/') || file.size < 400 * 1024) {
      return file;
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX = 1600;
          if (width > MAX || height > MAX) {
            if (width > height) {
              height = Math.round((height * MAX) / width);
              width = MAX;
            } else {
              width = Math.round((width * MAX) / height);
              height = MAX;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                if (blob && blob.size < file.size) {
                  resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
                } else {
                  resolve(file);
                }
              },
              'image/jpeg',
              0.85
            );
          } else {
            resolve(file);
          }
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleFilePicked = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("Le fichier dépasse le plafond de 10 Mo. Merci de déposer un document plus léger.");
      return;
    }
    const processed = await compressImageIfNeeded(file);
    setSelectedFile(processed);
    if (processed.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(processed));
    } else {
      setFilePreview(null);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFilePicked(e.dataTransfer.files[0]);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    const fileToUpload = selectedFile;
    if ((!query && !fileToUpload) || loading) return;

    const userMsgId = `u-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text: query || (fileToUpload ? `Justificatif transmis : ${fileToUpload.name}` : ''),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachedFile: fileToUpload ? {
        name: fileToUpload.name,
        size: fileToUpload.size,
        url: filePreview || undefined,
      } : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSelectedFile(null);
    setFilePreview(null);
    setLoading(true);

    try {
      if (fileToUpload) {
        // Multi-modal Ingestion via /api/assistant/ingest
        const formData = new FormData();
        formData.append('file', fileToUpload);
        if (query) formData.append('text', query);
        if (selectedMissionId) formData.append('missionId', selectedMissionId);

        const res = await api.ingestDocument(formData);
        const action = res.action;

        const defaultMissionId = action.matched_mission_id || selectedMissionId || (missions[0] ? missions[0].id : null);
        const defaultMissionCode = action.matched_mission_code || (missions.find(m => m.id === defaultMissionId)?.code) || null;

        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text: action.summary || "Document analysé. Voici la proposition d'action à valider :",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: res.model,
          hasKey: true,
          actionCard: {
            action_type: action.action_type,
            confidence: action.confidence,
            matched_mission_id: defaultMissionId,
            matched_mission_code: defaultMissionCode,
            summary: action.summary,
            filename: res.file?.filename,
            original_filename: res.file?.original_name,
            payload: action.payload || {},
          },
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        // Standard conversational chat
        const res = await api.askAssistant({
          message: query,
          missionId: selectedMissionId || undefined,
          history: messages.slice(-4).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            text: m.text,
          })),
        });

        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text: res.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: res.model,
          hasKey: res.hasKey,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ Erreur : ${err.message || "Impossible de contacter l'assistant."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCommitAction = async (msgId: string, actionCard: ActionCardData) => {
    setSubmittingActionId(msgId);
    try {
      const res = await api.commitAssistantAction({
        action_type: actionCard.action_type,
        mission_id: actionCard.matched_mission_id,
        payload: actionCard.payload,
        filename: actionCard.filename,
        original_name: actionCard.original_filename,
      });

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId && m.actionCard) {
            return {
              ...m,
              actionCard: {
                ...m.actionCard,
                committed: true,
                committedMessage: res.message,
              },
            };
          }
          return m;
        })
      );

      onRefreshData?.();
    } catch (err: any) {
      alert(`Erreur d'enregistrement : ${err.message}`);
    } finally {
      setSubmittingActionId(null);
    }
  };

  const handleCancelAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.actionCard) {
          return {
            ...m,
            actionCard: {
              ...m.actionCard,
              cancelled: true,
            },
          };
        }
        return m;
      })
    );
  };

  const updateCardMission = (msgId: string, missionId: string) => {
    const found = missions.find((m) => m.id === missionId);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.actionCard) {
          return {
            ...m,
            actionCard: {
              ...m.actionCard,
              matched_mission_id: missionId,
              matched_mission_code: found ? found.code : null,
            },
          };
        }
        return m;
      })
    );
  };

  const updateCardField = (msgId: string, field: string, value: any) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.actionCard) {
          const newPayload = { ...m.actionCard.payload, [field]: value };
          if (field === 'amount_ht' || field === 'vat_rate') {
            const ht = Number(field === 'amount_ht' ? value : newPayload.amount_ht) || 0;
            const rate = Number(field === 'vat_rate' ? value : newPayload.vat_rate) || 0;
            const vat = Math.round(ht * rate * 100) / 100;
            newPayload.vat_amount = vat;
            newPayload.total_ttc = Math.round((ht + vat) * 100) / 100;
          }
          return {
            ...m,
            actionCard: {
              ...m.actionCard,
              payload: newPayload,
            },
          };
        }
        return m;
      })
    );
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReset = () => {
    setMessages([
      {
        id: `w-${Date.now()}`,
        sender: 'assistant',
        text: `Conversation réinitialisée. En quoi puis-je vous aider pour vos dossiers VP Expertise ?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Quick suggestions tailored to current view
  const quickSuggestions = [
    { label: '💶 Honoraires à émettre', query: 'Quels dossiers ont atteint leur palier de facturation ?' },
    { label: '📅 Prochaines échéances', query: 'Quelles sont les prochaines échéances et dires attendus ?' },
    { label: '📊 Bilan TVA & CA', query: 'Quel est mon chiffre d\'affaires et ma TVA ce mois-ci ?' },
    ...(currentMission
      ? [
          {
            label: `🔎 Dossier ${currentMission.code}`,
            query: `Fais-moi le point complet sur le dossier ${currentMission.code} (${currentMission.title}).`,
          },
        ]
      : []),
    {
      label: '✉️ Rédiger une relance Dire',
      query: 'Rédige-moi un mail courtois pour relancer un avocat sur la remise de son Dire n°2.',
    },
  ];

  // Helper to render basic markdown formatting cleanly
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-1 text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} className="h-1.5" />;
          }

          const isBullet = line.startsWith('* ') || line.startsWith('- ');
          const cleanLine = isBullet ? line.slice(2) : line;

          const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
          const parsedLine = parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-semibold text-slate-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          });

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start space-x-2 pl-2">
                <span className="text-slate-400 mt-1 text-xs shrink-0">•</span>
                <span className="flex-1">{parsedLine}</span>
              </div>
            );
          }

          return <p key={idx}>{parsedLine}</p>;
        })}
      </div>
    );
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end"
    >
      <div
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-200 relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 bg-slate-600/70 rounded-full mx-auto my-1.5 md:hidden"></div>

        {/* Drag & Drop Visual Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-30 bg-sky-500/10 border-2 border-dashed border-[#0f3854] flex flex-col items-center justify-center pointer-events-none backdrop-blur-xs">
            <UploadCloud className="w-12 h-12 text-[#0f3854] animate-bounce" />
            <p className="mt-2 text-sm font-bold text-[#0f3854]">
              Déposez votre reçu ou document ici
            </p>
            <p className="text-xs text-slate-500">
              Analyse automatique & préparation de l'action
            </p>
          </div>
        )}

        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm tracking-tight">Assistant VP Expertise</h3>
                <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-900/80 text-cyan-200 border border-cyan-700/50">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Gemini Flash</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {currentMission ? `Contexte : [${currentMission.code}]` : 'Connecté à vos dossiers & comptabilité'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleReset}
              title="Nouvelle conversation"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Fermer la fenêtre"
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span className="text-[11px]">Fermer</span>
            </button>
          </div>
        </div>

        {/* Current Mission Context Banner if active */}
        {currentMission && (
          <div className="bg-cyan-50 border-b border-cyan-100 px-4 py-2 flex items-center justify-between text-xs text-cyan-900">
            <div className="truncate pr-2">
              <span className="font-bold">{currentMission.code}</span> — {currentMission.title}
            </div>
            <span className="text-[10px] bg-cyan-200 text-cyan-800 px-1.5 py-0.5 rounded font-medium shrink-0">
              Ciblé
            </span>
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            const card = m.actionCard;

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}
              >
                <div
                  className={`max-w-[95%] sm:max-w-[90%] rounded-2xl px-4 py-3 shadow-xs ${
                    isUser
                      ? 'bg-[#0f3854] text-white rounded-br-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                  }`}
                >
                  {/* Attached file chip in user message */}
                  {isUser && m.attachedFile && (
                    <div className="mb-2 p-2 bg-white/10 rounded-lg flex items-center space-x-2 text-xs border border-white/20">
                      {m.attachedFile.url ? (
                        <img
                          src={m.attachedFile.url}
                          alt="preview"
                          className="w-10 h-10 object-cover rounded border border-white/30 shrink-0"
                        />
                      ) : (
                        <FileText className="w-6 h-6 text-white/80 shrink-0" />
                      )}
                      <div className="truncate flex-1">
                        <p className="font-semibold truncate">{m.attachedFile.name}</p>
                        <p className="text-[10px] text-white/70">
                          {Math.round(m.attachedFile.size / 1024)} Ko
                        </p>
                      </div>
                    </div>
                  )}

                  {isUser ? (
                    <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                  ) : (
                    <>
                      {renderFormattedText(m.text)}

                      {/* Interactive Action Preview Card (Human-in-the-loop) */}
                      {card && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          {card.committed ? (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2 text-emerald-900">
                              <div className="flex items-center space-x-2 font-bold">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>{card.committedMessage || "Action enregistrée avec succès."}</span>
                              </div>
                              {card.matched_mission_code && onNavigateToMission && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onNavigateToMission(card.matched_mission_code!);
                                    onClose();
                                  }}
                                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline flex items-center space-x-1 cursor-pointer"
                                >
                                  <span>Consulter le dossier {card.matched_mission_code}</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : card.cancelled ? (
                            <div className="p-2.5 bg-slate-100 text-slate-500 rounded-xl text-xs text-center italic">
                              Proposition d'enregistrement annulée.
                            </div>
                          ) : (
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                              {/* Header of Action */}
                              <div className="flex items-center justify-between">
                                <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                  card.action_type === 'expense'
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : card.action_type === 'new_mission'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                                }`}>
                                  {card.action_type === 'expense' && <Receipt className="w-3.5 h-3.5" />}
                                  {card.action_type === 'document' && <FileText className="w-3.5 h-3.5" />}
                                  {card.action_type === 'new_mission' && <FolderPlus className="w-3.5 h-3.5" />}
                                  <span>
                                    {card.action_type === 'expense' && 'Note de frais détectée'}
                                    {card.action_type === 'document' && 'Pièce de procédure détectée'}
                                    {card.action_type === 'new_mission' && 'Nouveau dossier détecté'}
                                    {card.action_type === 'activity' && 'Pointage de temps détecté'}
                                  </span>
                                </span>

                                {card.filename && (
                                  <a
                                    href={`/uploads/${card.filename}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] text-[#0f3854] hover:underline font-semibold flex items-center space-x-1"
                                    title="Voir le justificatif scanné"
                                  >
                                    <span>Voir le reçu</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </a>
                                )}
                              </div>

                              {/* Target Mission Selector */}
                              {card.action_type !== 'new_mission' && (
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Dossier de rattachement :
                                  </label>
                                  <select
                                    value={card.matched_mission_id || ''}
                                    onChange={(e) => updateCardMission(m.id, e.target.value)}
                                    className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-1 focus:ring-[#0f3854]"
                                  >
                                    <option value="" disabled>Sélectionner un dossier...</option>
                                    {missions.map((ms) => (
                                      <option key={ms.id} value={ms.id}>
                                        [{ms.code}] {ms.title.slice(0, 40)}...
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Expense Specific Form Fields */}
                              {card.action_type === 'expense' && (
                                <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] text-slate-500 font-semibold uppercase">Date</label>
                                      <input
                                        type="date"
                                        value={card.payload.date || ''}
                                        onChange={(e) => updateCardField(m.id, 'date', e.target.value)}
                                        className="w-full text-xs p-1 border rounded bg-slate-50/50"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] text-slate-500 font-semibold uppercase">Catégorie</label>
                                      <select
                                        value={card.payload.category || 'train'}
                                        onChange={(e) => {
                                          const cat = e.target.value;
                                          const defaultRate = cat === 'train' || cat === 'hotel' || cat === 'repas' ? 0.10 : (cat === 'km' ? 0 : 0.20);
                                          updateCardField(m.id, 'category', cat);
                                          updateCardField(m.id, 'vat_rate', defaultRate);
                                        }}
                                        className="w-full text-xs p-1 border rounded bg-slate-50/50"
                                      >
                                        <option value="train">Train / Transport (10%)</option>
                                        <option value="hotel">Hôtel / Nuitée (10%)</option>
                                        <option value="repas">Restauration (10%)</option>
                                        <option value="peage">Péage autoroute / Taxi (20%)</option>
                                        <option value="km">Kilométrique (0%)</option>
                                        <option value="autre">Autre frais (20%)</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-semibold uppercase">Libellé</label>
                                    <input
                                      type="text"
                                      value={card.payload.label || ''}
                                      onChange={(e) => updateCardField(m.id, 'label', e.target.value)}
                                      placeholder="ex: Billet TGV Paris-Lyon A/R"
                                      className="w-full text-xs p-1 border rounded bg-slate-50/50 font-medium"
                                    />
                                  </div>

                                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                                    <div>
                                      <label className="block text-[10px] text-slate-500 font-semibold uppercase">Total HT</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={card.payload.amount_ht ?? 0}
                                        onChange={(e) => updateCardField(m.id, 'amount_ht', parseFloat(e.target.value) || 0)}
                                        className="w-full text-xs p-1 border rounded font-bold font-mono bg-slate-50/50"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] text-slate-500 font-semibold uppercase">TVA</label>
                                      <span className="block text-xs p-1 text-slate-700 font-mono">
                                        {(card.payload.vat_amount || 0).toFixed(2).replace('.', ',')} €
                                      </span>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] text-slate-500 font-semibold uppercase">Total TTC</label>
                                      <span className="block text-xs p-1 font-bold text-emerald-800 font-mono">
                                        {(card.payload.total_ttc || 0).toFixed(2).replace('.', ',')} €
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Document Specific Form Fields */}
                              {card.action_type === 'document' && (
                                <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-semibold uppercase">Titre de la pièce</label>
                                    <input
                                      type="text"
                                      value={card.payload.document_title || ''}
                                      onChange={(e) => updateCardField(m.id, 'document_title', e.target.value)}
                                      className="w-full text-xs p-1 border rounded bg-slate-50/50 font-medium"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] text-slate-500 font-semibold uppercase">Type</label>
                                      <select
                                        value={card.payload.document_category || 'dire'}
                                        onChange={(e) => updateCardField(m.id, 'document_category', e.target.value)}
                                        className="w-full text-xs p-1 border rounded bg-slate-50/50"
                                      >
                                        <option value="dire">Dire d'avocat</option>
                                        <option value="pv">PV / Émargement</option>
                                        <option value="technique">Note technique</option>
                                        <option value="autre">Autre pièce</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] text-slate-500 font-semibold uppercase">Échéance réponse</label>
                                      <input
                                        type="date"
                                        value={card.payload.deadline || ''}
                                        onChange={(e) => updateCardField(m.id, 'deadline', e.target.value)}
                                        className="w-full text-xs p-1 border rounded bg-slate-50/50"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* New Mission Specific Card */}
                              {card.action_type === 'new_mission' && (
                                <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
                                  <p className="text-slate-600">
                                    Une nouvelle désignation d'expertise a été identifiée dans votre document :
                                  </p>
                                  <div className="p-2 bg-amber-50 rounded border border-amber-200 text-[11px] space-y-1">
                                    <p className="font-bold text-slate-900">{card.payload.new_mission_title || "Nouvelle mission"}</p>
                                    <p className="text-slate-600">Juridiction : {card.payload.new_mission_court || "TJ"}</p>
                                    <p className="text-slate-600">Client / Assureur : {card.payload.new_mission_client || "À préciser"}</p>
                                  </div>
                                </div>
                              )}

                              {/* Buttons */}
                              <div className="flex items-center justify-end space-x-2 pt-1">
                                <button
                                  type="button"
                                  disabled={submittingActionId === m.id}
                                  onClick={() => handleCancelAction(m.id)}
                                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
                                >
                                  Annuler
                                </button>

                                {card.action_type === 'new_mission' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onOpenCreateMissionWithData) {
                                        onOpenCreateMissionWithData({
                                          title: card.payload.new_mission_title,
                                          case_reference: card.payload.new_mission_case_reference,
                                          insurance_client: card.payload.new_mission_client,
                                          court_reference: card.payload.new_mission_court,
                                          insured_party: card.payload.new_mission_insured,
                                          description: card.summary,
                                        });
                                      }
                                      handleCancelAction(m.id);
                                      onClose();
                                    }}
                                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                                  >
                                    <FolderPlus className="w-3.5 h-3.5" />
                                    <span>Ouvrir la fiche pré-remplie</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={submittingActionId === m.id || !card.matched_mission_id}
                                    onClick={() => handleCommitAction(m.id, card)}
                                    className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                                  >
                                    {submittingActionId === m.id ? (
                                      <span>Enregistrement...</span>
                                    ) : (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Valider l'enregistrement</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer of message (time + copy action) */}
                <div className="flex items-center space-x-2 mt-1 px-1 text-[11px] text-slate-400">
                  <span>{m.timestamp}</span>
                  {!isUser && (
                    <button
                      onClick={() => handleCopy(m.id, m.text)}
                      className="inline-flex items-center space-x-1 text-slate-500 hover:text-slate-800 transition-colors"
                      title="Copier la réponse"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-semibold text-[10px]">Copié</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="text-[10px]">Copier</span>
                        </>
                      )}
                    </button>
                  )}
                  {m.model && (
                    <span className="text-[9px] bg-slate-200 text-slate-600 px-1 rounded">
                      {m.model}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center space-x-2 text-slate-500 bg-white border border-slate-200 rounded-2xl px-4 py-3 max-w-[80%] shadow-xs">
              <Sparkles className="w-4 h-4 text-cyan-600 animate-spin" />
              <span className="text-xs font-medium">Analyse multimodale & vérification comptable...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-2.5 bg-white border-t border-slate-200">
          <p className="text-[11px] font-semibold text-slate-400 mb-1.5 px-1 uppercase tracking-wider">
            Suggestions rapides
          </p>
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
            {quickSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                disabled={loading}
                onClick={() => handleSend(item.query)}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium whitespace-nowrap transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Attached File Staging Area (Before sending) */}
        {selectedFile && (
          <div className="px-3 py-2 bg-sky-50/80 border-t border-sky-100 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center space-x-2 truncate">
              {filePreview ? (
                <img
                  src={filePreview}
                  alt="Aperçu reçu"
                  className="w-8 h-8 rounded object-cover border border-sky-200 shrink-0"
                />
              ) : (
                <FileText className="w-6 h-6 text-sky-700 shrink-0" />
              )}
              <div className="truncate">
                <span className="font-bold text-sky-900 block truncate">{selectedFile.name}</span>
                <span className="text-[10px] text-sky-600">
                  {Math.round(selectedFile.size / 1024)} Ko • Prêt pour analyse
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setFilePreview(null);
              }}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
              title="Retirer ce fichier"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input Bar with Camera & File Triggers */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-1.5"
          >
            {/* Hidden native camera trigger */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFilePicked(e.target.files[0]);
                }
              }}
            />

            {/* Hidden file picker trigger */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFilePicked(e.target.files[0]);
                }
              }}
            />

            {/* Camera Button (Mobile / Field receipt snapshot) */}
            <button
              type="button"
              disabled={loading}
              onClick={() => cameraInputRef.current?.click()}
              className="p-2 text-slate-500 hover:text-[#0f3854] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Prendre une photo de reçu (Appareil photo mobile)"
            >
              <Camera className="w-5 h-5 text-slate-600" />
            </button>

            {/* Paperclip Button (Desktop / File picker) */}
            <button
              type="button"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-500 hover:text-[#0f3854] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Joindre un justificatif ou document (PDF, JPG, PNG)"
            >
              <Paperclip className="w-5 h-5 text-slate-600" />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedFile
                  ? "Consigne (ex: 'Dossier Alstom') ou valider direct..."
                  : "Question, consigne ou glisser un reçu..."
              }
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading || (!input.trim() && !selectedFile)}
              className="p-2 bg-[#0f3854] hover:bg-[#16496d] disabled:opacity-40 text-white rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
              title="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <p className="text-[10px] text-slate-400 text-center mt-1.5 flex items-center justify-center space-x-1.5">
            <span>📷 Prise de photo terrain</span>
            <span>•</span>
            <span>⚡ Glisser-déposer PDF/Reçus</span>
            <span>•</span>
            <span>Contrôle 100% avant enregistrement</span>
          </p>
        </div>
      </div>
    </div>
  );
};
