import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, Send, X, Copy, Check, RotateCcw, AlertCircle, ChevronRight, MessageSquare } from 'lucide-react';
import { api } from '../api.js';
import { Mission } from '@shared/types.js';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  model?: string;
  hasKey?: boolean;
}

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMissionId?: string | null;
  missions?: Mission[];
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  selectedMissionId,
  missions = [],
}) => {
  const currentMission = selectedMissionId
    ? missions.find((m) => m.id === selectedMissionId)
    : null;

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Bonjour Valentine !\n\nJe suis votre **assistant opérationnel VP Expertise**, propulsé par **Gemini 2.5 Flash** et connecté en temps réel à l'ensemble de vos dossiers ferroviaires.\n\nVous pouvez me demander :\n* Vos seuils de facturation et dossiers à clôturer\n* Vos échéances de dires et convocations d'expertise\n* Un projet de mail ou de relance prêt à être copié\n* Votre bilan d'activité et TVA du mois`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
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
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ Erreur de connexion : ${err.message || "Impossible de contacter l'assistant."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
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
    { label: '⚠️ Seuils > 3 500 €', query: 'Quels dossiers dépassent le seuil de 3 500 € HT ?' },
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

          // Format bold items (**text**)
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm tracking-tight">Assistant VP Expertise</h3>
                <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-900/80 text-cyan-200 border border-cyan-700/50">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Gemini 2.5 Flash</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {currentMission ? `Contexte actif : [${currentMission.code}]` : 'Connecté à vos dossiers ferroviaires'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={handleReset}
              title="Nouvelle conversation"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Fermer"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
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
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-xs ${
                    isUser
                      ? 'bg-[#0f3854] text-white rounded-br-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                  ) : (
                    renderFormattedText(m.text)
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
                      {m.hasKey ? 'Gemini 2.5 Flash' : 'Local Conforme'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center space-x-2 text-slate-500 bg-white border border-slate-200 rounded-2xl px-4 py-3 max-w-[80%] shadow-xs">
              <Sparkles className="w-4 h-4 text-cyan-600 animate-spin" />
              <span className="text-xs font-medium">Analyse des dossiers en cours...</span>
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

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question (facturation, dires, synthèse...)"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 bg-[#0f3854] hover:bg-[#16496d] disabled:opacity-40 text-white rounded-xl transition-all shadow-xs cursor-pointer"
              title="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[10px] text-slate-400 text-center mt-1.5">
            Modèle Gemini 2.5 Flash (rapide & économique) • Données locales VP Expertise
          </p>
        </div>
      </div>
    </div>
  );
};
