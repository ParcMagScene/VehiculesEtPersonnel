#!/usr/bin/env node
/**
 * Tests unitaires — services/leaves/* (T-P1-04).
 *
 * DB in-memory + fixtures minimales. Couvre :
 *   - calcWorkingDays (base, feries, demi-jours, weekend/dim).
 *   - calculateLeavePeriod (base, exceptionnel duree fixe, warnings).
 *   - checkDeadline / checkMainLeaveRule / isInClosurePeriod.
 *   - getBalanceForPerson (existant, absent).
 *   - resolvePersonIdFromUser (ok / not found).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import {
  calcWorkingDays,
  calculateLeavePeriod,
  checkDeadline,
  checkMainLeaveRule,
  DAYS_PER_YEAR,
  EXCEPTIONAL_LEAVE_DURATIONS,
  getBalanceForPerson,
  getReferencePeriod,
  isInClosurePeriod,
  LeavesV2NotFoundError,
  LeavesV2ValidationError,
  resolvePersonIdFromUser,
} from '../../../apps/api/services/leaves/index.js';

let db;

before(() => {
  db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
    CREATE TABLE persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      user_id INTEGER
    );
    CREATE TABLE public_holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      date TEXT NOT NULL UNIQUE,
      name TEXT
    );
    CREATE TABLE leave_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      type TEXT NOT NULL,
      days_entitled REAL NOT NULL DEFAULT 0,
      days_taken REAL NOT NULL DEFAULT 0,
      UNIQUE(person_id, year, type)
    );
  `);
  // Fixtures : quelques feries 2026.
  const insHoliday = db.prepare('INSERT INTO public_holidays (year, date, name) VALUES (?, ?, ?)');
  insHoliday.run(2026, '2026-01-01', 'Jour de l an');
  insHoliday.run(2026, '2026-05-01', 'Fete du travail');
  insHoliday.run(2026, '2026-07-14', 'Fete nationale');
  insHoliday.run(2026, '2026-12-25', 'Noel');

  db.prepare('INSERT INTO users (id, name) VALUES (10, ?)').run('alice');
  db.prepare('INSERT INTO persons (id, first_name, last_name, user_id) VALUES (?, ?, ?, ?)').run(
    100,
    'Alice',
    'Test',
    10,
  );
  db.prepare('INSERT INTO persons (id, first_name, last_name) VALUES (?, ?, ?)').run(
    200,
    'Bob',
    'NoUser',
  );
  db.prepare(
    'INSERT INTO leave_balances (person_id, year, type, days_entitled, days_taken) VALUES (?, ?, ?, ?, ?)',
  ).run(100, 2026, 'conge_paye', 30, 12);
});

after(() => db.close());

describe('leaves/rules — constantes', () => {
  it('DAYS_PER_YEAR = 30', () => {
    assert.equal(DAYS_PER_YEAR, 30);
  });

  it('EXCEPTIONAL_LEAVE_DURATIONS est frozen et contient les cas legaux', () => {
    assert.ok(Object.isFrozen(EXCEPTIONAL_LEAVE_DURATIONS));
    for (const key of ['mariage_salarie', 'naissance', 'deces_enfant', 'demenagement']) {
      assert.ok(EXCEPTIONAL_LEAVE_DURATIONS[key], `${key} present`);
      assert.equal(typeof EXCEPTIONAL_LEAVE_DURATIONS[key].days, 'number');
    }
  });
});

describe('leaves/rules — calcWorkingDays', () => {
  it('semaine complete lundi-samedi = 6 jours', () => {
    // 2026-01-12 (lundi) -> 2026-01-17 (samedi), aucun ferie.
    assert.equal(calcWorkingDays({ db, startDate: '2026-01-12', endDate: '2026-01-17' }), 6);
  });

  it('exclut le dimanche', () => {
    // Dimanche seul = 0.
    assert.equal(calcWorkingDays({ db, startDate: '2026-01-11', endDate: '2026-01-11' }), 0);
  });

  it('exclut les jours feries', () => {
    // 2026-05-01 est ferie (vendredi). Du 2026-04-27 (lundi) au 2026-05-02
    // (samedi) = 5 jours ouvres (samedi inclus, ferie exclu).
    assert.equal(calcWorkingDays({ db, startDate: '2026-04-27', endDate: '2026-05-02' }), 5);
  });

  it('applique demi-jour startPeriod=PM', () => {
    assert.equal(
      calcWorkingDays({
        db,
        startDate: '2026-01-12',
        endDate: '2026-01-13',
        startPeriod: 'PM',
        endPeriod: 'PM',
      }),
      1.5,
    );
  });

  it('endDate < startDate -> 0', () => {
    assert.equal(calcWorkingDays({ db, startDate: '2026-05-10', endDate: '2026-05-01' }), 0);
  });
});

describe('leaves/rules — helpers legaux', () => {
  it('getReferencePeriod : date en juillet 2026 -> 2026/2027', () => {
    assert.deepEqual(getReferencePeriod('2026-07-15'), {
      start: '2026-06-01',
      end: '2027-05-31',
      label: '2026/2027',
    });
  });

  it('getReferencePeriod : date en avril 2026 -> 2025/2026', () => {
    assert.deepEqual(getReferencePeriod('2026-04-15'), {
      start: '2025-06-01',
      end: '2026-05-31',
      label: '2025/2026',
    });
  });

  it('isInClosurePeriod : 24/12 et 01/01 = true, 15/06 = false', () => {
    assert.equal(isInClosurePeriod('2026-12-24'), true);
    assert.equal(isInClosurePeriod('2026-12-31'), true);
    assert.equal(isInClosurePeriod('2026-01-01'), true);
    assert.equal(isInClosurePeriod('2026-06-15'), false);
  });

  it('checkDeadline : demande apres 28/02 pour l annee courante -> invalid', () => {
    const r = checkDeadline('2026-03-15', '2026-07-01');
    assert.equal(r.valid, false);
    assert.match(r.message, /28 fevrier 2026/);
  });

  it('checkDeadline : demande avant 28/02 -> valid', () => {
    assert.equal(checkDeadline('2026-01-15', '2026-07-01').valid, true);
  });

  it('checkMainLeaveRule : 12+ jours en ete -> message conforme', () => {
    const r = checkMainLeaveRule('2026-07-01', '2026-07-20', 15);
    assert.match(r.message, /12 jours consecutifs/);
  });
});

describe('leaves/calculate — calculateLeavePeriod', () => {
  it('validation stricte : dates ISO requises', () => {
    assert.throws(
      () => calculateLeavePeriod({ db, startDate: 'foo', endDate: '2026-01-10' }),
      LeavesV2ValidationError,
    );
    assert.throws(() => calculateLeavePeriod({ db }), LeavesV2ValidationError);
  });

  it('conge exceptionnel : renvoie duree legale fixe sans calcul', () => {
    const r = calculateLeavePeriod({
      db,
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      leaveType: 'exceptionnel',
      exceptionalType: 'mariage_salarie',
    });
    assert.equal(r.workingDays, 4);
    assert.equal(r.isExceptional, true);
    assert.equal(r.fixedDuration, true);
    assert.equal(r.label, 'Mariage du salarie');
  });

  it('conge paye normal : renvoie workingDays + holidaysInPeriod + warnings', () => {
    const r = calculateLeavePeriod({
      db,
      startDate: '2026-04-27', // lundi
      endDate: '2026-05-02', // samedi (avec 01/05 ferie)
      leaveType: 'conge_paye',
      requestDate: '2026-01-15',
    });
    assert.equal(r.workingDays, 5);
    assert.equal(r.holidaysInPeriod.length, 1);
    assert.equal(r.holidaysInPeriod[0].name, 'Fete du travail');
    assert.ok(Array.isArray(r.warnings));
    assert.ok(r.referencePeriod);
  });

  it('warning fermeture annuelle sur 24-31/12', () => {
    const r = calculateLeavePeriod({
      db,
      startDate: '2026-12-22',
      endDate: '2026-12-31',
      requestDate: '2026-01-01',
    });
    assert.ok(r.warnings.some((w) => /fermeture annuelle/.test(w)));
  });
});

describe('leaves/balance — getBalanceForPerson', () => {
  it('lit un solde existant', () => {
    const b = getBalanceForPerson({ db, personId: 100, year: 2026, type: 'conge_paye' });
    assert.deepEqual(b, {
      person_id: 100,
      year: 2026,
      type: 'conge_paye',
      days_entitled: 30,
      days_taken: 12,
      days_remaining: 18,
      exists: true,
    });
  });

  it('renvoie 0/0/0 exists:false pour un couple sans ligne', () => {
    const b = getBalanceForPerson({ db, personId: 200, year: 2026, type: 'conge_paye' });
    assert.equal(b.exists, false);
    assert.equal(b.days_entitled, 0);
    assert.equal(b.days_remaining, 0);
  });

  it('type par defaut = conge_paye + year par defaut = annee courante', () => {
    const now = new Date().getFullYear();
    const b = getBalanceForPerson({ db, personId: 100 });
    assert.equal(b.type, 'conge_paye');
    assert.equal(b.year, now);
  });

  it('validation : personId invalide -> throw', () => {
    assert.throws(() => getBalanceForPerson({ db, personId: 0 }), LeavesV2ValidationError);
    assert.throws(() => getBalanceForPerson({ db, personId: 'x' }), LeavesV2ValidationError);
  });
});

describe('leaves/balance — resolvePersonIdFromUser', () => {
  it('resout user 10 -> person 100', () => {
    assert.equal(resolvePersonIdFromUser({ db, userId: 10 }), 100);
  });

  it('throw NotFound si aucune person lie', () => {
    assert.throws(() => resolvePersonIdFromUser({ db, userId: 999 }), LeavesV2NotFoundError);
  });
});
