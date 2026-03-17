// ═══════════════════════════════════════════════════════════════
// bpAnnotationEngine.js — Moteur d'annotation des BP Mag Scène
// Détection familles, kits, couleurs, bloc infos affaire
// ═══════════════════════════════════════════════════════════════

// ─── Couleurs par famille métier ───
export const FAMILY_COLORS = {
  sonorisation:    { bg: 'rgba(59, 130, 246, 0.25)',  border: '#3b82f6', label: 'Sonorisation',    emoji: '🔊' },
  lumiere:         { bg: 'rgba(234, 179, 8, 0.25)',   border: '#eab308', label: 'Lumière',         emoji: '💡' },
  video:           { bg: 'rgba(236, 72, 153, 0.25)',  border: '#ec4899', label: 'Vidéo',           emoji: '🎥' },
  structure:       { bg: 'rgba(34, 197, 94, 0.25)',   border: '#22c55e', label: 'Structure',       emoji: '🏗️' },
  electricite:     { bg: 'rgba(239, 68, 68, 0.25)',   border: '#ef4444', label: 'Distribution Élec.', emoji: '⚡' },
  regie:           { bg: 'rgba(168, 85, 247, 0.25)',  border: '#a855f7', label: 'Régie',           emoji: '🎛️' },
  accroche:        { bg: 'rgba(20, 184, 166, 0.25)',  border: '#14b8a6', label: 'Accroche',        emoji: '🔗' },
  motorisation:    { bg: 'rgba(249, 115, 22, 0.25)',  border: '#f97316', label: 'Motorisation',    emoji: '⚙️' },
  mobilier:        { bg: 'rgba(107, 114, 128, 0.25)', border: '#6b7280', label: 'Mobilier',        emoji: '🪑' },
  divers:          { bg: 'rgba(156, 163, 175, 0.20)', border: '#9ca3af', label: 'Divers',          emoji: '📦' },
  vente:           { bg: 'rgba(251, 191, 36, 0.20)',  border: '#fbbf24', label: 'Vente',           emoji: '🛒' },
};

// ─── Mapping section BP → famille ───
const SECTION_TO_FAMILY = {
  'SONORISATION':    'sonorisation',
  'LUMIERE':         'lumiere',
  'LUMIÈRE':         'lumiere',
  'VIDEO':           'video',
  'VIDÉO':           'video',
  'STRUCTURE':       'structure',
  'ELECTRICITE':     'electricite',
  'ÉLECTRICITÉ':     'electricite',
  'CÂBLAGE':         'electricite',
  'CABLAGE':         'electricite',
  'DISTRIBUTION':    'electricite',
  'REGIE':           'regie',
  'RÉGIE':           'regie',
  'REGIE/PLATEAU':   'regie',
  'RÉGIE/PLATEAU':   'regie',
  'ACCROCHE':        'accroche',
  'MOTORISATION':    'motorisation',
  'MOBILIER':        'mobilier',
  'PRATICABLE':      'structure',
  'PRATICABLES':     'structure',
  'DIVERS':          'divers',
  'AUDIOVISUEL':     'video',
  'DIFFUSION':       'sonorisation',
  'VENTE':           'vente',
  'VTE':             'vente',
};

