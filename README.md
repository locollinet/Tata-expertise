# VP Expertise — Application Métier de Gestion de Cabinet

Application métier sur-mesure conçue pour **VP Expertise** (Valentine Pécheux, Ingénieure Experte en Mécanique et Matériels Ferroviaires).

Cette application remplace la constellation de feuilles Excel (`Pointage_2026.xlsx`, `Expertise File Register`, `Compta_2026.xlsx`) et de documents Word par un outil unifié, élégant et déterministe, centré sur le cycle :
**Dossiers → Pointage du Temps → Frais → Notes d'honoraires → Sortie Comptable Mensuelle**.

---

## 1. Fonctionnalités Clés Livrées

### 🚀 Aujourd'hui (Cockpit & Pilotage)
- Réponse immédiate à : *« Qu'est-ce que je dois faire maintenant ? »*.
- **Rappels automatiques de facturation** : Alerte dès qu'un dossier dépasse le seuil paramétré (défaut : **3 500 € HT**).
- **Suivi des jalons** : Échéances des dires, réunions contradictoires et rapports d'étape.
- **File de messages prioritaires** et rappel du prochain déplacement avec checklist matériel terrain.
- Raccourci universel **« + Saisie rapide »** pour noter 15 minutes ou un frais en 3 clics.

### 📁 Portefeuille de Dossiers & Fiche Mission
- Recherche instantanée par code VP, référence assureur, titre du sinistre, assuré ou compagnie.
- Fiche de synthèse : parties, contacts, cadre judiciaire / tribunal, dates d'incident et de mandat.
- **Gestion du temps** : Saisie par catégorie (Étude, Analyse, Expertise, Visio, Rédaction, Déplacement) avec taux horaires configurables (190 €/h et 135 €/h).
- **Gestion des frais** : Frais kilométriques (0,95 €/km), train, hôtel, repas, péages/parking avec justificatifs.

### 🧾 Honoraires & Facturation Déterministe
- **Sélection des éléments non facturés** avec calcul déterministe immédiat au centime près.
- **Verrou anti-double facturation** : Réservation atomique en base des prestations (`status = 'reserve'`), empêchant tout double clic ou facturation concurrente.
- **Émission officielle** : Incrémentation séquentielle du numéro de facture (ex. `2026-100`).
- **Génération native de documents Word (.docx)** : Note d'honoraires complète avec tableau chiffré, coordonnées, mentions légales et IBAN, sans nécessiter Word ou LibreOffice sur le serveur.
- **Gestion des encaissements & Avoirs** : Suivi des règlements (date crédit, virement), gestion des acomptes déduits et émission d'avoirs rectificatifs inaltérables.

### 📊 Suivi Comptable & Sortie TVA Mensuelle
- Vue mensuelle ventilant **Dépenses** et **Recettes** (HT / TVA / TTC) et calcul de la TVA nette due.
- **Export Excel natif (.xlsx)** reproduisant fidèlement la structure de `Compta_2026.xlsx` pour l'expert-comptable (onglets mensuels avec formules et onglet `Factures 2026` pour le suivi des encaissements).

### 📝 Terrain, Photos & Projet de Rapport
- **Gestion des participants** : Saisie et réutilisation des présents aux réunions (sur site / visio).
- **Galerie de clichés** : Téléversement, légendes et sélection humaine des photos à intégrer au rapport.
- **Trame d'expertise ferroviaire** : Éditeur structuré (Faits, Constatations, Analyse technique réservée à l'experte, Conclusions).
- **Export Word (.docx)** du projet de rapport intégrant automatiquement les participants, les sections et les photos sélectionnées.

### ✉️ Communications & Déplacements
- Rattachement d'e-mails et courriers au dossier avec classification d'urgence.
- Générateur de projet de réponse d'avancement pour travailler sans être interrompu.
- Ordres de déplacement (train, hébergement, consignes EPI, checklist).
- Suivi des courriers recommandés (LRAR) et numéros de suivi postal.

---

## 2. Démarrage Rapide & Installation Locale

### Prérequis
- **Node.js** v20+ (testé et validé sur Node v22 et v24).
- **npm** v10+.

### Installation
```bash
# 1. Cloner le dépôt privé
git clone <url-du-depot-github>
cd vp-expertise-app

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env

# 4. Lancer l'application en mode développement
npm run dev
```

