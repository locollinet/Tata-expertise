import { db, initDatabase } from './db.js';
import { v4 as uuidv4 } from 'uuid';

initDatabase();

export function seedData() {
  console.log('Seeding initial synthetic data for VP Expertise...');

  // Clean existing data
  db.exec(`
    DELETE FROM invoice_lines;
    DELETE FROM credit_notes;
    DELETE FROM invoices;
    DELETE FROM activities;
    DELETE FROM expenses;
    DELETE FROM photos;
    DELETE FROM attendees;
    DELETE FROM report_drafts;
    DELETE FROM communications;
    DELETE FROM travel_orders;
    DELETE FROM registered_mails;
    DELETE FROM accounting_entries;
    DELETE FROM missions;
  `);

  const insertMission = db.prepare(`
    INSERT INTO missions (
      id, code, title, case_reference, status, insurance_client, client_contact,
      insured_party, third_parties, court_reference, incident_date, reception_date,
      description, current_step, next_action, next_deadline, billing_contact_name,
      billing_address, custom_hourly_rate, custom_travel_rate, custom_km_rate
    ) VALUES (
      @id, @code, @title, @case_reference, @status, @insurance_client, @client_contact,
      @insured_party, @third_parties, @court_reference, @incident_date, @reception_date,
      @description, @current_step, @next_action, @next_deadline, @billing_contact_name,
      @billing_address, @custom_hourly_rate, @custom_travel_rate, @custom_km_rate
    )
  `);

  const insertActivity = db.prepare(`
    INSERT INTO activities (
      id, mission_id, mission_code, date, category, label, hours, hourly_rate,
      total_ht, billable, status, invoice_id, notes
    ) VALUES (
      @id, @mission_id, @mission_code, @date, @category, @label, @hours, @hourly_rate,
      @total_ht, @billable, @status, @invoice_id, @notes
    )
  `);

  const insertExpense = db.prepare(`
    INSERT INTO expenses (
      id, mission_id, mission_code, date, category, label, quantity, unit_price,
      total_ht, vat_amount, total_ttc, receipt_filename, status, invoice_id, is_refacturable
    ) VALUES (
      @id, @mission_id, @mission_code, @date, @category, @label, @quantity, @unit_price,
      @total_ht, @vat_amount, @total_ttc, @receipt_filename, @status, @invoice_id, @is_refacturable
    )
  `);

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (
      id, invoice_number, mission_id, mission_code, client_name, client_address,
      subject, case_title, client_ref, our_ref, date, total_ht, vat_rate, vat_amount,
      total_ttc, advance_amount, net_payable, status, payment_date, payment_method,
      paid_amount, split_details
    ) VALUES (
      @id, @invoice_number, @mission_id, @mission_code, @client_name, @client_address,
      @subject, @case_title, @client_ref, @our_ref, @date, @total_ht, @vat_rate, @vat_amount,
      @total_ttc, @advance_amount, @net_payable, @status, @payment_date, @payment_method,
      @paid_amount, @split_details
    )
  `);

  const insertInvoiceLine = db.prepare(`
    INSERT INTO invoice_lines (
      id, invoice_id, activity_id, expense_id, description, quantity, time_spent,
      unit_price_ht, total_ht, order_index
    ) VALUES (
      @id, @invoice_id, @activity_id, @expense_id, @description, @quantity, @time_spent,
      @unit_price_ht, @total_ht, @order_index
    )
  `);

  // Mission 1 : ALSTOM - SGP Ligne 18 (VP2026922) -> Facture 2026-097
  const m1Id = 'm-vp2026922';
  insertMission.run({
    id: m1Id,
    code: 'VP2026922',
    title: 'ALSTOM - SGP Ligne 18 - Effondrement dalle de couverture trémie OA-08',
    case_reference: '11161461',
    status: 'en_cours',
    insurance_client: 'AXA XL',
    client_contact: 'Yannick DELAUNAY',
    insured_party: 'ALSTOM',
    third_parties: 'SGP / VINCI',
    court_reference: 'TJ Nanterre - Référé préventif',
    incident_date: '2026-02-15',
    reception_date: '2026-04-30',
    description: "Dommages aux équipements et matériels sous trémie suite à l'effondrement partiel d'une dalle provisoire de chantier.",
    current_step: "Analyse des notes techniques Alstom et préparation de la réunion contradictoire de novembre.",
    next_action: "Finaliser la note d'observation technique suite aux dires de VINCI.",
    next_deadline: '2026-11-05',
    billing_contact_name: 'Yannick DELAUNAY',
    billing_address: "AXA XL\nTour Majunga - La Défense 9\n6 Place de la pyramide\n92800 PUTEAUX",
    custom_hourly_rate: 190,
    custom_travel_rate: 135,
    custom_km_rate: 0.95,
  });

  // Facture 2026-097 (reconstitution exacte)
  const inv97Id = 'inv-2026-097';
  insertInvoice.run({
    id: inv97Id,
    invoice_number: '2026-097',
    mission_id: m1Id,
    mission_code: 'VP2026922',
    client_name: 'AXA XL',
    client_address: "Tour Majunga\nLa Défense 9\n6 Place de la pyramide\n92 800 PUTEAUX",
    subject: "Mission d’expertise depuis le 28/07/2026 – Réunion du 25/09/2026",
    case_title: "ALSTOM - SGP Ligne 18 - Effondrement dalle de couverture trémie OA-08",
    client_ref: "11161461",
    our_ref: "VP2026922",
    date: "2026-10-08",
    total_ht: 2354.30,
    vat_rate: 0.20,
    vat_amount: 470.86,
    total_ttc: 2825.16,
    advance_amount: 0,
    net_payable: 2825.16,
    status: 'emis',
    payment_date: null,
    payment_method: null,
    paid_amount: 0,
    split_details: null,
  });

  // Lines for Facture 2026-097
  const lines97 = [
    { desc: "Etude de documents, gestion du dossier", qty: 1, time: 7.0, unit: 190, total: 1330.00 },
    { desc: "Expertise à Massy le 22/07/2026", qty: 1, time: 1.5, unit: 190, total: 285.00 },
    { desc: "Déplacement Expert", qty: 1, time: 2.0, unit: 135, total: 270.00 },
    { desc: "Frais kilométriques", qty: 70, time: 1.0, unit: 0.95, total: 66.50 },
    { desc: "Péages", qty: 1, time: 1.0, unit: 22.80, total: 22.80 },
    { desc: "Rédaction Expert", qty: 1, time: 2.0, unit: 190, total: 380.00 },
  ];
  lines97.forEach((l, idx) => {
    insertInvoiceLine.run({
      id: `line-97-${idx}`,
      invoice_id: inv97Id,
      activity_id: null,
      expense_id: null,
      description: l.desc,
      quantity: l.qty,
      time_spent: l.time,
      unit_price_ht: l.unit,
      total_ht: l.total,
      order_index: idx + 1,
    });
  });

  // Add fresh unbilled activities on Mission 1 (since 08/10/2026) to test new billing
  insertActivity.run({
    id: 'act-m1-new1',
    mission_id: m1Id,
    mission_code: 'VP2026922',
    date: '2026-10-14',
    category: 'analyse',
    label: "Analyse approfondie de la note de calcul VINCI sur la résistance de la trémie",
    hours: 3.5,
    hourly_rate: 190,
    total_ht: 665.00,
    billable: 1,
    status: 'a_facturer',
    invoice_id: null,
    notes: "Examen des charges statiques admissibles",
  });
  insertActivity.run({
    id: 'act-m1-new2',
    mission_id: m1Id,
    mission_code: 'VP2026922',
    date: '2026-10-22',
    category: 'visio',
    label: "Visio-conférence préparatoire avec Alstom et l'avocat Me Garnier",
    hours: 2.0,
    hourly_rate: 190,
    total_ht: 380.00,
    billable: 1,
    status: 'a_facturer',
    invoice_id: null,
    notes: "Stratégie pour les dires contradictoires",
  });

  // Mission 2 : FORWARDIS - Déraillement à Clermont-Gravanche (VP2025915) -> Facture 2026-098
  const m2Id = 'm-vp2025915';
  insertMission.run({
    id: m2Id,
    code: 'VP2025915',
    title: 'FORWARDIS - Déraillement à Clermont-Gravanche le 25/03/2025',
    case_reference: '10772207',
    status: 'en_cours',
    insurance_client: 'AXA XL',
    client_contact: 'Fabienne MULLER',
    insured_party: 'FORWARDIS',
    third_parties: 'SNCF Réseau / VTG',
    court_reference: 'TJ Clermont-Ferrand - Référé expertise',
    incident_date: '2025-03-25',
    reception_date: '2025-05-12',
    description: "Déraillement de 4 wagons-trémies sur voie de service. Investigations sur l'usure des boudins d'essieux et l'écartement de voie.",
    current_step: "Deuxième réunion contradictoire effectuée à Fos-sur-Mer. Rédaction du compte rendu technique.",
    next_action: "Rédiger le projet de rapport sur la conformité du profil des tables de roulement.",
    next_deadline: '2026-11-12',
    billing_contact_name: 'Fabienne MULLER',
    billing_address: "AXA XL\nTour Majunga - La Défense 9\n6 Place de la pyramide\n92800 PUTEAUX",
    custom_hourly_rate: 190,
    custom_travel_rate: 135,
    custom_km_rate: 0.95,
  });

  // Facture 2026-098 (reconstitution exacte)
  const inv98Id = 'inv-2026-098';
  insertInvoice.run({
    id: inv98Id,
    invoice_number: '2026-098',
    mission_id: m2Id,
    mission_code: 'VP2025915',
    client_name: 'AXA XL',
    client_address: "Tour Majunga\nLa Défense 9\n6 Place de la pyramide\n92 800 PUTEAUX",
    subject: "Mission depuis le 17/08/2025 – Réunion d’expertise judiciaire le 09/09/2026",
    case_title: "FORWARDIS - Déraillement à Clermont-Gravanche le 25/03/2025",
    client_ref: "10772207",
    our_ref: "VP2025915",
    date: "2026-10-08",
    total_ht: 3194.80,
    vat_rate: 0.20,
    vat_amount: 638.96,
    total_ttc: 3833.76,
    advance_amount: 0,
    net_payable: 3833.76,
    status: 'emis',
    payment_date: null,
    payment_method: null,
    paid_amount: 0,
    split_details: null,
  });

  const lines98 = [
    { desc: "Gestion du dossier, analyse de documents", qty: 1, time: 1.5, unit: 190, total: 285.00 },
    { desc: "Expertise judiciaire à Fos-sur-Mer le 09/09/2026", qty: 1, time: 4.5, unit: 190, total: 855.00 },
    { desc: "Déplacement Expert", qty: 1, time: 12.0, unit: 135, total: 1620.00 },
    { desc: "Frais de déplacement (train)", qty: 1, time: 1.0, unit: 294.00, total: 294.00 },
    { desc: "Hôtel", qty: 1, time: 1.0, unit: 97.80, total: 97.80 },
    { desc: "Repas", qty: 2, time: 1.0, unit: 21.50, total: 43.00 },
  ];
  lines98.forEach((l, idx) => {
    insertInvoiceLine.run({
      id: `line-98-${idx}`,
      invoice_id: inv98Id,
      activity_id: null,
      expense_id: null,
      description: l.desc,
      quantity: l.qty,
      time_spent: l.time,
      unit_price_ht: l.unit,
      total_ht: l.total,
      order_index: idx + 1,
    });
  });

  // Mission 3 : HELVETIA - Collision au PN N°5 d’Ettendorf (VP2026728) -> Facture 2026-099
  const m3Id = 'm-vp2026728';
  insertMission.run({
    id: m3Id,
    code: 'VP2026728',
    title: 'TLA TRANSPORTS - Collision au PN N°5 d’Ettendorf le 20/05/2026',
    case_reference: '26GF13102078',
    status: 'en_cours',
    insurance_client: 'HELVETIA Assurances',
    client_contact: 'Marc LECLERC',
    insured_party: 'TLA TRANSPORTS',
    third_parties: 'SNCF Réseau / Région Grand Est',
    court_reference: 'Tribunal de Commerce de Strasbourg',
    incident_date: '2026-05-20',
    reception_date: '2026-07-02',
    description: "Collision entre un camion porte-engins bloqué sur passage à niveau et une rame TER Régiolis. Examen des dégâts sur la motrice et le bogie avant.",
    current_step: "Constatations contradictoires terminées à Strasbourg. En attente du rapport de l'expert judiciaire SNCF.",
    next_action: "Relancer l'expert judiciaire sur le calendrier de restitution des enregistreurs d'événements (ATESS).",
    next_deadline: '2026-10-31',
    billing_contact_name: 'Marc LECLERC',
    billing_address: "HELVETIA Assurances\n1 route de Rouffach\n68000 COLMAR",
    custom_hourly_rate: 190,
    custom_travel_rate: 135,
    custom_km_rate: 0.95,
  });

  // Facture 2026-099 (reconstitution exacte)
  const inv99Id = 'inv-2026-099';
  insertInvoice.run({
    id: inv99Id,
    invoice_number: '2026-099',
    mission_id: m3Id,
    mission_code: 'VP2026728',
    client_name: 'HELVETIA Assurances',
    client_address: "1 route de Rouffach\n68000 COLMAR",
    subject: "Mission d’expertise du 12/07 au 09/10/2026 dont constatations contradictoires à Ettendorf et Strasbourg le 24/09/2026",
    case_title: "TLA TRANSPORTS - Collision au PN N°5 d’Ettendorf le 20/05/2026",
    client_ref: "26GF13102078",
    our_ref: "VP2026728",
    date: "2026-10-19",
    total_ht: 4717.20,
    vat_rate: 0.20,
    vat_amount: 943.44,
    total_ttc: 5660.64,
    advance_amount: 0,
    net_payable: 5660.64,
    status: 'emis',
    payment_date: null,
    payment_method: null,
    paid_amount: 0,
    split_details: null,
  });

  const lines99 = [
    { desc: "Étude de documents, analyse, gestion du dossier", qty: 1, time: 8.5, unit: 190, total: 1615.00 },
    { desc: "Expertise à Ettendorf et Strasbourg le 24/09/2026", qty: 1, time: 4.0, unit: 190, total: 760.00 },
    { desc: "Déplacement Expert", qty: 1, time: 10.5, unit: 135, total: 1417.50 },
    { desc: "Frais kilométriques", qty: 202, time: 1.0, unit: 0.95, total: 191.90 },
    { desc: "Parking", qty: 1, time: 1.0, unit: 42.00, total: 42.00 },
    { desc: "Frais de déplacement (train)", qty: 1, time: 1.0, unit: 196.00, total: 196.00 },
    { desc: "Repas", qty: 1, time: 1.0, unit: 19.80, total: 19.80 },
    { desc: "Rédaction Expert", qty: 1, time: 2.5, unit: 190, total: 475.00 },
  ];
  lines99.forEach((l, idx) => {
    insertInvoiceLine.run({
      id: `line-99-${idx}`,
      invoice_id: inv99Id,
      activity_id: null,
      expense_id: null,
      description: l.desc,
      quantity: l.qty,
      time_spent: l.time,
      unit_price_ht: l.unit,
      total_ht: l.total,
      order_index: idx + 1,
    });
  });

  // Mission 4 : REGIORAIL - Rupture d'attelage et dérive à Ambérieu (VP2026104)
  // Has unbilled time > 3,800 € -> Triggers the billing alert (> 3,500 €)!
  const m4Id = 'm-vp2026104';
  insertMission.run({
    id: m4Id,
    code: 'VP2026104',
    title: "REGIORAIL - Rupture d'attelage et dérive de rame fret à Ambérieu",
    case_reference: 'RR-2026-AMB-09',
    status: 'en_cours',
    insurance_client: 'ALBINGIA',
    client_contact: 'Christophe VIAL',
    insured_party: 'REGIORAIL',
    third_parties: 'SNCF Réseau',
    court_reference: 'TJ Bourg-en-Bresse',
    incident_date: '2026-06-12',
    reception_date: '2026-06-18',
    description: "Rupture de mâchoire d'attelage automatique sur convoi de fret lourd, entraînant section de conduite générale et freinage d'urgence sur voie principale.",
    current_step: "Analyses métallurgiques reçues du laboratoire CETIM. Réunion contradictoire de restitution terminée.",
    next_action: "Préparer la note d'honoraires d'étape (seuil dépassé : 4 125 € HT) et remettre la synthèse provisoire.",
    next_deadline: '2026-10-30',
    billing_contact_name: 'Christophe VIAL',
    billing_address: "ALBINGIA\n109/111 rue Victor Hugo\n92300 LEVALLOIS-PERRET",
    custom_hourly_rate: 190,
    custom_travel_rate: 135,
    custom_km_rate: 0.95,
  });

  // Activities for Mission 4 ready to be billed in 2026-100!
  const m4Activities = [
    { date: '2026-09-02', cat: 'etude_documents', label: "Étude des rapports de visite CETIM et analyse fractographique", hours: 4.5, rate: 190, total: 855.00 },
    { date: '2026-09-15', cat: 'visio', label: "Visio-conférence contradictoire avec Regiorail et l'assureur Albingia", hours: 2.5, rate: 190, total: 475.00 },
    { date: '2026-09-28', cat: 'deplacement', label: "Déplacement sur site triage Ambérieu pour constatations contradictoires", hours: 8.0, rate: 135, total: 1080.00 },
    { date: '2026-09-28', cat: 'expertise', label: "Inspection contradictoire de la mâchoire et du crochet de traction", hours: 3.5, rate: 190, total: 665.00 },
    { date: '2026-10-05', cat: 'redaction', label: "Rédaction de la note d'étape technique sur le mécanisme de rupture par fatigue", hours: 4.0, rate: 190, total: 760.00 },
  ];
  m4Activities.forEach((act, idx) => {
    insertActivity.run({
      id: `act-m4-${idx}`,
      mission_id: m4Id,
      mission_code: 'VP2026104',
      date: act.date,
      category: act.cat,
      label: act.label,
      hours: act.hours,
      hourly_rate: act.rate,
      total_ht: act.total,
      billable: 1,
      status: 'a_facturer',
      invoice_id: null,
      notes: null,
    });
  });

  // Expenses for Mission 4
  const m4Expenses = [
    { date: '2026-09-28', cat: 'train', label: "Billet TGV Paris - Ambérieu A/R", qty: 1, unit: 215.00, ht: 215.00, vat: 21.50, ttc: 236.50 },
    { date: '2026-09-28', cat: 'taxi', label: "Taxi Gare Ambérieu - Triage A/R", qty: 1, unit: 45.00, ht: 45.00, vat: 4.50, ttc: 49.50 },
    { date: '2026-09-28', cat: 'repas', label: "Déjeuner de travail expert sur site", qty: 1, unit: 28.50, ht: 28.50, vat: 2.85, ttc: 31.35 },
  ];
  m4Expenses.forEach((exp, idx) => {
    insertExpense.run({
      id: `exp-m4-${idx}`,
      mission_id: m4Id,
      mission_code: 'VP2026104',
      date: exp.date,
      category: exp.cat,
      label: exp.label,
      quantity: exp.qty,
      unit_price: exp.unit,
      total_ht: exp.ht,
      vat_amount: exp.vat,
      total_ttc: exp.ttc,
      receipt_filename: null,
      status: 'a_facturer',
      invoice_id: null,
      is_refacturable: 1,
    });
  });

  // Attendees for Mission 4
  const insertAttendee = db.prepare(`
    INSERT INTO attendees (id, mission_id, name, organization, role, email, phone, present_on_site, present_remote)
    VALUES (@id, @mission_id, @name, @organization, @role, @email, @phone, @present_on_site, @present_remote)
  `);
  [
    { name: "Valentine PECHEUX", org: "VP Expertise", role: "Ingénieur Expert (Conseil Assuré)", email: "valentine.pecheux@vpexpertise.com", phone: "+33 6 38 73 68 88", site: 1, visio: 0 },
    { name: "Christophe VIAL", org: "ALBINGIA", role: "Inspecteur Sinistres", email: "cvial@albingia.net", phone: "+33 1 41 40 50 60", site: 0, visio: 1 },
    { name: "Jean-Luc BERTHIER", org: "REGIORAIL", role: "Directeur Technique Matériel", email: "jl.berthier@regiorail.fr", phone: "+33 4 74 38 12 00", site: 1, visio: 0 },
    { name: "Hervé KAUFMANN", org: "SNCF Réseau", role: "Expert Voie & Appareils", email: "herve.kaufmann@sncf.fr", phone: "+33 4 72 00 11 22", site: 1, visio: 0 },
  ].forEach((att, idx) => {
    insertAttendee.run({
      id: `att-m4-${idx}`,
      mission_id: m4Id,
      name: att.name,
      organization: att.org,
      role: att.role,
      email: att.email,
      phone: att.phone,
      present_on_site: att.site,
      present_remote: att.visio,
    });
  });

  // Report Draft for Mission 4
  const insertReportDraft = db.prepare(`
    INSERT INTO report_drafts (id, mission_id, mission_code, title, version, section_facts, section_observations, section_analysis, section_conclusions)
    VALUES (@id, @mission_id, @mission_code, @title, @version, @section_facts, @section_observations, @section_analysis, @section_conclusions)
  `);
  insertReportDraft.run({
    id: 'rd-m4',
    mission_id: m4Id,
    mission_code: 'VP2026104',
    title: "Projet de rapport d'expertise technique d'étape — Rupture attelage Ambérieu",
    version: 1,
    section_facts: "Le 12 juin 2026 à 04h15, le convoi de fret n° 48123 tracté par la locomotive BB 27000 a subi une rupture de l'attelage mécanique entre les wagons n° 4 et 5 en sortie de gare d'Ambérieu. La rupture a provoqué la disjonction de la conduite générale de frein et l'immobilisation de la rame sans déraillement.",
    section_observations: "L'inspection macroscopique révèle une surface de rupture plane typique d'une amorce de fissure par fatigue sous contrainte cyclique, localisée au rayon de congé de la mâchoire droite. Absence d'inclusion macroscopique visible. Déformation plastique minime au niveau du cordon résiduel.",
    section_analysis: "Les résultats fractographiques obtenus par le laboratoire CETIM confirment la présence de stries de fatigue initiées sur un défaut de fonderie préexistant sous la peau superficielle. L'examen des carnets d'entretien de l'atelier de maintenance montre un contrôle par magnétoscopie réalisé il y a 8 mois n'ayant décelé aucune anomalie de surface.",
    section_conclusions: "La responsabilité de l'exploitant ferroviaire Regiorail est susceptible d'être atténuée au bénéfice d'un vice caché de fabrication du composant d'attelage fourni par le constructeur. Une mise en cause du fondeur est recommandée dans le cadre des opérations contradictoires.",
  });

  // Communications
  const insertComm = db.prepare(`
    INSERT INTO communications (
      id, mission_id, mission_code, direction, sender, recipient, date, subject, body,
      importance, urgency, status, next_action, draft_reply
    ) VALUES (
      @id, @mission_id, @mission_code, @direction, @sender, @recipient, @date, @subject, @body,
      @importance, @urgency, @status, @next_action, @draft_reply
    )
  `);
  insertComm.run({
    id: 'comm-1',
    mission_id: m4Id,
    mission_code: 'VP2026104',
    direction: 'in',
    sender: "Christophe VIAL <cvial@albingia.net>",
    recipient: "Valentine PECHEUX <valentine.pecheux@vpexpertise.com>",
    date: '2026-10-26 14:32',
    subject: "URGENT : Sinistre Ambérieu — Note de synthèse attendue pour le comité",
    body: "Bonjour Valentine,\n\nLe comité des sinistres complexes se réunit jeudi prochain. Peux-tu nous faire parvenir ta note d'étape provisoire ainsi que la note d'honoraires correspondante aux investigations CETIM ?\n\nMerci d'avance pour ton retour rapide.\nBien cordialement,\nChristophe VIAL",
    importance: 'haute',
    urgency: 'urgente',
    status: 'a_traiter',
    next_action: "Envoyer le projet de rapport d'étape et la facture 2026-100 préparée.",
    draft_reply: "Bonjour Christophe,\n\nBien reçu. L'analyse des résultats métallurgiques du CETIM est finalisée. Je vous transmets ci-joint notre note d'étape technique ainsi que la note d'honoraires correspondante aux opérations réalisées jusqu'à ce jour.\n\nRestant à votre entière disposition pour le comité de jeudi.\nBien cordialement,\n\nValentine PECHEUX",
  });
  insertComm.run({
    id: 'comm-2',
    mission_id: m1Id,
    mission_code: 'VP2026922',
    direction: 'in',
    sender: "Yannick DELAUNAY <yannick.delaunay@axaxl.com>",
    recipient: "Valentine PECHEUX <valentine.pecheux@vpexpertise.com>",
    date: '2026-10-25 09:15',
    subject: "Ligne 18 trémie OA-08 : Réception des dires VINCI",
    body: "Chère Valentine,\n\nVous trouverez en pièce jointe les derniers dires déposés par le conseil de VINCI Construction. Pouvez-vous nous indiquer si ces éléments appellent des observations complémentaires avant l'audience du 5 novembre ?\n\nBien à vous,\nYannick",
    importance: 'haute',
    urgency: 'normale',
    status: 'en_cours',
    next_action: "Examen des pièces VINCI et échange téléphonique avec Me Garnier.",
    draft_reply: "Bonjour Yannick,\n\nJ'ai bien pris connaissance des dires de VINCI. Leurs conclusions sur les charges admissibles omettent l'impact des vibrations transmises par le tablier provisoire. Je prépare un mémo récapitulatif pour Me Garnier d'ici mercredi.\n\nBien à vous,\nValentine",
  });

  // Travel Order
  const insertTravel = db.prepare(`
    INSERT INTO travel_orders (id, mission_id, mission_code, destination, start_date, end_date, train_info, hotel_info, notes, checklist, status)
    VALUES (@id, @mission_id, @mission_code, @destination, @start_date, @end_date, @train_info, @hotel_info, @notes, @checklist, @status)
  `);
  insertTravel.run({
    id: 'travel-1',
    mission_id: m1Id,
    mission_code: 'VP2026922',
    destination: "Massy — Chantier Ligne 18 OA-08",
    start_date: '2026-11-04',
    end_date: '2026-11-04',
    train_info: "RER B / Covoiturage ou Véhicule personnel (70 km A/R)",
    hotel_info: "Pas d'hébergement (déplacement journée)",
    notes: "Prévoir EPI complets (Casque, chasuble haute visibilité classe 3, chaussures de sécurité S3).",
    checklist: JSON.stringify([
      { id: 'c1', label: "Appareil photo / smartphone chargé + batterie externe", done: true },
      { id: 'c2', label: "Dossier de plans de coffrage et d'étaiement imprimé", done: true },
      { id: 'c3', label: "Feuille d'émargement vierge pour réunion contradictoire", done: false },
      { id: 'c4', label: "Jauge de mesure d'ouverture de fissure / fissuromètre", done: false },
    ]),
    status: 'confirme',
  });

  // Registered Mails (LRAR)
  const insertLRAR = db.prepare(`
    INSERT INTO registered_mails (id, mission_id, mission_code, recipient, subject, tracking_number, status, sent_date, notes)
    VALUES (@id, @mission_id, @mission_code, @recipient, @subject, @tracking_number, @status, @sent_date, @notes)
  `);
  insertLRAR.run({
    id: 'lrar-1',
    mission_id: m4Id,
    mission_code: 'VP2026104',
    recipient: "Me KAUFMANN, Expert de justice — TJ Bourg-en-Bresse",
    subject: "Transmission du compte rendu technique d'analyse métallurgique CETIM",
    tracking_number: "1A 189 452 789 2",
    status: 'expedie',
    sent_date: '2026-10-21',
    notes: "Déposé au bureau de poste Paris 8ème.",
  });
  insertLRAR.run({
    id: 'lrar-2',
    mission_id: m2Id,
    mission_code: 'VP2025915',
    recipient: "VTG Rail Logistics — Direction Juridique Sinistres",
    subject: "Mise en demeure de communication des carnets d'essieux wagons-trémies",
    tracking_number: null,
    status: 'a_preparer',
    sent_date: null,
    notes: "Courrier à finaliser suite au refus oral lors de la réunion de Fos.",
  });

  // Monthly Accounting entries for Octobre 2026 matching Compta_2026 format
  const insertAcc = db.prepare(`
    INSERT INTO accounting_entries (id, month, type, piece_number, date, invoice_number, mission_code, object, party, amount_ht, vat_amount, amount_ttc, comment)
    VALUES (@id, @month, @type, @piece_number, @date, @invoice_number, @mission_code, @object, @party, @amount_ht, @vat_amount, @amount_ttc, @comment)
  `);
  [
    { id: 'acc-1', month: '2026-10', type: 'depense', piece: 'P-101', date: '2026-10-01', inv: null, code: null, obj: "Loyer mensuel bureau", party: "Pecheux SCI", ht: 1050.00, vat: 0, ttc: 1050.00, com: "Loyer professionnel" },
    { id: 'acc-2', month: '2026-10', type: 'depense', piece: 'P-102', date: '2026-10-05', inv: null, code: null, obj: "Assurance scooter pro", party: "April", ht: 50.63, vat: 0, ttc: 50.63, com: "Prélèvement mensuel" },
    { id: 'acc-3', month: '2026-10', type: 'depense', piece: 'P-103', date: '2026-10-08', inv: null, code: null, obj: "Mutuelle TNS", party: "GENERALI Vie", ht: 390.85, vat: 0, ttc: 390.85, com: "Selon échéancier" },
    { id: 'acc-4', month: '2026-10', type: 'depense', piece: 'P-104', date: '2026-10-12', inv: null, code: 'VP2026728', obj: "Billet train SNCF Colmar", party: "SNCF Connect", ht: 196.00, vat: 19.60, ttc: 215.60, com: "Déplacement expertise Ettendorf" },
    { id: 'acc-5', month: '2026-10', type: 'depense', piece: 'P-105', date: '2026-10-15', inv: null, code: null, obj: "Abonnement parking", party: "PayByPhone", ht: 38.00, vat: 0, ttc: 38.00, com: "Stationnement Paris" },
    // Incomes (Recettes)
    { id: 'acc-6', month: '2026-10', type: 'recette', piece: 'R-097', date: '2026-10-08', inv: '2026-097', code: 'VP2026922', obj: "Note d'honoraires n° 2026-097", party: "AXA XL", ht: 2354.30, vat: 470.86, ttc: 2825.16, com: "Ligne 18 Trémie" },
    { id: 'acc-7', month: '2026-10', type: 'recette', piece: 'R-098', date: '2026-10-08', inv: '2026-098', code: 'VP2025915', obj: "Note d'honoraires n° 2026-098", party: "AXA XL", ht: 3194.80, vat: 638.96, ttc: 3833.76, com: "Forwardis Fos-sur-Mer" },
    { id: 'acc-8', month: '2026-10', type: 'recette', piece: 'R-099', date: '2026-10-19', inv: '2026-099', code: 'VP2026728', obj: "Note d'honoraires n° 2026-099", party: "HELVETIA", ht: 4717.20, vat: 943.44, ttc: 5660.64, com: "TLA PN Ettendorf" },
  ].forEach(e => {
    insertAcc.run({
      id: e.id,
      month: e.month,
      type: e.type,
      piece_number: e.piece,
      date: e.date,
      invoice_number: e.inv,
      mission_code: e.code,
      object: e.obj,
      party: e.party,
      amount_ht: e.ht,
      vat_amount: e.vat,
      amount_ttc: e.ttc,
      comment: e.com,
    });
  });

  console.log('Seeding completed successfully!');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seedData();
}
