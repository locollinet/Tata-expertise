# 📋 Tata-expertise (En cours de finalisation)

- **Pôle** : 👨‍👩‍👧‍👦 Proches & Pilotes Terrain (Tante — Expertise)
- **Repo GitHub** : https://github.com/locollinet/Tata-expertise
- **Fiche Notion App** : https://app.notion.com/p/40e705b3311a81c4b2c6e5f500126a98 (`40e705b3-311a-81c4-b2c6-e5f500126a98`)
- **Dossier Google Drive (Pièces lourdes - Drive Personnel)** : https://drive.google.com/drive/folders/1eeybaFYmT4iMBVEAwegEFTATETKu6o9J (`1eeybaFYmT4iMBVEAwegEFTATETKu6o9J`)
- **Stack** : GCP Cloud Run + Firebase DB + Firebase Auth + Gemini Flash IA

## 🔒 Règle Stricte d'Isolation de ce Projet (Repo Unique)
- **Projet actif** : `Tata-expertise`
- **Dossier autorisé unique** : `/Users/loulou/Desktop/Studio-Louls/Tata-expertise`
- **Repo GitHub autorisé unique** : `https://github.com/locollinet/Tata-expertise`
- **Interdiction absolue** de lire/modifier le code d'un autre dossier d'application ou de faire un `git push` vers un autre dépôt que `https://github.com/locollinet/Tata-expertise`. Toujours vérifier `pwd` et `git remote -v` avant de commiter/pousser.

---

# 🍷 Règles & Contexte Permanent — Studio Loul's & Offres Commerciales avec Pierre Thos (dont Cepia)

Tu travailles avec **Loul's** au sein du **Studio Loul's**. Toutes les règles ci-dessous sont permanentes : **tu ne dois jamais demander à Loul's de réexpliquer son organisation, sa stack technique, ses liens Notion ou son Google Drive.**

---

## 🏛️ 1. Vue d'Ensemble du Studio Loul's (Les 7 Applications)

Le Studio Loul's regroupe **7 applications** dans `/Users/loulou/Desktop/Studio-Louls` :

### A. 🍾 Les 2 Applications Commercialisées avec Pierre Thos (Directeur Commercial — Loul's & Thosti)
Ces 2 applications ne sont pas des logiciels figés vendus en boîte : ce sont nos **socles de démonstration** (couvrant déjà 80% du métier) que nous personnalisons à **100% sur-mesure** (les 20% restants) autour des habitudes de chaque client :
1. **Cepia (`Cave-Thos-Loul-s-AI-Studio`)** : Gestion de cave haute précision pour **Hôtels-Restaurants, Palaces, Maisons de négoce** et **Négociants / Cavistes indépendants** (cartographie des caves/casiers/températures, rotation des stocks, valorisation financière, sommellerie assistée par IA, accès multi-rôles).
2. **Domaine Viticole (`Domaine-viticole-avec-Thos-Loul-s`)** : Gestion d'un **domaine viticole de bout en bout**, de la vigne à la commercialisation (parcelles, traitements phytosanitaires obligatoires 2027/2028, vendanges, cuverie en hectolitres `hL`, analyses labo, assemblages traçables, mises en bouteille/BIB, matières sèches, ventes et préparation DRM Douanes mensuelle).

### B. 👨‍👩‍👧‍👦 Les 5 Applications Proches & Pilotes Terrain (Preuves en Production)
3. **Premnord (`Premnord`)** : Gestion de la cave du restaurant Premnord en Bourgogne dirigé par l'oncle de Loul's (utilisée au quotidien avec son sommelier). **En production réelle** — sert de référence commerciale #1. *(⚠️ Attention : l'URL live pointe sur leur BDD Firebase de production réelle).*
4. **Cave-des-Peress (`Cave-des-Peress`)** : Gestion de l'activité de négoce en vin indépendant de l'oncle de Loul's. **En production depuis 1 an**.
5. **Tata-expertise (`Tata-expertise`)** : Application métier pour l'activité d'expertise de la tante de Loul's. **En cours de finalisation** (pas encore utilisée en prod).
6. **Parcelles-vendanges (`Parcelles-vendanges`)** : Application terrain pour aider à gérer les parcelles et les vendanges au **Domaine Olivier Leflaive**.
7. **App-Thosti (`App-Thosti`)** : Application de configuration et suivi de cave développée auprès de Pierre Thos et son frère Florent.

---

