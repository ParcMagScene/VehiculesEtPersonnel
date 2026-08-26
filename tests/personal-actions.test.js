#!/usr/bin/env node
/**
 * Tests — auth éphémère « actions personnelles » (commit 1, infra)
 *
 * Couvre :
 *   - migration personal_actions_log (table + index)
 *   - schéma Zod personalActionPerformSchema
 *   - helper verifyPersonalCredentials (tous les cas d'erreur + succès)
 *   - registry du dispatcher (registerPersonalActionHandler)
 *
 * Usage : node --test tests/personal-actions.test.js
 */

import { describe, it, after, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import db from '../apps/api/database.js';
import { personalActionPerformSchema } from '../apps/api/schemas/auth.js';
import { verifyPersonalCredentials } from '../apps/api/services/personalAuth.js';
import {
  registerPersonalActionHandler,
  _clearPersonalActionHandlers,
  _hasPersonalActionHandler,
} from '../apps/api/personalActionsRoutes.js';

after(() => db.close());

// ════════════════════════════════════════════════════════════════
// Migration : table + index
// ════════════════════════════════════════════════════════════════
describe('Migration personal_actions_log', () => {
  it('table existe avec les colonnes attendues', () => {
    const cols = db.pragma('table_info(personal_actions_log)').map((c) => c.name);
    for (const expected of [
      'id',
      'context_user_id',
      'personal_user_id',
      'person_id',
      'action_type',
      'target_type',
      'target_id',
      'payload_summary',
      'success',
      'error_code',
      'ip',
      'user_agent',
      'created_at',
    ]) {
      assert.ok(cols.includes(expected), `colonne manquante: ${expected}`);
    }
  });

  it('index attendus présents', () => {
    const idx = db.pragma('index_list(personal_actions_log)').map((i) => i.name);
    assert.ok(idx.includes('idx_personal_actions_log_context'));
    assert.ok(idx.includes('idx_personal_actions_log_personal'));
    assert.ok(idx.includes('idx_personal_actions_log_action'));
    assert.ok(idx.includes('idx_personal_actions_log_target'));
  });
});

// ════════════════════════════════════════════════════════════════
// Schéma Zod
// ════════════════════════════════════════════════════════════════
describe('personalActionPerformSchema', () => {
  const base = {
    personId: 1,
    pin: '1234',
    actionType: 'create_assignment',
    payload: { foo: 'bar' },
  };

  it('accepte un payload minimal avec PIN', () => {
    const r = personalActionPerformSchema.safeParse(base);
    assert.ok(r.success, JSON.stringify(r.error?.issues));
  });

  it('accepte un payload avec password à la place du PIN', () => {
    const r = personalActionPerformSchema.safeParse({
      ...base,
      pin: undefined,
      password: 'monMotDePasse',
    });
    assert.ok(r.success);
  });

  it('rejette sans PIN ni password', () => {
    const r = personalActionPerformSchema.safeParse({ ...base, pin: undefined });
    assert.ok(!r.success);
  });

  it('rejette un PIN non numérique', () => {
    const r = personalActionPerformSchema.safeParse({ ...base, pin: 'abcd' });
    assert.ok(!r.success);
  });

  it('rejette un actionType inconnu', () => {
    const r = personalActionPerformSchema.safeParse({ ...base, actionType: 'delete_account' });
    assert.ok(!r.success);
  });

  it('rejette un personId non positif', () => {
    const r = personalActionPerformSchema.safeParse({ ...base, personId: -1 });
    assert.ok(!r.success);
  });

  it('accepte les trois actionTypes prévus', () => {
    for (const t of ['create_assignment', 'request_leave', 'declare_unavailability']) {
      const r = personalActionPerformSchema.safeParse({ ...base, actionType: t });
      assert.ok(r.success, `actionType ${t} doit être accepté`);
    }
  });
});

// ════════════════════════════════════════════════════════════════
// Helper verifyPersonalCredentials
// ════════════════════════════════════════════════════════════════
describe('verifyPersonalCredentials', () => {
  const FIXTURE_EMAIL = `test-personal-auth-${Date.now()}@example.test`;
  let testUserId;
  let testPersonId;
  let blockedUserId;
  let blockedPersonId;
  let unlinkedPersonId;
  const PLAIN_PASSWORD = 'TestSecurePwd!1';
  const PLAIN_PIN = '4321';

  before(async () => {
    const pwHash = await bcrypt.hash(PLAIN_PASSWORD, 4);
    const pinHash = await bcrypt.hash(PLAIN_PIN, 4);

    // user actif
    const u = db
      .prepare(
        'INSERT INTO users (email, name, password_hash, pin_hash, is_admin) VALUES (?, ?, ?, ?, 0)',
      )
      .run(FIXTURE_EMAIL, 'Fixture Personal', pwHash, pinHash);
    testUserId = u.lastInsertRowid;

    const p = db
      .prepare(
        "INSERT INTO persons (first_name, last_name, email, user_id, status) VALUES (?, ?, ?, ?, 'active')",
      )
      .run('Test', 'PersonalAuth', FIXTURE_EMAIL, testUserId);
    testPersonId = p.lastInsertRowid;

    // user bloqué
    const ub = db
      .prepare(
        "INSERT INTO users (email, name, password_hash, is_admin, is_blocked) VALUES (?, ?, ?, 0, 1)",
      )
      .run(`blocked-${FIXTURE_EMAIL}`, 'Blocked', pwHash);
    blockedUserId = ub.lastInsertRowid;
    const pb = db
      .prepare(
        "INSERT INTO persons (first_name, last_name, email, user_id, status) VALUES (?, ?, ?, ?, 'active')",
      )
      .run('Blocked', 'User', `blocked-${FIXTURE_EMAIL}`, blockedUserId);
    blockedPersonId = pb.lastInsertRowid;

    // personne sans user lié
    const pu = db
      .prepare(
        "INSERT INTO persons (first_name, last_name, status) VALUES (?, ?, 'active')",
      )
      .run('Sans', 'Compte');
    unlinkedPersonId = pu.lastInsertRowid;
  });

  after(() => {
    db.prepare('DELETE FROM persons WHERE id IN (?, ?, ?)').run(
      testPersonId,
      blockedPersonId,
      unlinkedPersonId,
    );
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(testUserId, blockedUserId);
  });

  it('rejette sans PIN ni password (MISSING_CREDENTIALS)', async () => {
    const r = await verifyPersonalCredentials({ db, personId: testPersonId });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'MISSING_CREDENTIALS');
    assert.equal(r.status, 400);
  });

  it('rejette une personne inexistante (PERSON_NOT_FOUND)', async () => {
    const r = await verifyPersonalCredentials({ db, personId: 999999999, pin: '1234' });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'PERSON_NOT_FOUND');
    assert.equal(r.status, 404);
  });

  it('rejette une personne sans user lié (NO_LINKED_USER)', async () => {
    const r = await verifyPersonalCredentials({
      db,
      personId: unlinkedPersonId,
      pin: '1234',
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'NO_LINKED_USER');
    assert.equal(r.status, 403);
  });

  it('rejette un compte bloqué (USER_BLOCKED_OR_MISSING)', async () => {
    const r = await verifyPersonalCredentials({
      db,
      personId: blockedPersonId,
      password: PLAIN_PASSWORD,
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'USER_BLOCKED_OR_MISSING');
    assert.equal(r.status, 403);
  });

  it('rejette un PIN incorrect (INVALID_CREDENTIALS)', async () => {
    const r = await verifyPersonalCredentials({ db, personId: testPersonId, pin: '0000' });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'INVALID_CREDENTIALS');
    assert.equal(r.status, 401);
  });

  it('rejette un password incorrect (INVALID_CREDENTIALS)', async () => {
    const r = await verifyPersonalCredentials({
      db,
      personId: testPersonId,
      password: 'mauvais',
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'INVALID_CREDENTIALS');
  });

  it('accepte un PIN correct', async () => {
    const r = await verifyPersonalCredentials({ db, personId: testPersonId, pin: PLAIN_PIN });
    assert.equal(r.ok, true);
    assert.equal(r.person.id, testPersonId);
    assert.equal(r.user.id, testUserId);
  });

  it('accepte un password correct', async () => {
    const r = await verifyPersonalCredentials({
      db,
      personId: testPersonId,
      password: PLAIN_PASSWORD,
    });
    assert.equal(r.ok, true);
  });
});

// ════════════════════════════════════════════════════════════════
// Dispatcher registry
// ════════════════════════════════════════════════════════════════
describe('Personal action handlers registry', () => {
  it('register puis hasHandler retourne true', () => {
    _clearPersonalActionHandlers();
    assert.equal(_hasPersonalActionHandler('create_assignment'), false);
    registerPersonalActionHandler('create_assignment', async () => ({ result: 'ok' }));
    assert.equal(_hasPersonalActionHandler('create_assignment'), true);
  });

  it('register avec handler non-fonction throw', () => {
    assert.throws(() => registerPersonalActionHandler('x', 'not a function'));
  });

  it('clear supprime tous les handlers', () => {
    registerPersonalActionHandler('foo', async () => ({}));
    _clearPersonalActionHandlers();
    assert.equal(_hasPersonalActionHandler('foo'), false);
  });
});

// ════════════════════════════════════════════════════════════════
// Handlers métier (create_assignment, request_leave, declare_unavailability)
// ════════════════════════════════════════════════════════════════
const {
  handleCreateAssignment,
  handleRequestLeave,
  handleDeclareUnavailability,
  HandlerError,
} = await import('../apps/api/services/personalActionHandlers.js');

describe('handleCreateAssignment', () => {
  const FX = `pa-handler-asg-${Date.now()}@example.test`;
  let userId, personId, missionId, otherPersonId;
  const cleanup = [];

  before(async () => {
    const u = db
      .prepare(
        'INSERT INTO users (email, name, password_hash, is_admin) VALUES (?, ?, ?, 0)',
      )
      .run(FX, 'Asg Tester', await bcrypt.hash('pw', 4));
    userId = u.lastInsertRowid;
    const p = db
      .prepare(
        "INSERT INTO persons (first_name, last_name, email, user_id, status) VALUES (?, ?, ?, ?, 'active')",
      )
      .run('Asg', 'Tester', FX, userId);
    personId = p.lastInsertRowid;
    const op = db
      .prepare(
        "INSERT INTO persons (first_name, last_name, status) VALUES (?, ?, 'active')",
      )
      .run('Other', 'Person');
    otherPersonId = op.lastInsertRowid;
    const m = db
      .prepare(
        `INSERT INTO missions (title, start_date, end_date, status, created_by)
         VALUES ('PA Test Mission', date('now'), date('now', '+1 day'), 'open', ?)`,
      )
      .run(userId);
    missionId = m.lastInsertRowid;
  });

  after(() => {
    for (const id of cleanup) {
      try {
        db.prepare('DELETE FROM mission_assignments WHERE id = ?').run(id);
      } catch {
        /* noop */
      }
    }
    db.prepare('DELETE FROM mission_assignments WHERE mission_id = ?').run(missionId);
    db.prepare('DELETE FROM missions WHERE id = ?').run(missionId);
    db.prepare('DELETE FROM persons WHERE id IN (?, ?)').run(personId, otherPersonId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  it('crée une affectation avec person_id forcé', () => {
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    const personalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    const out = handleCreateAssignment({
      db,
      person,
      personalUser,
      payload: {
        mission_id: missionId,
        // tentative de privilege escalation
        person_id: otherPersonId,
        position: 'plateau',
      },
    });
    cleanup.push(out.targetId);

    assert.equal(out.targetType, 'mission_assignment');
    assert.ok(out.targetId > 0);
    // SÉCURITÉ : person_id doit être celui du personne authentifiée
    assert.equal(out.result.person_id, personId);
    assert.notEqual(out.result.person_id, otherPersonId);
    assert.equal(out.result.mission_id, missionId);
    assert.equal(out.result.created_by, userId);
    assert.equal(out.result.position, 'plateau');
  });

  it('refuse mission_id manquant', () => {
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    const personalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    assert.throws(
      () => handleCreateAssignment({ db, person, personalUser, payload: {} }),
      (err) => err instanceof HandlerError && err.code === 'INVALID_PAYLOAD',
    );
  });

  it('refuse une mission inexistante', () => {
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    const personalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    assert.throws(
      () =>
        handleCreateAssignment({
          db,
          person,
          personalUser,
          payload: { mission_id: 999999999 },
        }),
      (err) => err instanceof HandlerError && err.code === 'MISSION_NOT_FOUND',
    );
  });

  it('refuse un doublon (déjà affecté)', () => {
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    const personalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    assert.throws(
      () =>
        handleCreateAssignment({
          db,
          person,
          personalUser,
          payload: { mission_id: missionId },
        }),
      (err) => err instanceof HandlerError && err.code === 'ASSIGNMENT_EXISTS',
    );
  });
});

describe('handleRequestLeave', () => {
  const FX = `pa-handler-leave-${Date.now()}@example.test`;
  let userId, personId;
  const cleanup = [];

  before(async () => {
    const u = db
      .prepare(
        'INSERT INTO users (email, name, password_hash, is_admin) VALUES (?, ?, ?, 0)',
      )
      .run(FX, 'Leave Tester', await bcrypt.hash('pw', 4));
    userId = u.lastInsertRowid;
    const p = db
      .prepare(
        "INSERT INTO persons (first_name, last_name, email, user_id, status) VALUES (?, ?, ?, ?, 'active')",
      )
      .run('Leave', 'Tester', FX, userId);
    personId = p.lastInsertRowid;
  });

  after(() => {
    for (const id of cleanup) {
      try {
        db.prepare('DELETE FROM leave_requests WHERE id = ?').run(id);
      } catch {
        /* noop */
      }
    }
    db.prepare('DELETE FROM leave_requests WHERE person_id = ?').run(personId);
    db.prepare('DELETE FROM availabilities WHERE person_id = ?').run(personId);
    db.prepare('DELETE FROM persons WHERE id = ?').run(personId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  it('crée une demande avec person_id et user_id forcés', () => {
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    const personalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    // Dates : 60 jours dans le futur pour éviter conflits potentiels
    const base = new Date();
    base.setDate(base.getDate() + 60);
    const startDate = base.toISOString().split('T')[0];
    base.setDate(base.getDate() + 2);
    const endDate = base.toISOString().split('T')[0];

    const out = handleRequestLeave({
      db,
      person,
      personalUser,
      payload: {
        leaveType: 'conge_paye',
        startDate,
        endDate,
        startPeriod: 'AM',
        endPeriod: 'PM',
        employeeComment: 'vacances',
        // tentative privilege escalation
        personId: 999999999,
      },
    });
    cleanup.push(out.targetId);

    assert.equal(out.targetType, 'leave_request');
    assert.equal(out.result.person_id, personId);
    assert.equal(out.result.user_id, userId);
    assert.equal(out.result.leave_type, 'conge_paye');
    assert.ok(out.result.working_days > 0);

    // Vérifier la création parallèle dans availabilities
    const avail = db
      .prepare(
        `SELECT * FROM availabilities
         WHERE person_id = ? AND start_date = ? AND source = 'leave_request'`,
      )
      .get(personId, startDate);
    assert.ok(avail, 'availability parallèle manquante');
  });

  it('refuse un type de congé invalide', () => {
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    const personalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    assert.throws(
      () =>
        handleRequestLeave({
          db,
          person,
          personalUser,
          payload: {
            leaveType: 'unknown_type',
            startDate: '2099-01-01',
            endDate: '2099-01-02',
          },
        }),
      (err) => err instanceof HandlerError && err.code === 'INVALID_LEAVE_TYPE',
    );
  });

  it('refuse dates invalides (fin < début)', () => {
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    const personalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    assert.throws(
      () =>
        handleRequestLeave({
          db,
          person,
          personalUser,
          payload: {
            leaveType: 'conge_paye',
            startDate: '2099-01-05',
            endDate: '2099-01-02',
          },
        }),
      (err) => err instanceof HandlerError && err.code === 'INVALID_DATES',
    );
  });
});

describe('handleDeclareUnavailability', () => {
  const FX = `pa-handler-avail-${Date.now()}@example.test`;
  let userId, personId, otherPersonId;
  const cleanup = [];

  before(async () => {
    const u = db
      .prepare(
        'INSERT INTO users (email, name, password_hash, is_admin) VALUES (?, ?, ?, 0)',
      )
      .run(FX, 'Avail Tester', await bcrypt.hash('pw', 4));
    userId = u.lastInsertRowid;
    const p = db
      .prepare(
        "INSERT INTO persons (first_name, last_name, email, user_id, status) VALUES (?, ?, ?, ?, 'active')",
      )
      .run('Avail', 'Tester', FX, userId);
    personId = p.lastInsertRowid;
    const op = db
      .prepare(
        "INSERT INTO persons (first_name, last_name, status) VALUES (?, ?, 'active')",
      )
      .run('Other2', 'Person');
    otherPersonId = op.lastInsertRowid;
  });

  after(() => {
    for (const id of cleanup) {
      try {
        db.prepare('DELETE FROM availabilities WHERE id = ?').run(id);
      } catch {
        /* noop */
      }
    }
    db.prepare('DELETE FROM availabilities WHERE person_id IN (?, ?)').run(
      personId,
      otherPersonId,
    );
    db.prepare('DELETE FROM persons WHERE id IN (?, ?)').run(personId, otherPersonId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  it('crée une indispo avec person_id forcé (privilege escalation impossible)', () => {
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    const personalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    const out = handleDeclareUnavailability({
      db,
      person,
      personalUser,
      payload: {
        // tentative
        person_id: otherPersonId,
        type: 'absence',
        startDate: '2099-06-01',
        endDate: '2099-06-02',
        reason: 'test',
      },
    });
    cleanup.push(out.targetId);

    assert.equal(out.targetType, 'availability');
    assert.equal(out.result.person_id, personId);
    assert.notEqual(out.result.person_id, otherPersonId);
    assert.equal(out.result.type, 'absence');
    // 'absence' → auto-approved
    assert.equal(out.result.status, 'approved');
    assert.equal(out.result.source, 'personal');
    assert.equal(out.result.created_by, userId);
  });

  it('met en pending les types nécessitant approbation', () => {
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    const personalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const out = handleDeclareUnavailability({
      db,
      person,
      personalUser,
      payload: {
        type: 'conge_paye',
        startDate: '2099-07-01',
        endDate: '2099-07-02',
      },
    });
    cleanup.push(out.targetId);
    assert.equal(out.result.status, 'pending');
  });

  it('refuse type invalide', () => {
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    const personalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    assert.throws(
      () =>
        handleDeclareUnavailability({
          db,
          person,
          personalUser,
          payload: {
            type: 'inexistant',
            startDate: '2099-01-01',
            endDate: '2099-01-02',
          },
        }),
      (err) => err instanceof HandlerError && err.code === 'INVALID_TYPE',
    );
  });
});
