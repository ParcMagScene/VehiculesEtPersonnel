// ═══════════════════════════════════════════════════════════════
// migrations/taxonomy-v1.js
// Migration idempotente: Uniformisation de la taxonomie
// - Ajout familles Accroche, Motorisation, Mobilier, Outillage & EPI
// - Normalisation casse (Majuscule initiale)
// - Reclassement Levage → Accroche / Motorisation
// - Rattachement catégories orphelines → Outillage & EPI
// - Ajout colonne unified_family sur supplier_articles
// - Table taxonomy_mapping pour supplier_articles
// NON DESTRUCTIF : aucune donnée existante supprimée
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

export function runTaxonomyMigrations(db) {
  // ─── 1. Normaliser la casse des familles equipment_categories ───
  try {
    const migKey = 'taxonomy_normalize_family_case_v1';
    db.exec(`CREATE TABLE IF NOT EXISTS _migrations_log (
      key TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      const renames = [
        ['SONORISATION', 'Sonorisation'],
        ['ECLAIRAGE', 'Éclairage'],
        ['AUDIOVISUEL', 'Audiovisuel'],
        ['DISTRIBUTION ELECTRIQUE', 'Distribution Électrique'],
        ['BACKLINE', 'Backline'],
        ['RIDEAU-MACHINERIE', 'Rideau-Machinerie'],
        ['INFORMATIQUE', 'Informatique'],
        ['STRUCTURE', 'Structure'],
      ];
      const update = db.prepare(
        'UPDATE equipment_categories SET name = ? WHERE name = ? AND parent_id IS NULL',
      );
      let changes = 0;
      for (const [oldName, newName] of renames) {
        const r = update.run(newName, oldName);
        changes += r.changes;
      }
      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: ${changes} famille(s) renommée(s)`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration taxonomy_normalize_family_case:', e.message);
  }

  // ─── 2. Normaliser la casse des sous-familles ───
  try {
    const migKey = 'taxonomy_normalize_subfamily_case_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      // Corriger "praticables" → "Praticables"
      db.prepare(
        "UPDATE equipment_categories SET name = 'Praticables' WHERE name = 'praticables' AND level = 'subfamily'",
      ).run();
      // Corriger "protente / Crash / Leste" → "Protente / Crash / Leste"
      db.prepare(
        "UPDATE equipment_categories SET name = 'Protente / Crash / Leste' WHERE name = 'protente / Crash / Leste' AND level = 'subfamily'",
      ).run();
      // Corriger "Cablages audio" → "Câblages Audio"
      db.prepare(
        "UPDATE equipment_categories SET name = 'Câblages Audio' WHERE name = 'Cablages audio' AND level = 'subfamily'",
      ).run();
      // Corriger "Cablage" → "Câblage" dans Backline (sous-famille id 54's parent)
      db.prepare(
        "UPDATE equipment_categories SET name = 'Câblage' WHERE name = 'Cablage' AND level = 'subfamily'",
      ).run();
      // Corriger "Intercomm / Talky" → "Intercom / Talky"
      db.prepare(
        "UPDATE equipment_categories SET name = 'Intercom / Talky' WHERE name = 'Intercomm / Talky' AND level = 'subfamily'",
      ).run();

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: sous-familles normalisées`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration taxonomy_normalize_subfamily_case:', e.message);
  }

  // ─── 3. Ajouter nouvelles familles : Accroche, Motorisation, Mobilier, Outillage & EPI ───
  try {
    const migKey = 'taxonomy_add_new_families_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      const insertFamily = db.prepare(
        "INSERT INTO equipment_categories (name, icon, color, level) VALUES (?, ?, ?, 'family')",
      );

      const newFamilies = [
        ['Accroche', '🔗', '#14b8a6'],
        ['Motorisation', '⚙️', '#f97316'],
        ['Mobilier', '🪑', '#6b7280'],
        ['Outillage & EPI', '🔧', '#f59e0b'],
      ];

      const familyIds = {};
      for (const [name, icon, color] of newFamilies) {
        // Vérifier si cette famille existe déjà
        const exists = db
          .prepare("SELECT id FROM equipment_categories WHERE name = ? AND level = 'family'")
          .get(name);
        if (!exists) {
          const r = insertFamily.run(name, icon, color);
          familyIds[name] = r.lastInsertRowid;
          logger.info(`  ✅ Nouvelle famille: ${name} (id=${familyIds[name]})`);
        } else {
          familyIds[name] = exists.id;
        }
      }

      // ─── 3a. Ajouter sous-familles pour Accroche ───
      const insertSub = db.prepare(
        "INSERT INTO equipment_categories (name, parent_id, level, icon, color) VALUES (?, ?, 'subfamily', ?, ?)",
      );

      if (familyIds['Accroche']) {
        const accSubs = [
          ['Élingues', '🔗', '#14b8a6'],
          ["Accessoires d'accroche", '🔗', '#14b8a6'],
        ];
        for (const [name, icon, color] of accSubs) {
          const exists = db
            .prepare('SELECT id FROM equipment_categories WHERE name = ? AND parent_id = ?')
            .get(name, familyIds['Accroche']);
          if (!exists) {
            insertSub.run(name, familyIds['Accroche'], icon, color);
          }
        }
      }

      // ─── 3b. Ajouter sous-familles pour Motorisation ───
      if (familyIds['Motorisation']) {
        const motSubs = [
          ['Moteurs', '⚙️', '#f97316'],
          ['Pieds de levage', '⚙️', '#f97316'],
          ['Télécommandes', '⚙️', '#f97316'],
        ];
        for (const [name, icon, color] of motSubs) {
          const exists = db
            .prepare('SELECT id FROM equipment_categories WHERE name = ? AND parent_id = ?')
            .get(name, familyIds['Motorisation']);
          if (!exists) {
            insertSub.run(name, familyIds['Motorisation'], icon, color);
          }
        }
      }

      // ─── 3c. Ajouter sous-familles pour Mobilier ───
      if (familyIds['Mobilier']) {
        const mobSubs = [
          ['Mobilier scénique', '🪑', '#6b7280'],
          ['Podiums', '🪑', '#6b7280'],
        ];
        for (const [name, icon, color] of mobSubs) {
          const exists = db
            .prepare('SELECT id FROM equipment_categories WHERE name = ? AND parent_id = ?')
            .get(name, familyIds['Mobilier']);
          if (!exists) {
            insertSub.run(name, familyIds['Mobilier'], icon, color);
          }
        }
      }

      // ─── 3d. Sous-familles pour Outillage & EPI ───
      if (familyIds['Outillage & EPI']) {
        const oepSubs = [
          ['Outillage', '🔧', '#f59e0b'],
          ['Électroportatif', '⚡', '#3b82f6'],
          ['Levage & Manutention', '🏗️', '#ef4444'],
          ['Mesure & Contrôle', '📐', '#10b981'],
          ['EPI', '🦺', '#8b5cf6'],
          ['Véhicule annexe', '🚗', '#6366f1'],
        ];
        for (const [name, icon, color] of oepSubs) {
          const exists = db
            .prepare('SELECT id FROM equipment_categories WHERE name = ? AND parent_id = ?')
            .get(name, familyIds['Outillage & EPI']);
          if (!exists) {
            insertSub.run(name, familyIds['Outillage & EPI'], icon, color);
          }
        }
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: 4 nouvelles familles ajoutées`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration taxonomy_add_new_families:', e.message);
  }

  // ─── 4. Reclasser Levage → Accroche / Motorisation ───
  try {
    const migKey = 'taxonomy_reclassify_levage_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      // Trouver les IDs des nouvelles familles
      const accroche = db
        .prepare("SELECT id FROM equipment_categories WHERE name = 'Accroche' AND level = 'family'")
        .get();
      const motorisation = db
        .prepare(
          "SELECT id FROM equipment_categories WHERE name = 'Motorisation' AND level = 'family'",
        )
        .get();

      if (accroche && motorisation) {
        // Trouver les sous-familles cibles
        const sfElingues = db
          .prepare("SELECT id FROM equipment_categories WHERE name = 'Élingues' AND parent_id = ?")
          .get(accroche.id);
        const sfAccessAccroche = db
          .prepare(
            "SELECT id FROM equipment_categories WHERE name = 'Accessoires d''accroche' AND parent_id = ?",
          )
          .get(accroche.id);
        const sfMoteurs = db
          .prepare("SELECT id FROM equipment_categories WHERE name = 'Moteurs' AND parent_id = ?")
          .get(motorisation.id);
        const sfPieds = db
          .prepare(
            "SELECT id FROM equipment_categories WHERE name = 'Pieds de levage' AND parent_id = ?",
          )
          .get(motorisation.id);
        const sfTeleco = db
          .prepare(
            "SELECT id FROM equipment_categories WHERE name = 'Télécommandes' AND parent_id = ?",
          )
          .get(motorisation.id);

        const moveCategory = db.prepare(
          'UPDATE equipment_categories SET parent_id = ? WHERE id = ?',
        );
        let moved = 0;

        // Élingues acier (id 161) → Élingues sous Accroche
        if (sfElingues) {
          const r1 = moveCategory.run(sfElingues.id, 161); // Elingues acier
          const r2 = moveCategory.run(sfElingues.id, 216); // Elingues tissu
          moved += r1.changes + r2.changes;
        }

        // Accessoires levage (id 92) → Accessoires d'accroche
        if (sfAccessAccroche) {
          const r = moveCategory.run(sfAccessAccroche.id, 92);
          moved += r.changes;
        }

        // Moteurs de levage (id 191) → Moteurs sous Motorisation
        if (sfMoteurs) {
          const r = moveCategory.run(sfMoteurs.id, 191);
          moved += r.changes;
        }

        // Pied de levage (id 62) → Pieds de levage sous Motorisation
        if (sfPieds) {
          const r = moveCategory.run(sfPieds.id, 62);
          moved += r.changes;
        }

        // Télécommandes moteurs (id 211) → Télécommandes sous Motorisation
        if (sfTeleco) {
          const r = moveCategory.run(sfTeleco.id, 211);
          moved += r.changes;
        }

        // Marquer l'ancienne sous-famille Levage (id 19) comme legacy
        // On ne la supprime pas, on la renomme pour traçabilité
        const oldLevage = db
          .prepare("SELECT id FROM equipment_categories WHERE id = 19 AND name = 'Levage'")
          .get();
        if (oldLevage) {
          db.prepare(
            "UPDATE equipment_categories SET name = '[Legacy] Levage', description = 'Catégories migrées vers Accroche et Motorisation' WHERE id = 19",
          ).run();
        }

        db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
        logger.info(`  ✅ Migration ${migKey}: ${moved} catégorie(s) reclassées depuis Levage`);
      } else {
        logger.warn(
          '⚠️ Migration taxonomy_reclassify_levage: familles Accroche/Motorisation introuvables',
        );
      }
    }
  } catch (e) {
    logger.warn('⚠️ Migration taxonomy_reclassify_levage:', e.message);
  }

  // ─── 5. Rattacher catégories orphelines → Outillage & EPI ───
  try {
    const migKey = 'taxonomy_adopt_orphan_categories_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      const oep = db
        .prepare(
          "SELECT id FROM equipment_categories WHERE name = 'Outillage & EPI' AND level = 'family'",
        )
        .get();
      if (oep) {
        // Les orphelines : ids 1-8 (sans parent_id, level='category' ou 'family')
        // On les convertit en sous-familles de "Outillage & EPI"
        // Sauf id=7 "Informatique" (doublon de id=16 INFORMATIQUE) et id=8 "Autre" → Divers

        const orphanMapping = [
          // [id, nouveau_nom, target]
          [1, 'Outillage', oep.id],
          [2, 'Électroportatif', oep.id],
          [3, 'Levage & Manutention', oep.id],
          [4, 'Mesure & Contrôle', oep.id],
          [5, 'EPI', oep.id],
          [6, 'Véhicule annexe', oep.id],
        ];

        const adoptOrphan = db.prepare(
          "UPDATE equipment_categories SET parent_id = ?, level = 'subfamily' WHERE id = ? AND parent_id IS NULL",
        );

        let adopted = 0;
        for (const [id, , targetId] of orphanMapping) {
          // Vérifier qu'il n'y a pas de doublon de nom dans la sous-famille cible
          const existingSub = db
            .prepare(
              'SELECT id FROM equipment_categories WHERE name = (SELECT name FROM equipment_categories WHERE id = ?) AND parent_id = ? AND id != ?',
            )
            .get(id, targetId, id);

          if (existingSub) {
            // Un doublon existe déjà → supprimer l'orpheline (0 equipment liés)
            const eqCount = db
              .prepare('SELECT COUNT(*) as cnt FROM equipment WHERE category_id = ?')
              .get(id);
            if (eqCount.cnt === 0) {
              db.prepare('DELETE FROM equipment_categories WHERE id = ?').run(id);
              logger.info(`  🗑️  Orpheline id=${id} supprimée (doublon, 0 equipment)`);
            } else {
              // Migrer les équipements vers la sous-famille existante
              db.prepare('UPDATE equipment SET category_id = ? WHERE category_id = ?').run(
                existingSub.id,
                id,
              );
              db.prepare('DELETE FROM equipment_categories WHERE id = ?').run(id);
              logger.info(
                `  🔄 Orpheline id=${id}: ${eqCount.cnt} equipment migrés vers id=${existingSub.id}`,
              );
            }
          } else {
            const r = adoptOrphan.run(targetId, id);
            adopted += r.changes;
          }
        }

        // Orpheline id=7 "Informatique" → fusionner avec famille Informatique existante
        const infoFamily = db
          .prepare(
            "SELECT id FROM equipment_categories WHERE name = 'Informatique' AND level = 'family'",
          )
          .get();
        if (infoFamily) {
          const infoOrphan = db
            .prepare('SELECT id FROM equipment_categories WHERE id = 7 AND parent_id IS NULL')
            .get();
          if (infoOrphan) {
            const eqCount = db
              .prepare('SELECT COUNT(*) as cnt FROM equipment WHERE category_id = 7')
              .get();
            if (eqCount.cnt > 0) {
              db.prepare('UPDATE equipment SET category_id = ? WHERE category_id = 7').run(
                infoFamily.id,
              );
            }
            db.prepare('DELETE FROM equipment_categories WHERE id = 7').run();
            logger.info(`  🔄 Orpheline id=7 "Informatique" fusionnée avec famille Informatique`);
          }
        }

        // Orpheline id=8 "Autre" → rattacher au Divers existant
        const divers = db
          .prepare("SELECT id FROM equipment_categories WHERE name = 'Divers' AND level = 'family'")
          .get();
        if (!divers) {
          // Créer Divers si inexistant
          db.prepare(
            "INSERT INTO equipment_categories (name, icon, color, level) VALUES ('Divers', '📋', '#94a3b8', 'family')",
          ).run();
          const diversNew = db
            .prepare(
              "SELECT id FROM equipment_categories WHERE name = 'Divers' AND level = 'family'",
            )
            .get();
          if (diversNew) {
            db.prepare(
              "UPDATE equipment_categories SET parent_id = ?, level = 'subfamily', name = 'Sans catégorie' WHERE id = 8 AND parent_id IS NULL",
            ).run(diversNew.id);
          }
        } else {
          db.prepare(
            "UPDATE equipment_categories SET parent_id = ?, level = 'subfamily', name = 'Sans catégorie' WHERE id = 8 AND parent_id IS NULL",
          ).run(divers.id);
        }

        db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
        logger.info(`  ✅ Migration ${migKey}: ${adopted} orphelines rattachées à Outillage & EPI`);
      }
    }
  } catch (e) {
    logger.warn('⚠️ Migration taxonomy_adopt_orphan_categories:', e.message);
  }

  // ─── 6. Ajouter colonne unified_family sur supplier_articles ───
  try {
    const migKey = 'taxonomy_supplier_unified_family_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      const cols = db.pragma('table_info(supplier_articles)').map((c) => c.name);
      if (!cols.includes('unified_family')) {
        db.exec('ALTER TABLE supplier_articles ADD COLUMN unified_family TEXT');
        logger.info('  ✅ supplier_articles.unified_family ajouté');
      }

      // Créer table de mapping
      db.exec(`CREATE TABLE IF NOT EXISTS taxonomy_family_mapping (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_pattern TEXT NOT NULL,
        target_family TEXT NOT NULL,
        source_type TEXT DEFAULT 'supplier',
        is_regex INTEGER DEFAULT 0,
        priority INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Remplir le mapping
      const existingCount = db.prepare('SELECT COUNT(*) as cnt FROM taxonomy_family_mapping').get();
      if (existingCount.cnt === 0) {
        const ins = db.prepare(
          'INSERT INTO taxonomy_family_mapping (source_pattern, target_family, is_regex, priority) VALUES (?, ?, ?, ?)',
        );

        const mappings = [
          // Sonorisation
          ['enceinte|haut.parleur|systèmes compacts|line.array|line array', 'Sonorisation', 1, 10],
          ['micro|casque|ear.monitor|oreillette', 'Sonorisation', 1, 10],
          ['console.*mix|table.*mix|ampli.*puissance|amplificateur', 'Sonorisation', 1, 10],
          ['intercommunication|talkie', 'Sonorisation', 1, 10],
          ['traitement|splitter|distributeur audio|sommateur|préampli', 'Sonorisation', 1, 10],
          ['dlive|série dlive', 'Sonorisation', 1, 10],
          ['sources|matériel dj', 'Sonorisation', 1, 5],
          ['boîtier.*scène|cordon micro', 'Sonorisation', 1, 5],
          // Éclairage
          ['projecteur.*scén|asservi|lyre|led.*changeur|blinder|stroboscope', 'Éclairage', 1, 10],
          [
            'lampe|bague.*filtre|bloc.*puissance|lighting|projecteur.*architect',
            'Éclairage',
            1,
            10,
          ],
          ['éclairage.*gén|éclairage général|livré avec coupe', 'Éclairage', 1, 10],
          ['projecteur.*led|projecteur.*photo', 'Éclairage', 1, 5],
          ['pièces détachées pour projecteurs', 'Éclairage', 1, 5],
          // Structure
          [
            'structure.*scén|cercle|angle.*livr|gladiator|hauteur|tableau.*charge',
            'Structure',
            1,
            10,
          ],
          ['mvccs', 'Structure', 0, 10],
          // Audiovisuel
          [
            'vidéoprojecteur|écran|caméscope|apn|cadr|convertisseur.*scaler|lcd',
            'Audiovisuel',
            1,
            10,
          ],
          ['accessoires pour apn|accessoires.*prise.*vue|appareils photo', 'Audiovisuel', 1, 10],
          [
            'adaptateur.*vidéo|vidéo et data|support.*moniteur|support.*écran',
            'Audiovisuel',
            1,
            10,
          ],
          // Distribution Électrique
          ['matériel.*électr|électricité|schuko|tableau.*électr', 'Distribution Électrique', 1, 10],
          [
            'câble|cable|connectique|adaptateur.*audio.*lumi|speakerlink',
            'Distribution Électrique',
            1,
            5,
          ],
          ['analogique polywire', 'Distribution Électrique', 1, 5],
          // Accroche
          ['élingue|sangle.*textile|stopchute|pince.*manchon', 'Accroche', 1, 10],
          // Rideau-Machinerie
          ['tissu|décor|coton|jupe.*scène|rideau|pendrillon', 'Rideau-Machinerie', 1, 10],
          ['ambiance.*décoration|guidage.*public', 'Rideau-Machinerie', 1, 5],
          // Informatique
          ['informatique|accessoires informatiques', 'Informatique', 1, 5],
          // Outillage & EPI
          ['outillage|électroportatif|chariot', 'Outillage & EPI', 1, 10],
          [
            'epi|équipement.*protection|sécurité.*incendie|lampe.*frontale',
            'Outillage & EPI',
            1,
            10,
          ],
          // Divers
          ['rack|flight.case|valise.*transport|sac.*housse', 'Divers', 1, 5],
          ['gaffer|adhésif|marquage|velcro|balisage|signalisation', 'Divers', 1, 5],
          ['pile|accumulateur', 'Divers', 1, 5],
          ['fabrication.*flight', 'Divers', 1, 5],
        ];

        for (const [pattern, family, isRegex, priority] of mappings) {
          ins.run(pattern, family, isRegex, priority);
        }
        logger.info(`  ✅ taxonomy_family_mapping: ${mappings.length} règles insérées`);
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(`  ✅ Migration ${migKey}: colonne + table mapping créées`);
    }
  } catch (e) {
    logger.warn('⚠️ Migration taxonomy_supplier_unified_family:', e.message);
  }

  // ─── 7. Appliquer le mapping sur supplier_articles existants ───
  try {
    const migKey = 'taxonomy_apply_supplier_mapping_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
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
        // Les non-matchés restent avec unified_family = NULL
      }

      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
      logger.info(
        `  ✅ Migration ${migKey}: ${mapped}/${unmapped.length} articles fournisseurs mappés`,
      );
    }
  } catch (e) {
    logger.warn('⚠️ Migration taxonomy_apply_supplier_mapping:', e.message);
  }

  // ─── 8. Ajouter unified_family sur equipment_catalog ───
  try {
    const migKey = 'taxonomy_equipment_catalog_unified_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      const cols = db.pragma('table_info(equipment_catalog)').map((c) => c.name);
      if (!cols.includes('unified_family')) {
        db.exec('ALTER TABLE equipment_catalog ADD COLUMN unified_family TEXT');
        logger.info('  ✅ equipment_catalog.unified_family ajouté');
      }
      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
    }
  } catch (e) {
    logger.warn('⚠️ Migration taxonomy_equipment_catalog_unified:', e.message);
  }

  // ─── 9. Ajouter Divers comme famille equipment_categories si absent ───
  try {
    const migKey = 'taxonomy_add_divers_family_v1';
    const already = db.prepare('SELECT 1 FROM _migrations_log WHERE key = ?').get(migKey);
    if (!already) {
      const divers = db
        .prepare("SELECT id FROM equipment_categories WHERE name = 'Divers' AND level = 'family'")
        .get();
      if (!divers) {
        db.prepare(
          "INSERT INTO equipment_categories (name, icon, color, level) VALUES ('Divers', '📋', '#94a3b8', 'family')",
        ).run();
        logger.info('  ✅ Famille "Divers" ajoutée à equipment_categories');
      }
      db.prepare('INSERT INTO _migrations_log (key) VALUES (?)').run(migKey);
    }
  } catch (e) {
    logger.warn('⚠️ Migration taxonomy_add_divers_family:', e.message);
  }

  logger.info('  ✅ Migrations taxonomie terminées');
}
