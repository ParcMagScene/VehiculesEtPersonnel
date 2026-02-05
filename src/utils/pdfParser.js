// Utilitaire pour extraire du texte depuis un PDF
import * as pdfjsLib from 'pdfjs-dist';

// Configurer le worker depuis le dossier public
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

/**
 * Extrait le texte complet d'un fichier PDF
 * @param {File} file - Le fichier PDF à analyser
 * @returns {Promise<string>} Le texte extrait
 */
export const extractTextFromPDF = async (file) => {
  console.log('🔍 Début extraction PDF:', file.name, 'Taille:', file.size);
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    console.log('✅ ArrayBuffer créé:', arrayBuffer.byteLength, 'bytes');
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    console.log('📄 Chargement du document PDF...');
    
    const pdf = await loadingTask.promise;
    console.log('✅ PDF chargé:', pdf.numPages, 'pages');
    
    let fullText = '';
    
    // Parcourir toutes les pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`📖 Lecture page ${pageNum}/${pdf.numPages}...`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
      console.log(`✅ Page ${pageNum} extraite (${pageText.length} caractères)`);
    }
    
    console.log('✅ Extraction complète:', fullText.length, 'caractères au total');
    return fullText;
  } catch (error) {
    console.error('❌ Erreur lors de l\'extraction du texte PDF:', error);
    console.error('Type d\'erreur:', error.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    throw new Error(`Impossible d'analyser le PDF: ${error.message}`);
  }
};