## ⚙️ 2. Stack Technique & Cycle de Fabrication (Antigravity ➔ GitHub ➔ AI Studio)

1. **Où l'on code** :
   - **Antigravity** : Le lieu central où Loul's pose ses questions, prépare ses specs avec Notion/Drive et réalise les modifications d'architecture et de code en profondeur.
   - **Google AI Studio** : L'environnement tout-en-un interconnecté pour les ajustements rapides et le déploiement.
2. **Pont Central — GitHub** :
   - Chaque application possède son propre dépôt GitHub (`https://github.com/locollinet/<Nom-App>`).
   - Quand une modification est terminée dans Antigravity, on fait un `git commit` et `git push` vers le dépôt GitHub de l'application.
3. **Déploiement Production — 1-Click Publish via Google AI Studio** :
   - Depuis Google AI Studio, Loul's fait un **Pull** depuis GitHub puis clique sur **Publier (Publish)**.
   - Tout tourne sur **100% Google Cloud** :
     - **Serveurs GCP (Cloud Run)** haute disponibilité.
     - **Base de données Firebase (Firestore / Realtime DB)** temps réel.
     - **Authentification Native Google / Firebase Auth** : ne **jamais** bricoler de système d'authentification maison risqué ; toujours utiliser le standard officiel AI Studio / Firebase Auth.
     - **IA Embarquée : Modèles Gemini Flash** légers et ultra-rapides intégrés à l'intérieur des applications clients (lecture de factures PDF/photo, bulletins d'analyse labo, saisie vocale, assistant en langage naturel). L'IA assiste la saisie mais demande toujours une validation humaine avant d'impacter les stocks ou registres réglementaires.
4. **Motion Design & Marketing** :
   - Loul's utilise également VS Code + GitHub Copilot (Claude Opus 5.5 Motion Design) pour générer des vidéos marketing pour Pierre et des tutoriels de formation de 2 minutes pour les équipes des clients.

---

## 🔄 3. Fonctionnement Interconnecté avec Notion & Google Drive (Amont ➔ Aval)

Tu as un accès direct en lecture et écriture à **Notion** (via les outils MCP `notion_notion`) et à **Google Drive** (via la CLI `gdrive` connectée à `locollinet@gmail.com`). **C'est toi (Antigravity) qui assures la synchronisation intelligente entre Notion, Google Drive et le code :**

### A. Gestion des Documents & Pièces Lourdes (Les 2 sens fonctionnent automatiquement)
- **Cas 1 — Loul's dépose un fichier ou des notes directement dans le chat Antigravity** :
  - Si c'est une pièce lourde (PDF, facture, modèle DRM douanes, photo, Excel, HTML, vidéo), **uploade-la automatiquement dans le bon sous-dossier Google Drive** avec `gdrive mutate upload <fichier> --parent <FOLDER_ID>`.
  - Récupère son URL Drive (`gdrive readonly url <FILE_ID>`) et **crée ou mets à jour la fiche correspondante dans Notion** en renseignant la colonne `Lien_Drive`.
- **Cas 2 — Loul's ou Pierre déposent un fichier directement dans Google Drive** :
  - Dès que Loul's te le signale (ou te demande de regarder dans le Drive), utilise `gdrive readonly ls <FOLDER_ID>` puis `gdrive readonly export` (pour les Google Docs/Sheets) ou `gdrive readonly download` pour lire le document, et **mets à jour Notion** (compte-rendu + spécifications fonctionnelles).

### B. Suivi Amont (Calls Prospects avec Pierre & Retours des Proches)
- Tout retour d'un proche (ex: oncle sur Premnord) ou compte-rendu de RDV prospect avec Pierre (ex: Château Laymajoux) est enregistré dans la base Notion **🎯 Prospects, Clients & Calls** (`data_source_id: 2329a97e-da98-4028-9e3a-4c52755cc51d`).
- Les besoins identifiés sont découpés et packagés en fiches actionnables dans la base Notion **🛠️ Spécifications Fonctionnelles & Suivi des Évolutions** (`data_source_id: 38151d7d-b5e5-4636-909c-88ec443df406`) :
  - Statut initial : `💡 Retour Call / Idée (Amont)` ou `📐 Spec Prête (À coder Antigravity)`.
  - Remplir systématiquement le champ `Brief_Antigravity` et le corps de la page avec les critères fonctionnels précis pour que le développement ultérieur soit immédiat.

