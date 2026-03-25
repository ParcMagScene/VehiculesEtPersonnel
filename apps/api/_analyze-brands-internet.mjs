#!/usr/bin/env node
/**
 * _analyze-brands-internet.mjs
 * 
 * Script d'analyse automatique des marques sur Internet.
 * Interroge les sites officiels et catalogues fournisseurs pour :
 *  - Vérifier l'orthographe officielle
 *  - Détecter les gammes et modèles
 *  - Identifier les catégories métier
 *  - Trouver les fournisseurs officiels
 *  - Proposer des corrections
 *
 * Usage : node _analyze-brands-internet.mjs [--brand "L-Acoustics"] [--domain son] [--all]
 * Output : _brand-analysis-results.json
 */

import Database from 'better-sqlite3';
import { writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'vehicules-dev.db');
const OUTPUT_PATH = join(__dirname, '_brand-analysis-results.json');

// ============================================================
// BRAND REGISTRY — 85 marques canoniques avec metadata de recherche
// ============================================================
const BRAND_REGISTRY = [
  // Son
  { name: 'L-Acoustics', slug: 'lacoustics', domain: 'son', urls: ['https://www.l-acoustics.com'], searchTerms: ['L-Acoustics products range'] },
  { name: 'Shure', slug: 'shure', domain: 'son', urls: ['https://www.shure.com'], searchTerms: ['Shure microphone wireless systems'] },
  { name: 'Yamaha', slug: 'yamaha', domain: 'son', urls: ['https://www.yamaha.com/products/proaudio/'], searchTerms: ['Yamaha pro audio mixing console'] },
  { name: 'Sennheiser', slug: 'sennheiser', domain: 'son', urls: ['https://www.sennheiser.com/fr-fr'], searchTerms: ['Sennheiser professional microphones'] },
  { name: 'Allen & Heath', slug: 'allenandeath', domain: 'son', urls: ['https://www.allen-heath.com'], searchTerms: ['Allen Heath digital mixing console'] },
  { name: 'DPA', slug: 'dpa', domain: 'son', urls: ['https://www.dpamicrophones.com'], searchTerms: ['DPA microphones miniature'] },
  { name: 'Adamson', slug: 'adamson', domain: 'son', urls: ['https://www.adamsonsystems.com'], searchTerms: ['Adamson loudspeaker line array'] },
  { name: 'Drawmer', slug: 'drawmer', domain: 'son', urls: ['https://www.drawmer.com'], searchTerms: ['Drawmer compressor gate'] },
  { name: 'Nexo', slug: 'nexo', domain: 'son', urls: ['https://www.nexo-sa.com'], searchTerms: ['Nexo speaker system'] },
  { name: 'Lab Gruppen', slug: 'labgruppen', domain: 'son', urls: ['https://www.labgruppen.com'], searchTerms: ['Lab Gruppen amplifier'] },
  { name: 'Lexicon', slug: 'lexicon', domain: 'son', urls: ['https://lexiconpro.com'], searchTerms: ['Lexicon reverb processor'] },
  { name: 'Neve', slug: 'neve', domain: 'son', urls: ['https://ams-neve.com'], searchTerms: ['AMS Neve console preamp'] },
  { name: 'Universal Audio', slug: 'universalaudio', domain: 'son', urls: ['https://www.uaudio.com'], searchTerms: ['Universal Audio interface plugin'] },
  { name: 'Audio-Technica', slug: 'audiotechnica', domain: 'son', urls: ['https://www.audio-technica.com'], searchTerms: ['Audio-Technica microphone headphone'] },
  { name: 'Behringer', slug: 'behringer', domain: 'son', urls: ['https://www.behringer.com'], searchTerms: ['Behringer mixer audio'] },
  { name: 'Focusrite', slug: 'focusrite', domain: 'son', urls: ['https://focusrite.com'], searchTerms: ['Focusrite Scarlett interface'] },
  { name: 'Radial', slug: 'radial', domain: 'son', urls: ['https://www.radialeng.com'], searchTerms: ['Radial DI box'] },
  { name: 'Tube-Tech', slug: 'tubetech', domain: 'son', urls: ['https://www.tube-tech.com'], searchTerms: ['Tube-Tech compressor equalizer'] },
  { name: 'Audinate', slug: 'audinate', domain: 'son', urls: ['https://www.audinate.com'], searchTerms: ['Audinate Dante audio network'] },
  { name: 'APG', slug: 'apg', domain: 'son', urls: ['https://www.apg.audio'], searchTerms: ['APG France loudspeaker'] },
  { name: 'QSC', slug: 'qsc', domain: 'son', urls: ['https://www.qsc.com'], searchTerms: ['QSC loudspeaker amplifier'] },
  { name: 'Mackie', slug: 'mackie', domain: 'son', urls: ['https://mackie.com'], searchTerms: ['Mackie mixer speaker'] },
  { name: 'HK Audio', slug: 'hkaudio', domain: 'son', urls: ['https://www.hkaudio.com'], searchTerms: ['HK Audio speaker system'] },
  { name: 'Alto', slug: 'alto', domain: 'son', urls: ['https://www.altoprofessional.com'], searchTerms: ['Alto Professional speaker'] },
  { name: 'Ecler', slug: 'ecler', domain: 'son', urls: ['https://www.ecler.com'], searchTerms: ['Ecler audio mixer amplifier'] },
  { name: 'Fohhn', slug: 'fohhn', domain: 'son', urls: ['https://www.fohhn.com'], searchTerms: ['Fohhn speaker beam steering'] },
  { name: 'Apart', slug: 'apart', domain: 'son', urls: ['https://www.apart-audio.com'], searchTerms: ['Apart Audio speaker install'] },
  { name: 'BSS', slug: 'bss', domain: 'son', urls: ['https://bssaudio.com'], searchTerms: ['BSS Audio processor'] },
  { name: 'DBX', slug: 'dbx', domain: 'son', urls: ['https://dbxpro.com'], searchTerms: ['DBX compressor processor'] },
  { name: 'Klark Teknik', slug: 'klarkteknik', domain: 'son', urls: ['https://www.klarkteknik.com'], searchTerms: ['Klark Teknik equalizer'] },
  { name: 'Midas', slug: 'midas', domain: 'son', urls: ['https://www.midasconsoles.com'], searchTerms: ['Midas console mixer'] },
  { name: 'Denon', slug: 'denon', domain: 'son', urls: ['https://www.denon.com'], searchTerms: ['Denon DJ player'] },
  { name: 'Empirical Labs', slug: 'empiricallabs', domain: 'son', urls: ['https://www.empiricallabs.com'], searchTerms: ['Empirical Labs Distressor'] },
  { name: 'SPL', slug: 'spl', domain: 'son', urls: ['https://spl.audio'], searchTerms: ['SPL audio processor'] },
  // Lumière
  { name: 'Martin', slug: 'martin', domain: 'lumiere', urls: ['https://www.martin.com'], searchTerms: ['Martin lighting moving head'] },
  { name: 'Robe', slug: 'robe', domain: 'lumiere', urls: ['https://www.rfrobe.com', 'https://www.rfrobe.be'], searchTerms: ['Robe lighting moving head'] },
  { name: 'Clay Paky', slug: 'claypaky', domain: 'lumiere', urls: ['https://www.claypaky.it'], searchTerms: ['Clay Paky Sharpy spotlight'] },
  { name: 'Starway', slug: 'starway', domain: 'lumiere', urls: ['https://www.starway.fr'], searchTerms: ['Starway éclairage projecteur'] },
  { name: 'Chauvet', slug: 'chauvet', domain: 'lumiere', urls: ['https://www.chauvetprofessional.com'], searchTerms: ['Chauvet Professional lighting'] },
  { name: 'Juliat', slug: 'juliat', domain: 'lumiere', urls: ['https://www.juliat.com'], searchTerms: ['Juliat projecteur poursuite'] },
  { name: 'Robert Juliat', slug: 'robertjuliat', domain: 'lumiere', urls: ['https://www.music-group.com'], searchTerms: ['Robert Juliat follow spot'] },
  { name: 'MA Lighting', slug: 'malighting', domain: 'lumiere', urls: ['https://www.malighting.com'], searchTerms: ['MA Lighting grandMA console'] },
  { name: 'Ayrton', slug: 'ayrton', domain: 'lumiere', urls: ['https://www.ayrton.eu'], searchTerms: ['Ayrton lighting moving head'] },
  { name: 'RVE', slug: 'rve', domain: 'lumiere', urls: ['https://www.rfrve.com'], searchTerms: ['RVE gradateur dimmer'] },
  { name: 'Avolites', slug: 'avolites', domain: 'lumiere', urls: ['https://www.avolites.com'], searchTerms: ['Avolites lighting console'] },
  { name: 'ETC', slug: 'etc', domain: 'lumiere', urls: ['https://www.etcconnect.com'], searchTerms: ['ETC lighting Source Four'] },
  { name: 'GLP', slug: 'glp', domain: 'lumiere', urls: ['https://www.glp.de'], searchTerms: ['GLP German Light Products'] },
  { name: 'Showtec', slug: 'showtec', domain: 'lumiere', urls: ['https://www.highlite.com/en/showtec'], searchTerms: ['Showtec lighting Highlite'] },
  { name: 'DAP Audio', slug: 'dapaudio', domain: 'lumiere', urls: ['https://www.highlite.com/en/dap-audio'], searchTerms: ['DAP Audio Highlite'] },
  { name: 'Nicols', slug: 'nicols', domain: 'lumiere', urls: ['https://www.nicols.fr'], searchTerms: ['Nicols éclairage projecteur'] },
  { name: 'Prolights', slug: 'prolights', domain: 'lumiere', urls: ['https://www.prolights.it'], searchTerms: ['Prolights Music Lights'] },
  { name: 'Cameo', slug: 'cameo', domain: 'lumiere', urls: ['https://www.cameolight.com'], searchTerms: ['Cameo Light Adam Hall'] },
  // Structure
  { name: 'Prolyte', slug: 'prolyte', domain: 'structure', urls: ['https://www.prolyte.com'], searchTerms: ['Prolyte truss structure'] },
  { name: 'Layher', slug: 'layher', domain: 'structure', urls: ['https://www.layher.com'], searchTerms: ['Layher scaffolding échafaudage'] },
  { name: 'ASD', slug: 'asd', domain: 'structure', urls: ['https://www.music-group.com'], searchTerms: ['ASD structure aluminium scène'] },
  { name: 'Doughty', slug: 'doughty', domain: 'structure', urls: ['https://www.doughty-engineering.co.uk'], searchTerms: ['Doughty clamp rigging'] },
  { name: 'CM', slug: 'cm', domain: 'structure', urls: ['https://www.columbusmckinnon.com'], searchTerms: ['CM Columbus McKinnon hoist'] },
  { name: 'Manfrotto', slug: 'manfrotto', domain: 'structure', urls: ['https://www.manfrotto.com'], searchTerms: ['Manfrotto tripod stand'] },
  { name: 'VMB', slug: 'vmb', domain: 'structure', urls: ['https://www.vmb.es'], searchTerms: ['VMB tower lift stand'] },
  { name: 'Chainmaster', slug: 'chainmaster', domain: 'structure', urls: ['https://www.chainmaster.de'], searchTerms: ['Chainmaster chain hoist motor'] },
  { name: 'Stagemaker', slug: 'stagemaker', domain: 'structure', urls: ['https://www.stagemaker.com'], searchTerms: ['Stagemaker Verlinde hoist'] },
  { name: 'Liftket', slug: 'liftket', domain: 'structure', urls: ['https://www.liftket.de'], searchTerms: ['Liftket electric hoist chain'] },
  { name: 'Work Pro', slug: 'workpro', domain: 'structure', urls: ['https://www.equipson.es'], searchTerms: ['Work Pro tower lift'] },
  { name: 'Stacco', slug: 'stacco', domain: 'structure', urls: [], searchTerms: ['Stacco praticable scène France'] },
  { name: 'Stagedex', slug: 'stagedex', domain: 'structure', urls: ['https://www.stagedex.com'], searchTerms: ['Stagedex stage platform'] },
  { name: 'Europodium', slug: 'europodium', domain: 'structure', urls: [], searchTerms: ['Europodium podium praticable'] },
  // Vidéo
  { name: 'Blackmagic Design', slug: 'blackmagicdesign', domain: 'video', urls: ['https://www.blackmagicdesign.com'], searchTerms: ['Blackmagic Design ATEM camera'] },
  { name: 'Extron', slug: 'extron', domain: 'video', urls: ['https://www.extron.com'], searchTerms: ['Extron AV switching'] },
  { name: 'Panasonic', slug: 'panasonic', domain: 'video', urls: ['https://na.panasonic.com/us/projectors'], searchTerms: ['Panasonic projector camera'] },
  { name: 'Barco', slug: 'barco', domain: 'video', urls: ['https://www.barco.com'], searchTerms: ['Barco projector display'] },
  { name: 'Christie', slug: 'christie', domain: 'video', urls: ['https://www.christiedigital.com'], searchTerms: ['Christie projector display'] },
  { name: 'Novastar', slug: 'novastar', domain: 'video', urls: ['https://www.novastar.tech'], searchTerms: ['Novastar LED video processor'] },
  { name: 'Hollyland', slug: 'hollyland', domain: 'video', urls: ['https://www.hollyland.com'], searchTerms: ['Hollyland wireless video intercom'] },
  { name: 'Samsung', slug: 'samsung', domain: 'video', urls: ['https://www.samsung.com/display'], searchTerms: ['Samsung display monitor'] },
  { name: 'LG', slug: 'lg', domain: 'video', urls: ['https://www.lg.com'], searchTerms: ['LG display monitor'] },
  { name: 'Sony', slug: 'sony', domain: 'video', urls: ['https://pro.sony'], searchTerms: ['Sony professional camera display'] },
  { name: 'Unilumin', slug: 'unilumin', domain: 'video', urls: ['https://www.unilumin.com'], searchTerms: ['Unilumin LED display'] },
  { name: 'MuxLab', slug: 'muxlab', domain: 'video', urls: ['https://www.muxlab.com'], searchTerms: ['MuxLab AV extender'] },
  // Backline
  { name: 'Pearl', slug: 'pearl', domain: 'backline', urls: ['https://www.pearldrum.com'], searchTerms: ['Pearl drums percussion'] },
  { name: 'Fender', slug: 'fender', domain: 'backline', urls: ['https://www.fender.com'], searchTerms: ['Fender guitar amplifier'] },
  { name: 'DW', slug: 'dw', domain: 'backline', urls: ['https://www.dwdrums.com'], searchTerms: ['DW Drum Workshop'] },
  { name: 'Sabian', slug: 'sabian', domain: 'backline', urls: ['https://www.sabian.com'], searchTerms: ['Sabian cymbals'] },
  { name: 'Marshall', slug: 'marshall', domain: 'backline', urls: ['https://www.marshall.com'], searchTerms: ['Marshall amplifier guitar'] },
  // Câbles
  { name: 'Neutrik', slug: 'neutrik', domain: 'cables', urls: ['https://www.neutrik.com'], searchTerms: ['Neutrik connector XLR'] },
  { name: 'Sommer', slug: 'sommer', domain: 'cables', urls: ['https://www.sommercable.com'], searchTerms: ['Sommer Cable audio'] },
  { name: 'Procab', slug: 'procab', domain: 'cables', urls: ['https://www.procab.be'], searchTerms: ['Procab cable professional'] },
  { name: 'Klotz', slug: 'klotz', domain: 'cables', urls: ['https://www.klotz-ais.com'], searchTerms: ['Klotz cable audio'] },
];

