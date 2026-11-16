import type { DossierVoletKey } from './types.js';

export interface FolderMappingResult {
  section: DossierVoletKey;
  category: string;
  subSection?: string;
  groupLabel?: string;
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
  if (
    lower.includes('rci') ||
    lower.includes('photo') ||
    lower.includes('constat') ||
    lower.includes('opération') ||
    lower.includes('operation') ||
    lower.includes('extraction')
  ) {
    const isImg = /\.(jpe?g|png|webp|heic|gif)$/i.test(fLower);
    return {
      section: 'constatations',
      category: isImg ? 'photo_terrain' : 'note_technique',
      subSection: lower.includes('rci') ? 'jour_j' : 'visite_terrain',
    };
  }

  // 3. Fichiers "en vrac" à la racine du dossier -> détection intelligente par nom de fichier
  if (!lower) {
    if (/\.(jpe?g|png|webp|heic|gif)$/i.test(fLower)) {
      return { section: 'constatations', category: 'photo_terrain', subSection: 'visite_terrain' };
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

  return {
    section: 'constatations',
    category: /\.(jpe?g|png|webp|heic)$/i.test(fLower) ? 'photo_terrain' : 'note_technique',
    subSection: 'visite_terrain',
  };
}
