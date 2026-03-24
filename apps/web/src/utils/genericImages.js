/**
 * Système d'images génériques pour les équipements.
 *
 * Fournit un mapping [famille → catégorie → image] et un résolveur automatique
 * qui remonte la taxonomie (catégorie → sous-famille → famille) pour trouver
 * la meilleure image générique disponible.
 */

// ══════════════════════════════════════════
// MAPPING : clé normalisée → chemin image
// ══════════════════════════════════════════

const G = '/Photos/Generic';

export const GENERIC_IMAGES = {
  // ── 🏗️ Structure ──────────────────────────────
  structure: {
    _default: `${G}/structure/structure_carre_30.svg`,
    carre30:        `${G}/structure/structure_carre_30.svg`,
    carre40:        `${G}/structure/structure_carre_40.svg`,
    carre50:        `${G}/structure/structure_carre_50.svg`,
    triangle:       `${G}/structure/structure_triangle.svg`,
    embase:         `${G}/structure/structure_embase.svg`,
    manchon:        `${G}/structure/structure_manchon.svg`,
    elingueAcier:   `${G}/structure/structure_elingue_acier.svg`,
    elingueRonde:   `${G}/structure/structure_elingue_ronde.svg`,
    manille:        `${G}/structure/structure_manille.svg`,
    chaine:         `${G}/structure/structure_chaine.svg`,
  },

  // ── ⚙️ Levage / Ponts ─────────────────────────
  levage: {
    _default: `${G}/levage/moteur_500kg.svg`,
    moteur250kg:  `${G}/levage/moteur_250kg.svg`,
    moteur500kg:  `${G}/levage/moteur_500kg.svg`,
    moteur1t:     `${G}/levage/moteur_1t.svg`,
    palanChaine:  `${G}/levage/palan_chaine.svg`,
    poutreLevage: `${G}/levage/poutre_levage.svg`,
    cableMoteur:  `${G}/levage/cable_moteur.svg`,
  },

  // ── 🔊 Son ────────────────────────────────────
  son: {
    _default: `${G}/son/enceinte_generique.svg`,
    enceinte:     `${G}/son/enceinte_generique.svg`,
    sub:          `${G}/son/sub_generique.svg`,
    lineArray:    `${G}/son/line_array_generique.svg`,
    console:      `${G}/son/console_generique.svg`,
    microHF:      `${G}/son/micro_hf.svg`,
    microFilaire: `${G}/son/micro_filaire.svg`,
    diBox:        `${G}/son/di_box.svg`,
    xlr:          `${G}/son/cable_xlr.svg`,
    speakon:      `${G}/son/cable_speakon.svg`,
    multipaire:   `${G}/son/multipaire.svg`,
  },

  // ── 💡 Lumière ─────────────────────────────────
  lumiere: {
    _default: `${G}/lumiere/par_led.svg`,
    parLed:       `${G}/lumiere/par_led.svg`,
    projecteur:   `${G}/lumiere/projecteur_led.svg`,
    lyreSpot:     `${G}/lumiere/lyre_spot.svg`,
    lyreWash:     `${G}/lumiere/lyre_wash.svg`,
    barreLed:     `${G}/lumiere/barre_led.svg`,
    gradateur:    `${G}/lumiere/gradateur.svg`,
    dmx:          `${G}/lumiere/cable_dmx.svg`,
    powercon:     `${G}/lumiere/cable_powercon.svg`,
  },

  // ── 🎥 Vidéo ──────────────────────────────────
  video: {
    _default: `${G}/video/videoprojecteur.svg`,
    videoprojecteur:  `${G}/video/videoprojecteur.svg`,
    moduleLed:        `${G}/video/module_led.svg`,
    convertisseur:    `${G}/video/convertisseur_video.svg`,
    hdmi:             `${G}/video/cable_hdmi.svg`,
    sdi:              `${G}/video/cable_sdi.svg`,
    rj45:             `${G}/video/cable_rj45.svg`,
  },

  // ── 🎭 Scène / Praticables ────────────────────
  praticables: {
    _default: `${G}/praticables/praticable_2x1.svg`,
    prat1x1:      `${G}/praticables/praticable_1x1.svg`,
    prat2x1:      `${G}/praticables/praticable_2x1.svg`,
    prat2x2:      `${G}/praticables/praticable_2x2.svg`,
    piedReglable: `${G}/praticables/pied_reglable.svg`,
    gardeCorps:   `${G}/praticables/garde_corps.svg`,
    escalier:     `${G}/praticables/escalier_scene.svg`,
  },

  // ── 📦 Flightcases & Accessoires ──────────────
  accessoires: {
    _default: `${G}/accessoires/flightcase_generique.svg`,
    flightcase:       `${G}/accessoires/flightcase_generique.svg`,
    flightcaseDouble: `${G}/accessoires/flightcase_double.svg`,
    flightcaseConsole:`${G}/accessoires/flightcase_console.svg`,
    outillage:        `${G}/accessoires/outillage.svg`,
    securite:         `${G}/accessoires/securite.svg`,
    coffretElec:      `${G}/accessoires/coffret_electrique.svg`,
    rallonge:         `${G}/accessoires/rallonge_enrouleur.svg`,
  },
};

