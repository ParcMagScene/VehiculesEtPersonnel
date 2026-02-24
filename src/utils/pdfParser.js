// ═══════════════════════════════════════════════════════════════
// Utilitaire pour extraire et parser du texte depuis des PDFs
// Supporte : Bon de Livraison, Devis, Facture, Contrat, générique
// ═══════════════════════════════════════════════════════════════
import * as pdfjsLib from 'pdfjs-dist';

// Configurer le worker depuis le dossier public
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

// ─── Types de documents détectables ───
export const DOC_TYPES = {
  BON_LIVRAISON: 'bon_livraison',
  DEVIS: 'devis',
  FACTURE: 'facture',
  CONTRAT: 'contrat',
  INCONNU: 'inconnu',
};

const DOC_TYPE_LABELS = {
  [DOC_TYPES.BON_LIVRAISON]: 'Bon de Livraison',
  [DOC_TYPES.DEVIS]: 'Devis',
  [DOC_TYPES.FACTURE]: 'Facture',
  [DOC_TYPES.CONTRAT]: 'Contrat',
  [DOC_TYPES.INCONNU]: 'Document inconnu',
};

export const getDocTypeLabel = (type) => DOC_TYPE_LABELS[type] || DOC_TYPE_LABELS[DOC_TYPES.INCONNU];

/**
 * Extrait le texte complet d'un fichier PDF
 * @param {File} file - Le fichier PDF à analyser
 * @returns {Promise<{ text: string, pageCount: number }>}
 */
export const extractTextFromPDF = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  } catch (error) {
    console.error('❌ Erreur extraction texte PDF:', error);
    throw new Error(`Impossible d'analyser le PDF: ${error.message}`);
  }
};

/**
 * Extrait le texte + métadonnées (pages, taille)
 * @param {File} file
 * @returns {Promise<{ text: string, pageCount: number, fileSize: number }>}
 */
export const extractPDFMeta = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return { text: fullText, pageCount: pdf.numPages, fileSize: file.size };
  } catch (error) {
    console.error('❌ Erreur extraction meta PDF:', error);
    throw new Error(`Impossible d'analyser le PDF: ${error.message}`);
  }
};

// ─── Helpers de parsing ───

/** Extrait toutes les dates DD/MM/YYYY d'un texte */
const extractAllDates = (text) => {
  const matches = [];
  const regex = /(\d{2})\/(\d{2})\/(\d{4})/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const [, jour, mois, annee] = m;
    matches.push({ raw: m[0], iso: `${annee}-${mois}-${jour}` });
  }
  return matches;
};

/** Extrait un numéro d'affaire (AF + digits) */
const extractNumeroAffaire = (text) => {
  const match = text.match(/\b(AF\s?\d{4,6})\b/i);
  return match ? match[1].replace(/\s/g, '').toUpperCase() : null;
};

/** Extrait un numéro de téléphone */
const extractPhone = (text, label) => {
  const regex = new RegExp(`${label}\\s*[.:]*\\s*([0-9][0-9\\s.\\-]{8,})`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim().replace(/\s+/g, ' ') : null;
};

/** Extrait une adresse postale */
const extractAddress = (text) => {
  // Format: "3 Rue de la TÉLÉMATIQUE  42000 SAINT-ETIENNE"
  const match1 = text.match(/(\d+\s+(?:Rue|Avenue|Boulevard|Place|Allée|Impasse|Chemin|Route)[^\d]*?)\s+(\d{5}\s+[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ\s-]+)/i);
  if (match1) return `${match1[1].trim()}\n${match1[2].trim()}`;
  
  const match2 = text.match(/((?:Rue|Avenue|Boulevard|Place|Allée|Impasse|Chemin|Route)[^\d]*?)\s+(\d{5}\s+[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ\s-]+)/i);
  if (match2) return `${match2[1].trim()}\n${match2[2].trim()}`;
  
  // Code postal seul
  const match3 = text.match(/(\d{5})\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ][A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ\s-]{2,})/);
  if (match3) return `${match3[1]} ${match3[2].trim()}`;
  
  return null;
};

