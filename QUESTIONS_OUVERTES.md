# Questions Ouvertes & Hypothèses Métier — VP Expertise

Ce document recense les points métier et techniques observés lors de l'analyse des sources et du brief, les hypothèses retenues pour l'application locale, et les validations à confirmer lors de l'essai utilisateur avec Valentine Pécheux et son cabinet comptable.

---

## 1. Facturation & Tarification

### 1.1 Taux horaires et barèmes constatés
- **Constat dans les registres 2024–2026** :
  - Prestations d'expertise, analyse de documents, études, rédaction : **190,00 € HT / heure**.
  - Temps passé en déplacement : **135,00 € HT / heure**.
  - Frais kilométriques pour véhicule personnel : **0,95 € HT / km**.
  - TVA standard : **20,00 %**.
- **Hypothèse retenue** : Ces taux sont définis comme valeurs par défaut modifiables par dossier (dans la fiche mission), sans impact rétroactif sur les factures déjà émises.
- **Point à valider** : Les taux de 190 €/h et 135 €/h s'appliquent-ils universellement ou existent-ils des grilles spécifiques par compagnie d'assurance ou convention judiciaire ?

### 1.2 Divergences documentées sur les trois factures de contrôle
- **Facture 2026-097 (Mission VP2026922 - Ligne 18 Trémie)** :
  - L'objet Word indique : *« Mission d’expertise depuis le 28/07/2026 – Réunion du 25/09/2026 »*.
  - Le tableau copié depuis Excel mentionne en ligne R41 : *« Expertise à Massy le 22/07/2026 »*.
  - Dans la colonne J/O du registre, la réunion du 25/09 est explicitement consignée (`O28: 25/09 : Trajet2Expertise1,5`).
  - *Hypothèse* : Le libellé exact de la prestation était bien l'expertise du 25/09/2026, la mention 22/07 étant issue d'un copier-coller de l'étape précédente. Le montant facturé (2 354,30 € HT) est mathématiquement exact.
- **Facture 2026-098 (Mission VP2025915 - Forwardis Clermont-Gravanche)** :
  - L'objet Word indique : *« Mission depuis le 17/08/2025 – Réunion d’expertise judiciaire le 09/09/2026 »*.
  - La cellule O39 du registre indique : *« W depuis le 17/08/2026 + Expertise à Fos le 09/09/2026 »*.
  - *Hypothèse* : La coquille figurait dans la note Excel (17/08/2026 pour 2025). Le montant facturé (3 194,80 € HT) est exact au centime.
- **Pointage 2026, Feuille 2026, Cellule FC3** :
  - Décalage de numérotation des jours : la colonne FB porte le libellé 3, FC porte également le libellé 3 (au lieu de 4 juin), et FD porte 5.
  - *Hypothèse* : Erreur typographique dans la ligne d'en-tête du tableur source. Les dates réelles sont gérées par calendrier natif dans l'application.

---

## 2. Continuité Comptable & Règlements

### 2.1 Sortie mensuelle TVA (`Compta_2026.xlsx`)
- **Constat** : L'expert-comptable utilise chaque mois un onglet de type `Octobre 2026` ventilant les **Dépenses** (colonnes G, H, I : HT / TVA / TTC) et les **Recettes** (colonnes J, K, L : HT / TVA / TTC), ainsi qu'un onglet `Factures 2026` pour le suivi des encaissements (Date de crédit).
- **Hypothèse retenue** : L'application génère un classeur Excel `.xlsx` strictement identique avec formules de totaux et colonnes correspondantes.
- **Point à valider avec le cabinet** : Souhaitent-ils recevoir cet export mensuel par e-mail direct ou fichier partagé ? Les écritures d'achats récurrents (loyer, mutuelle, URSSAF) doivent-elles être préremplies automatiquement chaque 1er du mois ?

### 2.2 Anomalies de dates dans `Factures 2026`
- **Constat** :
  - Lignes A43 à A45 et A49 à A50 : Numéros de factures 2026 portant des dates d'émission en 2025 (séries 45789–45803).
  - Ligne 46 (Facture 2026-040) : Date de crédit en 2028 (série 46913, soit le 11/06/2028).
  - Lignes 33 à 35 : Répartition tripartite entre payeurs (HELVETIA, HDI, CNA).
  - Lignes 37 à 38 : Paiement partiel HT sans solde de TVA.
- **Règle retenue** : L'application n'écrase jamais silencieusement une date ou un montant. Les répartitions multi-payeurs et règlements partiels sont modélisés explicitement avec suivi du reste dû.

---

## 3. Terrain, Rapports & Communications

### 3.1 Trame de rapport d'expertise
- **Constat** : Aucun modèle de rapport Word préexistant n'a été fourni dans le lot source (le modèle Word personnel de Valentine est en attente).
- **Solution livrée** : Une trame d'expertise ferroviaire structurée et modifiable a été implémentée (1. Rappel des faits, 2. Participants, 3. Constatations matérielles, 4. Analyse technique, 5. Conclusions provisoires), avec génération native du fichier `.docx` incorporant les photos sélectionnées et le tableau des présences.
- **Point à valider** : À réception du modèle `.dotx` officiel de Valentine (charte graphique, polices de titres, en-têtes/pieds de page), adapter le générateur pour reproduire fidèlement son gabarit.

### 3.2 Gestion des e-mails et non-interruption
- **Constat** : Valentine a exprimé un besoin fort de concentration pour rédiger sans être interrompue par les notifications, tout en isolant les urgences.
- **Solution livrée** : Un espace de rattachement des messages par dossier, un tri visuel (Urgent / Normal), un statut de traitement et un générateur de brouillons de réponse d'avancement.
- **Point à valider** : Type de messagerie utilisée (Outlook 365, IMAP standard, Gmail) pour configurer ultérieurement un connecteur de relève sans intervention manuelle.
