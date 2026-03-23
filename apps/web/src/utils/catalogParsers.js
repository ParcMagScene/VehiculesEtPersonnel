// ═══════════════════════════════════════════════════════════
// Parsers de catalogues fournisseurs PDF → articles
// Chaque parser reçoit le texte brut extrait du PDF
// et retourne { items: [...], stats: { total, parsed, skipped } }
// ═══════════════════════════════════════════════════════════

// ─── Nettoyage commun ───
const clean = (s) => s?.trim().replace(/\s+/g, ' ') || '';
const parsePrice = (s) => {
  if (!s) return null;
  // Gère: "2 564 ,00" / "144,20" / "9,78" / "2564.00"
  const cleaned = s.replace(/\s/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : Math.round(val * 100) / 100;
};

// ═══════════════════════════════════════════════════════════
// ALGAM ENTREPRISES
// Format: CODE  BRAND MODEL  description  PRICE ,00 HT
// Ex: "003291  SAH QU-16  16 entrées micro rackable  2 564 ,00 HT"
// Brand prefixes: SAH (Allen&Heath), SMA (Mackie), RAZ, HKA, ADJ, ADA, ...
// ═══════════════════════════════════════════════════════════

// Mapping codes internes Algam → noms de marques canoniques (sync brands table)
export const ALGAM_BRAND_MAP = {
  SAH: 'Allen & Heath', SMA: 'Mackie', SMK: 'Mackie',
  SQS: 'QSC', SQC: 'QSC',
  SSP: 'Shure', SSR: 'Shure', SSX: 'Shure', SSI: 'Shure', SSE: 'Shure',
  SHK: 'Sennheiser', SHL: 'HK Audio', SHP: 'L-Acoustics',
  SRA: 'Radial', SDE: 'Denon', SDA: 'Audinate', SFC: 'SoundTube',
  SLT: 'Alto', SSL: 'SSL',
  IPA: 'Panasonic', IPB: 'Panasonic',
  IBM: 'Blackmagic Design', IDK: 'IDK', IBA: 'Barco',
  IMU: 'MuxLab', IAV: 'AVer', ING: 'Extron',
  LCL: 'Clay Paky', LSU: 'Luminex', LMA: 'Luminex', LMP: 'Luminex',
  LUN: 'Unilumin', LMR: 'Martin', LSF: 'Look Solutions',
  RFC: 'Focal', RFR: 'Focusrite', RFO: 'Focusrite',
  RSL: 'SSL', RHA: 'Heritage Audio', RAZ: 'Audeze',
  SAU: 'Ecler', SPG: 'Apart', SPT: 'SoundTube',
  IPC: 'Projecta', ISK: 'SKB',
  LAV: 'Avolites', LAL: 'Algam Lighting',
  HGF: 'Gator',
  TCH: 'Chief', TKM: 'K&M', TEU: 'EuroMet', TQA: 'Quiklok',
  EAU: 'IsoAcoustics', ECL: 'Procab', ENE: 'Neutrik', EPC: 'APG',
  SAF: 'Fohhn',
};

export function parseAlgam(text) {
  const items = [];
  const lines = text.split('\n');

  // Pattern: code(5-6 digits) [spaces] brand_prefix(3 lettres) model [spaces] designation [spaces] prix ,XX HT
  const lineRx = /^(\d{5,6})\s+(\d\s+)?([A-Z]{2,4})\s+([\w./-]+(?:\s+[\w./-]+)?)\s+(.+?)\s+([\d\s]+,\d{2})\s+HT\s*$/;
  // Also try a more relaxed pattern for price-only-end lines
  const relaxedRx = /^(\d{5,6})\s+(.+?)\s+([\d\s]+,\d{2})\s+HT\s*$/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    let match = line.match(lineRx);
    if (match) {
      const code = match[3];
      items.push({
        supplier_ref: match[1],
        brand: ALGAM_BRAND_MAP[code] || code,
        model: clean(match[4]),
        designation: clean(match[5]),
        price_ht: parsePrice(match[6]),
      });
      continue;
    }

    match = line.match(relaxedRx);
    if (match) {
      // Essayer d'extraire le brand prefix (3 lettres majuscules au début de la description)
      const desc = match[2];
      const brandMatch = desc.match(/^([A-Z]{2,4})\s+([\w./-]+(?:\s+[\w./-]+)?)\s+(.+)$/);
      if (brandMatch) {
        const code = brandMatch[1];
        items.push({
          supplier_ref: match[1],
          brand: ALGAM_BRAND_MAP[code] || code,
          model: clean(brandMatch[2]),
          designation: clean(brandMatch[3]),
          price_ht: parsePrice(match[3]),
        });
      } else {
        items.push({
          supplier_ref: match[1],
          brand: null,
          model: null,
          designation: clean(desc),
          price_ht: parsePrice(match[3]),
        });
      }
    }
  }

  return { items, stats: { total: lines.length, parsed: items.length, skipped: lines.length - items.length } };
}

