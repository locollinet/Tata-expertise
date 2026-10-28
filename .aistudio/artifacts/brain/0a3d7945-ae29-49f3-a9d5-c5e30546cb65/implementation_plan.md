# Ingestion Terrain & Assistant IA Pragmatique (VP Expertise)

Permettre à Valentine de capturer ou déposer un justificatif (ticket de train, reçu de péage/hôtel, pièce de procédure) depuis son smartphone ou son ordinateur, avec extraction ciblée des données et pré-remplissage sécurisé sans jamais corrompre sa comptabilité ni sa numérotation.

---

## Synthèse du Challenge & Arbitrages Retenus

Suite à l'analyse critique de votre IA, voici le tri objectif entre la réalité technique de la plateforme et les excellentes remarques métier :

| Point soulevé | Verdict | Prise en compte dans le plan |
| :--- | :--- | :--- |
| **1. Noms des modèles Gemini** | ❌ L'IA externe a tort (données d'entraînement anciennes). | Nous avons vérifié en direct dans la console que `gemini-2.5-flash` est déprécié par Google (erreur 404 du SDK invitant à passer à `gemini-3.8-flash`). Ce sont bien `gemini-3.8-flash` et `gemini-3.1-flash-lite` qui sont opérationnels sur notre serveur. |
| **2. Usage Smartphone / Caméra** | ✅ **100 % pertinent et indispensable.** | Ajout d'un bouton direct **« 📷 Prendre en photo »** avec déclencheur caméra native (`capture="environment"`) sur smartphone pour shooter les reçus en gare ou sur les voies. |
| **3. Création automatique de dossier** | ✅ **100 % d'accord sur le danger.** | **Aucune création autonome en base**. Si un nouveau dossier est détecté, l'IA pré-remplit la modale habituelle de création de dossier. Valentine conserve la maîtrise absolue de son code `VP2026...` et de sa numérotation. |
| **4. Gros PDF juridiques (35 pages)** | ✅ **Très sage pour la stabilité.** | Limite de taille à **10 Mo** et analyse ciblée des premières pages clés pour garantir une réponse en moins de 3 secondes sans risque de timeout réseau. |

---

## 1. Vue d'Ensemble & Expérience Terrain de Valentine

### Scénario 1 : Le reçu de frais sur le terrain (iPhone / Mobile)
1. Valentine est à la gare de Massy ou au restaurant après une expertise.
2. Elle ouvre l'assistant dans l'app sur son téléphone, appuie sur l'icône **Appareil photo** 📷.
3. Elle prend en photo le reçu CB ou le billet SNCF.
4. Optionnel : elle dit ou tape juste *"Dossier Alstom"*.
5. En 2 secondes, l'assistant affiche une carte :
   - Catégorie : *Transports / Train*
   - Montant : *118,00 € HT (TVA 10% : 11,80 €)*
   - Dossier rattaché : *[VP2026922] ALSTOM - Ligne 18*
6. Valentine clique sur **« Valider la dépense »** ➡️ C'est enregistré directement dans sa base, sans aucune ressaisie.

### Scénario 2 : Le Dire d'avocat ou le PV reçu par e-mail (Bureau / PC)
1. Au bureau, Valentine glisse le PDF du Dire reçu (limité à 10 Mo) dans le tiroir assistant.
2. L'IA extrait : la date de signification, l'échéance de réponse (ex: sous 15 jours), l'auteur et un résumé en 2 lignes.
3. Valentine valide : la pièce est classée dans l'onglet **Documents & Dires** du dossier correspondant et l'échéance de procédure est mise à jour.

### Scénario 3 : Une nouvelle mission judiciaire ou amiable
1. Valentine dépose une lettre de mission ou une ordonnance de désignation.
2. L'assistant détecte qu'aucun dossier existant ne correspond.
3. L'assistant affiche : *« Nouveau dossier détecté : TGI d'Évry c/ SNCF Réseau. Souhaitez-vous ouvrir la fiche de création pré-remplie ? »*
4. Au clic, la fenêtre habituelle **« Nouveau Dossier »** s'ouvre avec les champs pré-remplis (juridiction, références, parties, date). Valentine vérifie, attribue son code officiel `VP2026...`, et valide.