L'application démarre automatiquement sur : **http://localhost:3001** (ou http://localhost:5173 en mode proxy Vite).
*Note : Au premier lancement, la base SQLite locale est automatiquement initialisée et alimentée avec un jeu de données synthétiques réalistes (dossiers ferroviaires de démonstration, factures de contrôle 097, 098, 099 et écritures d'octobre 2026).*

### Lancement des Tests Automatisés
```bash
npm test
```
*Vérifie mathématiquement la concordance des factures 097, 098, 099 au centime affiché, les calculs de barème kilométrique (0,95 €/km), la TVA 20% et le verrou anti-double facturation.*

### Build pour Production
```bash
# Compiler le frontend React/Vite
npm run build

# Démarrer le serveur de production (sert l'API et le client statique)
npm start
```

---

## 3. Checklist de Transfert : GitHub → Google AI Studio Build Mode (§ 8 bis)

Ce projet a été rigoureusement conçu selon les contraintes du § 8 bis du brief pour un import immédiat dans **Google AI Studio (mode Build)**.

### ✅ Étape 1 : Vérification de la propreté du dépôt Git
- [x] **Aucun document client confidentiel dans Git** : Le fichier `.gitignore` exclut formellement les répertoires `sources/`, `work/`, `data/`, uploads, ainsi que tous fichiers `*.xlsx`, `*.docx`, `*.pdf`, `*.rtfd`.
- [x] **Aucun secret côté client** : Les variables de configuration sont réservées au serveur via `.env`.
- [x] **Indépendance des runtimes** : Aucune dépendance vers Python, LibreOffice ou binaire OS local pour l'exécution quotidienne. Les générateurs DOCX et XLSX tournent en pur JavaScript (Node.js).

### 🚀 Étape 2 : Push sur GitHub privé
```bash
# Vérifier l'état du dépôt
git status

# Ajouter les fichiers applicatifs
git add .
git commit -m "feat: initial commit VP Expertise app compliant with Brief V3"

# Associer au dépôt GitHub privé et pousser
git remote add origin https://github.com/<votre-organisation>/<votre-depot-prive>.git
git branch -M main
git push -u origin main
```

### ☁️ Étape 3 : Import dans Google AI Studio
1. Se connecter à [Google AI Studio](https://aistudio.google.com/).
2. Ouvrir le mode **Build**.
3. Sélectionner **Import from GitHub** et choisir le dépôt privé créé ci-dessus.
4. Dans les paramètres d'environnement d'AI Studio (**Secrets / Environment Variables**), renseigner :
   - `PORT` : la variable fournie par AI Studio (ou laisser par défaut `3001`).
   - `NODE_ENV` : `production`.
   - `DB_PATH` : chemin persistant configuré (ex. `./data/vp_expertise.db`).
   - `GEMINI_API_KEY` : *(Optionnel)* Si vous souhaitez activer l'assistance IA sur les suggestions de réponse ou l'analyse des pièces. Laisser vide pour le mode 100% manuel et local.
5. Lancer le build : AI Studio exécutera `npm install` et `npm run build`, puis démarrera le serveur via `npm start`.

---

## 4. Architecture Technique

```
.
├── server/                 # Backend Node.js / Express
│   ├── index.ts            # Point d'entrée serveur HTTP & statique
│   ├── db.ts               # Base SQLite persistante (better-sqlite3 + WAL mode)
│   ├── api.ts              # Routes REST complètes
│   ├── docx.ts             # Moteur natif de génération DOCX (Word)
│   ├── excel.ts            # Moteur natif Excel (Compta TVA & Suivi règlements)
│   └── seed.ts             # Données synthétiques de démonstration
├── src/                    # Frontend React 19 + TypeScript + Vite
│   ├── App.tsx             # Routeur d'onglets et état global
│   ├── main.tsx            # Bootstrap React
│   ├── api.ts              # Client API typé
│   ├── components/         # Header, Saisie rapide, Création dossier
│   └── views/              # Aujourd'hui, Dossiers, Fiche Mission, Honoraires, Compta
├── shared/
│   └── types.ts            # Modèle de données partagé (TypeScript)
├── tests/
│   └── billing.test.js     # Tests unitaires déterministes
└── data/                   # Données persistantes locales (gitignored)
    ├── vp_expertise.db     # Base de données SQLite
    └── uploads/            # Pièces justificatives et photos
```

---

## 5. Limites Connues & Points à Valider à l'Usage

1. **Format du rapport d'expertise** : La trame livrée est structurée pour la mécanique ferroviaire, mais le gabarit Word spécifique de Valentine (avec ses en-têtes et chartes particulières) sera ajusté dès réception de ses modèles types.
2. **Facturation électronique (réforme française)** : L'application génère des données prêtes pour une chaîne d'émission conforme (factures électroniques), mais ne se substitue pas à une Plateforme de Dématérialisation Partenaire (PDP) ou au Portail Public de Facturation (PPF).
3. **Connecteur e-mail** : L'import et le classement de messages fonctionnent par copier-coller ou chargement de fichiers `.eml`. L'accès automatique direct à la boîte de messagerie réelle nécessitera les autorisations IMAP/OAuth de son fournisseur de messagerie.
