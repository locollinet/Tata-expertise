import React from 'react';
import { X, Bookmark, Compass, Sparkles, CheckCircle2, ShieldCheck, HeartHandshake, MousePointerClick, FileText } from 'lucide-react';

interface MacGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQuickAdd: () => void;
  onOpenAssistant: () => void;
}

export const MacGuideModal: React.FC<MacGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenQuickAdd,
  onOpenAssistant,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* En-tête rassurant */}
        <div className="bg-gradient-to-r from-[#0f3854] to-[#1e5882] text-white p-5 sm:p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Fermer le guide"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-2 text-cyan-300 text-xs font-bold uppercase tracking-wider mb-1">
            <HeartHandshake className="w-4 h-4" />
            <span>Guide Pas à Pas Mac • Spécial Valentine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Bienvenue sur votre espace de travail !
          </h2>
          <p className="text-xs sm:text-sm text-cyan-100 mt-1.5 max-w-lg leading-relaxed">
            Pas besoin d'être à l'aise avec l'informatique : tout a été conçu pour être simple, direct et sans aucun risque d'erreur.
          </p>
        </div>

        {/* Corps des 3 étapes concrètes */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto text-slate-700 text-xs sm:text-sm">
          
          {/* Règle d'or anti-stress */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start space-x-3 text-emerald-900">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs sm:text-sm">Règle d'or : Vous ne pouvez RIEN casser</p>
              <p className="text-xs text-emerald-800 mt-0.5">
                Cliquez librement partout pour regarder. Rien ne s'efface par accident, vos calculs de TVA et d'honoraires se font tous seuls.
              </p>
            </div>
          </div>

          {/* Étape 1 : Sauvegarder sur son Mac */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
            <div className="flex items-center space-x-2.5 font-bold text-slate-900 text-sm">
              <span className="w-6 h-6 rounded-full bg-[#0f3854] text-white flex items-center justify-center text-xs shrink-0">1</span>
              <span>L'enregistrer dans votre Mac (pour le retrouver en 1 clic)</span>
            </div>
            <p className="text-xs text-slate-600 pl-8 leading-relaxed">
              Pour ne jamais chercher le lien :
            </p>
            <ul className="pl-8 text-xs text-slate-700 space-y-1.5 list-disc list-outside ml-4">
              <li>
                <strong>Sur Safari</strong> : Appuyez sur les touches <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-800 font-mono font-bold">Cmd ⌘</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-800 font-mono font-bold">D</kbd> pour l'ajouter à vos <strong>Favoris</strong>.
              </li>
              <li>
                <strong>Astuce encore plus simple</strong> : Dans le menu tout en haut de votre écran Mac, cliquez sur <strong>Fichier</strong> &gt; <strong>Ajouter au Dock</strong>. L'icône VP Expertise se posera en bas de votre écran comme une vraie application Mac !
              </li>
            </ul>
          </div>

          {/* Étape 2 : Les 3 onglets essentiels */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
            <div className="flex items-center space-x-2.5 font-bold text-slate-900 text-sm">
              <span className="w-6 h-6 rounded-full bg-[#0f3854] text-white flex items-center justify-center text-xs shrink-0">2</span>
              <span>Vos 3 gestes indispensables</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 pl-1">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div className="font-bold text-xs text-[#0f3854] flex items-center space-x-1.5 mb-1">
                  <MousePointerClick className="w-3.5 h-3.5" />
                  <span>1. Pointage rapide</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Le gros bouton bleu en haut : notez 1h ou 2h de réunion en 15 secondes.
                </p>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div className="font-bold text-xs text-amber-700 flex items-center space-x-1.5 mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>2. Facturer dès 3 500 €</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Une alerte orange s'allume quand le seuil est dépassé. 1 clic et votre Word VP Expertise est prêt.
                </p>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div className="font-bold text-xs text-cyan-800 flex items-center space-x-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>3. Parler à Rocco</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Votre secrétaire numérique : il rédige vos courriers de relance et résume vos dossiers.
                </p>
              </div>
            </div>
          </div>

          {/* Étape 3 : Essayer tout de suite */}
          <div className="border border-cyan-200 bg-cyan-50/50 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center space-x-2.5 font-bold text-slate-900 text-sm">
              <span className="w-6 h-6 rounded-full bg-cyan-700 text-white flex items-center justify-center text-xs shrink-0">3</span>
              <span>Pour démarrer sereinement en 30 secondes :</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed pl-8">
              Vous pouvez tester tout de suite l'un de ces boutons ci-dessous, c'est sans danger :
            </p>
            <div className="flex flex-wrap gap-2 pl-8 pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQuickAdd();
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#0f3854] hover:bg-[#16496d] text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                <MousePointerClick className="w-3.5 h-3.5" />
                <span>Tester une saisie de temps</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAssistant();
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-900 border border-cyan-300 text-xs font-bold shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-700" />
                <span>Dire bonjour à Rocco IA</span>
              </button>
            </div>
          </div>

        </div>

        {/* Pied de modal avec validation */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Vous pourrez rouvrir ce guide à tout moment via le bouton « Guide Mac » en haut.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto ml-auto px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            C'est parti !
          </button>
        </div>

      </div>
    </div>
  );
};
