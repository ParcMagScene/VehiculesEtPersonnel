// ═══════════════════════════════════════════════════════════════
// bpAnnotationEngine.js — Moteur d'annotation des BP Mag Scène
// Détection familles, kits, couleurs, bloc infos affaire
// ═══════════════════════════════════════════════════════════════

// ─── Couleurs par famille métier ───
export const FAMILY_COLORS = {
  sonorisation:    { bg: 'rgba(59, 130, 246, 0.7)',  border: '#3b82f6', label: 'Sonorisation',    emoji: '🔊' },
  lumiere:         { bg: 'rgba(234, 179, 8, 0.7)',   border: '#eab308', label: 'Lumière',         emoji: '💡' },
  video:           { bg: 'rgba(236, 72, 153, 0.7)',  border: '#ec4899', label: 'Vidéo',           emoji: '🎥' },
  structure:       { bg: 'rgba(34, 197, 94, 0.7)',   border: '#22c55e', label: 'Structure',       emoji: '🏗️' },
  electricite:     { bg: 'rgba(239, 68, 68, 0.7)',   border: '#ef4444', label: 'Distribution Élec.', emoji: '⚡' },
  regie:           { bg: 'rgba(168, 85, 247, 0.7)',  border: '#a855f7', label: 'Régie',           emoji: '🎛️' },
  accroche:        { bg: 'rgba(20, 184, 166, 0.7)',  border: '#14b8a6', label: 'Accroche',        emoji: '🔗' },
  motorisation:    { bg: 'rgba(249, 115, 22, 0.7)',  border: '#f97316', label: 'Motorisation',    emoji: '⚙️' },
  mobilier:        { bg: 'rgba(107, 114, 128, 0.7)', border: '#6b7280', label: 'Mobilier',        emoji: '🪑' },
  divers:          { bg: 'rgba(156, 163, 175, 0.6)', border: '#9ca3af', label: 'Divers',          emoji: '📦' },
  vente:           { bg: 'rgba(251, 191, 36, 0.6)',  border: '#fbbf24', label: 'Vente',           emoji: '🛒' },
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
  sonorisation: [/\benceinte\b/i, /\bhp\b/i, /\bsub\b/i, /\bbass\b/i, /\bconsole\s*(son|audio|mix)/i, /\bmicro/i, /\bampli/i, /\bhaut.?parleur/i, /\bdi\s*box/i, /\bspl/i, /\bd[&b]b/i, /\bl[-\s]?acoustics/i, /\bsennheiser/i, /\bshure/i, /\byamaha.*cl|tf|pm/i, /\bnexo/i],
  lumiere:      [/\bprojecteur/i, /\bspot/i, /\bwash/i, /\bbeam/i, /\bled\b/i, /\blyre/i, /\bpar\s*\d/i, /\bfresnel/i, /\bdécoupe/i, /\bstrobo/i, /\bgobo/i, /\bdimmer/i, /\bgradateur/i, /\bclay\s*paky/i, /\brobe/i, /\bmartin/i, /\bayrton/i, /\bconsole\s*(lumi|éclai|dmx)/i, /\bma\s*lighting/i, /\bgrand\s*ma/i],
  video:        [/\bvid[eé]o/i, /\bécran/i, /\bprojecteur\s*vid/i, /\bbarco/i, /\bpanasonic/i, /\bcaméra/i, /\bswitch.*vid/i, /\bmatrice.*vid/i, /\bled\s*wall/i, /\brégie\s*vid/i],
  structure:    [/\bpoutre/i, /\btruss/i, /\bpont/i, /\btotems?\b/i, /\bpied/i, /\bpraticable/i, /\bpodium/i, /\bscène\b/i, /\bbase.*roulante/i, /\bembas/i, /\bsleeve/i, /\bprolyte/i],
  electricite:  [/\bcoffret/i, /\btableau\s*(elec|dist)/i, /\bcâble\s*(force|alim|elec)/i, /\brallong/i, /\bmultipr/i, /\bpower/i, /\bsocapex/i, /\bpowercon/i, /\bcontacteur/i, /\bdisjoncteur/i],
  regie:        [/\brégie/i, /\btable\s*(régie|mixage)/i, /\bflight\s*case\s*régie/i],
  accroche:     [/\bélingue/i, /\bmanille/i, /\bpalan/i, /\bchain\s*hoist/i, /\bcrochet/i, /\bpince/i, /\bcoupler/i],
  motorisation: [/\bmoteur/i, /\bpalan/i, /\btreuil/i, /\bchain.*motor/i, /\bverlinde/i],
};

/**
 * Génère une couleur unique et distincte pour une section sans famille connue
 */
