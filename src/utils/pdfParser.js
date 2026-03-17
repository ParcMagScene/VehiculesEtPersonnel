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
  BL_VENTE: 'bl_vente',
  BON_PREPARATION: 'bon_preparation',
  DEVIS: 'devis',
  FACTURE: 'facture',
  CONTRAT: 'contrat',
  INCONNU: 'inconnu',
};

const DOC_TYPE_LABELS = {
  [DOC_TYPES.BON_LIVRAISON]: 'Bon de Livraison',
  [DOC_TYPES.BL_VENTE]: 'BL Vente / Installation',
  [DOC_TYPES.BON_PREPARATION]: 'Bon de Préparation',
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

      // Extraction intelligente : détection de sauts de ligne via coordonnées Y
      let lastY = null;
      let currentLine = '';
      const lines = [];

      for (const item of textContent.items) {
        const str = item.str;
        if (!str && !item.hasEOL) continue;
        const y = Math.round((item.transform?.[5] || 0) * 10) / 10;

        if (lastY !== null && Math.abs(y - lastY) > 2) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = str;
        } else {
          currentLine += (currentLine ? ' ' : '') + str;
        }
        lastY = y;
      }
      if (currentLine.trim()) lines.push(currentLine.trim());

      fullText += lines.join('\n') + '\n';
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
    const text = await extractTextFromPDF(file);
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    return { text, pageCount: pdf.numPages, fileSize: file.size };
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
    [DOC_TYPES.BL_VENTE]: 0,
    [DOC_TYPES.BON_PREPARATION]: 0,
    [DOC_TYPES.DEVIS]: 0,
    [DOC_TYPES.FACTURE]: 0,
    [DOC_TYPES.CONTRAT]: 0,
  };

  // ─── BL Vente / Installation (Format A — "BON DE LIVRAISON VENTE") ───
  if (/bon\s+de\s+livraison\s+vente/i.test(t)) scores[DOC_TYPES.BL_VENTE] += 60;
  if (/notre\s+r[eé]f\s*:/i.test(t) && /objet\s*:/i.test(t)) scores[DOC_TYPES.BL_VENTE] += 20;
  if (/conditions\s+g[eé]n[eé]rales/i.test(t) && /bon\s+de\s+livraison/i.test(t)) scores[DOC_TYPES.BL_VENTE] += 15;
  if (/votre\s+interlocuteur/i.test(t) && /mag-scene/i.test(t)) scores[DOC_TYPES.BL_VENTE] += 10;
  if (/\bVTE\b/.test(text)) scores[DOC_TYPES.BL_VENTE] += 10;

  // ─── Bon de Préparation (Format B — "Bon de préparation") ───
  if (/bon\s+de\s+pr[eé]paration/i.test(t)) scores[DOC_TYPES.BON_PREPARATION] += 60;
  if (/r[eé]f[eé]rence\s+nom\s+qt[eé]\s+poids\s+volume/i.test(t)) scores[DOC_TYPES.BON_PREPARATION] += 20;
  if (/\bsonorisation\b/i.test(t) && /\blumi[eè]re\b/i.test(t)) scores[DOC_TYPES.BON_PREPARATION] += 15;
  if (/adresse\s+de\s+livraison/i.test(t) && /\bdevis\b/i.test(t)) scores[DOC_TYPES.BON_PREPARATION] += 10;
  if (/\b\d{2}\/\d{2}\/\d{4}\s+(AM|PM)\b/.test(text)) scores[DOC_TYPES.BON_PREPARATION] += 15;

  // ─── Bon de Livraison générique ───
  if (/bon\s+de\s+livraison/i.test(t)) scores[DOC_TYPES.BON_LIVRAISON] += 40;
  if (/\bbl\b/i.test(t) && /livraison/i.test(t)) scores[DOC_TYPES.BON_LIVRAISON] += 20;
  if (/prestation\s+(du|le)/i.test(t)) scores[DOC_TYPES.BON_LIVRAISON] += 15;
  if (/location\s+(du|le)/i.test(t)) scores[DOC_TYPES.BON_LIVRAISON] += 15;
  if (/adresse\s+de\s+livraison/i.test(t)) scores[DOC_TYPES.BON_LIVRAISON] += 10;

  // ─── Devis ───
  if (/\bdevis\b/i.test(t)) scores[DOC_TYPES.DEVIS] += 35;
  if (/devis\s+n[°o]?\s*[:\s]*\d/i.test(t)) scores[DOC_TYPES.DEVIS] += 20;
  if (/validité\s+du\s+devis/i.test(t)) scores[DOC_TYPES.DEVIS] += 15;
  if (/montant\s+ht/i.test(t)) scores[DOC_TYPES.DEVIS] += 10;
  if (/total\s+ttc/i.test(t)) scores[DOC_TYPES.DEVIS] += 5;

  // ─── Facture ───
  if (/\bfacture\b/i.test(t)) scores[DOC_TYPES.FACTURE] += 35;
  if (/facture\s+n[°o]?\s*[:\s]*\d/i.test(t)) scores[DOC_TYPES.FACTURE] += 20;
  if (/échéance|echeance/i.test(t)) scores[DOC_TYPES.FACTURE] += 10;
  if (/règlement|reglement|paiement/i.test(t)) scores[DOC_TYPES.FACTURE] += 10;
  if (/tva/i.test(t)) scores[DOC_TYPES.FACTURE] += 5;
  if (/net\s+[àa]\s+payer/i.test(t)) scores[DOC_TYPES.FACTURE] += 15;

  // ─── Contrat ───
  if (/\bcontrat\b/i.test(t)) scores[DOC_TYPES.CONTRAT] += 35;
  if (/convention/i.test(t)) scores[DOC_TYPES.CONTRAT] += 20;
  if (/durée\s+du\s+contrat|duree\s+du\s+contrat/i.test(t)) scores[DOC_TYPES.CONTRAT] += 15;
  if (/clause|article\s+\d/i.test(t)) scores[DOC_TYPES.CONTRAT] += 10;
  if (/signataire|signature/i.test(t)) scores[DOC_TYPES.CONTRAT] += 5;

  // Bonus communs (affaire number boosts BL types)
  if (extractNumeroAffaire(text)) {
    scores[DOC_TYPES.BL_VENTE] += 5;
    scores[DOC_TYPES.BON_PREPARATION] += 5;
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
    items: [],
    fournisseurs: [],
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

// ═══════════════════════════════════════════════════════════════
// PARSEUR FORMAT A — "BON DE LIVRAISON VENTE" (BL Ventes et installations)
// Structure : interlocuteur, client, Notre Réf AF, Objet, articles simples
// ═══════════════════════════════════════════════════════════════
export const parseBLVente = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const info = {
    numeroAffaire: null,
    variante: null,
    type: 'Vente',
    client: null,
    adresseLivraison: null,
    interlocuteur: null,
    tel: null,
    fax: null,
    objet: null,
    dateDocument: null,
    dateLocation: null,
    dateDebut: null,
    dateFin: null,
    nomAffaire: null,
    items: [],
    fieldsFound: 0,
    fieldsTotal: 12,
  };

  try {
    // Interlocuteur : "Votre interlocuteur : Richard FOUVET"
    const interMatch = text.match(/Votre\s+interlocuteur\s*:\s*(.+)/i);
    if (interMatch) { info.interlocuteur = interMatch[1].trim(); info.fieldsFound++; }

    // Notre Réf : AF30883 / 3
    const refMatch = text.match(/Notre\s+R[eé]f\s*:?\s*\n?\s*(AF\d{4,6})\s*\/?\s*(\d*)/i);
    if (refMatch) {
      info.numeroAffaire = refMatch[1];
      info.variante = refMatch[2] || null;
      info.fieldsFound++;
    } else {
      info.numeroAffaire = extractNumeroAffaire(text);
      if (info.numeroAffaire) info.fieldsFound++;
    }

    // Client : bloc entre "contact@mag-scene.com" et "Votre Réf."
    const clientBlockMatch = text.match(/contact@mag-scene\.com\s*\n([\s\S]*?)(?=Votre\s+R[eé]f)/i);
    if (clientBlockMatch) {
      const clientLines = clientBlockMatch[1].split('\n').map(l => l.trim()).filter(l => l && !/^p\.\d+$/.test(l));
      if (clientLines.length > 0) {
        info.client = clientLines[0];
        info.fieldsFound++;
        if (clientLines.length > 1) {
          info.adresseLivraison = clientLines.slice(1).join('\n');
          info.fieldsFound++;
        }
      }
    }

    // Téléphone & Fax client
    const telMatch = text.match(/V\.\s*T[eé]l\s*:\s*\n?\s*(\d[\d\s.]+)/i);
    if (telMatch) { info.tel = telMatch[1].trim(); info.fieldsFound++; }
    const faxMatch = text.match(/V\.\s*Fax\s*:\s*\n?\s*(\d[\d\s.]+)/i);
    if (faxMatch) { info.fax = faxMatch[1].trim(); info.fieldsFound++; }

    // Objet : "VTE MICROS HF/SIMPLES-DOUBLES du 30/10/24 au 30/10/24"
    const objetMatch = text.match(/Objet\s*:\s*\n?\s*(.+)/i);
    if (objetMatch) {
      info.objet = objetMatch[1].trim();
      info.nomAffaire = info.objet;
      info.fieldsFound++;

      // Type depuis l'objet
      if (/\bVTE\b|\bvente\b/i.test(info.objet)) info.type = 'Vente';
      else if (/\bINSTALL/i.test(info.objet)) info.type = 'Installation';
      else if (/\bLOC\b/i.test(info.objet)) info.type = 'Location';
      else if (/\bPREST/i.test(info.objet)) info.type = 'Prestation';

      // Dates du/au dans l'objet
      const datesMatch = info.objet.match(/du\s+(\d{2})\/(\d{2})\/(\d{2,4})\s+au\s+(\d{2})\/(\d{2})\/(\d{2,4})/i);
      if (datesMatch) {
        const [, j1, m1, a1, j2, m2, a2] = datesMatch;
        const y1 = a1.length === 2 ? '20' + a1 : a1;
        const y2 = a2.length === 2 ? '20' + a2 : a2;
        info.dateDebut = `${y1}-${m1}-${j1}`;
        info.dateFin = `${y2}-${m2}-${j2}`;
        info.dateLocation = info.dateDebut;
        info.fieldsFound++;
      }
    }

    // Date document : "A Saint-Etienne le DD/MM/YYYY"
    const dateDocMatch = text.match(/A\s+Saint-[EÉe]tienne\s+le\s+(\d{2})\/(\d{2})\/(\d{4})/i);
    if (dateDocMatch) {
      info.dateDocument = `${dateDocMatch[3]}-${dateDocMatch[2]}-${dateDocMatch[1]}`;
      info.fieldsFound++;
    }

    // ─── Extraction des articles ───
    // Fournisseurs connus (après la qté dans le BL)
    const KNOWN_FOURNISSEURS = new Set([
      'ESL', 'LA BS', 'ALGAM', 'STOCK', 'CSI', 'KLOTZ', 'R&S', 'BS',
      'ADAM HALL', 'ROBE', 'CLAY PAKY', 'PROLIGHTS TRIBE',
    ]);
    const isFournisseurLine = (line) => {
      if (!line || line.length < 2 || line.length > 20) return false;
      if (KNOWN_FOURNISSEURS.has(line.toUpperCase())) return true;
      // Heuristic : tout en majuscules, lettres/espaces/& seulement, pas un code article
      if (!/^[A-Z][A-Z\s&'.]{0,19}$/.test(line)) return false;
      if (/^(VTE|PORT|MO|CODE|NOM|QT)/i.test(line)) return false;
      return true;
    };

    // Bloc entre "Qté" (ou header contenant Qté) et "Conditions générales"
    const qteIdx = lines.findIndex(l => /\bQt[eé](?:\b|\s|$)/i.test(l));
    const condIdx = lines.findIndex((l, i) => i > qteIdx && /conditions\s+g[eé]n[eé]rales/i.test(l));
    if (qteIdx >= 0) {
      const isJoinedHeader = !/^Qt[eé]$/i.test(lines[qteIdx]);
      const endIdx = condIdx >= 0 ? condIdx : lines.length;
      const fournisseursSet = new Set();

      // Helper : séparer code / description
      const splitCodeDesc = (fullDesc) => {
        let code = '', description = fullDesc;
        const codeSplit = fullDesc.match(/^([A-Z0-9][A-Z0-9._&-]{1,15})\s+(.{10,})$/);
        if (codeSplit) { code = codeSplit[1]; description = codeSplit[2]; }
        return { code, description };
      };

      // Skip page headers dans BL multi-pages
      const isPageHeader = (line) => /^(Votre interlocuteur|Sarl au capital|Parc d'activit|Tel\.|p\.\d+$)/i.test(line) || /contact@mag-scene/i.test(line);

      if (isJoinedHeader) {
        // ─── Mode lignes jointes (pdfjs-dist) ───
        for (let i = qteIdx + 1; i < endIdx; i++) {
          const line = lines[i];
          if (!line || isPageHeader(line)) continue;

          // Skip repeated "Code Nom Qté" headers
          if (/\bCode\b/i.test(line) && /\bQt[eé](?:\b|\s|$)/i.test(line)) continue;

          // 1) "desc QTY FOURNISSEUR" — texte après le chiffre en fin de ligne
          const rowWithFourn = line.match(/^(.+)\s+(\d{1,5})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s&'.]{0,19})\s*$/);
          if (rowWithFourn) {
            const { code, description } = splitCodeDesc(rowWithFourn[1].trim());
            const qty = parseInt(rowWithFourn[2]);
            const fourn = rowWithFourn[3].trim();
            if (description && description.length > 3) {
              info.items.push({ code, description, quantity: qty, fournisseur: fourn });
              fournisseursSet.add(fourn);
            }
            continue;
          }

          // 2) "desc QTY" — pas de fournisseur
          const rowMatch = line.match(/^(.+?)\s+(\d{1,5})\s*$/);
          if (rowMatch) {
            const { code, description } = splitCodeDesc(rowMatch[1].trim());
            const qty = parseInt(rowMatch[2]);
            if (description && description.length > 3) {
              info.items.push({ code, description, quantity: qty, fournisseur: null });
            }
          }
        }
      } else {
        // ─── Mode lignes séparées (PyMuPDF-like) : qty sur sa propre ligne ───
        for (let i = qteIdx + 1; i < endIdx; i++) {
          // Skip headers + page headers
          if (/^(Code|Nom)$/i.test(lines[i])) continue;
          if (/^Qt[eé]$/i.test(lines[i])) continue;
          if (isPageHeader(lines[i])) continue;

          // Ancrage sur les lignes de quantité (chiffre seul)
          if (/^\d{1,5}$/.test(lines[i])) {
            const qty = parseInt(lines[i]);
            let description = '';
            let code = '';
            let fournisseur = null;

            // Remonter pour trouver description + code
            let descIdx = i - 1;
            while (descIdx > qteIdx && (/^(Code|Nom|Qt[eé])$/i.test(lines[descIdx]) || isPageHeader(lines[descIdx]))) descIdx--;

            if (descIdx > qteIdx && !/^\d{1,5}$/.test(lines[descIdx]) && !isFournisseurLine(lines[descIdx])) {
              description = lines[descIdx];
              // Ligne précédente = potentiel code article
              const codeIdx = descIdx - 1;
              if (codeIdx > qteIdx && !isPageHeader(lines[codeIdx])) {
                const maybeCode = lines[codeIdx];
                if (maybeCode && maybeCode.length <= 20
                    && /^[A-Z0-9][A-Z0-9._&\s-]{0,19}$/i.test(maybeCode)
                    && !/^(Code|Nom|Qt[eé])$/i.test(maybeCode)
                    && !/^\d{1,5}$/.test(maybeCode)
                    && !isFournisseurLine(maybeCode)) {
                  code = maybeCode;
                }
              }
            }

            // Avancer pour trouver le fournisseur
            if (i + 1 < endIdx && isFournisseurLine(lines[i + 1])) {
              fournisseur = lines[i + 1];
              fournisseursSet.add(fournisseur);
            }

            if (description && !/^(Code|Nom|Qt[eé])$/i.test(description)) {
              info.items.push({ code, description, quantity: qty, fournisseur });
            }
          }
        }
      }

      info.fournisseurs = [...fournisseursSet];
      if (info.items.length > 0) info.fieldsFound++;
    }

    // Fallback client
    if (!info.client && info.nomAffaire) info.client = info.nomAffaire;
  } catch (error) {
    console.error('❌ Erreur parsing BL Vente:', error);
  }

  return info;
};

// ═══════════════════════════════════════════════════════════════
// PARSEUR FORMAT B — "BON DE PRÉPARATION" (BL Affaires Location/Presta)
// Structure : AF, nom affaire, client, adresse, devis, sections catégorisées
// ═══════════════════════════════════════════════════════════════
const SECTION_NAMES = ['SONORISATION', 'LUMIERE', 'LUMIÈRE', 'REGIE', 'RÉGIE', 'REGIE/PLATEAU', 'RÉGIE/PLATEAU', 'VIDEO', 'VIDÉO', 'STRUCTURE', 'MOBILIER', 'DIVERS', 'ACCROCHE', 'MOTORISATION', 'PRATICABLE', 'PRATICABLES', 'ELECTRICITE', 'ÉLECTRICITÉ', 'CÂBLAGE', 'CABLAGE', 'AUDIOVISUEL', 'DIFFUSION', 'VENTE', 'VTE'];
const SECTION_PATTERN = /^(SONORISATION|LUMIERE|LUMIÈRE|REGIE|RÉGIE|REGIE\/PLATEAU|RÉGIE\/PLATEAU|VIDEO|VIDÉO|STRUCTURE|MOBILIER|DIVERS|ACCROCHE|MOTORISATION|PRATICABLES?|ELECTRICITE|ÉLECTRICITÉ|CÂBLAGE|CABLAGE|AUDIOVISUEL|DIFFUSION|VENTE|VTE)(\s|$)/i;

export const parseBonPreparation = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const info = {
    numeroAffaire: null,
    type: null,
    client: null,
    nomAffaire: null,
    adresseLivraison: null,
    devis: null,
    devisDate: null,
    datePreparation: null,
    dateLocation: null,
    interlocuteur: null,
    tel: null,
    fax: null,
    sections: [],
    items: [],
    fieldsFound: 0,
    fieldsTotal: 12,
  };

  try {
    // Date de préparation ("DD/MM/YYYY à HH:MM:SS")
    const datePrepMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s+[àa]\s+\d{2}:\d{2}:\d{2}/);
    if (datePrepMatch) {
      info.datePreparation = `${datePrepMatch[3]}-${datePrepMatch[2]}-${datePrepMatch[1]}`;
      info.fieldsFound++;
    }

    // AF number — essayer d'abord ligne isolée, sinon fallback regex souple
    const afMatch = text.match(/^(AF\d{4,6})$/m);
    if (afMatch) {
      info.numeroAffaire = afMatch[1]; info.fieldsFound++;
    } else {
      // Fallback : AF dans le texte (avec espace optionnel, milieu de ligne)
      const afFallback = extractNumeroAffaire(text);
      if (afFallback) { info.numeroAffaire = afFallback; info.fieldsFound++; }
    }

    // Trouver l'index AF dans les lignes (essai strict puis souple)
    let afIdx = lines.findIndex(l => /^AF\d{4,6}$/.test(l));
    if (afIdx < 0) {
      afIdx = lines.findIndex(l => /\bAF\s?\d{4,6}\b/i.test(l));
    }
    if (afIdx >= 0) {
      // Nom affaire = ligne après AF
      if (afIdx + 1 < lines.length && lines[afIdx + 1] !== 'Devis') {
        info.nomAffaire = lines[afIdx + 1];
        info.fieldsFound++;
        // Détecter type depuis le nom
        if (/prestation/i.test(info.nomAffaire)) info.type = 'Prestation';
        else if (/location/i.test(info.nomAffaire)) info.type = 'Location';
        else if (/installation/i.test(info.nomAffaire)) info.type = 'Installation';
        else if (/vente|vte/i.test(info.nomAffaire)) info.type = 'Vente';
      }

      // Trouver "Devis" keyword — soit ligne isolée, soit fusionnée "1001 Devis 05/02/2026"
      const devisIdx = lines.findIndex((l, i) => i > afIdx && l === 'Devis');
      // Aussi chercher la ligne fusionnée contenant "Devis"
      const devisInlineIdx = devisIdx < 0
        ? lines.findIndex((l, i) => i > afIdx && /\bDevis\b/i.test(l) && /\d{3,}/.test(l))
        : -1;
      // Index effectif de la ligne contenant l'info devis
      const devisLineIdx = devisIdx >= 0 ? devisIdx : devisInlineIdx;

      if (devisIdx >= 0) {
        // Cas classique : "Devis" sur sa propre ligne
        if (devisIdx > 0 && /^\d+$/.test(lines[devisIdx - 1])) {
          info.devis = lines[devisIdx - 1];
          info.fieldsFound++;
        } else if (devisIdx + 1 < lines.length && /^\d+$/.test(lines[devisIdx + 1])) {
          info.devis = lines[devisIdx + 1];
          info.fieldsFound++;
        }
        const dateSearchStart = devisIdx + 1;
        for (let j = dateSearchStart; j < Math.min(devisIdx + 4, lines.length); j++) {
          const dm = lines[j].match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (dm) {
            info.devisDate = `${dm[3]}-${dm[2]}-${dm[1]}`;
            info.fieldsFound++;
            break;
          }
        }
      } else if (devisInlineIdx >= 0) {
        // Cas fusionné : "1001 Devis 05/02/2026" ou "Devis 1001" sur une seule ligne
        const devisLine = lines[devisInlineIdx];
        const numMatch = devisLine.match(/(\d{3,})\s*Devis|Devis\s*(\d{3,})/i);
        if (numMatch) {
          info.devis = numMatch[1] || numMatch[2];
          info.fieldsFound++;
        }
        const dateMatch = devisLine.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (dateMatch) {
          info.devisDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
          info.fieldsFound++;
        }
      }

      // Client + adresse : entre nomAffaire (afIdx+1) et la ligne devis
      if (devisLineIdx >= 0) {
        const clientStart = afIdx + 2;
        // Pour le cas classique, exclure le numéro de devis s'il est sur la ligne avant
        const clientEnd = (devisIdx >= 0 && /^\d+$/.test(lines[devisIdx - 1]))
          ? devisIdx - 1
          : devisLineIdx;
        const clientLines = lines.slice(clientStart, clientEnd);
        if (clientLines.length > 0 && !info.client) {
          info.client = clientLines[0];
          info.fieldsFound++;
          if (clientLines.length > 1) {
            info.adresseLivraison = clientLines.slice(1).join('\n');
            info.fieldsFound++;
          }
        } else if (clientLines.length > 1 && !info.adresseLivraison) {
          // Client déjà trouvé par fallback mais pas l'adresse
          info.adresseLivraison = clientLines.slice(1).join('\n');
          info.fieldsFound++;
        }
      }
    }

    // ── Fallback : recherche du devis via le label ou inline ──
    if (!info.devis) {
      // Forme inline: "Devis 1001" ou "Devis : 1001" ou "1001 Devis"
      const devisInlineMatch = text.match(/\bDevis\s*[:\s]\s*(\d{3,})/i);
      if (devisInlineMatch) {
        info.devis = devisInlineMatch[1];
        info.fieldsFound++;
      }
      // Chercher aussi le label "Devis" suivi d'un numéro + date sur les lignes voisines
      if (!info.devis) {
        for (let li = 0; li < lines.length; li++) {
          if (/^Devis$/i.test(lines[li])) {
            // Chercher un numéro dans les 3 lignes avant ou après
            for (let delta = -2; delta <= 3; delta++) {
              const idx = li + delta;
              if (idx >= 0 && idx < lines.length && idx !== li && /^\d{3,}$/.test(lines[idx])) {
                info.devis = lines[idx];
                info.fieldsFound++;
                break;
              }
            }
            break;
          }
        }
      }
    }
    // Fallback date devis
    if (!info.devisDate) {
      // "du DD/MM/YYYY" pattern near "Devis"
      const devisDateMatch = text.match(/\bDevis\b[^\n]{0,30}?(\d{2})\/(\d{2})\/(\d{4})/i);
      if (devisDateMatch) {
        info.devisDate = `${devisDateMatch[3]}-${devisDateMatch[2]}-${devisDateMatch[1]}`;
        info.fieldsFound++;
      }
    }

    // ── Fallback : recherche du client via le label "Client" ──
    // pdfjs-dist peut produire "Client NomDuClient" sur une même ligne ou "Client" suivi du nom sur la ligne suivante
    if (!info.client) {
      const clientLabelIdx = lines.findIndex(l => /^Client$/i.test(l));
      if (clientLabelIdx >= 0 && clientLabelIdx + 1 < lines.length) {
        // Le client est sur la ligne suivante (si ce n'est pas un autre label connu)
        const nextLine = lines[clientLabelIdx + 1];
        if (nextLine && !/^(du|au|Adresse|R[eé]f[eé]rence|Nom|Qt[eé]|Poids|Volume|T[eé]l|Fax|Interlocuteur|Affaire|Devis)\b/i.test(nextLine)) {
          info.client = nextLine;
          info.fieldsFound++;
        }
      }
      // Ou "Client" en début de ligne suivi de la valeur : "Client C'KELPROD"
      if (!info.client) {
        const clientInlineMatch = text.match(/\bClient\s*[:\s]\s*([A-ZÀ-ÿ][A-ZÀ-ÿ'\s\-&.]{2,})/i);
        if (clientInlineMatch) {
          const val = clientInlineMatch[1].trim();
          // Exclure les faux positifs (labels de colonnes, mots-clés)
          if (!/^(du|au|Adresse|R[eé]f[eé]rence|Nom|Qt[eé]|Poids|Volume)\b/i.test(val)) {
            info.client = val;
            info.fieldsFound++;
          }
        }
      }
    }

    // ── Fallback : recherche de l'adresse via "Adresse de livraison" ou patterns ──
    if (!info.adresseLivraison) {
      const addrLabelIdx = lines.findIndex(l => /Adresse de livraison/i.test(l));
      if (addrLabelIdx >= 0) {
        // D'abord chercher APRÈS le label (format classique)
        const addrLinesAfter = [];
        for (let j = addrLabelIdx + 1; j < Math.min(addrLabelIdx + 5, lines.length); j++) {
          const ln = lines[j];
          if (/^(R[eé]f[eé]rence|Nom|Qt[eé]|Poids|Volume|T[eé]l|Fax|SONORISATION|LUMIERE|STRUCTURE|REGIE|VIDEO)\b/i.test(ln)) break;
          if (/\d{5}\s+[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ]/.test(ln) || /^\d+\s+(Rue|Avenue|Boulevard|Bd|Place|All[eé]e|Impasse|Chemin|Route)\b/i.test(ln) || /^(FRANCE|FR)$/i.test(ln)) {
            addrLinesAfter.push(ln);
          } else if (addrLinesAfter.length > 0 || ln.length > 5) {
            addrLinesAfter.push(ln);
          }
        }
        if (addrLinesAfter.length > 0) {
          info.adresseLivraison = addrLinesAfter.join('\n');
          info.fieldsFound++;
        }
      }
      // Si toujours rien, chercher des lignes d'adresse AVANT le label (format Locmat : labels après valeurs)
      if (!info.adresseLivraison && info.client) {
        const clientIdx = lines.findIndex(l => l === info.client);
        if (clientIdx >= 0) {
          const addrLinesBefore = [];
          const stopIdx = addrLabelIdx >= 0 ? addrLabelIdx : Math.min(clientIdx + 6, lines.length);
          for (let j = clientIdx + 1; j < stopIdx; j++) {
            const ln = lines[j];
            // S'arrêter si on tombe sur un label ou la ligne devis fusionnée
            if (/\bDevis\b/i.test(ln) || /^(Affaire|Interlocuteur|Client|du|Adresse|R[eé]f[eé]rence)\b/i.test(ln)) break;
            // Accepter les lignes qui ressemblent à une adresse
            if (/\d{5}\s+\S/.test(ln) || /\d+\s*(Rue|Avenue|Boulevard|Bd|Place|All[eé]e|Impasse|Chemin|Route|Av\.|Cours)\b/i.test(ln) || /^(FRANCE|FR)$/i.test(ln) || ln.length > 5) {
              addrLinesBefore.push(ln);
            }
          }
          if (addrLinesBefore.length > 0) {
            info.adresseLivraison = addrLinesBefore.join('\n');
            info.fieldsFound++;
          }
        }
      }
    }

    // ── Fallback : interlocuteur via le label ──
    if (!info.interlocuteur) {
      const interLabelIdx = lines.findIndex(l => /^Interlocuteur$/i.test(l));
      if (interLabelIdx >= 0 && interLabelIdx + 1 < lines.length) {
        const nextLine = lines[interLabelIdx + 1];
        if (nextLine && !/^(Client|du|au|Adresse|R[eé]f[eé]rence|Nom|Qt[eé]|Poids|Volume|T[eé]l|Fax|Affaire|Devis)\b/i.test(nextLine) && nextLine.length > 1) {
          info.interlocuteur = nextLine;
          info.fieldsFound++;
        }
      }
    }

    // Tél & Fax
    const telMatch = text.match(/T[eé]l\s*:\s*\n?\s*(\d[\d\s.]{3,})/i);
    if (telMatch) { info.tel = telMatch[1].trim(); info.fieldsFound++; }
    const faxMatch = text.match(/Fax\s*:\s*\n?\s*(\d[\d\s.]{3,})/i);
    if (faxMatch) { info.fax = faxMatch[1].trim(); info.fieldsFound++; }

    // ─── Extraction des sections et articles ───
    // Scanner après "Fax :" (exact ou contenu dans une ligne) ou header joint "Référence Nom Qté"
    const faxLineIdx = lines.findIndex(l => /\bFax\s*:/i.test(l));
    const headerLineIdx = lines.findIndex(l => /\bR[eé]f[eé]rence\b.*\bNom\b.*\bQt[eé]\b/i.test(l));
    const scanStart = headerLineIdx >= 0 ? headerLineIdx + 1 : (faxLineIdx >= 0 ? faxLineIdx + 1 : 0);
    let currentSection = null;
    let firstSectionDate = null;
    let lastSectionDate = null;

    let i = scanStart;
    while (i < lines.length) {
      const line = lines[i];

      // Skip en-têtes de page répétés (contenant "Bon de préparation" ou numéro de page)
      if (/Bon de pr[eé]paration/i.test(line) || /^-\s*\d+\s*-$/.test(line)) {
        // Chercher le prochain header / Fax pour reprendre le scan
        const nextFaxIdx = lines.findIndex((l, j) => j > i && /\bFax\s*:/i.test(l));
        const nextHeaderIdx = lines.findIndex((l, j) => j > i && /\bR[eé]f[eé]rence\b.*\bNom\b.*\bQt[eé]\b/i.test(l));
        const skipTo = [nextFaxIdx, nextHeaderIdx].filter(x => x > i);
        if (skipTo.length > 0) { i = Math.min(...skipTo) + 1; continue; }
      }

      // Nouveau header de section (exact ou suivi de chiffres)
      const sectionMatch = SECTION_PATTERN.exec(line);
      if (sectionMatch) {
        const sectionName = sectionMatch[1].toUpperCase();
        currentSection = { name: sectionName, dateDebut: null, dateFin: null, items: [] };
        info.sections.push(currentSection);
        // Chercher dates dans les lignes suivantes (jusqu'à 8 lignes)
        for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
          const dm = lines[j].match(/(\d{2}\/\d{2}\/\d{4})\s+(AM|PM)\s+(\d{2}\/\d{2}\/\d{4})\s+(AM|PM)/);
          if (dm && !currentSection.dateDebut) {
            currentSection.dateDebut = `${dm[1]} ${dm[2]}`;
            currentSection.dateFin = `${dm[3]} ${dm[4]}`;
            const d1 = dm[1].split('/').reverse().join('-');
            const d2 = dm[3].split('/').reverse().join('-');
            if (!firstSectionDate || d1 < firstSectionDate) firstSectionDate = d1;
            if (!lastSectionDate || d2 > lastSectionDate) lastSectionDate = d2;
          }
        }
        i++;
        continue;
      }

      // Détection d'article (2 modes : lignes jointes ou séparées)
      // Mode joint (pdfjs-dist) : "description [ref] qty poids volume" sur une seule ligne
      // Mode séparé (PyMuPDF) : description, ref, qty, poids, volume sur des lignes distinctes
      if (currentSection) {
        // Essai mode joint : ligne se terminant par "nombre nombre nombre" (qty poids volume)
        const joinedMatch = line.match(/^(.{8,}?)\s+(\d{1,5})\s+([\d,.]+)\s+([\d,.]+)\s*$/);
        if (joinedMatch) {
          let fullDesc = joinedMatch[1].trim();
          const qty = parseInt(joinedMatch[2]);
          const poids = parseFloat(joinedMatch[3].replace(',', '.')) || 0;
          const volume = parseFloat(joinedMatch[4].replace(',', '.')) || 0;
          let reference = '';
          // Séparer la référence (dernier mot court en majuscules/chiffres)
          const refSplit = fullDesc.match(/^(.+?)\s+([A-Z][A-Z0-9 ._-]{1,20})\s*$/);
          if (refSplit && refSplit[1].length > 12) {
            fullDesc = refSplit[1];
            reference = refSplit[2];
          }
          // Skip si c'est un agrégat de section (fullDesc = nom de section)
          if (!SECTION_NAMES.some(s => fullDesc.toUpperCase().startsWith(s))) {
            const item = { reference, description: fullDesc, quantity: qty, poids, volume, section: currentSection.name };
            currentSection.items.push(item);
            info.items.push(item);
          }
          i++;
          continue;
        }

        // Mode séparé : détection de ligne descriptive (avec • ou longue avec lettres)
        if (!SECTION_PATTERN.test(line)
          && !/^(du|au)$/i.test(line)
          && !/^\d{2}\/\d{2}\/\d{4}\s+(AM|PM)/.test(line)
          && !/\bR[eé]f[eé]rence\b.*\bNom\b.*\bQt[eé]\b/i.test(line)
          && !/^(R[eé]f[eé]rence|Nom|Qt[eé]|Poids|Volume|Affaire|Interlocuteur|Client|Adresse|T[eé]l|Fax)\s*:?$/i.test(line)
          && !/Bon de pr[eé]paration/i.test(line)
          && !/^-\s*\d+\s*-$/.test(line)
          && !/^AF\d{4,6}$/.test(line)
          && (line.includes('•') || line.includes('!') || (line.length > 20 && /[a-zA-ZÀ-ÿ]/.test(line)))
        ) {
          const description = line.replace(/^!\s*/, '').trim();
          let reference = '';
          let qty = 0, poids = 0, volume = 0;

          let j = i + 1;
          // Ligne suivante : référence (court, non numérique) ou quantité
          if (j < lines.length) {
            const nextLine = lines[j].replace(/\s/g, '');
            if (/^\d+$/.test(nextLine)) {
              qty = parseInt(nextLine);
              j++;
            } else if (!SECTION_PATTERN.test(lines[j]) && !lines[j].includes('•')
                       && !/^(du|au)$/i.test(lines[j]) && lines[j].length < 30) {
              reference = lines[j];
              j++;
              if (j < lines.length && /^\d+$/.test(lines[j].replace(/\s/g, ''))) {
                qty = parseInt(lines[j].replace(/\s/g, ''));
                j++;
              }
            }
          }
          // Poids
          if (j < lines.length && /^[\d,.\s]+$/.test(lines[j])) {
            poids = parseFloat(lines[j].replace(',', '.').replace(/\s/g, '')) || 0;
            j++;
          }
          // Volume
          if (j < lines.length && /^[\d,.\s]+$/.test(lines[j])) {
            volume = parseFloat(lines[j].replace(',', '.').replace(/\s/g, '')) || 0;
            j++;
          }

          const item = { reference, description, quantity: qty, poids, volume, section: currentSection.name };
          currentSection.items.push(item);
          info.items.push(item);
          i = j;
          continue;
        }
      }

      i++;
    }

    // Dates de la prestation/location
    if (firstSectionDate) {
      info.dateLocation = firstSectionDate;
      info.fieldsFound++;
    }
    if (info.items.length > 0) info.fieldsFound++;
    if (info.sections.length > 0) info.fieldsFound++;

    // Type par défaut si non détecté
    if (!info.type) info.type = 'Prestation';
  } catch (error) {
    console.error('❌ Erreur parsing Bon de Préparation:', error);
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

// ═══ Calcul de confiance par champ ═══
const computeFieldConfidence = (result) => {
  const fc = {};
  // Numéro affaire
  if (result.numero) {
    fc.numero = /^AF\d{4,6}$/.test(result.numero) ? 'high' : 'medium';
  }
  // Type
  if (result.type) {
    fc.type = ['Prestation', 'Location', 'Installation', 'Vente'].includes(result.type) ? 'high' : 'low';
  }
  // Client
  if (result.client) {
    fc.client = result.client.length > 5 ? 'high' : 'medium';
  }
  // Date
  if (result.date) {
    fc.date = /^\d{4}-\d{2}-\d{2}$/.test(result.date) ? 'high' : 'medium';
  }
  // Interlocuteur
  if (result.interlocuteur) {
    fc.interlocuteur = /^(Monsieur|Madame|M\.|Mme)/i.test(result.interlocuteur) ? 'high' : 'medium';
  }
  // Adresse
  if (result.adresse) {
    fc.adresse = /\d{5}/.test(result.adresse) ? 'high' : 'medium';
  }
  // Nom
  if (result.nomAffaire) {
    fc.nomAffaire = result.nomAffaire.length > 3 ? 'high' : 'medium';
  }
  // Tél
  if (result.tel) {
    fc.tel = result.tel.replace(/\s/g, '').length >= 10 ? 'high' : 'medium';
  }
  // Fax
  if (result.fax) {
    fc.fax = result.fax.replace(/\s/g, '').length >= 10 ? 'high' : 'medium';
  }
  // Devis
  if (result.devis) {
    fc.devis = 'medium';
  }
  // Items
  if (result.items && result.items.length > 0) {
    fc.items = result.items.length > 2 ? 'high' : 'medium';
  }
  // Sections
  if (result.sections && result.sections.length > 0) {
    fc.sections = 'high';
  }
  return fc;
};

/**
 * Parse intelligent — détecte le type de document puis applique le parseur spécialisé
 * Retourne un objet APLATI pour usage direct par BLImportModal
 * @param {string} text - Texte extrait du PDF
 * @returns {Object} Objet aplati avec docType, confidence, et tous les champs extraits
 */
export const smartParse = (text) => {
  const { docType, confidence, scores } = detectDocumentType(text);
  let info;

  switch (docType) {
    case DOC_TYPES.BL_VENTE:
      info = parseBLVente(text);
      break;
    case DOC_TYPES.BON_PREPARATION:
      info = parseBonPreparation(text);
      break;
    case DOC_TYPES.BON_LIVRAISON:
      info = parseBonLivraison(text);
      // Fallback : si pas d'items, essayer le parseur BL Vente pour les articles
      if (!info.items || info.items.length === 0) {
        try {
          const venteInfo = parseBLVente(text);
          if (venteInfo.items && venteInfo.items.length > 0) {
            info.items = venteInfo.items;
            info.fournisseurs = venteInfo.fournisseurs || [];
          }
        } catch (_) { /* ignore */ }
      }
      break;
    case DOC_TYPES.DEVIS:
      info = parseDevis(text);
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

  // Retour APLATI — champs directement accessibles par BLImportModal
  const result = {
    docType,
    docTypeLabel: getDocTypeLabel(docType),
    confidence,
    scores,
    // Champs principaux aplatis
    numero: info.numeroAffaire || null,
    type: info.type || null,
    client: info.client || null,
    destinataire: info.client || null,
    date: info.dateLocation || info.dateDebut || info.dateDevis || info.dateFacture || null,
    dateLivraison: info.dateLocation || info.dateDebut || null,
    dateDebut: info.dateDebut || null,
    dateFin: info.dateFin || null,
    datePreparation: info.datePreparation || null,
    objet: info.objet || null,
    variante: info.variante || null,
    nomAffaire: info.nomAffaire || null,
    interlocuteur: info.interlocuteur || null,
    tel: info.tel || null,
    fax: info.fax || null,
    devis: info.devis || null,
    adresse: info.adresseLivraison || null,
    lieu: info.adresseLivraison || null,
    montantHT: info.montantHT || null,
    montantTTC: info.montantTTC || null,
    tva: info.tva || null,
    items: info.items || [],
    sections: info.sections || [],
    fournisseurs: info.fournisseurs || [],
    fieldsFound: info.fieldsFound || 0,
    fieldsTotal: info.fieldsTotal || 0,
    // Info brute originale pour accès détaillé
    _raw: info,
  };

  // Calculer la confiance par champ
  result._fieldConfidence = computeFieldConfidence(result);
  return result;
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