// ══════════════════════════════════════════
// MAPPING : nom de famille DB → clé GENERIC_IMAGES
// ══════════════════════════════════════════

const FAMILY_TO_KEY = {
  'sonorisation':             'son',
  'éclairage':                'lumiere',
  'structure':                'structure',
  'audiovisuel':              'video',
  'distribution électrique':  'accessoires',
  'backline':                 'son',
  'rideau-machinerie':        'praticables',
  'informatique':             'video',
  'accroche':                 'structure',
  'motorisation':             'levage',
  'mobilier':                 'praticables',
  'outillage & epi':          'accessoires',
  'divers':                   'accessoires',
};

// ══════════════════════════════════════════
// MATCHING PAR MOTS-CLÉS
// ══════════════════════════════════════════

const KEYWORD_MATCH = [
  // Structure
  { keywords: ['carré 30', 'carre 30', 'alu 30', 'h30'],           path: 'structure', key: 'carre30' },
  { keywords: ['carré 40', 'carre 40', 'alu 40', 'h40'],           path: 'structure', key: 'carre40' },
  { keywords: ['carré 50', 'carre 50', 'alu 50', 'h50'],           path: 'structure', key: 'carre50' },
  { keywords: ['triangle', 'truss triangle'],                       path: 'structure', key: 'triangle' },
  { keywords: ['embase', 'platine'],                                 path: 'structure', key: 'embase' },
  { keywords: ['manchon', 'raccord', 'sleeve'],                     path: 'structure', key: 'manchon' },
  { keywords: ['élingue acier', 'elingue acier', 'cable acier'],    path: 'structure', key: 'elingueAcier' },
  { keywords: ['élingue ronde', 'elingue ronde', 'sangle', 'dyneema'], path: 'structure', key: 'elingueRonde' },
  { keywords: ['manille'],                                           path: 'structure', key: 'manille' },
  { keywords: ['chaîne', 'chaine'],                                  path: 'structure', key: 'chaine' },
  // Levage
  { keywords: ['moteur 250', '250kg', '250 kg'],                    path: 'levage', key: 'moteur250kg' },
  { keywords: ['moteur 500', '500kg', '500 kg'],                    path: 'levage', key: 'moteur500kg' },
  { keywords: ['moteur 1t', '1000kg', '1 tonne'],                   path: 'levage', key: 'moteur1t' },
  { keywords: ['palan'],                                             path: 'levage', key: 'palanChaine' },
  { keywords: ['poutre', 'beam'],                                    path: 'levage', key: 'poutreLevage' },
  // Son
  { keywords: ['enceinte', 'speaker', 'hp', 'haut-parleur'],        path: 'son', key: 'enceinte' },
  { keywords: ['sub', 'caisson', 'subwoofer'],                      path: 'son', key: 'sub' },
  { keywords: ['line array', 'line-array', 'array'],                path: 'son', key: 'lineArray' },
  { keywords: ['console', 'table de mixage', 'mixer'],              path: 'son', key: 'console' },
  { keywords: ['micro hf', 'micro sans fil', 'uhf', 'microhf'],    path: 'son', key: 'microHF' },
  { keywords: ['micro filaire', 'micro fil', 'micro câble'],        path: 'son', key: 'microFilaire' },
  { keywords: ['di box', 'di ', 'boîtier direct'],                  path: 'son', key: 'diBox' },
  { keywords: ['xlr'],                                               path: 'son', key: 'xlr' },
  { keywords: ['speakon'],                                           path: 'son', key: 'speakon' },
  { keywords: ['multipaire', 'multi-paire'],                         path: 'son', key: 'multipaire' },
  // Lumière
  { keywords: ['par led', 'par ', 'parled'],                         path: 'lumiere', key: 'parLed' },
  { keywords: ['projecteur'],                                        path: 'lumiere', key: 'projecteur' },
  { keywords: ['lyre spot', 'spot mobile'],                          path: 'lumiere', key: 'lyreSpot' },
  { keywords: ['lyre wash', 'wash mobile'],                          path: 'lumiere', key: 'lyreWash' },
  { keywords: ['barre led', 'strip led', 'led bar'],                path: 'lumiere', key: 'barreLed' },
  { keywords: ['gradateur', 'dimmer'],                               path: 'lumiere', key: 'gradateur' },
  { keywords: ['dmx'],                                               path: 'lumiere', key: 'dmx' },
  { keywords: ['powercon'],                                          path: 'lumiere', key: 'powercon' },
  // Vidéo
  { keywords: ['vidéoprojecteur', 'videoprojecteur', 'vp ', 'beamer'], path: 'video', key: 'videoprojecteur' },
  { keywords: ['led wall', 'mur led', 'module led', 'dalle led'],   path: 'video', key: 'moduleLed' },
  { keywords: ['convertisseur', 'scaler'],                           path: 'video', key: 'convertisseur' },
  { keywords: ['hdmi'],                                              path: 'video', key: 'hdmi' },
  { keywords: ['sdi', 'bnc'],                                       path: 'video', key: 'sdi' },
  { keywords: ['rj45', 'ethernet', 'réseau'],                       path: 'video', key: 'rj45' },
  // Praticables
  { keywords: ['praticable 1x1', '1m x 1m', '1×1'],                 path: 'praticables', key: 'prat1x1' },
  { keywords: ['praticable 2x1', '2m x 1m', '2×1'],                 path: 'praticables', key: 'prat2x1' },
  { keywords: ['praticable 2x2', '2m x 2m', '2×2'],                 path: 'praticables', key: 'prat2x2' },
  { keywords: ['pied réglable', 'pied reglable', 'vérin'],          path: 'praticables', key: 'piedReglable' },
  { keywords: ['garde-corps', 'garde corps', 'rambarde'],           path: 'praticables', key: 'gardeCorps' },
  { keywords: ['escalier'],                                          path: 'praticables', key: 'escalier' },
  // Accessoires
  { keywords: ['flightcase', 'flight case', 'flight-case'],         path: 'accessoires', key: 'flightcase' },
  { keywords: ['coffret élec', 'coffret elec', 'armoire élec'],     path: 'accessoires', key: 'coffretElec' },
  { keywords: ['rallonge', 'enrouleur', 'prolongateur'],            path: 'accessoires', key: 'rallonge' },
  { keywords: ['outillage', 'outil'],                                path: 'accessoires', key: 'outillage' },
  { keywords: ['epi', 'casque sécu', 'harnais', 'gilet'],           path: 'accessoires', key: 'securite' },
];