// ═══════════════════════════════════════════════════════════
// ESL (Music & Lights)
// Format A (leader dots): CODE  DESIGNATION  PRICE € HT  CODE_CAT
// Format B (table numérotée): NUM  CODE  DESIGNATION  ✓ ...  PRICE €  CODE_CAT
// Ex: "ML024  LumiPar 6UQ  144,20 € HT  05"
// Ex: "1  LED700  Micro Switch  ✓ ✓  24,22 €  06"
// ═══════════════════════════════════════════════════════════
export function parseESL(text) {
  const items = [];
  const lines = text.split('\n');

  // Pattern: [optional line number] code designation prix € [HT] [category]
  const lineRx = /^(?:\d{1,4}\s+)?([A-Z0-9][\w./-]{1,25})\s+(.+?)\s+([\d\s,.]+)\s*€\s*(?:HT)?\s*(\d{2})?\s*$/;

  for (const raw of lines) {
    // Strip U+FFFD replacement chars (from PDF leader dots) and checkmarks
    let line = raw.trim().replace(/[\uFFFD✓]/g, '').replace(/\s+/g, ' ').trim();
    if (!line || line.length < 8) continue;

    const match = line.match(lineRx);
    if (match) {
      const designation = match[2].trim().replace(/\s+/g, ' ');
      if (!designation || designation.length < 2) continue;
      // Skip header lines
      if (/^(code|ref|désignation|description|page|unité|prix)/i.test(designation)) continue;
      items.push({
        supplier_ref: match[1],
        brand: null,
        model: null,
        designation,
        price_ht: parsePrice(match[3]),
        category: match[4] || null,
      });
    }
  }

  return { items, stats: { total: lines.length, parsed: items.length, skipped: lines.length - items.length } };
}

// ═══════════════════════════════════════════════════════════
// LA-BS (Levage & Accroche)
// Formats réels extraits du PDF:
//   1) Long: "DRISSE/1N  Drisse polypropylène  ø 1 mm noire  200 m  18 daN  2,5 kg  7,45€"
//   2) Court: "HSP2/N/EW  490,81€"  (après header "C ode  € HT UNIT.")
//   3) Multi-prix: "CA/BNC0.3N  30 cm  15,69€ 12,83€ (2 et +)" → on prend le 1er prix
//   4) Prix orphelin: code sur une ligne, prix seul sur une ligne suivante
//      Ex: "PFC125  125 x 125  105  C51 - F51" → ... → "3,47€"
//   5) Paires de codes: PFM/PAR16N + PFM/PAR16A → 2,70€ + 2,87€ (stack FIFO)
// Le prix est toujours collé au € : NUMBER€
// ═══════════════════════════════════════════════════════════
export function parseLABS(text) {
  const items = [];
  const lines = text.split('\n');

  let currentFamily = null;
  // Stack of pending codes (FIFO) for orphan price recovery
  let pendingCodes = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length < 5) continue;

    // Skip lines with >30% garbled characters (encoded PDF text)
    const garbled = (line.match(/[^\x20-\x7E\u00C0-\u00FF\u0152\u0153\u0178€°±²³µ¹º¼½¾×÷øŸŹŻŵŷ✓]/g) || []).length;
    if (garbled > line.length * 0.3) continue;

    // Detect section headers
    if (/^[A-ZÉÈÊÀÂÔÛÎÙ\s\-&]{5,60}$/.test(line) && !line.includes('€')) {
      currentFamily = clean(line);
      pendingCodes = [];
      continue;
    }

    // Skip header lines (also reset pending on new table)
    if (/^C\s*ode\b/i.test(line)) { pendingCodes = []; continue; }
    if (/^(page|catalogue|prix|attention|contact|www\.|la-bs)/i.test(line)) continue;

    // Find first price€ pattern — strict thousand-separator format to avoid
    // matching "650   34,24€" as a single price (only "N NNN,DD€" allowed)
    const priceMatch = line.match(/(\d+(?:\s+\d{3})*,\d{2})\s*€/);
    if (!priceMatch) {
      // No price on this line — check if it starts with a product code (for stack)
      const potentialCode = line.match(/^([\w./-]{2,30})/);
      if (potentialCode) {
        const code = potentialCode[1];
        // Only treat as product code if it contains digits, '/' or '-' (not pure descriptive words)
        if (/[\d/-]/.test(code) && !/^\d{1,4}$/.test(code) && !/^\d+[,.]\d+$/.test(code)) {
          pendingCodes.push({
            code,
            designation: clean(line.substring(code.length)) || currentFamily || code,
          });
        }
      }
      continue;
    }

    // Everything before the price is code + designation
    const beforePrice = line.substring(0, priceMatch.index).trim();

    if (!beforePrice) {
      // Orphan price line (e.g. "3,47€") — associate with next pending code (FIFO)
      if (pendingCodes.length > 0) {
        const pending = pendingCodes.shift();
        items.push({
          supplier_ref: pending.code,
          brand: null,
          model: null,
          designation: pending.designation,
          price_ht: parsePrice(priceMatch[1]),
          family: currentFamily,
        });
      }
      continue;
    }

    // Extract code from beginning
    const codeMatch = beforePrice.match(/^([\w./-]{2,30})/);
    if (!codeMatch) continue;

    const code = codeMatch[1];
    // Skip pure numbers (page numbers, dimensions, weights)
    if (/^\d{1,4}$/.test(code)) continue;
    // Skip if code looks like a spec value
    if (/^\d+[,.]\d+$/.test(code)) continue;

    const designation = clean(beforePrice.substring(code.length)) || currentFamily || code;

    items.push({
      supplier_ref: code,
      brand: null,
      model: null,
      designation,
      price_ht: parsePrice(priceMatch[1]),
      family: currentFamily,
    });
    // Successful single-line parse — clear pending stack (context switch)
    pendingCodes = [];
  }

  return { items, stats: { total: lines.length, parsed: items.length, skipped: lines.length - items.length } };
}

