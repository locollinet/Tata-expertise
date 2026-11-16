import type { DossierVoletKey } from './types.js';

/**
 * Nomenclature officielle iCloud / Finder de Valentine Pécheux (VP Expertise).
 */
export const VALENTINE_FOLDERS = {
  elements_mission: 'Éléments de la mission',
  contrats: 'Contrats',
  rci_photos: 'RCI-Photos',
  operations: "Opérations d'expertise",
  prejudice: 'Préjudice',
  livrables: 'Rapports & Courriers',
  honoraires: 'Factures Honoraires',
  // Compartiments Judiciaires
  nap: 'NAP',
  pre_rapport: 'Rapport-Pré-rapport',
  dires_1: 'Dires de partie 1',
} as const;

export const BASE_VALENTINE_FOLDERS = [
  VALENTINE_FOLDERS.elements_mission,
  VALENTINE_FOLDERS.contrats,
  VALENTINE_FOLDERS.rci_photos,
  VALENTINE_FOLDERS.operations,
  VALENTINE_FOLDERS.prejudice,
  VALENTINE_FOLDERS.livrables,
  VALENTINE_FOLDERS.honoraires,
] as const;

export const JUDICIAL_VALENTINE_FOLDERS = [
  VALENTINE_FOLDERS.nap,
  VALENTINE_FOLDERS.pre_rapport,
  VALENTINE_FOLDERS.dires_1,
] as const;

export interface FolderMappingResult {
  section: DossierVoletKey;
  category: string;
  subSection?: string;
  groupLabel?: string;
}

/**
 * Résout le sous-dossier exact de Valentine où classer/exporter un document donné.
 */
export function resolveValentineExportFolder(doc: {
  section?: string;
  subSection?: string;
  sub_section?: string;
  category?: string;
  mimeType?: string;
  mime_type?: string;
  fileName?: string;
  original_name?: string;
  documentGroupLabel?: string;
  document_group_label?: string;
  isJudicial?: boolean;
}): string {
  const sec = (doc.section || '').toLowerCase();
  const sub = (doc.subSection || doc.sub_section || '').toLowerCase();
  const cat = (doc.category || '').toLowerCase();
  const mime = (doc.mimeType || doc.mime_type || '').toLowerCase();
  const name = (doc.fileName || doc.original_name || '').toLowerCase();
  const grp = (doc.documentGroupLabel || doc.document_group_label || '').trim();

  // 1. Honoraires VP Expertise
  if (cat.includes('facture_emise') || cat === 'facture' || name.startsWith('facture_') || name.includes('honoraires')) {
    return VALENTINE_FOLDERS.honoraires;
  }

  // 2. Compartiments Judiciaires (NAP, Rapport-Pré-rapport, Dires de partie X)
  if (sub === 'nap' || cat === 'judicial_nap') {
    return VALENTINE_FOLDERS.nap;
  }
  if (sub === 'pre_rapport' || cat === 'judicial_pre_rapport') {
    return VALENTINE_FOLDERS.pre_rapport;
  }
  if (sub === 'dires' || cat === 'judicial_dire') {
    if (grp && /dire/i.test(grp)) {
      return grp.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 64);
    }
    return VALENTINE_FOLDERS.dires_1;
  }

  // 3. Éléments de la mission vs Contrats
  if (sec === 'garde' || sub === 'elements_mission' || cat.includes('mandat')) {
    return VALENTINE_FOLDERS.elements_mission;
  }
  if (sec === 'contrats' || cat.includes('contrat') || cat.includes('police') || cat.includes('avenant')) {
    return VALENTINE_FOLDERS.contrats;
  }

  // 4. RCI-Photos vs Opérations d'expertise
  if (sub === 'rci_photos' || sub === 'jour_j' || cat === 'photo_terrain' || mime.startsWith('image/')) {
    return VALENTINE_FOLDERS.rci_photos;
  }
  if (sec === 'constatations' || sec === 'contradictoire' || sub === 'operations' || cat.includes('dire') || cat.includes('courrier') || cat.includes('convoc')) {
    return VALENTINE_FOLDERS.operations;
  }

  // 5. Préjudice & Rapports/Courriers
  if (sec === 'prejudice' || cat.includes('prejudice') || cat.includes('devis')) {
    return VALENTINE_FOLDERS.prejudice;
  }
  if (sec === 'rapports' || cat.includes('rapport')) {
    return VALENTINE_FOLDERS.livrables;
  }

  return VALENTINE_FOLDERS.operations;
}