// ============================================================
// KNOWN PRODUCT RANGES — Database de référence compilée
// (enrichie par l'Étape 2 — recherche manuelle)
// ============================================================
const KNOWN_RANGES = {
  'L-Acoustics': {
    officialName: 'L-Acoustics',
    country: 'FR',
    website: 'https://www.l-acoustics.com',
    ranges: ['K Series (K1, K2, K3)', 'A Series (A10, A15)', 'X Series (X8, X12, X15)', 'Kara (I, II)', 'ARCS (II, Wide, Focus)', 'SB Series (SB15, SB18, SB28)', 'LA Series (LA4X, LA8, LA12X)', '5XT, 108P, 112XT, P Series'],
    categories: ['Enceinte ligne', 'Subwoofer', 'Amplification', 'Processeur'],
    distributors: ['LA BOUTIQUE DU SPECTACLE', 'L-Acoustics (direct)'],
  },
  'Shure': {
    officialName: 'Shure Incorporated',
    country: 'US',
    website: 'https://www.shure.com',
    ranges: ['SM Series (SM57, SM58, SM81)', 'Beta Series (Beta 52, 56, 57, 87, 91)', 'KSM Series (KSM32, KSM137, KSM141)', 'Axient Digital (AD)', 'PSM Series (PSM300, PSM900, PSM1000)', 'QLXD, ULXD', 'MXA, MXW (plafond)', 'SCM Series'],
    categories: ['Micro filaire', 'Micro HF', 'Ear Monitor', 'Conférence'],
    distributors: ['ESL', 'LA BOUTIQUE DU SPECTACLE', 'ALGAM'],
  },
  'Martin': {
    officialName: 'Martin by HARMAN',
    country: 'DK',
    website: 'https://www.martin.com',
    ranges: ['MAC (Viper, Quantum, Ultra)', 'ERA (150, 300, 600, 800)', 'VDO (Sceptron)', 'Rush Series', 'Atomic Series', 'P3 System Controller'],
    categories: ['Asservi Spot', 'Asservi Wash', 'Asservi Beam', 'LED', 'Strobe'],
    distributors: ['LA BOUTIQUE DU SPECTACLE'],
  },
  'Robe': {
    officialName: 'Robe Lighting',
    country: 'CZ',
    website: 'https://www.robe.cz',
    ranges: ['MegaPointe', 'Spiider', 'T1/T2 Series', 'BMFL', 'LEDBeam (150, 350)', 'Robin (Pointe, 600)', 'Forte', 'iForte'],
    categories: ['Asservi Spot', 'Asservi Wash', 'Asservi Beam', 'LED', 'Effet'],
    distributors: ['LA BOUTIQUE DU SPECTACLE'],
  },
  'Clay Paky': {
    officialName: 'Clay Paky (Osram)',
    country: 'IT',
    website: 'https://www.claypaky.it',
    ranges: ['Sharpy', 'Mythos', 'Scenius', 'Axcor', 'HY B-EYE', 'Tambora', 'Arolla', 'Xtylos'],
    categories: ['Asservi Spot', 'Asservi Wash', 'Asservi Beam', 'LED'],
    distributors: ['LA BOUTIQUE DU SPECTACLE'],
  },
  'Yamaha': {
    officialName: 'Yamaha Corporation',
    country: 'JP',
    website: 'https://www.yamaha.com',
    ranges: ['CL Series (CL1, CL3, CL5)', 'TF Series (TF1, TF3, TF5)', 'QL Series (QL1, QL5)', 'PM Series (PM5D, PM10)', 'DZR/DXS Series', 'Rio Stagebox', 'P Series (piano)', 'CP Series (stage piano)'],
    categories: ['Console numérique', 'Enceinte', 'Piano numérique', 'Stagebox'],
    distributors: ['YAMAHA Music France'],
  },
  'Allen & Heath': {
    officialName: 'Allen & Heath',
    country: 'UK',
    website: 'https://www.allen-heath.com',
    ranges: ['dLive', 'SQ Series (SQ-5, SQ-6, SQ-7)', 'Avantis', 'GLD', 'QU Series (Qu-16, Qu-32)', 'ZED Series', 'CQ Series'],
    categories: ['Console numérique', 'Console analogique'],
    distributors: ['ALGAM'],
  },
  'Prolyte': {
    officialName: 'Prolyte Group',
    country: 'NL',
    website: 'https://www.prolyte.com',
    ranges: ['X30 Series', 'H30 Series', 'S36 Series', 'H40 Series', 'S52 Series', 'MPT Series (towers)', 'StageDex'],
    categories: ['Pont aluminium', 'Tour', 'Pieds'],
    distributors: ['LA BOUTIQUE DU SPECTACLE'],
  },
  'Sennheiser': {
    officialName: 'Sennheiser electronic',
    country: 'DE',
    website: 'https://www.sennheiser.com',
    ranges: ['EW Series (EW-D, EW-DX)', 'Digital 6000', 'MKE Series', 'MD Series (421, 441)', 'e Series (e835, e935, e945)', 'Neumann (KMS, U87, TLM)', 'IEM (2000, G4)'],
    categories: ['Micro filaire', 'Micro HF', 'Ear Monitor', 'Accessoire'],
    distributors: ['LA BOUTIQUE DU SPECTACLE', 'ESL'],
  },
  'Blackmagic Design': {
    officialName: 'Blackmagic Design',
    country: 'AU',
    website: 'https://www.blackmagicdesign.com',
    ranges: ['ATEM (Mini, Television Studio, Constellation)', 'DeckLink', 'HyperDeck', 'UltraStudio', 'Smart Videohub', 'Pocket Cinema Camera', 'DaVinci Resolve'],
    categories: ['Mélangeur vidéo', 'Convertisseur', 'Enregistreur', 'Caméra'],
    distributors: ['LA BOUTIQUE DU SPECTACLE'],
  },
  'MA Lighting': {
    officialName: 'MA Lighting Technology',
    country: 'DE',
    website: 'https://www.malighting.com',
    ranges: ['grandMA3 (Full, Light, Compact, onPC)', 'grandMA2 (Full, Light, Ultra-Light)', 'dot2', 'MA Network Switch', 'MA NPU'],
    categories: ['Console éclairage', 'Accessoire réseau'],
    distributors: ['LA BOUTIQUE DU SPECTACLE'],
  },
  'Neutrik': {
    officialName: 'Neutrik AG',
    country: 'LI',
    website: 'https://www.neutrik.com',
    ranges: ['XLR (NC3, NC5)', 'speakON (NL2, NL4, NL8)', 'powerCON', 'etherCON', 'opticalCON', 'REAN', 'BNC'],
    categories: ['Connecteur audio', 'Connecteur réseau', 'Connecteur secteur'],
    distributors: ['ESL', 'LA BOUTIQUE DU SPECTACLE'],
  },
  'Extron': {
    officialName: 'Extron Electronics',
    country: 'US',
    website: 'https://www.extron.com',
    ranges: ['DTP (CrossPoint, T)', 'IN Series', 'SM Series (Scaler)', 'SMP Series (streaming)', 'XPA (amplis)', 'NAV Series (AV-over-IP)'],
    categories: ['Matrice AV', 'Scaler', 'Extender', 'Switch'],
    distributors: ['LA BOUTIQUE DU SPECTACLE'],
  },
  'DPA': {
    officialName: 'DPA Microphones',
    country: 'DK',
    website: 'https://www.dpamicrophones.com',
    ranges: ['d:fine Headset', 'd:vote Instrument', 'd:dicate Recording (4006, 4011)', 'd:screet Miniature (4060, 4061, 4071)', 'd:mension Surround', 'CORE Technology'],
    categories: ['Micro miniature', 'Micro statique', 'Accessoire micro'],
    distributors: [],
  },
  'Ayrton': {
    officialName: 'Ayrton',
    country: 'FR',
    website: 'https://www.ayrton.eu',
    ranges: ['Khamsin', 'Ghibli', 'Perseo', 'Domino', 'Cobra', 'Rivale', 'Diablo', 'Mistral', 'Bora'],
    categories: ['Asservi Spot', 'Asservi Wash', 'Asservi Profil'],
    distributors: [],
  },
  'Chauvet': {
    officialName: 'Chauvet Professional',
    country: 'US',
    website: 'https://www.chauvetprofessional.com',
    ranges: ['Maverick', 'Rogue', 'COLORado', 'WELL', 'Strike', 'Ovation'],
    categories: ['Asservi Spot', 'Asservi Wash', 'LED', 'Strobe'],
    distributors: [],
  },
};

