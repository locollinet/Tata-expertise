# Déploiement Firebase pour les Preuves & Personnalisation des Paramètres par Dossier

Intégration d'une infrastructure cloud Firebase (Firestore et Authentification Google) pour sécuriser et pérenniser le dépôt de toutes les preuves techniques (photos terrain haute définition, documents PDF, constats contradictoires), tout en offrant un paramétrage sur-mesure à l'échelle de chaque mission (taux d'expert, taux de déplacement, barème kilométrique et seuil d'alerte de facturation).

## Décisions Clés & Réponses de Cadrage

> [!IMPORTANT]
> Les réponses aux questions de cadrage ont fixé les arbitrages majeurs suivants pour le déploiement :
> - **Périmètre des Preuves dans Firebase** : Stockage structuré des photos terrain (clichés, métadonnées, exifs, sélection rapport), des pièces justificatives PDF (PV de constat, ordonnances, dires, devis), et des métadonnées probatoires associées.
> - **Paramétrage Tarifaire à l'Échelle du Dossier** : Chaque dossier hérite des taux standards de Valentine (`DEFAULT_HOURLY_RATE = 190 €/h`, `TRAVEL_HOURLY_RATE = 135 €/h`, `KILOMETER_RATE = 0,95 €/km`, `BILLING_THRESHOLD_REMINDER = 3 500 €`), mais l'experte peut surcharger individuellement ces 4 paramètres directement dans la fiche du dossier.
> - **Contrôle d'Accès** : Authentification Google via Firebase Auth avec politique Zero-Trust et règles de sécurité Firestore strictes (RBAC garantissant l'intégrité probatoire des pièces).

---

## 1. Vue d'Ensemble & Périmètre Fonctionnel

### Qu'apporte cette évolution ?
1. **Dépôt & Consultation Pérenne des Preuves (Photos & PDF)** :
   - Dépôt glisser-déposer (Drag & Drop) de clichés haute définition et de rapports/pièces d'expertise PDF.
   - Indexation et horodatage probatoire certifié des pièces (date/heure de prise de vue, géolocalisation ou lieu de constat, légende technique, statut de sélection pour le rapport Word final).
   - Synchronisation temps réel Firestore des métadonnées de preuves entre terminaux (ordinateur portable du cabinet, tablette sur chantier, smartphone de terrain).
2. **Paramétrage Granulaire par Dossier (Taux & Alertes)** :
   - Écran de configuration dédié dans la Fiche Mission pour surcharger :
     - Taux horaire d'expert (par défaut 190 €/h)
     - Taux horaire de déplacement (par défaut 135 €/h)
     - Barème kilométrique spécifique (par défaut 0,95 €/km)
     - Seuil d'alerte de facturation d'étape (par défaut 3 500 € HT)
   - Recalcul déterministe immédiat des activités et frais associés lors de la saisie d'un temps ou d'un déplacement sur ce dossier.
   - Notification proactive dans l'onglet « Aujourd'hui » dès que le cumul non facturé du dossier atteint le seuil personnalisé défini pour cette mission.
3. **Sécurité & Authentification** :
   - Connexion sécurisée Google Firebase Auth avec bandeau de statut discret.
   - Protection des pièces sensibles selon les règles déontologiques et judiciaires d'expertise.

---

## 2. Expérience Utilisateur & Design d'Interface

### Parcours Utilisateur
1. **Accès & Authentification** :
   - Un bouton d'authentification Google discret dans le header (« Connexion Valentine Pécheux ») affiche le statut de session et l'avatar sécurisé.
   - En mode déconnecté, une invite fluide permet de s'authentifier en un clic via popup Google sans interruption du travail.
2. **Fiche Dossier — Section « Paramètres Tarifaires du Dossier »** :
   - Intégration d'un sous-volet « Tarification & Seuil d'Alerte » dans la vue détaillée de la mission.
   - Switch intuitif « Utiliser les taux standards du cabinet » vs « Personnaliser pour ce dossier ».
   - Affichage immédiat d'une pastille informative : *« Taux appliqués : 190 €/h étude / 135 €/h trajet / 0,95 €/km · Seuil d'étape : 3 500 € »*.
   - Modification en direct avec sauvegarde instantanée et recalcul des totaux de prestations non facturées.
3. **Galerie & Registre des Preuves** :
   - Onglet « Preuves & Clichés » repensé dans la Fiche Mission avec zone de téléversement Drag & Drop réactive.
   - Prévisualisation instantanée des miniatures, badge de statut d'intégration au rapport final, saisie de la légende technique et date du constat.
   - Visualiseur plein écran de photos et aperçu des documents PDF sans rechargement.

### Charte Visuelle & Finitions (anti-slop)
- **Palette** : Bleu marine institutionnel ferroviaire (`#0f3854`), ardoise profonde (`#0f172a`), fond blanc épuré (`#f8fafc`), accents ambre/rose discrets pour les alertes de seuil.
- **Typographie** : `Plus Jakarta Sans` pour la structure de navigation et les titres, combinée à une typographie à espacement fixe (`tabular-nums` / `font-mono`) pour tous les calculs monétaires et barèmes kilométriques.
- **Zéro-Pill** : Séparateurs textuels typographiques sobres (`·`, `/`) au lieu de badges capsules superposés.