// ══════════════════════════════════════════
// RÉSOLUTION AUTOMATIQUE
// ══════════════════════════════════════════

/**
 * Résout l'image générique la plus adaptée pour un équipement.
 *
 * Stratégie de résolution (du plus précis au plus général) :
 * 1. Match par mots-clés dans le nom de l'équipement
 * 2. Image _default de la famille taxonomique
 * 3. null (pas d'image générique trouvée)
 *
 * @param {Object} eq - L'équipement ({ name, reference, ... })
 * @param {Object|null} hierarchy - Résultat de getCategoryHierarchy()
 *   ex: { family: { name: 'Sonorisation' }, subfamily: ..., category: ... }
 * @returns {string|null} Chemin de l'image générique ou null
 */
export function resolveGenericImage(eq, hierarchy) {
  if (!eq) return null;

  // 1) Match par mots-clés dans le nom + référence
  const searchText = `${eq.name || ''} ${eq.reference || ''}`.toLowerCase();

  for (const rule of KEYWORD_MATCH) {
    for (const kw of rule.keywords) {
      if (searchText.includes(kw.toLowerCase())) {
        const group = GENERIC_IMAGES[rule.path];
        if (group && group[rule.key]) return group[rule.key];
      }
    }
  }

  // 2) Fallback sur la famille taxonomique → _default
  if (hierarchy) {
    const familyName = hierarchy.family?.name;
    if (familyName) {
      const key = FAMILY_TO_KEY[familyName.toLowerCase()];
      if (key && GENERIC_IMAGES[key]) {
        return GENERIC_IMAGES[key]._default;
      }
    }
  }

  return null;
}

/**
 * Retourne la liste plate de toutes les images génériques
 * (pour le sélecteur d'images).
 * @returns {Array<{ path: string, label: string, group: string, key: string }>}
 */
export function getAllGenericImages() {
  const result = [];
  const GROUP_LABELS = {
    structure: '🏗️ Structure',
    levage: '⚙️ Levage / Ponts',
    son: '🔊 Son',
    lumiere: '💡 Lumière',
    video: '🎥 Vidéo',
    praticables: '🎭 Scène / Praticables',
    accessoires: '📦 Accessoires',
  };

  for (const [group, images] of Object.entries(GENERIC_IMAGES)) {
    for (const [key, path] of Object.entries(images)) {
      if (key === '_default') continue;
      // Créer un label lisible à partir du nom de fichier
      const filename = path.split('/').pop().replace(/\.[^.]+$/, '');
      const label = filename
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      result.push({
        path,
        label,
        group: GROUP_LABELS[group] || group,
        groupKey: group,
        key,
      });
    }
  }
  return result;
}