/**
 * Parse les informations d'un bon de livraison
 * @param {string} text - Le texte extrait du PDF
 * @returns {Object} Les informations extraites
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
    adresseLivraison: null
  };

  try {
    console.log('🔍 Parsing du texte BL...');
    
    // Extraction du numéro d'affaire (AF32770)
    const affaireMatch = text.match(/\b(AF\d+)\b/i);
    if (affaireMatch) {
      info.numeroAffaire = affaireMatch[1].toUpperCase();
      console.log('✅ Numéro affaire trouvé:', info.numeroAffaire);
    }

    // Extraction du type et date - deux formats possibles
    // Format 1: "Prestation du 29/01/2026 LEMAN LA FORGE"
    // Format 2: "Prestation Redouane Bougheraba Le Spot 27/01/2026"
    const prestationMatch1 = text.match(/(Prestation|Location)\s+du\s+(\d{2})\/(\d{2})\/(\d{4})\s+([A-Z][A-Z\s]+?)\s+(?:Monsieur|Madame)/i);
    const prestationMatch2 = text.match(/(Prestation|Location)\s+([^\d]+?)\s+(\d{2})\/(\d{2})\/(\d{4})/i);
    
    if (prestationMatch1) {
      const [, type, jour, mois, annee, nom] = prestationMatch1;
      info.type = type;
      info.dateLocation = `${annee}-${mois}-${jour}`;
      info.nomAffaire = nom.trim();
      console.log('✅ Type trouvé:', info.type);
      console.log('✅ Date trouvée:', info.dateLocation);
      console.log('✅ Nom affaire trouvé:', info.nomAffaire);
    } else if (prestationMatch2) {
      const [, type, nom, jour, mois, annee] = prestationMatch2;
      info.type = type;
      info.dateLocation = `${annee}-${mois}-${jour}`;
      info.nomAffaire = nom.trim();
      console.log('✅ Type trouvé:', info.type);
      console.log('✅ Date trouvée:', info.dateLocation);
      console.log('✅ Nom affaire trouvé:', info.nomAffaire);
    }

    // Extraction de l'interlocuteur (Monsieur Guillaume RIBOUAT)
    // Capture jusqu'au prochain mot entièrement en MAJUSCULES (le client)
    const interlocuteurMatch = text.match(/(Monsieur|Madame)\s+([A-Z][a-z]+(?:\s+[A-Z][A-Z]+)?)\s+/i);
    if (interlocuteurMatch) {
      info.interlocuteur = `${interlocuteurMatch[1]} ${interlocuteurMatch[2].trim()}`;
      console.log('✅ Interlocuteur trouvé:', info.interlocuteur);
    }

    // Extraction du client - mots en MAJUSCULES entre l'interlocuteur et l'adresse
    // Trois patterns possibles
    // Pattern 1: Recherche simple après "Client"
    const clientMatch0 = text.match(/Client\s*:?\s*([A-Z][A-Z\s'.-]+?)(?=\s+(?:Monsieur|Madame|Tél|Fax|\d+\s+(?:Rue|Place|Avenue|Boulevard)|$))/i);
    const clientMatch1 = text.match(/(?:Monsieur|Madame)\s+[A-Z][a-z]+\s+[A-Z]+\s+([A-Z']+(?:\s+[A-Z']+)*?)\s+(?=\d+\s+(?:Place|Rue|Avenue|Boulevard))/i);
    const clientMatch2 = text.match(/(?:Monsieur|Madame)\s+[A-Z][a-z]+\s+[A-Z]+\s+([A-Z']+(?:\s+[A-Z']+)*?)\s+(?=Place|Rue|Avenue|Boulevard)/i);
    
    if (clientMatch0) {
      info.client = clientMatch0[1].trim();
      console.log('✅ Client trouvé (après "Client"):', info.client);
    } else if (clientMatch1) {
      info.client = clientMatch1[1].trim();
      console.log('✅ Client trouvé:', info.client);
    } else if (clientMatch2) {
      info.client = clientMatch2[1].trim();
      console.log('✅ Client trouvé:', info.client);
    }

    // Extraction du téléphone
    const telMatch = text.match(/Tél\s*:\s*([0-9\s.]+)/i);
    if (telMatch) {
      info.tel = telMatch[1].trim();
      console.log('✅ Tél trouvé:', info.tel);
    }

    // Extraction du fax
    const faxMatch = text.match(/Fax\s*:\s*([0-9\s.]+)/i);
    if (faxMatch) {
      info.fax = faxMatch[1].trim();
      console.log('✅ Fax trouvé:', info.fax);
    }

    // Extraction du devis (1001 du 20/01/2026)
    const devisMatch = text.match(/(\d+)\s+Devis\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (devisMatch) {
      info.devis = `${devisMatch[1]} du ${devisMatch[2]}`;
      console.log('✅ Devis trouvé:', info.devis);
    }

    // Extraction de l'adresse de livraison - plusieurs formats possibles
    // Format 1: "3 Rue de la TÉLÉMATIQUE  42000 SAINT-ETIENNE"
    // Format 2: "Place Jean Jaures  42501 LE CHAMBON FEUGEROLLES"
    const adresseMatch1 = text.match(/(\d+\s+(?:Rue|Avenue|Boulevard|Place)[^\d]+?)\s+(\d{5}\s+[A-Z\s-]+?)(?=\s+\d{4}\s+Devis|\s+Devis|\s+Affaire|$)/i);
    const adresseMatch2 = text.match(/((?:Rue|Avenue|Boulevard|Place)[^\d]+?)\s+(\d{5}\s+[A-Z\s-]+?)(?=\s+\d{4}\s+Devis|\s+Devis|\s+Affaire|$)/i);
    
    if (adresseMatch1) {
      const rue = adresseMatch1[1].trim();
      const ville = adresseMatch1[2].trim();
      info.adresseLivraison = `${rue}\n${ville}`;
      console.log('✅ Adresse trouvée:', info.adresseLivraison);
    } else if (adresseMatch2) {
      const rue = adresseMatch2[1].trim();
      const ville = adresseMatch2[2].trim();
      info.adresseLivraison = `${rue}\n${ville}`;
      console.log('✅ Adresse trouvée:', info.adresseLivraison);
    }

    // Si le client n'est pas trouvé, utiliser le nom de l'affaire comme client
    if (!info.client && info.nomAffaire) {
      info.client = info.nomAffaire;
      console.log('ℹ️ Client non trouvé, utilisation du nom d\'affaire:', info.client);
    }

    console.log('📊 Résultat final du parsing:', info);

  } catch (error) {
    console.error('❌ Erreur lors du parsing du BL:', error);
  }

  return info;
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