---

## 3. Choix d'Architecture & Arbitrages Techniques

### Décision 1 : Modèle Hybride Local-First & Cloud Firestore
- **Approche retenue** : Architecture hybride synchrone.
  - La base SQLite locale continue d'assurer les calculs ultra-rapides, la génération native des documents Word (`.docx`) et classeurs Excel (`.xlsx`), et les tests déterministes.
  - Firestore stocke et synchronise en temps réel la collection des preuves (`evidence_items`), photos annotées et pièces PDF, ainsi que les surcharges de configuration de dossiers.
- **Bénéfice** : Zéro régression sur le moteur Word/Excel déterministe déjà validé, tout en assurant la persistance cloud pérenne des preuves téléversées depuis n'importe quel appareil.

### Décision 2 : Stockage des Fichiers de Preuves
- **Approche retenue** : Les métadonnées probatoires (hash, horodatage, auteur, légende, tags, ordre de rapport) sont stockées dans Firestore dans `/missions/{missionId}/evidences/{evidenceId}`. Les fichiers volumineux ou originaux sont téléversés avec stockage persistant local et synchronisation des aperçus/binaires optimisés.

### Décision 3 : Surcharges Tarifaires au Niveau de la Mission
- **Approche retenue** : Chaque enregistrement `missions` comprend les champs `custom_hourly_rate`, `custom_travel_rate`, `custom_km_rate`, et le nouveau champ `custom_billing_threshold`.
- **Règle de résolution** : `taux_effectif = mission.custom_rate ?? CONFIG.DEFAULT_RATE`.

---

## 4. Architecture Technique & Flux de Données

```
┌────────────────────────────────────────────────────────────────────────┐
│                          NAVIGATEUR CLIENT                             │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │   Firebase Auth       │             │   Interface React 19       │  │
│  │  (Google Sign-In)     │             │  - Fiche Mission & Tarifs  │  │
│  └──────────┬────────────┘             │  - Registre des Preuves    │  │
│             │ Token                    │  - Saisie Rapide & Factures│  │
│             ▼                          └─────────────┬──────────────┘  │
│  ┌───────────────────────┐                           │                 │
│  │   Firestore SDK       │◄──────────────────────────┘                 │
│  │  - evidences          │                                             │
│  │  - mission_rates      │                                             │
│  └──────────┬────────────┘                                             │
└─────────────┼──────────────────────────────────────────────────────────┘
              │ Synchronisation Cloud
              ▼
┌──────────────────────────────────────────────┐
│            FIREBASE CLOUD                    │
│  ┌────────────────────────────────────────┐  │
│  │  Firestore Security Rules (ABAC)       │  │
│  │  /missions/{id}/evidences/{doc}        │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
              ▲
              │ REST API (/api/...)
┌─────────────┴──────────────────────────────────────────────────────────┐
│                      SERVEUR EXPRESS BACKEND                           │
│                                                                        │
│  ┌────────────────────┐   ┌────────────────────┐   ┌────────────────┐  │
│  │  Routes Missions   │   │  Moteur Word/Excel │   │  SQLite WAL DB │  │
│  │  & Taux Surchargés │   │  (.docx & .xlsx)   │   │  (Calculs &    │  │
│  └────────────────────┘   └────────────────────┘   │   Invariants)  │  │
│                                                    └────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Plan d'Exécution par Étapes

1. **Étape 1 : Provisioning Firebase & Authentification**
   - Lancement de la procédure de provisionnement Firebase via les outils AI Studio (`show_aistudio_ui` avec `ui_type: "firebase_setup"` puis `ProvisionFirebase`).
   - Mise en place de `firebase-blueprint.json` et des règles `firestore.rules` validées avec tests de sécurité et ESLint.
   - Initialisation du SDK Firebase client (`src/firebase.ts`) et composant de connexion Google Auth.

2. **Étape 2 : Personnalisation des Taux & Alertes par Dossier**
   - Ajout des champs de configuration dans la base (`custom_billing_threshold`, `custom_hourly_rate`, `custom_travel_rate`, `custom_km_rate`).
   - Ajout du panneau d'édition des taux et seuils dans `src/views/MissionDetailView.tsx`.
   - Adaptation du moteur de calcul des prestations pour appliquer prioritairement les taux du dossier.
   - Mise à jour du calcul des alertes du tableau de bord (`TodayView.tsx` et `Header.tsx`) en tenant compte du seuil spécifique du dossier.

3. **Étape 3 : Registre des Preuves & Synchronisation Cloud**
   - Composant de glisser-déposer de preuves (photos terrain haute définition, documents PDF).
   - Enregistrement des métadonnées dans Firestore et stockage des pièces.
   - Intégration dynamique des photos sélectionnées dans le générateur de rapport d'expertise Word `.docx`.

4. **Étape 4 : Tests & Validation**
   - Validation de non-régression des tests unitaires déterministes existants (`npm test`).
   - Vérification de la compilation TypeScript (`lint_applet` & `compile_applet`).
