#!/usr/bin/env node
/**
 * Tests — extracteur de dates BL/BP + helper recordAffaireHistory (L6)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { extractDatesFromParsedData, parseFrDate } from '../apps/api/services/blDateExtractor.js';
import { recordAffaireHistory } from '../apps/api/services/affaireHistory.js';

// ── parseFrDate ────────────────────────────────────────────────────────
describe('parseFrDate', () => {
  it('convertit DD/MM/YYYY en YYYY-MM-DD', () => {
    assert.equal(parseFrDate('15/03/2026'), '2026-03-15');
    assert.equal(parseFrDate('01/01/2026'), '2026-01-01');
    assert.equal(parseFrDate('31/12/2025'), '2025-12-31');
  });

  it('accepte une date noyée dans une chaîne', () => {
    assert.equal(parseFrDate('Livraison le 20/05/2026 à Paris'), '2026-05-20');
  });

  it('rejette les formats invalides', () => {
    assert.equal(parseFrDate(null), null);
    assert.equal(parseFrDate(''), null);
    assert.equal(parseFrDate('2026-05-20'), null);
    assert.equal(parseFrDate('20-05-2026'), null);
    assert.equal(parseFrDate(undefined), null);
    assert.equal(parseFrDate(20260520), null);
  });

  it('rejette mois/jour hors bornes', () => {
    assert.equal(parseFrDate('32/01/2026'), null);
    assert.equal(parseFrDate('15/13/2026'), null);
    assert.equal(parseFrDate('00/05/2026'), null);
  });
});

// ── extractDatesFromParsedData ─────────────────────────────────────────
describe('extractDatesFromParsedData', () => {
  it('retourne nulls pour input invalide', () => {
    assert.deepEqual(extractDatesFromParsedData(null), { dateDebut: null, dateFin: null });
    assert.deepEqual(extractDatesFromParsedData(undefined), { dateDebut: null, dateFin: null });
    assert.deepEqual(extractDatesFromParsedData('foo'), { dateDebut: null, dateFin: null });
  });

  it('extrait dateDebut depuis champs racine ISO', () => {
    assert.deepEqual(extractDatesFromParsedData({ date: '2026-05-20' }), {
      dateDebut: '2026-05-20',
      dateFin: null,
    });
  });

  it('extrait dateDebut depuis champs racine FR', () => {
    assert.deepEqual(extractDatesFromParsedData({ dateLivraison: '20/05/2026' }), {
      dateDebut: '2026-05-20',
      dateFin: null,
    });
  });

  it('combine dateDebut + dateFin racine', () => {
    assert.deepEqual(
      extractDatesFromParsedData({ dateDebut: '15/05/2026', dateFin: '20/05/2026' }),
      { dateDebut: '2026-05-15', dateFin: '2026-05-20' },
    );
  });

  it('agrège min/max des sections', () => {
    const pd = {
      sections: [
        { dateDebut: '15/05/2026', dateFin: '17/05/2026' },
        { dateDebut: '20/05/2026', dateFin: '25/05/2026' },
        { dateDebut: '10/05/2026', dateFin: '12/05/2026' },
      ],
    };
    assert.deepEqual(extractDatesFromParsedData(pd), {
      dateDebut: '2026-05-10',
      dateFin: '2026-05-25',
    });
  });

  it('combine racine + sections (prend le min/max global)', () => {
    const pd = {
      date: '2026-05-20',
      sections: [{ dateDebut: '15/05/2026', dateFin: '30/05/2026' }],
    };
    assert.deepEqual(extractDatesFromParsedData(pd), {
      dateDebut: '2026-05-15',
      dateFin: '2026-05-30',
    });
  });

  it('ignore sections invalides', () => {
    const pd = {
      sections: [null, 'not-an-object', { dateDebut: 'invalide' }, { dateDebut: '15/05/2026' }],
    };
    assert.deepEqual(extractDatesFromParsedData(pd), {
      dateDebut: '2026-05-15',
      dateFin: null,
    });
  });

  it('priorité racine ISO sur racine FR', () => {
    const pd = { date: '2026-05-20', dateDebut: '01/01/2030' };
    // pd.date pris en premier (priorité), pd.dateDebut ignoré car déjà set
    assert.deepEqual(extractDatesFromParsedData(pd), {
      dateDebut: '2026-05-20',
      dateFin: null,
    });
  });
});

// ── recordAffaireHistory ───────────────────────────────────────────────
function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE affaire_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      affaire_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      source TEXT,
      source_ref TEXT,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      user_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  return db;
}

describe('recordAffaireHistory', () => {
  it('insère un évènement valide et retourne rowid', () => {
    const db = makeDb();
    const id = recordAffaireHistory(db, {
      affaire_id: 42,
      event_type: 'affaire_created',
      source: 'bl_import',
      source_ref: 'abc123',
      field_name: 'numero_affaire',
      new_value: 'AFF-2026-001',
      user_id: 7,
      notes: 'Test',
    });
    assert.ok(typeof id === 'number' || typeof id === 'bigint');
    const row = db.prepare('SELECT * FROM affaire_history WHERE id = ?').get(id);
    assert.equal(row.affaire_id, 42);
    assert.equal(row.event_type, 'affaire_created');
    assert.equal(row.source, 'bl_import');
    assert.equal(row.field_name, 'numero_affaire');
    assert.equal(row.new_value, 'AFF-2026-001');
    assert.equal(row.user_id, 7);
  });

  it('insère un date_change avec old/new', () => {
    const db = makeDb();
    const id = recordAffaireHistory(db, {
      affaire_id: 1,
      event_type: 'date_change',
      source: 'batch_import',
      source_ref: 'xyz',
      field_name: 'date_debut',
      old_value: null,
      new_value: '2026-05-15',
      user_id: 1,
    });
    assert.ok(id);
    const row = db.prepare('SELECT * FROM affaire_history WHERE id = ?').get(id);
    assert.equal(row.field_name, 'date_debut');
    assert.equal(row.old_value, null);
    assert.equal(row.new_value, '2026-05-15');
  });

  it('retourne null et ne throw pas sur event_type invalide', () => {
    const db = makeDb();
    const id = recordAffaireHistory(db, {
      affaire_id: 1,
      event_type: 'pas_valide',
      user_id: 1,
    });
    assert.equal(id, null);
    const count = db.prepare('SELECT COUNT(*) AS n FROM affaire_history').get();
    assert.equal(count.n, 0);
  });

  it('retourne null sur affaire_id invalide', () => {
    const db = makeDb();
    assert.equal(recordAffaireHistory(db, { affaire_id: 0, event_type: 'affaire_created' }), null);
    assert.equal(
      recordAffaireHistory(db, { affaire_id: 'foo', event_type: 'affaire_created' }),
      null,
    );
    assert.equal(
      recordAffaireHistory(db, { affaire_id: null, event_type: 'affaire_created' }),
      null,
    );
  });

  it('retourne null sur source invalide', () => {
    const db = makeDb();
    assert.equal(
      recordAffaireHistory(db, {
        affaire_id: 1,
        event_type: 'affaire_created',
        source: 'pirate',
      }),
      null,
    );
  });

  it('retourne null sur db invalide sans throw', () => {
    assert.equal(
      recordAffaireHistory(null, { affaire_id: 1, event_type: 'affaire_created' }),
      null,
    );
    assert.equal(recordAffaireHistory({}, { affaire_id: 1, event_type: 'affaire_created' }), null);
  });

  it('accepte source par défaut = manual', () => {
    const db = makeDb();
    const id = recordAffaireHistory(db, {
      affaire_id: 1,
      event_type: 'field_change',
      field_name: 'titre',
      new_value: 'Test',
      user_id: 1,
    });
    assert.ok(id);
    const row = db.prepare('SELECT source FROM affaire_history WHERE id = ?').get(id);
    assert.equal(row.source, 'manual');
  });
});