// ═══════════════════════════════════════════════════════════
// ASD (Structures aluminium)
// Format tabulaire technique:
//   RÉFÉRENCE  SD25025  SD25029  SD25050  ...
//   LONGUEUR   0,25 m   0,29 m   0,50 m  ...
//   POIDS (kg) 1,75     1,75     2,20    ...
// Produits transposés: colonnes = produits, lignes = propriétés
// ═══════════════════════════════════════════════════════════
export function parseASD(text) {
  const items = [];
  const lines = text.split('\n');

  let currentFamily = null;
  let refs = [];
  let lengths = [];
  let weights = [];
  let pendingFlush = false;

  const flushBlock = () => {
    if (refs.length === 0) return;
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (!ref || /^(RÉFÉRENCE|REF|référence)/.test(ref)) continue;
      const lengthVal = lengths[i] || null;
      const weightVal = weights[i] ? parseFloat(weights[i].replace(',', '.')) : null;
      items.push({
        supplier_ref: ref,
        brand: 'ASD',
        model: null,
        designation: currentFamily
          ? `${currentFamily}${lengthVal ? ' — ' + lengthVal : ''}`
          : ref,
        price_ht: null, // ASD n'affiche pas de prix dans le catalogue
        weight: weightVal ? String(weightVal) : null,
        family: currentFamily,
        metadata: lengthVal ? { length: lengthVal } : null,
      });
    }
    refs = [];
    lengths = [];
    weights = [];
    pendingFlush = false;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (pendingFlush) flushBlock();
      continue;
    }

    // Detect section/product family headers
    // Typically lines like "POUTRE TRIANGULAIRE", "POUTRE CARRÉE", etc.
    if (/^[A-ZÉÈÊÀÂÔÛÎÙ][A-ZÉÈÊÀÂÔÛÎÙ\s\-&]{4,60}$/.test(line) && !/RÉFÉRENCE|LONGUEUR|POIDS/.test(line)) {
      if (pendingFlush) flushBlock();
      currentFamily = clean(line);
      continue;
    }

    // RÉFÉRENCE line — extract refs by splitting on whitespace, keeping alpha+digit tokens
    if (/^R[ÉE]F[ÉE]RENCE/i.test(line)) {
      if (pendingFlush) flushBlock();
      refs = line.replace(/^R[ÉE]F[ÉE]RENCE\s*/i, '').split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
      // Handle refs merged by single space (e.g. "SDC25300 SDC25400")
      refs = refs.flatMap(r => {
        const parts = r.split(/\s+/).filter(p => /^[A-Z]/.test(p) && /\d/.test(p));
        return parts.length > 1 ? parts : [r];
      }).filter(Boolean);
      pendingFlush = true;
      continue;
    }

    // LONGUEUR line — strip (m) prefix
    if (/^LONGUEUR/i.test(line)) {
      lengths = line.replace(/^LONGUEUR\s*(?:\([^)]*\))?\s*/i, '').split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
      continue;
    }

    // POIDS line — strip (kg) prefix
    if (/^POIDS/i.test(line)) {
      weights = line.replace(/^POIDS\s*(?:\([^)]*\))?\s*/i, '').split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
      pendingFlush = true;
      continue;
    }
  }

  // Flush remaining
  flushBlock();

  return { items, stats: { total: lines.length, parsed: items.length, skipped: lines.length - items.length } };
}