### C. Suivi Aval (Pendant et Après le Code dans Antigravity)
- **Avant de coder une évolution** : Si Loul's te demande de coder une fonctionnalité liée à une spec Notion, lis la fiche dans **🛠️ Spécifications Fonctionnelles** et passe son `Statut` à **`🧑‍💻 En dev (Antigravity)`**.
- **Après le code et le `git push`** :
  1. Passe automatiquement le `Statut` de la spec dans Notion à **`🐙 Push GitHub (À pull AI Studio)`**.
  2. Mets à jour la colonne **`Etat_Aval`** de l'application concernée dans la base **📱 Catalogue des Applications** (`data_source_id: 297167dc-66ae-4e27-ac3c-0341b93977f5`) pour tracer où on en est sur cette app.
- **Après le Pull & Publish dans AI Studio** : Passe le `Statut` de la spec à **`🚀 Déployé (AI Studio / Prod)`**.

---

## 🧭 4. Référentiel Exact des Identifiants Notion (MCP `notion_notion`)

- **Page QG Centrale** : `Studio Loul's — QG Apps, Specs & Commercial (Avec Pierre / Cepia)`
  - Page ID : `40e705b3-311a-811c-b756-d9d0df367d81`
  - URL : https://app.notion.com/p/40e705b3311a811cb756d9d0df367d81
- **Base 1 — 📱 Catalogue des Applications** :
  - Database ID : `bf87b827-243f-4719-9d17-db3ee5c6fafa`
  - Data Source ID (`collection://`) : `297167dc-66ae-4e27-ac3c-0341b93977f5`
  - Colonnes exactes : `Application` (TITLE), `Pôle` (SELECT: `'🍾 Commercial avec Pierre (Loul''s & Thosti)'`, `'👨‍👩‍👧‍👦 Proches & Pilotes Terrain'`), `Statut` (STATUS: `'En cadrage'`, `'En finalisation'`, `'Socle Démo Commerciale'`, `'En Production'`), `Cible` (TEXT), `GitHub` (URL), `URL_Live` (URL), `Dossier_Drive` (URL), `Dossier_Local` (TEXT), `Stack` (MULTI_SELECT), `Etat_Aval` (TEXT), `Prospects & Clients Liés` (RELATION), `Specs & Évolutions` (RELATION).
- **Base 2 — 🎯 Prospects, Clients & Calls (CRM & Retours Terrain)** :
  - Database ID : `c00f627a-f6ef-4208-960b-344133589b79`
  - Data Source ID (`collection://`) : `2329a97e-da98-4028-9e3a-4c52755cc51d`
  - Colonnes exactes : `Prospect_Client` (TITLE), `Type` (SELECT: `'🍇 Prospect Domaine Viticole'`, `'🥂 Prospect Cave / CHR / Négoce'`, `'🤝 Proche / Pilote en Prod'`, `'🏢 Concurrent / Écosystème'`), `Statut` (STATUS: `'À contacter'`, `'RDV / Découverte'`, `'Cadrage & Démo sur-mesure'`, `'Proposition envoyée'`, `'Actif / En Production'`, `'Veille / Référence'`), `App_Cible` (RELATION), `Interlocuteur` (TEXT), `Responsable` (SELECT: `'Loul''s & Pierre'`, `'Pierre (Thosti)'`, `'Loul''s'`), `Dernier_Echange` (DATE), `Lien_Drive` (URL), `Synthese` (TEXT), `Specs & Besoins Générés` (RELATION).
- **Base 3 — 🛠️ Spécifications Fonctionnelles & Suivi des Évolutions (Amont ➔ Aval)** :
  - Database ID : `6bf3e1f6-df93-4e98-8b19-235c01e54709`
  - Data Source ID (`collection://`) : `38151d7d-b5e5-4636-909c-88ec443df406`
  - Colonnes exactes : `Spec_Evolution` (TITLE), `Statut` (STATUS: `'💡 Retour Call / Idée (Amont)'`, `'📐 Spec Prête (À coder Antigravity)'`, `'🧑‍💻 En dev (Antigravity)'`, `'🐙 Push GitHub (À pull AI Studio)'`, `'🚀 Déployé (AI Studio / Prod)'`), `Application` (RELATION), `Origine` (RELATION), `Priorité` (SELECT: `'🔥 Critique / MVP'`, `'⚡ Haute'`, `'📌 Moyenne'`, `'🧊 Phase 2 / Basse'`), `Module` (SELECT: `'🍇 Vigne & Parcelles'`, `'🍷 Chai & Cuverie'`, `'📦 Stocks & Logistique'`, `'💶 Ventes & DRM Douanes'`, `'🍾 Cave & Sommellerie'`, `'🤖 IA Gemini Flash'`, `'🔐 Auth / Firebase / Tech'`, `'🎬 Motion Design / Marketing'`), `Brief_Antigravity` (TEXT), `Lien_Drive` (URL).