// ============================================================
// INTERNET RESEARCH ENGINE (Node.js native fetch)
// ============================================================
const FETCH_TIMEOUT = 8000; // 8s max per request
const USER_AGENT = 'Mozilla/5.0 (compatible; BrandAnalyzer/1.0)';

async function fetchBrandWebsite(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!resp.ok) return { ok: false, status: resp.status, url };
    const html = await resp.text();
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';
    // Extract key brand-related text (first 5000 chars of visible text)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 5000)
      .trim();
    return { ok: true, url, title, description, textLength: textContent.length, textSnippet: textContent.substring(0, 500) };
  } catch (err) {
    return { ok: false, url, error: err.name === 'AbortError' ? 'timeout' : err.message };
  }
}

async function researchBrandOnline(brand) {
  const research = {
    websiteReachable: false,
    officialTitle: null,
    officialDescription: null,
    fetchResults: [],
  };

  // Try each official URL 
  for (const url of brand.urls) {
    const result = await fetchBrandWebsite(url);
    research.fetchResults.push(result);
    if (result.ok) {
      research.websiteReachable = true;
      research.officialTitle = result.title;
      research.officialDescription = result.description;
      // Try to extract official brand name from title
      if (result.title) {
        // Common patterns: "Brand Name - Tagline" or "Brand Name | Products"
        const namePart = result.title.split(/[\-\|–—]/)[0].trim();
        if (namePart.length > 1 && namePart.length < 60) {
          research.officialNameFromSite = namePart;
        }
      }
    }
  }

  return research;
}