// ═══════════════════════════════════════════════════════════
// PARSER GÉNÉRIQUE (fallback)
// Tente de détecter des lignes produit: code + texte + prix
// ═══════════════════════════════════════════════════════════
export function parseGeneric(text) {
  const items = [];
  const lines = text.split('\n');

  // Pattern: quelque chose qui ressemble à REF DESIGNATION PRIX
  // Ref: alphanumérique 2-20 chars, Designation: texte, Prix: nombre avec , ou .
  const lineRx = /^([\w./-]{2,20})\s+(.{5,120}?)\s+([\d\s,.]+)\s*€?\s*(HT)?\s*$/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length < 10) continue;

    const match = line.match(lineRx);
    if (match) {
      const designation = clean(match[2]);
      // Filtrer les en-têtes et lignes parasites
      if (/^(code|ref|désignation|description|page|total|sous-total|catalogue)/i.test(designation)) continue;
      if (/^(code|ref|page|\d{1,3}\s*$)/i.test(match[1])) continue;

      const price = parsePrice(match[3]);
      items.push({
        supplier_ref: match[1],
        brand: null,
        model: null,
        designation,
        price_ht: price,
      });
    }
  }

  return { items, stats: { total: lines.length, parsed: items.length, skipped: lines.length - items.length } };
}

// ═══════════════════════════════════════════════════════════
// DÉTECTION AUTOMATIQUE DU FOURNISSEUR
// Analyse les premières pages pour identifier le format
// ═══════════════════════════════════════════════════════════
const SUPPLIER_PATTERNS = [
  { id: 'algam',  rx: /algam\s+entreprises|soundcraft|allen.*heath|mackie/i, parser: parseAlgam, label: 'Algam Entreprises' },
  { id: 'esl',    rx: /esl|music.*lights|briteq|jb\s*systems/i,            parser: parseESL,   label: 'ESL Music & Lights' },
  { id: 'asd',    rx: /\basd\b|structure.*alumin|poutre.*triangul|CHARGES\s+MAXIMALES|RÉFÉRENCE\s+S[DXZC]/i, parser: parseASD, label: 'ASD' },
  { id: 'labs',   rx: /la[\s-]?bs|le\s+grossiste|drisse|manille/i,         parser: parseLABS,  label: 'LA-BS' },
];

/**
 * Détecte automatiquement le fournisseur et retourne le parser adapté
 * @param {string} text - Texte brut extrait du PDF (premières pages suffisent)
 * @returns {{ id: string, label: string, parser: Function } | null}
 */
export function detectSupplier(text) {
  const sample = text.substring(0, 15000); // Analyser les premières pages
  for (const sp of SUPPLIER_PATTERNS) {
    if (sp.rx.test(sample)) return sp;
  }
  return null;
}

// ─── Marques connues pour détection automatique dans la désignation ───
// Classées du plus long au plus court pour éviter les faux positifs (ex: "JB" avant "J")
const KNOWN_BRANDS = [
  // ESL / Music & Lights
  'JB SYSTEMS', 'JB-SYSTEMS', 'POWER LIGHTING', 'BRITEQ', 'BRITE-Q',
  'AUDIOPHONY', 'DEFINITIVE AUDIO', 'CONTEST', 'SHOWTEC', 'DAP AUDIO',
  'DAP', 'ELATION', 'CHAUVET', 'AMERICAN DJ', 'ADJ', 'BEAMZ',
  'CAMEO', 'STAIRVILLE', 'EUROLITE', 'INVOLIGHT', 'IBIZA',
  'GHOST', 'NICOLS', 'RONDSON', 'SYNQ', 'JB', 'BST',
  // Algam / Audio
  'ALLEN & HEATH', 'ALLEN&HEATH', 'SOUNDCRAFT', 'MACKIE', 'YAMAHA',
  'QSC', 'DYNACORD', 'ELECTRO-VOICE', 'EV', 'SENNHEISER', 'SHURE',
  'HARMAN', 'JBL', 'BOSE', 'NEXO', 'RCF', 'HK AUDIO', 'DAS',
  'PIONEER', 'DENON', 'RANE', 'MIDAS', 'BEHRINGER', 'TASCAM',
  'ALTO', 'LD SYSTEMS', 'AMATE', 'FBT', 'PROEL', 'WHARFEDALE',
  // LA-BS / Accroche-rigging
  'DOUGHTY', 'PROLYTE', 'MOBILTECHLIFTS', 'MANFROTTO', 'AVENGER',
  'KUPO', 'GLOBAL TRUSS', 'MILOS', 'WORK', 'FENIX', 'LITEC',
  'PROLYFT', 'CHAINMASTER', 'CM', 'VERLINDE',
  // ASD
  'ASD',
  // Câbles / Connectique
  'NEUTRIK', 'CORDIAL', 'SOMMER', 'KLOTZ', 'CANARE', 'HICON',
  'ADAM HALL', 'DAP', 'SWIT',
  // Vidéo
  'PANASONIC', 'SONY', 'EPSON', 'BARCO', 'CHRISTIE', 'NEC', 'OPTOMA',
  'BENQ', 'SAMSUNG', 'LG', 'BLACKMAGIC',
  // LED / Écrans
  'ABSEN', 'UNILUMIN', 'ROE', 'BROMPTON',
];