---

## 2. Interface & Ergonomie Mobile-First

### A. Barre d'outils d'envoi dans `AIAssistantDrawer.tsx`
- **Double déclencheur** :
  1. **Bouton Caméra (Mobile)** : `<input type="file" accept="image/*" capture="environment">` pour prise de vue instantanée sans passer par la galerie.
  2. **Bouton Trombone / Drag & Drop (Desktop)** : `<input type="file" accept="image/*,application/pdf">` pour glisser un document PDF ou image.
- **Micro-vignette de prévisualisation** : Aperçu miniature du ticket pris en photo avec possibilité de le supprimer avant envoi.
- **Indicateur de traitement rapide** : Badge discret *"Analyse du reçu..."* avec animation fluide.

### B. Carte d'Aperçu Sécurisée (*Action Preview Card*)
- **Champs modifiables en un clic** : Date, montant HT, TVA, dossier cible.
- **Bouton vert « Valider l'enregistrement »** : Écrit en base de données SQLite et met à jour le montant non facturé en direct.
- **Bouton gris « Annuler »** : Oublie la proposition sans toucher à la base.

---

## 3. Architecture Technique Ciblée & Robuste

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AIAssistantDrawer.tsx                           │
│  - Déclencheur Caméra iPhone (capture="environment")                   │
│  - Déclencheur Drag & Drop Desktop                                     │
│  - Garde-fou taille (< 10 Mo)                                          │
│  - ActionPreviewCard avec validation interactive                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ POST /api/assistant/ingest
                                    │ (multipart: photo/pdf + prompt)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        server/api.ts                                   │
│  1. Vérification du fichier (taille <= 10 Mo, mime image/pdf)          │
│  2. Sauvegarde du justificatif dans ./uploads/expenses ou /documents   │
│  3. Analyse ciblée via @google/genai :                                 │
│     - gemini-3.1-flash-lite / gemini-3.8-flash (modèles actifs)       │
│     - Schéma JSON strict (montant, date, catégorie, dossier cible)     │
│  4. Retourne la proposition d'action à l'assistant                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Clic "Valider"
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│         Écriture sécurisée dans la base SQLite locale                  │
│  - INSERT INTO expenses / activities / documents                       │
│  - OU ouverture de la modale pré-remplie pour un nouveau dossier       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Garde-fous & Sécurité Métier

1. **Aucune création silencieuse de dossier** : Seule Valentine peut valider la création d'un dossier dans son formulaire standard.
2. **Plafond de taille de fichier** : Refus immédiat des scans au-delà de 10 Mo avec message clair (*« Document trop volumineux pour l'analyse rapide. Merci de déposer un fichier de moins de 10 Mo. »*).
3. **Calcul de TVA déterministe** : Les montants HT et TVA sont vérifiés arithmétiquement pour éviter toute incohérence de centimes.
4. **Conservation du justificatif** : L'image ou le PDF reste lié à la note de frais pour justificatif comptable fiscal.

---

## 5. Déroulé des Travaux

1. **Backend (`server/api.ts`)** :
   - Route `POST /api/assistant/ingest` avec validation des types MIME et limite 10 Mo.
   - Prompt d'extraction spécialisé pour factures/frais ferroviaires et pièces de procédure.
   - Route `POST /api/assistant/commit-action` pour l'enregistrement contrôlé.
2. **Frontend (`AIAssistantDrawer.tsx`)** :
   - Ajout des boutons Caméra mobile (`capture="environment"`) et trombone desktop.
   - Composant `ActionPreviewCard` avec boutons Valider / Annuler et ouverture de modale pré-remplie.
3. **Tests & Validation** :
   - Test d'un ticket de train (photo/scan) ➡️ validation de la dépense.
   - Test d'une pièce juridique ➡️ vérification du classement sans écriture parasite.