/**
 * Règles unifiées de classement entre les dossiers Mac/iCloud de Valentine
 * (arborescence historique, sous-dossiers réels 2026, compartiments judiciaires, vrac)
 * et les 6 volets de l'application Rocco.
 */
export function mapMacFolderToSectionAndCategory(
  folderName: string,
  fileName = ''
): FolderMappingResult {
  const lower = (folderName || '').toLowerCase();
  const fLower = (fileName || '').toLowerCase();

  // 1. Sous-dossiers Judiciaires explicites (NAP / Pré-rapport / Dires de partie X)
  if (/\bnap\b|note aux parties/.test(lower)) {
    return { section: 'contradictoire', category: 'judicial_nap', subSection: 'nap' };
  }
  if (/pr[eé]-?rapport/.test(lower)) {
    return { section: 'rapports', category: 'judicial_pre_rapport', subSection: 'pre_rapport' };
  }
  if (lower.includes('dire')) {
    const parts = folderName.split('/').filter(Boolean);
    const direFolder = parts.find((p) => /dire/i.test(p)) || parts[parts.length - 1] || 'Dire';
    return { section: 'contradictoire', category: 'judicial_dire', subSection: 'dires', groupLabel: direFolder };
  }

  // 2. Sous-dossiers iCloud réels & Arborescence 01..06
  if (
    lower.includes('02_contrat') ||
    lower.includes('contrat') ||
    lower.includes('mission') ||
    lower.includes('élém') ||
    lower.includes('elem')
  ) {
    return {
      section: 'contrats',
      category: 'contrat_client',
      subSection: lower.includes('élém') || lower.includes('elem') ? 'elements_mission' : '',
    };
  }
  if (lower.includes('04_contradictoire') || lower.includes('contradictoire') || lower.includes('convoc') || lower.includes('lrar')) {
    return { section: 'contradictoire', category: 'procedure_dires' };
  }
  if (lower.includes('05_comptes') || lower.includes('prejudice') || lower.includes('préjudice')) {
    return { section: 'prejudice', category: 'justificatif_prejudice' };
  }
  if (lower.includes('06_rapport') || lower.includes('rapport')) {
    return { section: 'rapports', category: 'rapport_emis' };
  }
  if (lower.includes('rci') || lower.includes('photo') || lower.includes('constat')) {
    const isImg = /\.(jpe?g|png|webp|heic|gif)$/i.test(fLower);
    return {
      section: 'constatations',
      category: isImg ? 'photo_terrain' : 'note_technique',
      subSection: 'rci_photos',
    };
  }
  if (lower.includes('opération') || lower.includes('operation') || lower.includes('extraction')) {
    const isImg = /\.(jpe?g|png|webp|heic|gif)$/i.test(fLower);
    return {
      section: 'constatations',
      category: isImg ? 'photo_terrain' : 'note_technique',
      subSection: 'operations',
    };
  }

  // 3. Fichiers "en vrac" à la racine du dossier -> détection intelligente par nom de fichier
  if (!lower) {
    if (/\.(jpe?g|png|webp|heic|gif)$/i.test(fLower)) {
      return { section: 'constatations', category: 'photo_terrain', subSection: 'rci_photos' };
    }
    if (/dire|convoc|mise[_\s-]?en[_\s-]?cause|\bmec\b|lrar|\bnap\b/i.test(fLower)) {
      return {
        section: 'contradictoire',
        category: /\bnap\b/i.test(fLower) ? 'judicial_nap' : 'procedure_dires',
        subSection: /\bnap\b/i.test(fLower) ? 'nap' : '',
      };
    }
    if (/contrat|police|avenant|cgv|ordre|mission/i.test(fLower)) {
      return { section: 'contrats', category: 'contrat_client' };
    }
    if (/devis|facture|prejudice|préjudice|chiffrage|indemnis/i.test(fLower)) {
      return { section: 'prejudice', category: 'justificatif_prejudice' };
    }
    if (/rapport|ead|note[_\s-]?(situation|technique)/i.test(fLower)) {
      return { section: 'rapports', category: 'rapport_emis' };
    }
  }

  const isImg = /\.(jpe?g|png|webp|heic|gif)$/i.test(fLower);
  return {
    section: 'constatations',
    category: isImg ? 'photo_terrain' : 'note_technique',
    subSection: isImg ? 'rci_photos' : 'operations',
  };
}