// Construit une regex à partir des marques connues (insensible à la casse)
const BRAND_RX = new RegExp(
  '\\b(' + KNOWN_BRANDS.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'i'
);

// Mapping normalisation marques détectées → noms canoniques (sync brands table)
const BRAND_CANONICAL = {};
for (const b of KNOWN_BRANDS) {
  BRAND_CANONICAL[b.toUpperCase()] = b;
}
// Ajout entrées supplémentaires pour cohérence avec la table brands
Object.assign(BRAND_CANONICAL, {
  'ALLEN&HEATH': 'Allen & Heath', 'ALLEN & HEATH': 'Allen & Heath',
  'ELECTRO-VOICE': 'Electro-Voice', 'EV': 'Electro-Voice',
  'AMERICAN DJ': 'ADJ', 'ADJ': 'ADJ',
  'JB-SYSTEMS': 'JB Systems', 'JB SYSTEMS': 'JB Systems',
  'BRITE-Q': 'Briteq', 'BRITEQ': 'Briteq',
  'BLACKMAGIC': 'Blackmagic Design',
  'HK AUDIO': 'HK Audio', 'DAP AUDIO': 'DAP Audio', 'DAP': 'DAP Audio',
  'DEFINITIVE AUDIO': 'Definitive Audio',
});

/**
 * Post-traitement : détecte la marque dans la désignation si elle n'est pas renseignée,
 * et normalise les marques existantes vers leur forme canonique.
 */
function inferBrands(items) {
  for (const item of items) {
    if (item.brand) {
      // Normaliser marque existante vers forme canonique
      const canon = BRAND_CANONICAL[item.brand.toUpperCase()];
      if (canon) item.brand = canon;
      continue;
    }
    const match = item.designation?.match(BRAND_RX);
    if (match) {
      item.brand = BRAND_CANONICAL[match[1].toUpperCase()] || match[1];
    }
  }
}

/**
 * Parse un catalogue PDF complet
 * @param {string} text - Texte brut extrait du PDF
 * @param {string} [forceParserId] - Forcer un parser: 'algam'|'esl'|'labs'|'asd'|'generic'
 * @returns {{ items: Array, stats: object, parserId: string, parserLabel: string }}
 */
export function parseCatalog(text, forceParserId) {
  let parser, parserId, parserLabel;

  if (forceParserId) {
    const found = SUPPLIER_PATTERNS.find(p => p.id === forceParserId);
    if (found) {
      parser = found.parser;
      parserId = found.id;
      parserLabel = found.label;
    } else {
      parser = parseGeneric;
      parserId = 'generic';
      parserLabel = 'Générique';
    }
  } else {
    const detected = detectSupplier(text);
    if (detected) {
      parser = detected.parser;
      parserId = detected.id;
      parserLabel = detected.label;
    } else {
      parser = parseGeneric;
      parserId = 'generic';
      parserLabel = 'Générique';
    }
  }

  const result = parser(text);

  // Post-traitement : détecter les marques dans les désignations
  inferBrands(result.items);

  return {
    ...result,
    parserId,
    parserLabel,
  };
}

// ─── Liste des parsers disponibles pour le front ───
export const AVAILABLE_PARSERS = [
  { id: 'auto', label: 'Détection automatique' },
  ...SUPPLIER_PATTERNS.map(p => ({ id: p.id, label: p.label })),
  { id: 'generic', label: 'Générique (fallback)' },
];