// ─── Mots-clés fallback par famille ───
const FAMILY_KEYWORDS = {
  sonorisation: [/\benceinte\b/i, /\bhp\b/i, /\bsub\b/i, /\bbass\b/i, /\bconsole\s*(son|audio|mix)/i, /\bmicro/i, /\bampli/i, /\bhaut.?parleur/i, /\bdi\s*box/i, /\bspl/i, /\bd[&b]b/i, /\bl[\-\s]?acoustics/i, /\bsennheiser/i, /\bshure/i, /\byamaha.*cl|tf|pm/i, /\bnexo/i],
  lumiere:      [/\bprojecteur/i, /\bspot/i, /\bwash/i, /\bbeam/i, /\bled\b/i, /\blyre/i, /\bpar\s*\d/i, /\bfresnel/i, /\bdécoupe/i, /\bstrobo/i, /\bgobo/i, /\bdimmer/i, /\bgradateur/i, /\bclay\s*paky/i, /\brobe/i, /\bmartin/i, /\bayrton/i, /\bconsole\s*(lumi|éclai|dmx)/i, /\bma\s*lighting/i, /\bgrand\s*ma/i],
  video:        [/\bvid[eé]o/i, /\bécran/i, /\bprojecteur\s*vid/i, /\bbarco/i, /\bpanasonic/i, /\bcaméra/i, /\bswitch.*vid/i, /\bmatrice.*vid/i, /\bled\s*wall/i, /\brégie\s*vid/i],
  structure:    [/\bpoutre/i, /\btruss/i, /\bpont/i, /\btotems?\b/i, /\bpied/i, /\bpraticable/i, /\bpodium/i, /\bscène\b/i, /\bbase.*roulante/i, /\bembas/i, /\bsleeve/i, /\bprolyte/i],
  electricite:  [/\bcoffret/i, /\btableau\s*(elec|dist)/i, /\bcâble\s*(force|alim|elec)/i, /\brallong/i, /\bmultipr/i, /\bpower/i, /\bsocapex/i, /\bpowercon/i, /\bcontacteur/i, /\bdisjoncteur/i],
  regie:        [/\brégie/i, /\btable\s*(régie|mixage)/i, /\bflight\s*case\s*régie/i],
  accroche:     [/\bélingue/i, /\bmanille/i, /\bpalan/i, /\bchain\s*hoist/i, /\bcrochet/i, /\bpince/i, /\bcoupler/i],
  motorisation: [/\bmoteur/i, /\bpalan/i, /\btreuil/i, /\bchain.*motor/i, /\bverlinde/i],
};

/**
 * Détecte la famille d'un article BP
 * @param {object} item - { reference, description, section }
 * @returns {string|null} clé famille (ex: 'sonorisation')
 */
export function detectFamily(item) {
  // 1. Par section (priorité haute)
  if (item.section) {
    const sectionKey = item.section.toUpperCase().trim();
    if (SECTION_TO_FAMILY[sectionKey]) return SECTION_TO_FAMILY[sectionKey];
    // Sous-match partiel
    for (const [pattern, family] of Object.entries(SECTION_TO_FAMILY)) {
      if (sectionKey.includes(pattern)) return family;
    }
  }

  // 2. Par mots-clés sur description + référence
  const text = `${item.reference || ''} ${item.description || ''}`;
  for (const [family, patterns] of Object.entries(FAMILY_KEYWORDS)) {
    for (const regex of patterns) {
      if (regex.test(text)) return family;
    }
  }

  return null;
}

/**
 * Détecte les kits dans une liste d'items BP
 * Un kit est un groupe d'articles consécutifs dans la même section,
 * précédé d'un titre (pas de référence, texte en gras/italique)
 * ou un ensemble d'articles indentés
 */
export function detectKits(items) {
  const kits = [];
  let currentKit = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const desc = (item.description || '').trim();
    const ref = (item.reference || '').trim();

    // Détection titre de kit : pas de référence OU ref qui commence par "KIT" / "LOT" / "ENSEMBLE"
    const isKitHeader = (
      (!ref && desc && /^(kit|lot|ensemble|pack|set)\b/i.test(desc)) ||
      (/^(KIT|LOT|ENSEMBLE|PACK)/i.test(ref))
    );

    if (isKitHeader) {
      // Sauvegarder le kit précédent s'il a > 1 item
      if (currentKit && currentKit.items.length > 1) {
        kits.push(currentKit);
      }
      currentKit = {
        title: desc || ref,
        section: item.section,
        family: detectFamily(item),
        startIndex: i,
        items: [item],
      };
      continue;
    }

    // Si on est dans un kit, ajouter si même section
    if (currentKit && item.section === currentKit.section) {
      currentKit.items.push(item);
    } else {
      // Fin du kit
      if (currentKit && currentKit.items.length > 1) {
        kits.push(currentKit);
      }
      currentKit = null;
    }
  }

  // Dernier kit en cours
  if (currentKit && currentKit.items.length > 1) {
    kits.push(currentKit);
  }

  return kits;
}

