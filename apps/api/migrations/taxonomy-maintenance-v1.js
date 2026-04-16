// ═══════════════════════════════════════════════════════════════
// migrations/taxonomy-maintenance-v1.js
// Migration de maintenance taxonomique — Phase 2
// - 18 nouvelles règles regex pour taxonomy_family_mapping
// - Nettoyage des artefacts PDF (SOMMAIRE, etc.)
// - Harmonisation stock_categories avec equipment_categories
// NON DESTRUCTIF : aucune donnée existante supprimée
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

export function runTaxonomyMaintenanceMigrations(db) {
  // ─── 1. Ajouter 18 nouvelles règles regex ───
  try {
    const migKey = 'taxonomy_maint_new_rules_v1';
    db.exec(`CREATE TABLE IF NOT EXISTS _migrations_log (
      key TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      const ins = db.prepare(
        'INSERT INTO taxonomy_family_mapping (source_pattern, target_family, is_regex, priority) VALUES (?, ?, ?, ?)',
      );
      const checkExists = db.prepare(
        'SELECT id FROM taxonomy_family_mapping WHERE source_pattern = ?',
      );

      const newRules = [
        // Éclairage — accessoires et pieds projecteurs (~219 articles)
        [
          'accessoires.*projecteur|pieds.*projecteur|colonnes?.*télescopique|trépieds?',
          'Éclairage',
          1,
          10,
        ],
        // Éclairage — contrôleurs, LED panels, guirlandes (~182)
        ['contrôleur|ledpanel|barres?.*led|cordon.*lumineux|guirlande', 'Éclairage', 1, 10],
        // Éclairage — filtres optiques et gélatines (~72)
        ['filtre.*optique|kit.*gélatine|compléments?.*optique', 'Éclairage', 1, 10],
        // Éclairage — effets fumée (~83)
        ['effet.*fumée|fanfogger|hurricane', 'Éclairage', 1, 5],
        // Structure — supports fixation (~92)
        ['support.*fixation|pointe.*haut', 'Structure', 1, 10],
        // Rideau-Machinerie — textiles et toiles (~131)
        ['chanvre|toile.*polyester|toile.*incrustation|cinemat', 'Rideau-Machinerie', 1, 10],
        // Rideau-Machinerie — poulies (~29)
        ['poulie|doughty', 'Rideau-Machinerie', 1, 5],
        // Sonorisation — cartes son, mixage (~61)
        ['carte.*son|surface.*contrôle|mixage', 'Sonorisation', 1, 10],
        // Sonorisation — séries wireless, mixers (~87)
        ['série.*blx|émetteur.*récepteur|slantmixer', 'Sonorisation', 1, 5],
        // Distribution Électrique — rail DIN, cosses (~58)
        ['bandeau.*rail|disjoncteur|cosse', 'Distribution Électrique', 1, 10],
        // Distribution Électrique — boîtiers scène (~26)
        ['boîtier.*scène.*enrouleur|enrouleur.*vierge', 'Distribution Électrique', 1, 5],
        // Distribution Électrique — gaines (~23)
        ['gaine', 'Distribution Électrique', 1, 5],
        // Audiovisuel — écrans ORAY (~47)
        ['oray', 'Audiovisuel', 1, 5],
        // Audiovisuel — caméras (~25)
        ['caméra', 'Audiovisuel', 1, 5],
        // Informatique — disques durs (~23)
        ['disque.*dur', 'Informatique', 1, 5],
        // Divers — comptage public (~22)
        ['comptage.*public|identification', 'Divers', 1, 5],
        // Divers — ventilation (~52)
        ['ventilat', 'Divers', 1, 5],
        // Outillage & EPI — sécurité seul (~25)
        ['^sécurité$', 'Outillage & EPI', 1, 5],
      ];

      let inserted = 0;
      for (const [pattern, family, isRegex, priority] of newRules) {
        if (!checkExists.get(pattern)) {
          ins.run(pattern, family, isRegex, priority);
          inserted++;
        }
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${inserted} nouvelles règles ajoutées`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration taxonomy_maint_new_rules:', e.message);
  }

  // ─── 2. Nettoyer les artefacts PDF → unified_family = NULL ───
  try {
    const migKey = 'taxonomy_maint_clean_artefacts_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      // Ces "familles" sont des artefacts de parsing PDF, pas de vraies catégories
      const artefactPatterns = [
        'SOMMAIRE',
        'TITRE SOUS SOMMAIRE',
        'S S E M E N T A U',
        'VUE ARRIÈRE',
      ];

      let cleaned = 0;
      const nullify = db.prepare(
        'UPDATE supplier_articles SET unified_family = NULL WHERE family = ?',
      );
      for (const pattern of artefactPatterns) {
        const r = nullify.run(pattern);
        cleaned += r.changes;
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${cleaned} articles artefacts nettoyés`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration taxonomy_maint_clean_artefacts:', e.message);
  }

  // ─── 3. Ré-appliquer le mapping sur les articles non-mappés ───
  try {
    const migKey = 'taxonomy_maint_remap_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      // Exclure les artefacts connus
      const artefacts = ['SOMMAIRE', 'TITRE SOUS SOMMAIRE', 'S S E M E N T A U', 'VUE ARRIÈRE'];
      const artefactSet = new Set(artefacts.map((a) => a.toLowerCase()));

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
          "SELECT id, family FROM supplier_articles WHERE unified_family IS NULL AND family IS NOT NULL AND family != ''",
        )
        .all();

      let mapped = 0;
      for (const row of unmapped) {
        const familyLower = row.family.toLowerCase();
        // Ignorer les artefacts
        if (artefactSet.has(familyLower)) continue;

        for (const rule of rules) {
          if (rule.is_regex) {
            try {
              const re = new RegExp(rule.source_pattern, 'i');
              if (re.test(familyLower)) {
                updateFamily.run(rule.target_family, row.id);
                mapped++;
                break;
              }
            } catch {
              /* regex invalide, skip */
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
    logger.warn('⚠️ Migration taxonomy_maint_remap:', e.message);
  }

  // ─── 4. Harmoniser stock_categories — renommer Mécanique & Outillage ───
  try {
    const migKey = 'taxonomy_maint_stock_rename_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      const r = db
        .prepare(
          "UPDATE stock_categories SET name = 'Outillage & EPI' WHERE name = 'Mécanique & Outillage' AND parent_id IS NULL",
        )
        .run();

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${r.changes} catégorie(s) renommée(s)`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration taxonomy_maint_stock_rename:', e.message);
  }

  // ─── 5. Ajouter 5 nouvelles racines stock_categories ───
  try {
    const migKey = 'taxonomy_maint_stock_add_roots_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      const newRoots = [
        ['Rideau-Machinerie', '🎭', '#a855f7'],
        ['Informatique', '💻', '#06b6d4'],
        ['Accroche', '🔗', '#14b8a6'],
        ['Motorisation', '⚙️', '#f97316'],
        ['Mobilier', '🪑', '#6b7280'],
      ];

      const checkExists = db.prepare(
        'SELECT id FROM stock_categories WHERE name = ? AND parent_id IS NULL',
      );
      const ins = db.prepare(
        'INSERT INTO stock_categories (name, icon, color, parent_id) VALUES (?, ?, ?, NULL)',
      );

      let added = 0;
      for (const [name, icon, color] of newRoots) {
        if (!checkExists.get(name)) {
          ins.run(name, icon, color);
          added++;
        }
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${added} nouvelles racines stock ajoutées`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration taxonomy_maint_stock_add_roots:', e.message);
  }

  logger.info('  ✅ Migrations maintenance taxonomie terminées');
}