function generateSectionColor(sectionName) {
  let hash = 0;
  for (let i = 0; i < sectionName.length; i++) {
    hash = sectionName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return {
    bg: `hsla(${h}, 55%, 50%, 0.7)`,
    border: `hsl(${h}, 55%, 40%)`,
    label: sectionName,
    emoji: '📋',
  };
}

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
  // Ajouter les sections connues même sans item
  const knownSections = ['SONORISATION', 'LUMIERE', 'LUMIÈRE', 'VIDEO', 'VIDÉO', 'STRUCTURE', 'ÉLECTRICITÉ', 'RÉGIE', 'ACCROCHE', 'MOTORISATION', 'MOBILIER', 'VENTE'];
  for (const secName of knownSections) {
    sectionsMap[secName] = { name: secName, family: null, color: null, items: [] };
  }
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

  // Assigner couleur basée sur le nom de la section (priorité sur les items)
  for (const sec of sections) {
    const name = sec.name.toLowerCase();
    if (name.includes('sonorisation') || name.includes('diffusion')) sec.color = FAMILY_COLORS.sonorisation;
    else if (name.includes('lumière') || name.includes('lumiere') || name.includes('eclairage') || name.includes('éclairage')) sec.color = FAMILY_COLORS.lumiere;
    else if (name.includes('vidéo') || name.includes('video') || name.includes('audiovisuel')) sec.color = FAMILY_COLORS.video;
    else if (name.includes('structure') || name.includes('praticable') || name.includes('podium') || name.includes('scène') || name.includes('scene')) sec.color = FAMILY_COLORS.structure;
    else if (name.includes('élec') || name.includes('elec') || name.includes('câbl') || name.includes('cabl') || name.includes('distribution') || name.includes('puissance')) sec.color = FAMILY_COLORS.electricite;
    else if (name.includes('régi') || name.includes('regi') || name.includes('plateau')) sec.color = FAMILY_COLORS.regie;
    else if (name.includes('accroche') || name.includes('rigging') || name.includes('élingue') || name.includes('elingue')) sec.color = FAMILY_COLORS.accroche;
    else if (name.includes('motorisation') || name.includes('moteur') || name.includes('levage')) sec.color = FAMILY_COLORS.motorisation;
    else if (name.includes('mobilier') || name.includes('meuble') || name.includes('décor') || name.includes('decor')) sec.color = FAMILY_COLORS.mobilier;
    else if (name.includes('vente') || name.includes('vte')) sec.color = FAMILY_COLORS.vente;
    else if (!sec.color) {
      // Générer une couleur unique et distincte par section inconnue
      sec.color = generateSectionColor(sec.name);
    }
  }

  // Propager la couleur de section aux items qui n'ont pas de couleur propre
  for (const sec of sections) {
    if (!sec.color) continue;
    for (const item of sec.items) {
      if (!item._color) {
        item._color = sec.color;
      }
    }
  }

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
  // NB: les données arrivent en camelCase (via toCamelCase du client API)
  const { reservations = [], personnel = [], tasks = [] } = data;
  const lines = [];

  // Réservations
  lines.push({ type: 'header', text: `🚛 Réservations (${reservations.length})` });
  if (reservations.length > 0) {
    for (const r of reservations.slice(0, 5)) {
      const startDate = (r.startDate || r.start_date || r.date) ? new Date(r.startDate || r.start_date || r.date).toLocaleDateString('fr-FR') : '?';
      const endDate = (r.endDate || r.end_date) ? ` → ${new Date(r.endDate || r.end_date).toLocaleDateString('fr-FR')}` : '';
      const vehicle = r.vehicleName || r.vehicle_name || 'Véhicule';
      const driverName = r.driverName || r.driver_name;
      const driver = driverName ? ` (${driverName})` : '';
      lines.push({ type: 'item', text: `${vehicle}${driver} — ${startDate}${endDate}` });
      const locName = r.locationName || r.location_name;
      if (locName) {
        lines.push({ type: 'item', text: `  📍 ${locName}` });
      }
    }
    if (reservations.length > 5) lines.push({ type: 'more', text: `+${reservations.length - 5} autres` });
  } else {
    lines.push({ type: 'item', text: 'Aucune réservation' });
  }

  // Tâches / Missions
  const pending = tasks.filter(t => t.status !== 'done' && t.status !== 'completed' && t.status !== 'cancelled');
  lines.push({ type: 'header', text: `📋 Tâches (${pending.length}/${tasks.length})` });
  if (tasks.length > 0) {
    for (const t of pending.slice(0, 4)) {
      const title = t.title || t.section || 'Tâche';
      const date = (t.startDate || t.start_date) ? new Date(t.startDate || t.start_date).toLocaleDateString('fr-FR') : '';
      const period = t.period === 'AM' ? 'matin' : t.period === 'PM' ? 'après-midi' : '';
      const when = date ? ` (${date}${period ? ' ' + period : ''})` : '';
      const person = [t.personFirstName || t.person_first_name, t.personLastName || t.person_last_name].filter(Boolean).join(' ');
      lines.push({ type: 'item', text: `${title}${when}${person ? ' — ' + person : ''}`.trim() });
    }
    if (pending.length > 4) lines.push({ type: 'more', text: `+${pending.length - 4} autres` });
  } else {
    lines.push({ type: 'item', text: 'Aucune tâche' });
  }

  // Personnel affecté
  lines.push({ type: 'header', text: `👤 Personnel (${personnel.length})` });
  if (personnel.length > 0) {
    for (const p of personnel.slice(0, 5)) {
      const firstName = p.firstName || p.first_name || p.prenom || '';
      const lastName = p.lastName || p.last_name || p.nom || '';
      const name = [firstName, lastName].filter(Boolean).join(' ') || 'Agent';
      const initials = (firstName[0] || '').toUpperCase() + (lastName[0] || '').toUpperCase() || '?';
      const role = p.poste || p.role || '';
      lines.push({ type: 'person', text: role ? `${name} — ${role}` : name, initials });
    }
    if (personnel.length > 5) lines.push({ type: 'more', text: `+${personnel.length - 5} autres` });
  } else {
    lines.push({ type: 'item', text: 'Aucune affectation' });
  }

  return lines;
}