/** Extrait un montant (€ / EUR) */
const extractMontant = (text, label) => {
  // "Total HT : 1 250,50 €" ou "Montant TTC: 1500.00€"
  const regex = new RegExp(`${label}\\s*[.:]*\\s*([\\d\\s]+[.,]\\d{2})\\s*€?`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
};

// ─── Détection automatique du type de document ───

/**
 * Détecte le type de document et retourne un score de confiance
 * @param {string} text - Texte extrait du PDF
 * @returns {{ docType: string, confidence: number, scores: Object }}
 */
export const detectDocumentType = (text) => {
  const t = text.toLowerCase();
  const scores = {
    [DOC_TYPES.BON_LIVRAISON]: 0,
    [DOC_TYPES.DEVIS]: 0,
    [DOC_TYPES.FACTURE]: 0,
    [DOC_TYPES.CONTRAT]: 0,
  };

  // Bon de Livraison
  if (/bon\s+de\s+livraison/i.test(t)) scores[DOC_TYPES.BON_LIVRAISON] += 40;
  if (/\bbl\b/i.test(t) && /livraison/i.test(t)) scores[DOC_TYPES.BON_LIVRAISON] += 20;
  if (/prestation\s+(du|le)/i.test(t)) scores[DOC_TYPES.BON_LIVRAISON] += 15;
  if (/location\s+(du|le)/i.test(t)) scores[DOC_TYPES.BON_LIVRAISON] += 15;
  if (/adresse\s+de\s+livraison/i.test(t)) scores[DOC_TYPES.BON_LIVRAISON] += 10;

  // Devis
  if (/\bdevis\b/i.test(t)) scores[DOC_TYPES.DEVIS] += 35;
  if (/devis\s+n[°o]?\s*[:\s]*\d/i.test(t)) scores[DOC_TYPES.DEVIS] += 20;
  if (/validité\s+du\s+devis/i.test(t)) scores[DOC_TYPES.DEVIS] += 15;
  if (/montant\s+ht/i.test(t)) scores[DOC_TYPES.DEVIS] += 10;
  if (/total\s+ttc/i.test(t)) scores[DOC_TYPES.DEVIS] += 5;

  // Facture
  if (/\bfacture\b/i.test(t)) scores[DOC_TYPES.FACTURE] += 35;
  if (/facture\s+n[°o]?\s*[:\s]*\d/i.test(t)) scores[DOC_TYPES.FACTURE] += 20;
  if (/échéance|echeance/i.test(t)) scores[DOC_TYPES.FACTURE] += 10;
  if (/règlement|reglement|paiement/i.test(t)) scores[DOC_TYPES.FACTURE] += 10;
  if (/tva/i.test(t)) scores[DOC_TYPES.FACTURE] += 5;
  if (/net\s+[àa]\s+payer/i.test(t)) scores[DOC_TYPES.FACTURE] += 15;

  // Contrat
  if (/\bcontrat\b/i.test(t)) scores[DOC_TYPES.CONTRAT] += 35;
  if (/convention/i.test(t)) scores[DOC_TYPES.CONTRAT] += 20;
  if (/durée\s+du\s+contrat|duree\s+du\s+contrat/i.test(t)) scores[DOC_TYPES.CONTRAT] += 15;
  if (/clause|article\s+\d/i.test(t)) scores[DOC_TYPES.CONTRAT] += 10;
  if (/signataire|signature/i.test(t)) scores[DOC_TYPES.CONTRAT] += 5;

  // Bonus communs (affaire number boosts BL/Devis)
  if (extractNumeroAffaire(text)) {
    scores[DOC_TYPES.BON_LIVRAISON] += 10;
    scores[DOC_TYPES.DEVIS] += 5;
  }

  // Trouver le type avec le score max
  let bestType = DOC_TYPES.INCONNU;
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // Seuil minimum de confiance : 15 points
  if (bestScore < 15) bestType = DOC_TYPES.INCONNU;

  // Normaliser la confiance (0-100)
  const confidence = Math.min(100, Math.round(bestScore * 1.5));

  return { docType: bestType, confidence, scores };
};

// ─── Parseurs spécialisés par type de document ───

/**
 * Parse les informations d'un bon de livraison
 * @param {string} text - Le texte extrait du PDF
 * @returns {Object} Les informations extraites avec score de confiance
 */
export const parseBonLivraison = (text) => {
  const info = {
    numeroAffaire: null,
    type: null,
    client: null,
    dateLocation: null,
    nomAffaire: null,
    interlocuteur: null,
    tel: null,
    fax: null,
    devis: null,
    adresseLivraison: null,
    fieldsFound: 0,
    fieldsTotal: 10
  };

  try {
    // Extraction du numéro d'affaire (AF32770)
    info.numeroAffaire = extractNumeroAffaire(text);
    if (info.numeroAffaire) info.fieldsFound++;

    // Extraction du type et date
    const prestationMatch1 = text.match(/(Prestation|Location|Installation|Vente)\s+du\s+(\d{2})\/(\d{2})\/(\d{4})\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇa-z][A-ZÀÂÉÈÊËÎÏÔÙÛÜÇa-z\s]+?)\s+(?:Monsieur|Madame)/i);
    const prestationMatch2 = text.match(/(Prestation|Location|Installation|Vente)\s+([^\d]+?)\s+(\d{2})\/(\d{2})\/(\d{4})/i);
    
    if (prestationMatch1) {
      const [, type, jour, mois, annee, nom] = prestationMatch1;
      info.type = type;
      info.dateLocation = `${annee}-${mois}-${jour}`;
      info.nomAffaire = nom.trim();
      info.fieldsFound += 3;
    } else if (prestationMatch2) {
      const [, type, nom, jour, mois, annee] = prestationMatch2;
      info.type = type;
      info.dateLocation = `${annee}-${mois}-${jour}`;
      info.nomAffaire = nom.trim();
      info.fieldsFound += 3;
    } else {
      // Fallback: chercher juste le type
      const typeMatch = text.match(/\b(Prestation|Location|Installation|Vente)\b/i);
      if (typeMatch) { info.type = typeMatch[1]; info.fieldsFound++; }
      // Fallback: première date trouvée
      const dates = extractAllDates(text);
      if (dates.length > 0) { info.dateLocation = dates[0].iso; info.fieldsFound++; }
    }

    // Extraction de l'interlocuteur
    const interlocuteurMatch = text.match(/(Monsieur|Madame|M\.|Mme)\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇa-z][a-zàâéèêëîïôùûüç]+(?:\s+[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ][A-ZÀÂÉÈÊËÎÏÔÙÛÜÇa-z]+){0,2})/);
    if (interlocuteurMatch) {
      info.interlocuteur = `${interlocuteurMatch[1]} ${interlocuteurMatch[2].trim()}`;
      info.fieldsFound++;
    }

    // Extraction du client
    const clientMatch0 = text.match(/Client\s*:?\s*([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ][A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ\s'.-]+?)(?=\s+(?:Monsieur|Madame|M\.|Mme|Tél|Fax|\d+\s+(?:Rue|Place|Avenue|Boulevard)|$))/i);
    const clientMatch1 = text.match(/(?:Monsieur|Madame|M\.|Mme)\s+[A-ZÀÂa-z]+\s+[A-Z]+\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ']+(?:\s+[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ']+)*?)\s+(?=\d+\s+(?:Place|Rue|Avenue|Boulevard))/i);
    const clientMatch2 = text.match(/(?:Monsieur|Madame|M\.|Mme)\s+[A-ZÀÂa-z]+\s+[A-Z]+\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ']+(?:\s+[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ']+)*?)\s+(?=Place|Rue|Avenue|Boulevard)/i);
    
    if (clientMatch0) { info.client = clientMatch0[1].trim(); info.fieldsFound++; }
    else if (clientMatch1) { info.client = clientMatch1[1].trim(); info.fieldsFound++; }
    else if (clientMatch2) { info.client = clientMatch2[1].trim(); info.fieldsFound++; }

    // Téléphone & Fax
    info.tel = extractPhone(text, 'Tél(?:éphone)?');
    if (info.tel) info.fieldsFound++;
    info.fax = extractPhone(text, 'Fax');
    if (info.fax) info.fieldsFound++;

    // Devis référence
    const devisMatch = text.match(/(\d+)\s+Devis\s+(\d{2}\/\d{2}\/\d{4})/i);
    const devisMatch2 = text.match(/Devis\s+(?:n[°o]?\s*)?(\d+)\s+du\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (devisMatch) { info.devis = `${devisMatch[1]} du ${devisMatch[2]}`; info.fieldsFound++; }
    else if (devisMatch2) { info.devis = `${devisMatch2[1]} du ${devisMatch2[2]}`; info.fieldsFound++; }

    // Adresse de livraison
    info.adresseLivraison = extractAddress(text);
    if (info.adresseLivraison) info.fieldsFound++;

    // Fallback client
    if (!info.client && info.nomAffaire) {
      info.client = info.nomAffaire;
    }
  } catch (error) {
    console.error('❌ Erreur parsing BL:', error);
  }

  return info;
};

