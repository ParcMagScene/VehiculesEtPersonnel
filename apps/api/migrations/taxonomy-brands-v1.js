// ═══════════════════════════════════════════════════════════════
// migrations/taxonomy-brands-v1.js
// Migration Phase 3 : Uniformisation Marques & Sociétés
// - Création tables brands, brand_aliases, brand_family_mapping
// - Peuplement du registre 85 marques canoniques
// - Ajout colonnes brand_id + model sur equipment, supplier_articles, equipment_catalog
// - Fusion fournisseurs doublons (6 fusions)
// - Renommage catégories brandées (5 renames)
// - Correction orthographe marques (6 corrections)
// - Nouvelles sous-familles + catégories (4 SF + 10 CAT)
// - Nouvelles règles de mapping (9 règles)
// - Normalisation casse marques
// - Liaison brand_id par matching
// NON DESTRUCTIF : aucune donnée existante supprimée
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

export function runBrandsMigrations(db) {
  // ─── 1. Créer les 3 nouvelles tables ───
  try {
    const migKey = 'brands_create_tables_v1';
    db.exec(`CREATE TABLE IF NOT EXISTS _migrations_log (
      key TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      db.exec(`CREATE TABLE IF NOT EXISTS brands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        website TEXT,
        country TEXT,
        primary_domain TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      db.exec('CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_brands_domain ON brands(primary_domain)');

      db.exec(`CREATE TABLE IF NOT EXISTS brand_aliases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand_id INTEGER NOT NULL,
        alias TEXT NOT NULL,
        alias_slug TEXT NOT NULL,
        source TEXT DEFAULT 'migration',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
        UNIQUE(alias_slug)
      )`);
      db.exec('CREATE INDEX IF NOT EXISTS idx_brand_aliases_brand ON brand_aliases(brand_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_brand_aliases_slug ON brand_aliases(alias_slug)');

      db.exec(`CREATE TABLE IF NOT EXISTS brand_family_mapping (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand_id INTEGER NOT NULL,
        family_id INTEGER NOT NULL,
        is_primary INTEGER DEFAULT 0,
        FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
        FOREIGN KEY (family_id) REFERENCES equipment_categories(id) ON DELETE CASCADE,
        UNIQUE(brand_id, family_id)
      )`);
      db.exec('CREATE INDEX IF NOT EXISTS idx_bfm_brand ON brand_family_mapping(brand_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_bfm_family ON brand_family_mapping(family_id)');

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(
        '  ✅ Migration brands_create_tables_v1: 3 tables créées (brands, brand_aliases, brand_family_mapping)',
      );
    }
  } catch (e) {
    logger.warn('⚠️ Migration brands_create_tables:', e.message);
  }

  // ─── 2. Peupler brands avec les 85 marques canoniques ───
  try {
    const migKey = 'brands_seed_registry_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      const BRANDS = [
        // Son (34)
        ['L-Acoustics', 'lacoustics', 'https://www.l-acoustics.com', 'FR', 'son'],
        ['Shure', 'shure', 'https://www.shure.com', 'US', 'son'],
        ['Yamaha', 'yamaha', 'https://www.yamaha.com', 'JP', 'son'],
        ['Sennheiser', 'sennheiser', 'https://www.sennheiser.com', 'DE', 'son'],
        ['Allen & Heath', 'allenandeath', 'https://www.allen-heath.com', 'UK', 'son'],
        ['DPA', 'dpa', 'https://www.dpamicrophones.com', 'DK', 'son'],
        ['Adamson', 'adamson', 'https://www.adamsonsystems.com', 'CA', 'son'],
        ['Drawmer', 'drawmer', 'https://www.drawmer.com', 'UK', 'son'],
        ['Nexo', 'nexo', 'https://www.nexo-sa.com', 'FR', 'son'],
        ['Lab Gruppen', 'labgruppen', 'https://www.labgruppen.com', 'SE', 'son'],
        ['Lexicon', 'lexicon', 'https://lexiconpro.com', 'US', 'son'],
        ['Neve', 'neve', 'https://ams-neve.com', 'UK', 'son'],
        ['Universal Audio', 'universalaudio', 'https://www.uaudio.com', 'US', 'son'],
        ['Audio-Technica', 'audiotechnica', 'https://www.audio-technica.com', 'JP', 'son'],
        ['Behringer', 'behringer', 'https://www.behringer.com', 'DE', 'son'],
        ['Focusrite', 'focusrite', 'https://focusrite.com', 'UK', 'son'],
        ['Radial', 'radial', 'https://www.radialeng.com', 'CA', 'son'],
        ['Tube-Tech', 'tubetech', 'https://www.tube-tech.com', 'DK', 'son'],
        ['Audinate', 'audinate', 'https://www.audinate.com', 'AU', 'son'],
        ['APG', 'apg', 'https://www.apg.audio', 'FR', 'son'],
        ['QSC', 'qsc', 'https://www.qsc.com', 'US', 'son'],
        ['Mackie', 'mackie', 'https://mackie.com', 'US', 'son'],
        ['HK Audio', 'hkaudio', 'https://www.hkaudio.com', 'DE', 'son'],
        ['Alto', 'alto', 'https://www.altoprofessional.com', 'US', 'son'],
        ['Ecler', 'ecler', 'https://www.ecler.com', 'ES', 'son'],
        ['Fohhn', 'fohhn', 'https://www.fohhn.com', 'DE', 'son'],
        ['Apart', 'apart', 'https://www.apart-audio.com', 'BE', 'son'],
        ['BSS', 'bss', 'https://bssaudio.com', 'UK', 'son'],
        ['DBX', 'dbx', 'https://dbxpro.com', 'US', 'son'],
        ['Klark Teknik', 'klarkteknik', 'https://www.klarkteknik.com', 'UK', 'son'],
        ['Midas', 'midas', 'https://www.midasconsoles.com', 'UK', 'son'],
        ['Denon', 'denon', 'https://www.denon.com', 'JP', 'son'],
        ['Empirical Labs', 'empiricallabs', 'https://www.empiricallabs.com', 'US', 'son'],
        ['SPL', 'spl', 'https://spl.audio', 'DE', 'son'],
        // Lumière (18)
        ['Martin', 'martin', 'https://www.martin.com', 'DK', 'lumiere'],
        ['Robe', 'robe', 'https://www.robe.cz', 'CZ', 'lumiere'],
        ['Clay Paky', 'claypaky', 'https://www.claypaky.it', 'IT', 'lumiere'],
        ['Starway', 'starway', 'https://www.starway.fr', 'FR', 'lumiere'],
        ['Chauvet', 'chauvet', 'https://www.chauvetprofessional.com', 'US', 'lumiere'],
        ['Juliat', 'juliat', 'https://www.juliat.com', 'FR', 'lumiere'],
        ['Robert Juliat', 'robertjuliat', 'https://www.robertjuliat.com', 'FR', 'lumiere'],
        ['MA Lighting', 'malighting', 'https://www.malighting.com', 'DE', 'lumiere'],
        ['Ayrton', 'ayrton', 'https://www.ayrton.eu', 'FR', 'lumiere'],
        ['RVE', 'rve', 'https://www.rve.fr', 'FR', 'lumiere'],
        ['Avolites', 'avolites', 'https://www.avolites.com', 'UK', 'lumiere'],
        ['ETC', 'etc', 'https://www.etcconnect.com', 'US', 'lumiere'],
        ['GLP', 'glp', 'https://www.glp.de', 'DE', 'lumiere'],
        ['Showtec', 'showtec', 'https://www.highlite.com', 'NL', 'lumiere'],
        ['DAP Audio', 'dapaudio', 'https://www.highlite.com', 'NL', 'lumiere'],
        ['Nicols', 'nicols', 'https://www.nicols.fr', 'FR', 'lumiere'],
        ['Prolights', 'prolights', 'https://www.prolights.it', 'IT', 'lumiere'],
        ['Cameo', 'cameo', 'https://www.cameolight.com', 'DE', 'lumiere'],
        // Structure (14)
        ['Prolyte', 'prolyte', 'https://www.prolyte.com', 'NL', 'structure'],
        ['Layher', 'layher', 'https://www.layher.com', 'DE', 'structure'],
        ['ASD', 'asd', null, 'FR', 'structure'],
        ['Doughty', 'doughty', 'https://www.doughty-engineering.co.uk', 'UK', 'structure'],
        ['CM', 'cm', 'https://www.columbusmckinnon.com', 'US', 'structure'],
        ['Manfrotto', 'manfrotto', 'https://www.manfrotto.com', 'IT', 'structure'],
        ['VMB', 'vmb', 'https://www.vmb.es', 'ES', 'structure'],
        ['Chainmaster', 'chainmaster', 'https://www.chainmaster.de', 'DE', 'structure'],
        ['Stagemaker', 'stagemaker', 'https://www.stagemaker.com', 'FR', 'structure'],
        ['Liftket', 'liftket', 'https://www.liftket.de', 'DE', 'structure'],
        ['Work Pro', 'workpro', 'https://www.equipson.es', 'ES', 'structure'],
        ['Stacco', 'stacco', null, 'FR', 'structure'],
        ['Stagedex', 'stagedex', 'https://www.stagedex.com', 'NL', 'structure'],
        ['Europodium', 'europodium', null, 'FR', 'structure'],
        // Vidéo (12)
        [
          'Blackmagic Design',
          'blackmagicdesign',
          'https://www.blackmagicdesign.com',
          'AU',
          'video',
        ],
        ['Extron', 'extron', 'https://www.extron.com', 'US', 'video'],
        ['Panasonic', 'panasonic', 'https://www.panasonic.com', 'JP', 'video'],
        ['Barco', 'barco', 'https://www.barco.com', 'BE', 'video'],
        ['Christie', 'christie', 'https://www.christiedigital.com', 'CA', 'video'],
        ['Novastar', 'novastar', 'https://www.novastar.tech', 'CN', 'video'],
        ['Hollyland', 'hollyland', 'https://www.hollyland.com', 'CN', 'video'],
        ['Samsung', 'samsung', 'https://www.samsung.com', 'KR', 'video'],
        ['LG', 'lg', 'https://www.lg.com', 'KR', 'video'],
        ['Sony', 'sony', 'https://pro.sony', 'JP', 'video'],
        ['Unilumin', 'unilumin', 'https://www.unilumin.com', 'CN', 'video'],
        ['MuxLab', 'muxlab', 'https://www.muxlab.com', 'CA', 'video'],
        // Backline (5)
        ['Pearl', 'pearl', 'https://www.pearldrum.com', 'JP', 'backline'],
        ['Fender', 'fender', 'https://www.fender.com', 'US', 'backline'],
        ['DW', 'dw', 'https://www.dwdrums.com', 'US', 'backline'],
        ['Sabian', 'sabian', 'https://www.sabian.com', 'CA', 'backline'],
        ['Marshall', 'marshall', 'https://www.marshall.com', 'UK', 'backline'],
        // Câbles (4)
        ['Neutrik', 'neutrik', 'https://www.neutrik.com', 'LI', 'cables'],
        ['Sommer', 'sommer', 'https://www.sommercable.com', 'DE', 'cables'],
        ['Procab', 'procab', 'https://www.procab.be', 'BE', 'cables'],
        ['Klotz', 'klotz', 'https://www.klotz-ais.com', 'DE', 'cables'],
      ];

      const ins = db.prepare(
        'INSERT OR IGNORE INTO brands (name, slug, website, country, primary_domain) VALUES (?, ?, ?, ?, ?)',
      );
      let inserted = 0;
      for (const b of BRANDS) {
        const r = ins.run(...b);
        if (r.changes > 0) inserted++;
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${inserted} marques insérées`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration brands_seed_registry:', e.message);
  }

  // ─── 3. Peupler brand_aliases (variantes connues) ───
  try {
    const migKey = 'brands_seed_aliases_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      // Aliases : [canonical_name, alias, source]
      const ALIASES = [
        // Casing variants (from DB analysis)
        ['L-Acoustics', 'L-ACOUSTICS', 'db_equipment'],
        ['Shure', 'SHURE', 'db_equipment'],
        ['Yamaha', 'YAMAHA', 'db_equipment'],
        ['Sennheiser', 'SENNHEISER', 'db_equipment'],
        ['Allen & Heath', 'ALLEN & HEATH', 'db_equipment'],
        ['Adamson', 'ADAMSON', 'db_equipment'],
        ['Drawmer', 'DRAWMER', 'db_equipment'],
        ['Nexo', 'NEXO', 'db_equipment'],
        ['Lab Gruppen', 'LAB GRUPPEN', 'db_equipment'],
        ['Lexicon', 'LEXICON', 'db_equipment'],
        ['Neve', 'NEVE', 'db_equipment'],
        ['Universal Audio', 'UNIVERSAL AUDIO', 'db_equipment'],
        ['Audio-Technica', 'AUDIO-TECHNICA', 'db_equipment'],
        ['Behringer', 'BEHRINGER', 'db_equipment'],
        ['Focusrite', 'FOCUSRITE', 'db_equipment'],
        ['Radial', 'RADIAL', 'db_equipment'],
        ['Tube-Tech', 'TUBE-TECH', 'db_equipment'],
        ['Tube-Tech', 'TUBE TECH', 'db_equipment'],
        ['Klark Teknik', 'KLARK TEKNIK', 'db_equipment'],
        ['Midas', 'MIDAS', 'db_equipment'],
        ['Martin', 'MARTIN', 'db_equipment'],
        ['Robe', 'ROBE', 'db_equipment'],
        ['Clay Paky', 'CLAY PAKY', 'db_equipment'],
        ['Starway', 'STARWAY', 'db_equipment'],
        ['Chauvet', 'CHAUVET', 'db_equipment'],
        ['Juliat', 'JULIAT', 'db_equipment'],
        ['Robert Juliat', 'ROBERT JULIAT', 'db_equipment'],
        ['MA Lighting', 'MA LIGHTING', 'db_equipment'],
        ['Ayrton', 'AYRTON', 'db_equipment'],
        ['Showtec', 'SHOWTEC', 'db_equipment'],
        ['DAP Audio', 'DAP AUDIO', 'db_equipment'],
        ['Nicols', 'NICOLS', 'db_equipment'],
        ['Prolights', 'PROLIGHTS', 'db_equipment'],
        ['Cameo', 'CAMEO', 'db_equipment'],
        ['Prolyte', 'PROLYTE', 'db_equipment'],
        ['Layher', 'LAYHER', 'db_equipment'],
        ['Doughty', 'DOUGHTY', 'db_equipment'],
        ['Manfrotto', 'MANFROTTO', 'db_equipment'],
        ['Chainmaster', 'CHAINMASTER', 'db_equipment'],
        ['Stagemaker', 'STAGEMAKER', 'db_equipment'],
        ['Liftket', 'LIFTKET', 'db_equipment'],
        ['Stacco', 'STACCO', 'db_equipment'],
        ['Stagedex', 'STAGEDEX', 'db_equipment'],
        ['Europodium', 'EUROPODIUM', 'db_equipment'],
        ['Extron', 'EXTRON', 'db_equipment'],
        ['Panasonic', 'PANASONIC', 'db_equipment'],
        ['Christie', 'CHRISTIE', 'db_equipment'],
        ['Novastar', 'NOVASTAR', 'db_equipment'],
        ['Hollyland', 'HOLLYLAND', 'db_equipment'],
        ['Samsung', 'SAMSUNG', 'db_equipment'],
        ['Sony', 'SONY', 'db_equipment'],
        ['Pearl', 'PEARL', 'db_equipment'],
        ['Fender', 'FENDER', 'db_equipment'],
        ['Sabian', 'SABIAN', 'db_equipment'],
        ['Marshall', 'MARSHALL', 'db_equipment'],
        ['Neutrik', 'NEUTRIK', 'db_equipment'],
        ['Sommer', 'SOMMER', 'db_equipment'],
        ['Klotz', 'KLOTZ', 'db_equipment'],
        ['BSS', 'bss', 'db_equipment'],
        ['DBX', 'dbx', 'db_equipment'],
        ['SPL', 'spl', 'db_equipment'],
        ['Empirical Labs', 'EMPIRICAL LAB', 'db_equipment'],
        // Orthographic errors (as aliases)
        ['Neutrik', 'NEUTRICK', 'typo'],
        ['Liftket', 'LFTKET', 'typo'],
        ['Tube-Tech', 'TUBE TECH', 'typo'],
        ['Blackmagic Design', 'BLACKMAGIC', 'abbreviation'],
        ['Blackmagic Design', 'Blackmagic', 'abbreviation'],
        ['Electro-Voice', 'ELECTROVOICE', 'typo'],
      ];

      const slugify = (s) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
      const getBrand = db.prepare('SELECT id FROM brands WHERE name = ?');
      const insAlias = db.prepare(
        'INSERT OR IGNORE INTO brand_aliases (brand_id, alias, alias_slug, source) VALUES (?, ?, ?, ?)',
      );

      let inserted = 0;
      for (const [canonical, alias, source] of ALIASES) {
        const brand = getBrand.get(canonical);
        if (brand) {
          const r = insAlias.run(brand.id, alias, slugify(alias), source);
          if (r.changes > 0) inserted++;
        }
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${inserted} aliases insérées`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration brands_seed_aliases:', e.message);
  }

  // ─── 4. Peupler brand_family_mapping ───
  try {
    const migKey = 'brands_seed_family_mapping_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      // Mapping domain → family name
      const DOMAIN_MAP = {
        son: 'Sonorisation',
        lumiere: 'Éclairage',
        structure: 'Structure',
        video: 'Audiovisuel',
        backline: 'Backline',
        cables: 'Divers',
      };

      const getBrand = db.prepare('SELECT id, primary_domain FROM brands');
      const getFamily = db.prepare(
        "SELECT id FROM equipment_categories WHERE name = ? AND level = 'family'",
      );
      const insBFM = db.prepare(
        'INSERT OR IGNORE INTO brand_family_mapping (brand_id, family_id, is_primary) VALUES (?, ?, 1)',
      );

      let inserted = 0;
      const allBrands = getBrand.all();
      for (const brand of allBrands) {
        const familyName = DOMAIN_MAP[brand.primary_domain];
        if (familyName) {
          const family = getFamily.get(familyName);
          if (family) {
            const r = insBFM.run(brand.id, family.id);
            if (r.changes > 0) inserted++;
          }
        }
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${inserted} associations marque↔famille insérées`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration brands_seed_family_mapping:', e.message);
  }

  // ─── 5. Ajouter colonnes brand_id et model ───
  try {
    const migKey = 'brands_add_columns_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      let changes = 0;

      // equipment.brand_id
      const eqCols = db.pragma('table_info(equipment)').map((c) => c.name);
      if (!eqCols.includes('brand_id')) {
        db.exec('ALTER TABLE equipment ADD COLUMN brand_id INTEGER REFERENCES brands(id)');
        changes++;
      }
      // equipment.model
      if (!eqCols.includes('model')) {
        db.exec('ALTER TABLE equipment ADD COLUMN model TEXT');
        changes++;
      }

      // supplier_articles.brand_id
      const saCols = db.pragma('table_info(supplier_articles)').map((c) => c.name);
      if (!saCols.includes('brand_id')) {
        db.exec('ALTER TABLE supplier_articles ADD COLUMN brand_id INTEGER REFERENCES brands(id)');
        changes++;
      }

      // equipment_catalog.brand_id
      const ecCols = db.pragma('table_info(equipment_catalog)').map((c) => c.name);
      if (!ecCols.includes('brand_id')) {
        db.exec('ALTER TABLE equipment_catalog ADD COLUMN brand_id INTEGER REFERENCES brands(id)');
        changes++;
      }

      db.exec('CREATE INDEX IF NOT EXISTS idx_equipment_brand_id ON equipment(brand_id)');
      db.exec(
        'CREATE INDEX IF NOT EXISTS idx_supplier_articles_brand_id ON supplier_articles(brand_id)',
      );
      db.exec(
        'CREATE INDEX IF NOT EXISTS idx_equipment_catalog_brand_id ON equipment_catalog(brand_id)',
      );

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${changes} colonnes ajoutées + 3 index`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration brands_add_columns:', e.message);
  }

  // ─── 6. Fusion fournisseurs doublons (6 fusions) ───
  try {
    const migKey = 'brands_supplier_fusions_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      // [master_id, duplicate_id, name]
      const FUSIONS = [
        [54, 55, 'ARBITER'],
        [103, 104, 'BOGEN IMAGING'],
        [291, 554, 'L-Acoustics'],
        [501, 502, 'SYNPASE'],
        [527, 528, 'UNAL'],
        [530, 531, 'UPS'],
      ];

      const updateSA = db.prepare(
        'UPDATE supplier_articles SET supplier_id = ? WHERE supplier_id = ?',
      );
      const updateOrders = db.prepare('UPDATE orders SET supplier_id = ? WHERE supplier_id = ?');
      const deactivate = db.prepare('UPDATE suppliers SET is_active = 0 WHERE id = ?');

      let fused = 0;
      for (const [masterId, dupId, name] of FUSIONS) {
        // Verify both exist
        const master = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(masterId);
        const dup = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(dupId);
        if (master && dup) {
          const r1 = updateSA.run(masterId, dupId);
          const r2 = updateOrders.run(masterId, dupId);
          deactivate.run(dupId);
          fused++;
          logger.info(
            `    Fusion ${name}: supplier ${dupId} → ${masterId} (${r1.changes} articles, ${r2.changes} commandes migrés)`,
          );
        }
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${fused} fusions fournisseurs effectuées`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration brands_supplier_fusions:', e.message);
  }

  // ─── 7. Renommage catégories brandées (5 renames) ───
  try {
    const migKey = 'brands_debrandize_categories_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      // [category_id, old_name, new_name]
      const RENAMES = [
        [75, 'accessoire L-ACOUSTICS', 'Accessoires enceintes ligne'],
        [154, 'Câbles L-Acoustics', 'Câbles amplifié réseau'],
        [105, 'DPA Accessoires', 'Accessoires micro statique'],
        [145, 'DPA Micro', 'Micro miniature'],
        [178, 'Fischer Amp', 'Amplificateur casque'],
      ];

      const renameStmt = db.prepare(
        'UPDATE equipment_categories SET name = ? WHERE id = ? AND name = ?',
      );
      let renamed = 0;
      for (const [id, oldName, newName] of RENAMES) {
        const r = renameStmt.run(newName, id, oldName);
        renamed += r.changes;
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${renamed} catégories renommées`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration brands_debrandize_categories:', e.message);
  }

  // ─── 8. Correction orthographe marques dans equipment + supplier_articles ───
  try {
    const migKey = 'brands_fix_typos_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      // [wrong, correct]
      const TYPOS = [
        ['NEUTRICK', 'Neutrik'],
        ['LFTKET', 'Liftket'],
        ['BLAKOUT', 'Blackout'],
        ['CHROMLECH', 'Chromlech'],
        ['ELECTROVOICE', 'Electro-Voice'],
      ];

      const fixEq = db.prepare('UPDATE equipment SET brand = ? WHERE brand = ?');
      const fixSA = db.prepare('UPDATE supplier_articles SET brand = ? WHERE brand = ?');

      let fixed = 0;
      for (const [wrong, correct] of TYPOS) {
        fixed += fixEq.run(correct, wrong).changes;
        fixed += fixSA.run(correct, wrong).changes;
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${fixed} corrections orthographiques`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration brands_fix_typos:', e.message);
  }

  // ─── 9. Normaliser la casse des marques (UPPER → Mixed Case) ───
  try {
    const migKey = 'brands_normalize_casing_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      // Fetch all canonical brand names
      const allBrands = db
        .prepare('SELECT name FROM brands')
        .all()
        .map((r) => r.name);

      const fixEq = db.prepare('UPDATE equipment SET brand = ? WHERE brand = ? AND brand != ?');
      const fixSA = db.prepare(
        'UPDATE supplier_articles SET brand = ? WHERE brand = ? AND brand != ?',
      );

      let fixed = 0;
      for (const canonical of allBrands) {
        const upper = canonical.toUpperCase();
        // Fix UPPER → canonical in equipment
        fixed += fixEq.run(canonical, upper, canonical).changes;
        // Fix UPPER → canonical in supplier_articles
        fixed += fixSA.run(canonical, upper, canonical).changes;
      }

      // Special case: TUBE TECH (with space) → Tube-Tech
      fixed += fixEq.run('Tube-Tech', 'TUBE TECH', 'Tube-Tech').changes;
      fixed += fixSA.run('Tube-Tech', 'TUBE TECH', 'Tube-Tech').changes;
      // EMPIRICAL LAB → Empirical Labs (missing 's')
      fixed += fixEq.run('Empirical Labs', 'EMPIRICAL LAB', 'Empirical Labs').changes;
      fixed += fixSA.run('Empirical Labs', 'EMPIRICAL LAB', 'Empirical Labs').changes;

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${fixed} marques normalisées (casse)`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration brands_normalize_casing:', e.message);
  }

  // ─── 10. Nouvelles sous-familles et catégories ───
  try {
    const migKey = 'brands_new_categories_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      const getFamily = db.prepare(
        "SELECT id FROM equipment_categories WHERE name = ? AND level = 'family'",
      );
      const getSub = db.prepare(
        'SELECT id FROM equipment_categories WHERE name = ? AND parent_id = ?',
      );
      const existsCat = db.prepare(
        'SELECT id FROM equipment_categories WHERE name = ? AND parent_id = ?',
      );
      const insSub = db.prepare(
        "INSERT INTO equipment_categories (name, parent_id, level, icon, color) VALUES (?, ?, 'subfamily', ?, ?)",
      );
      const insCat = db.prepare(
        "INSERT INTO equipment_categories (name, parent_id, level, icon, color) VALUES (?, ?, 'category', ?, ?)",
      );

      let created = 0;

      // ── Éclairage / Asservi → Stroboscope, Barre LED ──
      const eclairage = getFamily.get('Éclairage');
      if (eclairage) {
        const asservi = getSub.get('Asservi', eclairage.id);
        if (asservi) {
          if (!existsCat.get('Stroboscope', asservi.id)) {
            insCat.run('Stroboscope', asservi.id, '⚡', '#eab308');
            created++;
          }
          if (!existsCat.get('Barre LED', asservi.id)) {
            insCat.run('Barre LED', asservi.id, '💡', '#22d3ee');
            created++;
          }
        }
      }

      // ── Audiovisuel → Réseau vidéo (SF) → Switcheur réseau, Encodeur/Décodeur ──
      const audiovisuel = getFamily.get('Audiovisuel');
      if (audiovisuel) {
        let reseauVideo = getSub.get('Réseau vidéo', audiovisuel.id);
        if (!reseauVideo) {
          const r = insSub.run('Réseau vidéo', audiovisuel.id, '🌐', '#6366f1');
          reseauVideo = { id: r.lastInsertRowid };
          created++;
        }
        if (!existsCat.get('Switcheur réseau', reseauVideo.id)) {
          insCat.run('Switcheur réseau', reseauVideo.id, '🔀', '#6366f1');
          created++;
        }
        if (!existsCat.get('Encodeur/Décodeur', reseauVideo.id)) {
          insCat.run('Encodeur/Décodeur', reseauVideo.id, '📡', '#6366f1');
          created++;
        }

        // ── Audiovisuel → Captation (SF) → Caméra, Objectif ──
        let captation = getSub.get('Captation', audiovisuel.id);
        if (!captation) {
          const r = insSub.run('Captation', audiovisuel.id, '🎥', '#8b5cf6');
          captation = { id: r.lastInsertRowid };
          created++;
        }
        if (!existsCat.get('Caméra', captation.id)) {
          insCat.run('Caméra', captation.id, '🎥', '#8b5cf6');
          created++;
        }
        if (!existsCat.get('Objectif', captation.id)) {
          insCat.run('Objectif', captation.id, '🔭', '#8b5cf6');
          created++;
        }
      }

      // ── Sonorisation → Réseau audio (SF) → Dante/AES67, Interface réseau ──
      const son = getFamily.get('Sonorisation');
      if (son) {
        let reseauAudio = getSub.get('Réseau audio', son.id);
        if (!reseauAudio) {
          const r = insSub.run('Réseau audio', son.id, '🌐', '#3b82f6');
          reseauAudio = { id: r.lastInsertRowid };
          created++;
        }
        if (!existsCat.get('Dante/AES67', reseauAudio.id)) {
          insCat.run('Dante/AES67', reseauAudio.id, '🔊', '#3b82f6');
          created++;
        }
        if (!existsCat.get('Interface réseau', reseauAudio.id)) {
          insCat.run('Interface réseau', reseauAudio.id, '🌐', '#3b82f6');
          created++;
        }
      }

      // ── Backline → Instruments (SF) → Piano numérique, Synthétiseur ──
      const backline = getFamily.get('Backline');
      if (backline) {
        let instruments = getSub.get('Instruments', backline.id);
        if (!instruments) {
          const r = insSub.run('Instruments', backline.id, '🎹', '#ec4899');
          instruments = { id: r.lastInsertRowid };
          created++;
        }
        if (!existsCat.get('Piano numérique', instruments.id)) {
          insCat.run('Piano numérique', instruments.id, '🎹', '#ec4899');
          created++;
        }
        if (!existsCat.get('Synthétiseur', instruments.id)) {
          insCat.run('Synthétiseur', instruments.id, '🎛️', '#ec4899');
          created++;
        }
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${created} sous-familles/catégories créées`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration brands_new_categories:', e.message);
  }

  // ─── 11. Nouvelles règles de mapping taxonomy_family_mapping ───
  try {
    const migKey = 'brands_new_mapping_rules_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      const checkExists = db.prepare(
        'SELECT id FROM taxonomy_family_mapping WHERE source_pattern = ?',
      );
      const ins = db.prepare(
        'INSERT INTO taxonomy_family_mapping (source_pattern, target_family, is_regex, priority) VALUES (?, ?, 1, ?)',
      );

      const RULES = [
        // Brand-based rules (priority 15)
        [
          'l.acoustics|shure|sennheiser|dpa|yamaha|nexo|qsc|allen.+heath|lab.gruppen',
          'Sonorisation',
          15,
        ],
        [
          'martin|robe|clay.paky|avolites|showtec|chauvet|glp|ayrton|starway|juliat|ma.lighting',
          'Éclairage',
          15,
        ],
        ['prolyte|asd|layher|doughty|stagedex|europodium|stacco', 'Structure', 15],
        [
          'blackmagic|extron|barco|panasonic|sony|samsung|lg|unilumin|novastar|christie',
          'Audiovisuel',
          15,
        ],
        ['neutrik|sommer|procab|klotz', 'Divers', 15],
        // Keyword-based rules
        ['moteur|palan|treuil|liftket|chainmaster|stagemaker', 'Motorisation', 10],
        ['backline|batterie|guitare|clavier|ampli.guit|piano.num|synthé', 'Backline', 10],
        ['mobilier|table|chaise|praticable.roulant|podium', 'Mobilier', 5],
        ['informatique|ordinateur|switch.réseau|nas|serveur', 'Informatique', 5],
      ];

      let inserted = 0;
      for (const [pattern, family, priority] of RULES) {
        if (!checkExists.get(pattern)) {
          ins.run(pattern, family, priority);
          inserted++;
        }
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${inserted} nouvelles règles de mapping ajoutées`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration brands_new_mapping_rules:', e.message);
  }

  // ─── 12. Lier brand_id par matching sur equipment + supplier_articles ───
  try {
    const migKey = 'brands_link_brand_ids_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      // Build lookup: brand name (lowercase) → brand.id, including aliases
      const brandMap = new Map();
      const allBrands = db.prepare('SELECT id, name FROM brands').all();
      for (const b of allBrands) {
        brandMap.set(b.name.toLowerCase(), b.id);
      }
      const allAliases = db.prepare('SELECT brand_id, alias FROM brand_aliases').all();
      for (const a of allAliases) {
        brandMap.set(a.alias.toLowerCase(), a.brand_id);
      }

      // Link equipment.brand_id
      const eqUpdate = db.prepare('UPDATE equipment SET brand_id = ? WHERE id = ?');
      const eqRows = db
        .prepare(
          "SELECT id, brand FROM equipment WHERE brand IS NOT NULL AND brand != '' AND brand_id IS NULL",
        )
        .all();
      let eqLinked = 0;
      for (const row of eqRows) {
        const brandId = brandMap.get(row.brand.toLowerCase());
        if (brandId) {
          eqUpdate.run(brandId, row.id);
          eqLinked++;
        }
      }

      // Link supplier_articles.brand_id
      const saUpdate = db.prepare('UPDATE supplier_articles SET brand_id = ? WHERE id = ?');
      const saRows = db
        .prepare(
          "SELECT id, brand FROM supplier_articles WHERE brand IS NOT NULL AND brand != '' AND brand_id IS NULL",
        )
        .all();
      let saLinked = 0;
      for (const row of saRows) {
        const brandId = brandMap.get(row.brand.toLowerCase());
        if (brandId) {
          saUpdate.run(brandId, row.id);
          saLinked++;
        }
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(
        `  ✅ Migration ${migKey}: ${eqLinked} equipment + ${saLinked} supplier_articles liés par brand_id`,
      );
    }
  } catch (e) {
    logger.warn('⚠️ Migration brands_link_brand_ids:', e.message);
  }

  // ─── 13. Re-mapper les articles supplier_articles non mappés ───
  try {
    const migKey = 'brands_remap_unmapped_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      const artefacts = new Set([
        'sommaire',
        'titre sous sommaire',
        's s e m e n t a u',
        'vue arrière',
      ]);

      const rules = db
        .prepare(
          'SELECT source_pattern, target_family, is_regex FROM taxonomy_family_mapping ORDER BY priority DESC',
        )
        .all();

      const updateFamily = db.prepare(
        'UPDATE supplier_articles SET unified_family = ? WHERE id = ?',
      );
      const unmapped = db
        .prepare(
          "SELECT id, family, brand FROM supplier_articles WHERE unified_family IS NULL AND (family IS NOT NULL AND family != '')",
        )
        .all();

      let mapped = 0;
      for (const row of unmapped) {
        const familyLower = (row.family || '').toLowerCase();
        const brandLower = (row.brand || '').toLowerCase();
        if (artefacts.has(familyLower)) continue;

        // Try matching against family OR brand
        const testStr = familyLower + ' ' + brandLower;

        for (const rule of rules) {
          if (rule.is_regex) {
            try {
              const re = new RegExp(rule.source_pattern, 'i');
              if (re.test(testStr)) {
                updateFamily.run(rule.target_family, row.id);
                mapped++;
                break;
              }
            } catch {
              /* skip invalid regex */
            }
          } else {
            if (familyLower === rule.source_pattern.toLowerCase()) {
              updateFamily.run(rule.target_family, row.id);
              mapped++;
              break;
            }
          }
        }
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${mapped}/${unmapped.length} articles re-mappés`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration brands_remap_unmapped:', e.message);
  }

  logger.info('  ✅ Migrations Marques & Sociétés (taxonomy-brands-v1) terminées');
}
