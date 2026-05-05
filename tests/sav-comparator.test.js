#!/usr/bin/env node
/**
 * Tests unitaires — Service savComparator (logique pure)
 * Usage : node --test tests/sav-comparator.test.js
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  comparePreview,
  mapLocmatStatus,
  parseFrenchDate,
  parseLocmatCsv,
  SAV_STATUS,
} from '../apps/api/services/savComparator.js';

describe('parseFrenchDate', () => {
  it('parse DD/MM/YYYY AM en ISO 09:00', () => {
    assert.equal(parseFrenchDate('05/11/2025 AM'), '2025-11-05T09:00:00');
  });
  it('parse DD/MM/YYYY PM en ISO 14:00', () => {
    assert.equal(parseFrenchDate('05/11/2025 PM'), '2025-11-05T14:00:00');
  });
  it('parse DD/MM/YYYY sans suffixe → 09:00', () => {
    assert.equal(parseFrenchDate('05/11/2025'), '2025-11-05T09:00:00');
  });
  it('renvoie null pour vide ou invalide', () => {
    assert.equal(parseFrenchDate(''), null);
    assert.equal(parseFrenchDate(null), null);
    assert.equal(parseFrenchDate('not a date'), null);
  });
});

describe('mapLocmatStatus', () => {
  it('"En cours" → in_progress', () => {
    assert.equal(mapLocmatStatus('En cours'), SAV_STATUS.IN_PROGRESS);
  });
  it('"Attente pièce" → waiting_parts', () => {
    assert.equal(mapLocmatStatus('Attente pièce'), SAV_STATUS.WAITING_PARTS);
  });
  it('"Clôturé" → closed', () => {
    assert.equal(mapLocmatStatus('Clôturé'), SAV_STATUS.CLOSED);
  });
  it('vide → in_progress (défaut)', () => {
    assert.equal(mapLocmatStatus(''), SAV_STATUS.IN_PROGRESS);
  });
});

describe('parseLocmatCsv', () => {
  const sample = [
    'Code Libre;Code Article;Nom Article;Numéro de série;Début;Fin;Coût;A;',
    'IN0000000001;BOXKOLOR;Box Kolor 250;EMAG-00042;05/11/2025 AM;;0;En cours;',
    'IN0000000002;PEND9X2.80;Pendrillon 9x2.80;220490028509579;06/11/2025 PM;10/11/2025 AM;125,50;Clôturé;',
    'IN0000000003;XX;Sans série;;01/01/2026 AM;;0;En cours;',
    ';;;;;;;;', // ligne vide
  ].join('\n');

  it('détecte le séparateur ;', () => {
    const { rows, errors } = parseLocmatCsv(sample);
    assert.equal(errors.length, 0);
    assert.equal(rows.length, 3);
  });

  it('décode UID EMAG-XXXXX', () => {
    const { rows } = parseLocmatCsv(sample);
    const r = rows.find((x) => x.locmat_code === 'IN0000000001');
    assert.equal(r.uid, 'EMAG-00042');
    assert.equal(r.serial_number, null);
    assert.equal(r.status, SAV_STATUS.IN_PROGRESS);
    assert.equal(r.opened_at, '2025-11-05T09:00:00');
    assert.equal(r.closed_at, null);
  });

  it('garde SN brut quand pas EMAG', () => {
    const { rows } = parseLocmatCsv(sample);
    const r = rows.find((x) => x.locmat_code === 'IN0000000002');
    assert.equal(r.serial_number, '220490028509579');
    assert.equal(r.uid, null);
    assert.equal(r.status, SAV_STATUS.CLOSED);
    assert.equal(r.cost, 125.5);
  });

  it('parse coût avec virgule FR', () => {
    const { rows } = parseLocmatCsv(sample);
    const r = rows.find((x) => x.locmat_code === 'IN0000000002');
    assert.equal(r.cost, 125.5);
  });

  it('renvoie tableau vide pour CSV vide', () => {
    const { rows, errors } = parseLocmatCsv('');
    assert.equal(rows.length, 0);
    assert.equal(errors.length, 1);
  });
});

describe('comparePreview', () => {
  const equipmentList = [
    { id: 1, name: 'Box Kolor 250', reference: 'BOXKOLOR', serial_number: null, uid: 'EMAG-00042' },
    {
      id: 2,
      name: 'Pendrillon',
      reference: 'PEND9X2.80',
      serial_number: '220490028509579',
      uid: 'EMAG-00043',
    },
  ];

  it('classe newTickets pour ticket inexistant', () => {
    const rows = [
      {
        locmat_code: 'IN001',
        serial_number: null,
        uid: 'EMAG-00042',
        opened_at: '2026-01-01T09:00:00',
        closed_at: null,
        status: SAV_STATUS.IN_PROGRESS,
        cost: null,
      },
    ];
    const res = comparePreview({
      rows,
      existingTickets: [],
      equipmentList,
      importedAt: '2026-05-05T10:00:00',
    });
    assert.equal(res.newTickets.length, 1);
    assert.equal(res.newTickets[0].equipment_id, 1);
    assert.equal(res.newTickets[0].equipment_match, 'uid');
  });

  it('classe updatedTickets quand statut diffère et source=locmat', () => {
    const rows = [
      {
        locmat_code: 'IN002',
        serial_number: '220490028509579',
        uid: null,
        opened_at: '2026-01-01T09:00:00',
        closed_at: '2026-02-01T09:00:00',
        status: SAV_STATUS.CLOSED,
        cost: 100,
      },
    ];
    const existingTickets = [
      {
        id: 99,
        equipment_id: 2,
        locmat_code: 'IN002',
        serial_number: '220490028509579',
        uid: null,
        status: SAV_STATUS.IN_PROGRESS,
        last_modified_source: 'locmat',
        last_modified_at: '2026-01-15T09:00:00',
      },
    ];
    const res = comparePreview({
      rows,
      existingTickets,
      equipmentList,
      importedAt: '2026-05-05T10:00:00',
    });
    assert.equal(res.updatedTickets.length, 1);
    assert.equal(res.collisions.length, 0);
  });

  it('détecte collision si modif eM@g postérieure au précédent import', () => {
    const rows = [
      {
        locmat_code: 'IN003',
        serial_number: '220490028509579',
        uid: null,
        opened_at: '2026-01-01T09:00:00',
        closed_at: null,
        status: SAV_STATUS.WAITING_PARTS,
        cost: null,
      },
    ];
    const existingTickets = [
      {
        id: 100,
        equipment_id: 2,
        locmat_code: 'IN003',
        serial_number: '220490028509579',
        uid: null,
        status: SAV_STATUS.RESOLVED,
        last_modified_source: 'emag',
        // postérieur à importedAt → collision
        last_modified_at: '2026-06-01T09:00:00',
      },
    ];
    const res = comparePreview({
      rows,
      existingTickets,
      equipmentList,
      importedAt: '2026-05-05T10:00:00',
    });
    assert.equal(res.collisions.length, 1);
    assert.equal(res.updatedTickets.length, 0);
  });

  it('propose closedTickets pour tickets actifs absents du CSV', () => {
    const existingTickets = [
      {
        id: 200,
        equipment_id: 1,
        locmat_code: 'IN999',
        serial_number: null,
        uid: 'EMAG-99999',
        status: SAV_STATUS.IN_PROGRESS,
        last_modified_source: 'locmat',
        last_modified_at: '2026-01-01T09:00:00',
      },
    ];
    const res = comparePreview({
      rows: [],
      existingTickets,
      equipmentList,
      importedAt: '2026-05-05T10:00:00',
    });
    assert.equal(res.closedTickets.length, 1);
    assert.equal(res.closedTickets[0].ticket_id, 200);
  });

  it('détecte doublons CSV internes (même SN ±48h)', () => {
    const rows = [
      {
        locmat_code: 'A',
        serial_number: 'SN1',
        uid: null,
        opened_at: '2026-01-01T09:00:00',
        closed_at: null,
        status: SAV_STATUS.IN_PROGRESS,
        cost: null,
      },
      {
        locmat_code: 'B',
        serial_number: 'SN1',
        uid: null,
        opened_at: '2026-01-02T09:00:00',
        closed_at: null,
        status: SAV_STATUS.IN_PROGRESS,
        cost: null,
      },
    ];
    const res = comparePreview({
      rows,
      existingTickets: [],
      equipmentList,
      importedAt: '2026-05-05T10:00:00',
    });
    assert.equal(res.duplicates.length, 1);
    assert.equal(res.newTickets.length, 1);
  });
});