/**
 * Parse les informations d'un devis
 * @param {string} text - Le texte extrait du PDF
 * @returns {Object} Les informations extraites
 */
export const parseDevis = (text) => {
  const info = {
    numeroAffaire: null,
    type: null,
    client: null,
    dateDevis: null,
    validiteDevis: null,
    nomAffaire: null,
    interlocuteur: null,
    tel: null,
    fax: null,
    devis: null,
    adresseLivraison: null,
    montantHT: null,
    montantTTC: null,
    tva: null,
    fieldsFound: 0,
    fieldsTotal: 14
  };

  try {
    info.numeroAffaire = extractNumeroAffaire(text);
    if (info.numeroAffaire) info.fieldsFound++;

    // Numéro de devis
    const devisNumMatch = text.match(/Devis\s+(?:n[°o]?\s*)?[:\s]*(\d[\d\s/-]*)/i);
    if (devisNumMatch) { info.devis = devisNumMatch[1].trim(); info.fieldsFound++; }

    // Date du devis
    const dateDevisMatch = text.match(/(?:Date\s+(?:du\s+)?devis|Établi\s+le|Emis\s+le)\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
    if (dateDevisMatch) {
      const [jour, mois, annee] = dateDevisMatch[1].split('/');
      info.dateDevis = `${annee}-${mois}-${jour}`;
      info.fieldsFound++;
    } else {
      const dates = extractAllDates(text);
      if (dates.length > 0) { info.dateDevis = dates[0].iso; info.fieldsFound++; }
    }

    // Validité du devis
    const validiteMatch = text.match(/(?:Validité|valable\s+jusqu'au)\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
    if (validiteMatch) {
      const [jour, mois, annee] = validiteMatch[1].split('/');
      info.validiteDevis = `${annee}-${mois}-${jour}`;
      info.fieldsFound++;
    }

    // Client
    const clientMatch = text.match(/(?:Client|Destinataire|À l'attention de)\s*[:\s]*([^\n\r]{3,50})/i);
    if (clientMatch) { info.client = clientMatch[1].trim(); info.fieldsFound++; }

    // Objet / Nom affaire
    const objetMatch = text.match(/(?:Objet|Désignation|Référence|Intitulé)\s*[:\s]*([^\n\r]{3,80})/i);
    if (objetMatch) { info.nomAffaire = objetMatch[1].trim(); info.fieldsFound++; }

    // Type de prestation
    const typeMatch = text.match(/\b(Prestation|Location|Installation|Vente)\b/i);
    if (typeMatch) { info.type = typeMatch[1]; info.fieldsFound++; }

    // Interlocuteur
    const interMatch = text.match(/(Monsieur|Madame|M\.|Mme)\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇa-z][a-zàâéèêëîïôùûüç]+(?:\s+[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ][A-ZÀÂÉÈÊËÎÏÔÙÛÜÇa-z]+){0,2})/);
    if (interMatch) { info.interlocuteur = `${interMatch[1]} ${interMatch[2].trim()}`; info.fieldsFound++; }

    // Téléphone & Fax
    info.tel = extractPhone(text, 'Tél(?:éphone)?');
    if (info.tel) info.fieldsFound++;
    info.fax = extractPhone(text, 'Fax');
    if (info.fax) info.fieldsFound++;

    // Montants
    info.montantHT = extractMontant(text, '(?:Total|Montant)\\s*HT');
    if (info.montantHT) info.fieldsFound++;
    info.montantTTC = extractMontant(text, '(?:Total|Montant|Net à payer)\\s*TTC');
    if (info.montantTTC) info.fieldsFound++;
    info.tva = extractMontant(text, 'TVA');
    if (info.tva) info.fieldsFound++;

    // Adresse
    info.adresseLivraison = extractAddress(text);
    if (info.adresseLivraison) info.fieldsFound++;
  } catch (error) {
    console.error('❌ Erreur parsing Devis:', error);
  }

  return info;
};

/**
 * Parse les informations d'une facture
 * @param {string} text - Le texte extrait du PDF
 * @returns {Object} Les informations extraites
 */
export const parseFacture = (text) => {
  const info = {
    numeroAffaire: null,
    type: null,
    client: null,
    dateFacture: null,
    dateEcheance: null,
    nomAffaire: null,
    interlocuteur: null,
    tel: null,
    fax: null,
    numeroFacture: null,
    adresseLivraison: null,
    montantHT: null,
    montantTTC: null,
    tva: null,
    fieldsFound: 0,
    fieldsTotal: 14
  };

  try {
    info.numeroAffaire = extractNumeroAffaire(text);
    if (info.numeroAffaire) info.fieldsFound++;

    // Numéro de facture
    const factureNumMatch = text.match(/Facture\s+(?:n[°o]?\s*)?[:\s]*([A-Z0-9][\w\s/-]*)/i);
    if (factureNumMatch) { info.numeroFacture = factureNumMatch[1].trim(); info.fieldsFound++; }

    // Date facture
    const dateFactMatch = text.match(/(?:Date\s+(?:de\s+)?facture|Émise?\s+le|Date\s+d'émission)\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
    if (dateFactMatch) {
      const [jour, mois, annee] = dateFactMatch[1].split('/');
      info.dateFacture = `${annee}-${mois}-${jour}`;
      info.fieldsFound++;
    } else {
      const dates = extractAllDates(text);
      if (dates.length > 0) { info.dateFacture = dates[0].iso; info.fieldsFound++; }
    }

    // Échéance
    const echeanceMatch = text.match(/(?:Échéance|Echeance|Date\s+de\s+paiement|Payable\s+avant\s+le)\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
    if (echeanceMatch) {
      const [jour, mois, annee] = echeanceMatch[1].split('/');
      info.dateEcheance = `${annee}-${mois}-${jour}`;
      info.fieldsFound++;
    }

    // Client
    const clientMatch = text.match(/(?:Client|Facturé à|Destinataire)\s*[:\s]*([^\n\r]{3,50})/i);
    if (clientMatch) { info.client = clientMatch[1].trim(); info.fieldsFound++; }

    // Objet
    const objetMatch = text.match(/(?:Objet|Désignation|Référence)\s*[:\s]*([^\n\r]{3,80})/i);
    if (objetMatch) { info.nomAffaire = objetMatch[1].trim(); info.fieldsFound++; }

    // Type
    const typeMatch = text.match(/\b(Prestation|Location|Installation|Vente)\b/i);
    if (typeMatch) { info.type = typeMatch[1]; info.fieldsFound++; }

    // Interlocuteur
    const interMatch = text.match(/(Monsieur|Madame|M\.|Mme)\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇa-z][a-zàâéèêëîïôùûüç]+(?:\s+[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ][A-ZÀÂÉÈÊËÎÏÔÙÛÜÇa-z]+){0,2})/);
    if (interMatch) { info.interlocuteur = `${interMatch[1]} ${interMatch[2].trim()}`; info.fieldsFound++; }

    // Téléphone
    info.tel = extractPhone(text, 'Tél(?:éphone)?');
    if (info.tel) info.fieldsFound++;

    // Montants
    info.montantHT = extractMontant(text, '(?:Total|Montant)\\s*HT');
    if (info.montantHT) info.fieldsFound++;
    info.montantTTC = extractMontant(text, '(?:Total|Montant|Net à payer)\\s*TTC');
    if (info.montantTTC) info.fieldsFound++;
    info.tva = extractMontant(text, 'TVA');
    if (info.tva) info.fieldsFound++;

    // Adresse
    info.adresseLivraison = extractAddress(text);
    if (info.adresseLivraison) info.fieldsFound++;
  } catch (error) {
    console.error('❌ Erreur parsing Facture:', error);
  }

  return info;
};

/**
 * Parse un document de type inconnu — extraction générique
 * @param {string} text
 * @returns {Object}
 */
export const parseGeneric = (text) => {
  const info = {
    numeroAffaire: null,
    type: null,
    client: null,
    dateLocation: null,
    nomAffaire: null,
    interlocuteur: null,
    tel: null,
    fax: null,
    devis: null,
    adresseLivraison: null,
    fieldsFound: 0,
    fieldsTotal: 10
  };

  try {
    info.numeroAffaire = extractNumeroAffaire(text);
    if (info.numeroAffaire) info.fieldsFound++;

    const typeMatch = text.match(/\b(Prestation|Location|Installation|Vente)\b/i);
    if (typeMatch) { info.type = typeMatch[1]; info.fieldsFound++; }

    const dates = extractAllDates(text);
    if (dates.length > 0) { info.dateLocation = dates[0].iso; info.fieldsFound++; }

    const clientMatch = text.match(/(?:Client|Destinataire|À l'attention de|Société)\s*[:\s]*([^\n\r]{3,50})/i);
    if (clientMatch) { info.client = clientMatch[1].trim(); info.fieldsFound++; }

    const interMatch = text.match(/(Monsieur|Madame|M\.|Mme)\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇa-z][a-zàâéèêëîïôùûüç]+(?:\s+[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ][A-ZÀÂÉÈÊËÎÏÔÙÛÜÇa-z]+){0,2})/);
    if (interMatch) { info.interlocuteur = `${interMatch[1]} ${interMatch[2].trim()}`; info.fieldsFound++; }

    info.tel = extractPhone(text, 'Tél(?:éphone)?');
    if (info.tel) info.fieldsFound++;
    info.fax = extractPhone(text, 'Fax');
    if (info.fax) info.fieldsFound++;

    info.adresseLivraison = extractAddress(text);
    if (info.adresseLivraison) info.fieldsFound++;

    // Objet/titre
    const objetMatch = text.match(/(?:Objet|Désignation|Référence|Intitulé)\s*[:\s]*([^\n\r]{3,80})/i);
    if (objetMatch) { info.nomAffaire = objetMatch[1].trim(); info.fieldsFound++; }
  } catch (error) {
    console.error('❌ Erreur parsing générique:', error);
  }

  return info;
};

/**
 * Parse intelligent — détecte le type de document puis applique le parseur spécialisé
 * @param {string} text - Texte extrait du PDF
 * @returns {{ docType: string, docTypeLabel: string, confidence: number, info: Object }}
 */
export const smartParse = (text) => {
  const { docType, confidence } = detectDocumentType(text);
  let info;

  switch (docType) {
    case DOC_TYPES.BON_LIVRAISON:
      info = parseBonLivraison(text);
      break;
    case DOC_TYPES.DEVIS:
      info = parseDevis(text);
      // Mapper dateDevis → dateLocation pour cohérence avec le formulaire
      if (info.dateDevis && !info.dateLocation) info.dateLocation = info.dateDevis;
      if (info.devis == null && info.numeroFacture) info.devis = info.numeroFacture;
      break;
    case DOC_TYPES.FACTURE:
      info = parseFacture(text);
      if (info.dateFacture && !info.dateLocation) info.dateLocation = info.dateFacture;
      if (info.devis == null && info.numeroFacture) info.devis = `Fact. ${info.numeroFacture}`;
      break;
    case DOC_TYPES.CONTRAT:
    default:
      info = parseGeneric(text);
      break;
  }

  return {
    docType,
    docTypeLabel: getDocTypeLabel(docType),
    confidence,
    info,
  };
};

/**
 * Traite un batch de fichiers PDF
 * @param {File[]} files - Liste de fichiers PDF
 * @param {function} onProgress - Callback (index, total, result)
 * @returns {Promise<Array<{ file: File, docType: string, confidence: number, info: Object, error?: string }>>}
 */
export const batchParsePDFs = async (files, onProgress) => {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const text = await extractTextFromPDF(file);
      const parsed = smartParse(text);
      const result = { file, ...parsed, text, error: null };
      results.push(result);
      if (onProgress) onProgress(i + 1, files.length, result);
    } catch (error) {
      const result = { file, docType: DOC_TYPES.INCONNU, docTypeLabel: 'Erreur', confidence: 0, info: {}, text: '', error: error.message };
      results.push(result);
      if (onProgress) onProgress(i + 1, files.length, result);
    }
  }
  return results;
};

/**
 * Convertit une date du format DD/MM/YYYY vers un objet Date
 * @param {string} dateStr - Date au format DD/MM/YYYY
 * @returns {Date|null}
 */
export const parseDate = (dateStr) => {
  if (!dateStr) return null;
  
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  
  const [day, month, year] = parts;
  return new Date(year, month - 1, day);
};