/**
 * Annote les items BP avec familles, couleurs et kits
 * @param {Array} bpItems - items BP depuis l'API
 * @returns {{ annotatedItems: Array, kits: Array, sections: Array, stats: Object }}
 */
export function annotateBPItems(bpItems) {
  // Annoter chaque item avec sa famille et couleur
  const annotatedItems = bpItems.map((item, index) => {
    const family = detectFamily(item);
    const color = family ? FAMILY_COLORS[family] : null;
    return { ...item, _family: family, _color: color, _index: index };
  });

  // Détecter les kits
  const kits = detectKits(annotatedItems);

  // Marquer les items appartenant à un kit
  const kitItemIds = new Set();
  kits.forEach(kit => {
    kit.items.forEach(item => kitItemIds.add(item._index));
    // Assigner la famille du kit si pas déjà détectée
    if (!kit.family) {
      kit.family = kit.items.find(i => i._family)?._family || null;
    }
    kit.color = kit.family ? FAMILY_COLORS[kit.family] : null;
  });

  annotatedItems.forEach(item => {
    item._inKit = kitItemIds.has(item._index);
  });

  // Regrouper par section
  const sectionsMap = {};
  for (const item of annotatedItems) {
    const sec = item.section || 'Autre';
    if (!sectionsMap[sec]) sectionsMap[sec] = { name: sec, family: null, color: null, items: [] };
    sectionsMap[sec].items.push(item);
    if (!sectionsMap[sec].family && item._family) {
      sectionsMap[sec].family = item._family;
      sectionsMap[sec].color = item._color;
    }
  }
  const sections = Object.values(sectionsMap);

  // Stats
  const stats = {
    total: annotatedItems.length,
    matched: annotatedItems.filter(i => i.match_status === 'matched' || i.match_status === 'manual').length,
    byFamily: {},
    kitsCount: kits.length,
  };
  for (const item of annotatedItems) {
    const f = item._family || 'non_classé';
    stats.byFamily[f] = (stats.byFamily[f] || 0) + 1;
  }

  return { annotatedItems, kits, sections, stats };
}

/**
 * Formate le bloc d'informations affaire pour l'annotation PDF
 */
export function formatAffaireInfoBlock(data) {
  const { affaire, reservations = [], personnel = [], tasks = [] } = data;
  const lines = [];

  // Réservations
  if (reservations.length > 0) {
    lines.push({ type: 'header', text: `🚛 Réservations (${reservations.length})` });
    for (const r of reservations.slice(0, 5)) {
      const date = r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '?';
      lines.push({ type: 'item', text: `${r.vehicle_name || 'Véhicule'} — ${date}` });
    }
    if (reservations.length > 5) lines.push({ type: 'more', text: `+${reservations.length - 5} autres` });
  }

  // Personnel
  if (personnel.length > 0) {
    lines.push({ type: 'header', text: `👤 Personnel (${personnel.length})` });
    for (const p of personnel.slice(0, 5)) {
      const name = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Agent';
      lines.push({ type: 'item', text: `${name} — ${p.role || p.poste || ''}` });
    }
    if (personnel.length > 5) lines.push({ type: 'more', text: `+${personnel.length - 5} autres` });
  }

  // Tâches
  if (tasks.length > 0) {
    const pending = tasks.filter(t => t.status !== 'done' && t.status !== 'completed');
    lines.push({ type: 'header', text: `📋 Tâches (${pending.length}/${tasks.length})` });
    for (const t of pending.slice(0, 4)) {
      const prio = t.priority === 'urgent' ? '🔴' : t.priority === 'high' ? '🟠' : '';
      lines.push({ type: 'item', text: `${prio} ${t.title}`.trim() });
    }
    if (pending.length > 4) lines.push({ type: 'more', text: `+${pending.length - 4} autres` });
  }

  return lines;
}