---

## 📁 5. Référentiel Exact Google Drive (`gdrive` CLI)

### A. 🍾 Drive Partagé (`Cepia - By Loul’s & Thosti`) — STRICTEMENT pour les 2 Offres Commerciales avec Pierre Thos
- **Dossier Racine Partagé** : `1KDNwAw8_cjhoY8ckHxCbrc5Ts3gcAi9f` (https://drive.google.com/drive/folders/1KDNwAw8_cjhoY8ckHxCbrc5Ts3gcAi9f)
  - **`01 - Apps & Specs Techniques (Pièces lourdes)`** : `1vcSSLmzpDJIoBYRgvCXxtc-8mX6SMVPm`
    - Sous-dossier `Cave-Thos-Loul-s-AI-Studio` (Cepia) : `1REAWXTqmpYwNVwv8ex_bapqVirrV6YUH`
    - Sous-dossier `Domaine-viticole-avec-Thos-Loul-s` : `1J6XeQ-MNY3r3TiMpxwRJzTWHp0ClWjOM`
  - **`02 - Prospects & Clients (Docs & Audits)`** : `1B2F6nvixYqsGTwH-iQXx2dUcXHvdiWdc`
  - **`03 - Démos & Motion Design (Support Commercial)`** : `1LPLHHVDwQPlpJTaGgH65rHOELr0YoYHw`
  - **Documents clés à la racine du Drive Partagé** :
    - `Analyse concurrent Isagri` : `10TbMfNT5yS9bzeAhmMtSkThBx7sFF6gOozIuMcoSXNA`
    - `RDV Domaine Viticole - Softwine` (Château Laymajoux) : `1-dkBoOhe5wtQquuRSqCU8zm8ze_fxxGZOo5YiFXZYRs`
    - `Liens apps démos Cepia` : `10lSfqVvLjga9iqkYWzbq3mPhloi5wlUoEvyV0zdOrzE`
    - `Template mail générique Cepia` : `10_mBAtLl5nl0NoB9QzXh6g2DJ4WPlOG9EEdy1cgpZDk`
    - `pitch-pense-bete v2.html` : `1N6J9_qHSHRECBc83bziYV0oUIWP79zlA`
    - `architecture_workflow_pierre.html` : `1T3ahL0Ubwmub6ePTX7CoxU_dT6mWjraU`

### B. 👨‍👩‍👧‍👦 Drive Personnel de Loul's (`Mon Drive`) — STRICTEMENT pour les 5 Applications Proches & Pilotes
- **Dossier Parent Personnel** : `Studio Loul's - Apps Proches & Pilotes` : `1-iH_VF83aj8ZQUWuOAR-ryo-5402JYtb` (https://drive.google.com/drive/folders/1-iH_VF83aj8ZQUWuOAR-ryo-5402JYtb)
  - Sous-dossier `Premnord` : `1lurXDxP9kot09ioaosGWONLbwcgq_No9` (https://drive.google.com/drive/folders/1lurXDxP9kot09ioaosGWONLbwcgq_No9)
  - Sous-dossier `Tata-expertise` : `1eeybaFYmT4iMBVEAwegEFTATETKu6o9J` (https://drive.google.com/drive/folders/1eeybaFYmT4iMBVEAwegEFTATETKu6o9J)
  - Sous-dossier `Cave-des-Peress` : `1NqnR3-ave9mhHKfG3J1imj2MjAbqjnys` (https://drive.google.com/drive/folders/1NqnR3-ave9mhHKfG3J1imj2MjAbqjnys)
  - Sous-dossier `Parcelles-vendanges` : `1X3BoB6qtZnJ5dX2q66192yZ33TLXSoNn` (https://drive.google.com/drive/folders/1X3BoB6qtZnJ5dX2q66192yZ33TLXSoNn)
  - Sous-dossier `App-Thosti` : `16ZfPx35LcEt23stW9PQ_6Ac7lyxXms5H` (https://drive.google.com/drive/folders/16ZfPx35LcEt23stW9PQ_6Ac7lyxXms5H)

---

## 🔒 6. Règle Critique d'Isolation des Applications & Repos GitHub

- **Isolation stricte par dossier** : Le dossier parent `/Users/loulou/Desktop/Studio-Louls` n'est **jamais** un dépôt Git. Chaque sous-dossier d'application possède son propre dépôt `.git` indépendant pointant exclusivement vers son repo GitHub dédié.
- **Zéro écriture croisée** : Lorsque tu travailles sur une application (ex: `Cave-Thos-Loul-s-AI-Studio`), il est **strictement interdit** de créer, modifier ou supprimer des fichiers dans le dossier d'une autre application.
- **Vérification obligatoire avant `git push`** : Avant tout `git commit` ou `git push`, toujours vérifier avec `git remote -v` et `pwd` que tu es bien dans le dossier de l'application cible et que l'URL `origin` correspond exactement au repo attendu.

---

## 📱 7. Tableau Récapitulatif des 7 Applications (`/Users/loulou/Desktop/Studio-Louls/`)

| Application | Pôle | Dossier Local | Repo GitHub | URL Live AI Studio | Notion Page ID | Emplacement & ID Dossier Drive |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Cepia (`Cave-Thos-Loul-s-AI-Studio`)** | 🍾 Commercial Pierre | `/Users/loulou/Desktop/Studio-Louls/Cave-Thos-Loul-s-AI-Studio` | `https://github.com/locollinet/Cave-Thos-Loul-s-AI-Studio` | `https://cave-de-loul-s-thos.ai.studio` | `40e705b3-311a-8169-a65f-e903a5d55afc` | 🍾 Drive Partagé : `1REAWXTqmpYwNVwv8ex_bapqVirrV6YUH` |
| **Domaine Viticole (`Domaine-viticole-avec-Thos-Loul-s`)** | 🍾 Commercial Pierre | `/Users/loulou/Desktop/Studio-Louls/Domaine-viticole-avec-Thos-Loul-s` | `https://github.com/locollinet/Domaine-viticole-avec-Thos-Loul-s` | `https://domaine-des-trois-coteaux-thos-loul-s.ai.studio` | `40e705b3-311a-81a4-bb3d-c615479ff875` | 🍾 Drive Partagé : `1J6XeQ-MNY3r3TiMpxwRJzTWHp0ClWjOM` |
| **Premnord** | 👨‍👩‍👧‍👦 Proches (Prod) | `/Users/loulou/Desktop/Studio-Louls/Premnord` | `https://github.com/locollinet/Premnord` | `https://suivi-app-premnord.ai.studio` | `40e705b3-311a-81db-a5f4-df91b931e916` | 🏠 Drive Perso : `1lurXDxP9kot09ioaosGWONLbwcgq_No9` |
| **Cave-des-Peress** | 👨‍👩‍👧‍👦 Proches (Prod) | `/Users/loulou/Desktop/Studio-Louls/Cave-des-Peress` | `https://github.com/locollinet/Cave-des-Peress` | — | `40e705b3-311a-81a9-94de-dd7aef526db7` | 🏠 Drive Perso : `1NqnR3-ave9mhHKfG3J1imj2MjAbqjnys` |
| **Tata-expertise** | 👨‍👩‍👧‍👦 Proches (Finalisation) | `/Users/loulou/Desktop/Studio-Louls/Tata-expertise` | `https://github.com/locollinet/Tata-expertise` | — | `40e705b3-311a-81c4-b2c6-e5f500126a98` | 🏠 Drive Perso : `1eeybaFYmT4iMBVEAwegEFTATETKu6o9J` |
| **Parcelles-vendanges** | 👨‍👩‍👧‍👦 Pilote (Olivier Leflaive) | `/Users/loulou/Desktop/Studio-Louls/Parcelles-vendanges` | `https://github.com/locollinet/Parcelles-vendanges` | — | `40e705b3-311a-8193-bcf5-f1f206281740` | 🏠 Drive Perso : `1X3BoB6qtZnJ5dX2q66192yZ33TLXSoNn` |
| **App-Thosti** | 👨‍👩‍👧‍👦 Pilote (Pierre & Florent) | `/Users/loulou/Desktop/Studio-Louls/App-Thosti` | `https://github.com/locollinet/App-Thosti` | — | `40e705b3-311a-81de-a96b-c25b582d0418` | 🏠 Drive Perso : `16ZfPx35LcEt23stW9PQ_6Ac7lyxXms5H` |