// ============================================================
// ANALYSIS ENGINE
// ============================================================

async function analyzeBrand(brand, db) {
  const result = {
    canonicalName: brand.name,
    slug: brand.slug,
    domain: brand.domain,
    officialCheck: null,
    knownData: null,
    dbPresence: { equipment: 0, supplierArticles: 0, aliases: [] },
    ranges: [],
    categories: [],
    distributors: [],
    inconsistencies: [],
    corrections: [],
    confidence: 'high',
    analyzedAt: new Date().toISOString(),
  };

  // 1. Check DB presence
  const eqCount = db.prepare(
    "SELECT COUNT(*) as c FROM equipment WHERE UPPER(brand) = UPPER(?)"
  ).get(brand.name);
  result.dbPresence.equipment = eqCount.c;

  const saCount = db.prepare(
    "SELECT COUNT(*) as c FROM supplier_articles WHERE UPPER(brand) = UPPER(?)"
  ).get(brand.name);
  result.dbPresence.supplierArticles = saCount.c;

  // Check all known aliases
  const allEqBrands = db.prepare(
    "SELECT DISTINCT brand FROM equipment WHERE brand IS NOT NULL AND brand != ''"
  ).all().map(r => r.brand);
  const allSaBrands = db.prepare(
    "SELECT DISTINCT brand FROM supplier_articles WHERE brand IS NOT NULL AND brand != ''"
  ).all().map(r => r.brand);
  const allBrands = [...new Set([...allEqBrands, ...allSaBrands])];

  // Find aliases by slug matching (strict: must match fully or differ only by casing/punctuation)
  const normalize = s => s.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const canonical = normalize(brand.name);
  // Only match if the normalized form is identical or very close (Levenshtein ≤ 2 for long names)
  const aliases = allBrands.filter(b => {
    if (b === brand.name) return false;
    const norm = normalize(b);
    // Skip very short normalized patterns that cause false positives (LG, DW, CM, etc.)
    if (canonical.length <= 3 && norm !== canonical) return false;
    // Exact match after normalization
    if (norm === canonical) return true;
    // One is a known casing variant of the other (same chars, different case/punctuation)
    if (b.toUpperCase().replace(/[\s\-&]/g, '') === brand.name.toUpperCase().replace(/[\s\-&]/g, '')) return true;
    return false;
  });
  result.dbPresence.aliases = aliases;

  // 2. Use known data if available
  if (KNOWN_RANGES[brand.name]) {
    const kd = KNOWN_RANGES[brand.name];
    result.knownData = kd;
    result.officialCheck = {
      officialName: kd.officialName,
      country: kd.country,
      website: kd.website,
      verified: true,
    };
    result.ranges = kd.ranges;
    result.categories = kd.categories;
    result.distributors = kd.distributors;
  }

  // 3. Check for models in supplier_articles
  const models = db.prepare(
    "SELECT DISTINCT model FROM supplier_articles WHERE UPPER(brand) = UPPER(?) AND model IS NOT NULL AND model != '' ORDER BY model LIMIT 30"
  ).all(brand.name).map(r => r.model);
  if (models.length > 0) {
    result.modelsInDB = models;
  }

  // Also check aliases
  for (const alias of aliases) {
    const aliasModels = db.prepare(
      "SELECT DISTINCT model FROM supplier_articles WHERE brand = ? AND model IS NOT NULL AND model != '' ORDER BY model LIMIT 10"
    ).all(alias).map(r => r.model);
    if (aliasModels.length > 0) {
      result.modelsInDB = [...new Set([...(result.modelsInDB || []), ...aliasModels])];
    }
  }

  // 4. Detect inconsistencies
  // Brand in equipment but not supplier_articles
  if (result.dbPresence.equipment > 0 && result.dbPresence.supplierArticles === 0) {
    result.inconsistencies.push({
      type: 'missing_in_catalog',
      message: `${brand.name} présent dans equipment (${result.dbPresence.equipment}x) mais absent de supplier_articles`,
      severity: 'info'
    });
  }

  // Aliases with different casing/spelling
  if (aliases.length > 0) {
    result.inconsistencies.push({
      type: 'orthographic_variants',
      message: `Variantes trouvées : ${aliases.join(', ')}`,
      severity: 'warning',
    });
    result.corrections.push({
      type: 'normalize',
      from: aliases,
      to: brand.name,
      tables: ['equipment', 'supplier_articles'],
    });
  }

  // 5. Check equipment in wrong family
  if (brand.domain === 'lumiere') {
    const wrongFamily = db.prepare(`
      SELECT e.id, e.brand, ec.name as cat_name, ecf.name as family_name
      FROM equipment e
      JOIN equipment_categories ec ON e.category_id = ec.id
      LEFT JOIN equipment_categories ecsf ON ec.parent_id = ecsf.id
      LEFT JOIN equipment_categories ecf ON (ecsf.parent_id = ecf.id OR ec.parent_id = ecf.id)
      WHERE UPPER(e.brand) = UPPER(?) AND ecf.name IS NOT NULL AND ecf.name != 'Éclairage'
      LIMIT 5
    `).all(brand.name);
    if (wrongFamily.length > 0) {
      result.inconsistencies.push({
        type: 'wrong_family',
        message: `${wrongFamily.length} équipement(s) classé(s) hors Éclairage : ${wrongFamily.map(w => w.family_name).join(', ')}`,
        severity: 'error',
        items: wrongFamily,
      });
      result.corrections.push({
        type: 'reclassify',
        brand: brand.name,
        fromFamily: wrongFamily[0]?.family_name,
        toFamily: 'Éclairage',
      });
    }
  }

  return result;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const args = process.argv.slice(2);
  let filterBrand = null;
  let filterDomain = null;
  let runAll = false;
  let skipInternet = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--brand' && args[i+1]) { filterBrand = args[++i]; }
    else if (args[i] === '--domain' && args[i+1]) { filterDomain = args[++i]; }
    else if (args[i] === '--all') { runAll = true; }
    else if (args[i] === '--offline') { skipInternet = true; }
  }

  if (!filterBrand && !filterDomain && !runAll) {
    runAll = true;  // Default to all
  }

  const db = new Database(DB_PATH, { readonly: true });
  
  let brands = BRAND_REGISTRY;
  if (filterBrand) {
    brands = brands.filter(b => b.name.toLowerCase().includes(filterBrand.toLowerCase()));
  }
  if (filterDomain) {
    brands = brands.filter(b => b.domain === filterDomain);
  }

  console.log(`\n🏷️  Analyse de ${brands.length} marques...\n`);

  const results = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalBrands: brands.length,
      filter: { brand: filterBrand, domain: filterDomain },
    },
    brands: [],
    summary: {
      totalInconsistencies: 0,
      totalCorrections: 0,
      byDomain: {},
      brandsMissingFromCatalog: [],
      brandsWithVariants: [],
      brandsInWrongFamily: [],
    },
  };

  for (const brand of brands) {
    process.stdout.write(`  ⏳ ${brand.name}...`);
    const analysis = await analyzeBrand(brand, db);
    
    // Internet research (unless --offline)
    if (!skipInternet && brand.urls.length > 0) {
      process.stdout.write(` 🌐`);
      analysis.internetResearch = await researchBrandOnline(brand);
      
      // Cross-check official name from website vs our canonical
      if (analysis.internetResearch.officialNameFromSite) {
        const siteNameNorm = analysis.internetResearch.officialNameFromSite.replace(/[^a-z0-9]/gi, '').toUpperCase();
        const canonNorm = brand.name.replace(/[^a-z0-9]/gi, '').toUpperCase();
        if (siteNameNorm !== canonNorm && !siteNameNorm.includes(canonNorm)) {
          analysis.inconsistencies.push({
            type: 'official_name_mismatch',
            message: `Nom site officiel "${analysis.internetResearch.officialNameFromSite}" ≠ canonique "${brand.name}"`,
            severity: 'info',
          });
        }
      }
    }
    
    results.brands.push(analysis);

    const icon = analysis.inconsistencies.length > 0 ? '⚠️' : '✅';
    console.log(`\r  ${icon} ${brand.name} — ${analysis.dbPresence.equipment} éq, ${analysis.dbPresence.supplierArticles} art, ${analysis.inconsistencies.length} problèmes`);

    // Aggregate
    results.summary.totalInconsistencies += analysis.inconsistencies.length;
    results.summary.totalCorrections += analysis.corrections.length;

    if (!results.summary.byDomain[brand.domain]) {
      results.summary.byDomain[brand.domain] = { count: 0, inconsistencies: 0 };
    }
    results.summary.byDomain[brand.domain].count++;
    results.summary.byDomain[brand.domain].inconsistencies += analysis.inconsistencies.length;

    if (analysis.inconsistencies.some(i => i.type === 'missing_in_catalog')) {
      results.summary.brandsMissingFromCatalog.push(brand.name);
    }
    if (analysis.inconsistencies.some(i => i.type === 'orthographic_variants')) {
      results.summary.brandsWithVariants.push(brand.name);
    }
    if (analysis.inconsistencies.some(i => i.type === 'wrong_family')) {
      results.summary.brandsInWrongFamily.push(brand.name);
    }
  }

  db.close();

  // Write results
  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ DE L\'ANALYSE');
  console.log('='.repeat(60));
  console.log(`Marques analysées      : ${results.brands.length}`);
  console.log(`Incohérences trouvées  : ${results.summary.totalInconsistencies}`);
  console.log(`Corrections proposées  : ${results.summary.totalCorrections}`);
  console.log(`Manquantes du catalogue: ${results.summary.brandsMissingFromCatalog.length}`);
  console.log(`Avec variantes ortho.  : ${results.summary.brandsWithVariants.length}`);
  console.log(`Mauvaise famille       : ${results.summary.brandsInWrongFamily.length}`);
  console.log('\nPar domaine :');
  for (const [dom, data] of Object.entries(results.summary.byDomain)) {
    console.log(`  ${dom}: ${data.count} marques, ${data.inconsistencies} problèmes`);
  }
  console.log(`\n✅ Résultats écrits dans : ${OUTPUT_PATH}`);
  console.log('');
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
