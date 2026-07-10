#!/usr/bin/env node
/**
 * Tests unitaires — services/affaires/* (T-P0-09).
 *
 * DB in-memory + fixtures minimales. Couvre :
 *   - listAffaires (cursor-based, filtres, has_more).
 *   - getAffaireByNumero (200 / NotFound / validation).
 *   - patchAffaire (validation, no-op, changed_fields, audit trail).
 *   - getAffaireHistory (limit cap, ordre desc).
 *   - Frozen fields (AFFAIRE_PATCH_FIELDS / AFFAIRE_READ_FIELDS).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import {
  AFFAIRE_PATCH_FIELDS,
  AFFAIRE_READ_FIELDS,
  AffairesV2NotFoundError,
  AffairesV2ValidationError,
  getAffaireByNumero,
  getAffaireHistory,
  listAffaires,
  patchAffaire,
} from '../../../apps/api/services/affaires/index.js';

let db;

before(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT
    );
    CREATE TABLE affaires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_affaire TEXT NOT NULL UNIQUE,
      nom TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'Prestation',
      client TEXT,
      interlocuteur TEXT,
      tel TEXT,
      fax TEXT,
      date_debut TEXT,
      date_fin TEXT,
      devis TEXT,
      adresse_livraison TEXT,
      titre TEXT,
      description TEXT,
      google_event_id TEXT,
      event_name TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE affaire_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      affaire_id INTEGER NOT NULL REFERENCES affaires(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      changed_at DATETIME NOT NULL DEFAULT (datetime('now')),
      notes TEXT
    );
  `);

  // Fixtures : 3 affaires avec created_at echelonnes pour cursor.
  db.prepare("INSERT INTO users (id, name) VALUES (1, 'admin')").run();
  db.prepare(
    `INSERT INTO affaires (numero_affaire, nom, type, client, date_debut, date_fin, created_at)
     VALUES ('AF-001', 'Prestation A', 'Prestation', 'Client A', '2026-01-05', '2026-01-10', '2026-01-01 08:00:00')`,
  ).run();
  db.prepare(
    `INSERT INTO affaires (numero_affaire, nom, type, client, date_debut, date_fin, created_at)
     VALUES ('AF-002', 'Location B', 'Location', 'Client B', '2026-02-05', '2026-02-10', '2026-01-02 08:00:00')`,
  ).run();
  db.prepare(
    `INSERT INTO affaires (numero_affaire, nom, type, client, date_debut, date_fin, created_at)
     VALUES ('AF-003', 'Prestation C', 'Prestation', 'Client C', NULL, NULL, '2026-01-03 08:00:00')`,
  ).run();
});

after(() => db.close());

describe('services/affaires — constantes', () => {
  it('AFFAIRE_READ_FIELDS et AFFAIRE_PATCH_FIELDS sont figes (Object.freeze)', () => {
    assert.ok(Object.isFrozen(AFFAIRE_READ_FIELDS));
    assert.ok(Object.isFrozen(AFFAIRE_PATCH_FIELDS));
  });

  it('AFFAIRE_PATCH_FIELDS exclut id / numero_affaire / audit fields', () => {
    for (const forbidden of [
      'id',
      'numero_affaire',
      'created_by',
      'created_at',
      'modified_by',
      'modified_at',
    ]) {
      assert.ok(
        !AFFAIRE_PATCH_FIELDS.includes(forbidden),
        `${forbidden} ne doit pas etre patchable`,
      );
    }
  });
});

describe('services/affaires — getAffaireByNumero', () => {
  it("retourne l'affaire par cle metier", () => {
    const { affaire } = getAffaireByNumero({ db, numeroAffaire: 'AF-001' });
    assert.equal(affaire.numero_affaire, 'AF-001');
    assert.equal(affaire.client, 'Client A');
    assert.equal(affaire.type, 'Prestation');
    // Ne doit pas exposer de champ non-lecture.
    for (const key of Object.keys(affaire)) {
      assert.ok(AFFAIRE_READ_FIELDS.includes(key), `${key} est un champ de lecture`);
    }
  });

  it('throw NotFoundError pour un numero inconnu', () => {
    assert.throws(
      () => getAffaireByNumero({ db, numeroAffaire: 'AF-XXX' }),
      AffairesV2NotFoundError,
    );
  });

  it('throw ValidationError si numeroAffaire manquant', () => {
    assert.throws(() => getAffaireByNumero({ db }), AffairesV2ValidationError);
    assert.throws(() => getAffaireByNumero({ db, numeroAffaire: '' }), AffairesV2ValidationError);
  });
});

describe('services/affaires — listAffaires', () => {
  it('renvoie toutes les affaires (< limit) sans has_more', () => {
    const res = listAffaires({ db, limit: 50 });
    assert.equal(res.items.length, 3);
    assert.equal(res.has_more, false);
    assert.equal(res.next_cursor, null);
    assert.equal(res.total_returned, 3);
  });

  it('ordre desc created_at, id', () => {
    const res = listAffaires({ db, limit: 50 });
    // created_at DESC → AF-002 (2026-01-02) avant AF-003 (2026-01-03) ?
    // Attention : 2026-01-03 > 2026-01-02 donc AF-003 en premier.
    assert.equal(res.items[0].numero_affaire, 'AF-003');
    assert.equal(res.items[1].numero_affaire, 'AF-002');
    assert.equal(res.items[2].numero_affaire, 'AF-001');
  });

  it('pagination cursor keyset', () => {
    const page1 = listAffaires({ db, limit: 1 });
    assert.equal(page1.items.length, 1);
    assert.equal(page1.items[0].numero_affaire, 'AF-003');
    assert.equal(page1.has_more, true);
    assert.ok(page1.next_cursor);

    const page2 = listAffaires({ db, limit: 1, cursor: page1.next_cursor });
    assert.equal(page2.items.length, 1);
    assert.equal(page2.items[0].numero_affaire, 'AF-002');
    assert.equal(page2.has_more, true);

    const page3 = listAffaires({ db, limit: 1, cursor: page2.next_cursor });
    assert.equal(page3.items.length, 1);
    assert.equal(page3.items[0].numero_affaire, 'AF-001');
    assert.equal(page3.has_more, false);
    assert.equal(page3.next_cursor, null);
  });

  it('filtre par type', () => {
    const res = listAffaires({ db, filters: { type: 'Location' } });
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].numero_affaire, 'AF-002');
  });

  it('filtre par client (LIKE)', () => {
    const res = listAffaires({ db, filters: { client: 'Client B' } });
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].numero_affaire, 'AF-002');
  });

  it('limit borne a 200 max', () => {
    const res = listAffaires({ db, limit: 999999 });
    assert.equal(res.items.length, 3);
    // Pas de crash, cap respecte.
  });
});

describe('services/affaires — patchAffaire', () => {
  it('applique un patch et remplit affaire_history', () => {
    const before = db
      .prepare("SELECT client, modified_by FROM affaires WHERE numero_affaire = 'AF-001'")
      .get();
    assert.equal(before.client, 'Client A');
    const result = patchAffaire({
      db,
      numeroAffaire: 'AF-001',
      patch: { client: 'Client A - update', titre: 'Nouveau titre' },
      modifiedBy: 1,
      notes: 'test note',
    });
    assert.equal(result.changed, true);
    assert.deepEqual(result.changed_fields.sort(), ['client', 'titre']);
    assert.equal(result.history_ids.length, 2);
    assert.equal(result.affaire.client, 'Client A - update');
    assert.equal(result.affaire.titre, 'Nouveau titre');

    const hist = db
      .prepare(
        "SELECT field_name, old_value, new_value, changed_by, notes FROM affaire_history WHERE affaire_id = (SELECT id FROM affaires WHERE numero_affaire = 'AF-001') ORDER BY field_name",
      )
      .all();
    assert.equal(hist.length, 2);
    const clientEntry = hist.find((h) => h.field_name === 'client');
    assert.equal(clientEntry.old_value, 'Client A');
    assert.equal(clientEntry.new_value, 'Client A - update');
    assert.equal(clientEntry.changed_by, 1);
    assert.equal(clientEntry.notes, 'test note');
  });

  it('no-op : patch identique -> changed:false et aucune entree history', () => {
    const beforeCount = db
      .prepare(
        "SELECT COUNT(*) AS n FROM affaire_history WHERE affaire_id = (SELECT id FROM affaires WHERE numero_affaire = 'AF-002')",
      )
      .get().n;
    const result = patchAffaire({
      db,
      numeroAffaire: 'AF-002',
      patch: { client: 'Client B', type: 'Location' },
    });
    assert.equal(result.changed, false);
    assert.deepEqual(result.changed_fields, []);
    assert.deepEqual(result.history_ids, []);
    const afterCount = db
      .prepare(
        "SELECT COUNT(*) AS n FROM affaire_history WHERE affaire_id = (SELECT id FROM affaires WHERE numero_affaire = 'AF-002')",
      )
      .get().n;
    assert.equal(afterCount, beforeCount);
  });

  it('normalise trim() -> null pour chaine vide', () => {
    const result = patchAffaire({
      db,
      numeroAffaire: 'AF-003',
      patch: { client: '  ' },
    });
    // Etat initial : client = 'Client C'. Le patch trim -> '' -> null.
    assert.equal(result.changed, true);
    assert.equal(result.affaire.client, null);
  });

  it('throw ValidationError si patch vide (aucun champ patchable)', () => {
    assert.throws(
      () => patchAffaire({ db, numeroAffaire: 'AF-001', patch: {} }),
      AffairesV2ValidationError,
    );
    assert.throws(
      () =>
        patchAffaire({ db, numeroAffaire: 'AF-001', patch: { id: 999, numero_affaire: 'AF-X' } }),
      AffairesV2ValidationError,
    );
  });

  it('throw NotFoundError pour numero inconnu', () => {
    assert.throws(
      () => patchAffaire({ db, numeroAffaire: 'AF-XXX', patch: { client: 'x' } }),
      AffairesV2NotFoundError,
    );
  });
});

describe('services/affaires — getAffaireHistory', () => {
  it('renvoie les entrees en ordre desc, avec cap limit', () => {
    // AF-001 a deja au moins 2 entrees (test patch precedent).
    const { affaire } = getAffaireByNumero({ db, numeroAffaire: 'AF-001' });
    const res = getAffaireHistory({ db, affaireId: affaire.id, limit: 10 });
    assert.ok(res.total >= 2);
    // Ordre desc : changed_at DESC → l'entree la plus recente en premier.
    for (let i = 1; i < res.entries.length; i += 1) {
      assert.ok(
        res.entries[i - 1].changed_at >= res.entries[i].changed_at,
        'ordre changed_at desc',
      );
    }
  });

  it('validation : affaireId invalide -> throw', () => {
    assert.throws(() => getAffaireHistory({ db, affaireId: 0 }), AffairesV2ValidationError);
    assert.throws(() => getAffaireHistory({ db, affaireId: -1 }), AffairesV2ValidationError);
    assert.throws(() => getAffaireHistory({ db, affaireId: 'foo' }), AffairesV2ValidationError);
  });

  it('cap la limite a 500 max', () => {
    const { affaire } = getAffaireByNumero({ db, numeroAffaire: 'AF-001' });
    const res = getAffaireHistory({ db, affaireId: affaire.id, limit: 999999 });
    // Ne throw pas, borne appliquee silencieusement.
    assert.ok(res.entries.length <= 500);
  });
});
