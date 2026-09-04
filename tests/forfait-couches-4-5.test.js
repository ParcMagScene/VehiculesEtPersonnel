// Tests unitaires — couches 4 & 5 forfait-jours
// Réf. avenant n° 3 du 22-4-2025 (JO 12-6-2026).
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  checkForfaitEligibility,
  daysBetween,
  hoursToWorkedDays,
  REST_POSE_DEFAULTS,
  validateBeforeYearEnd,
  validateMaxConsecutiveWorked,
  validateNoticeDelay,
  validateRestPose,
} from '../apps/api/services/forfait/validation.js';

// ─── hoursToWorkedDays ────────────────────────────────────────
test('hoursToWorkedDays — 0h ou négatif = 0', () => {
  assert.equal(hoursToWorkedDays(0), 0);
  assert.equal(hoursToWorkedDays(-1), 0);
  assert.equal(hoursToWorkedDays(null), 0);
});

test('hoursToWorkedDays — ≤ 4h = 0.5 (art. 5.7.3 3°b)', () => {
  assert.equal(hoursToWorkedDays(1), 0.5);
  assert.equal(hoursToWorkedDays(3), 0.5);
  assert.equal(hoursToWorkedDays(4), 0.5);
});

test('hoursToWorkedDays — > 4h = 1', () => {
  assert.equal(hoursToWorkedDays(4.01), 1);
  assert.equal(hoursToWorkedDays(8), 1);
  assert.equal(hoursToWorkedDays(12), 1);
});

// ─── validateNoticeDelay ──────────────────────────────────────
test('validateNoticeDelay — 14 j OK', () => {
  const r = validateNoticeDelay('2026-01-15', '2026-01-01');
  assert.equal(r.ok, true);
  assert.equal(r.delayDays, 14);
});

test('validateNoticeDelay — 13 j KO', () => {
  const r = validateNoticeDelay('2026-01-14', '2026-01-01');
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOTICE_TOO_SHORT');
  assert.equal(r.delayDays, 13);
});

test('validateNoticeDelay — même jour = KO', () => {
  const r = validateNoticeDelay('2026-01-01', '2026-01-01');
  assert.equal(r.ok, false);
  assert.equal(r.delayDays, 0);
});

// ─── validateBeforeYearEnd ────────────────────────────────────
test('validateBeforeYearEnd — 31/12 OK', () => {
  assert.equal(validateBeforeYearEnd('2026-12-31').ok, true);
});

test('validateBeforeYearEnd — pose future OK dans l\'année', () => {
  assert.equal(validateBeforeYearEnd('2026-06-15').ok, true);
});

// ─── validateMaxConsecutiveWorked ─────────────────────────────
test('validateMaxConsecutiveWorked — 5 j consécutifs OK', () => {
  const dailyWork = [
    { date: '2026-06-01', isWorked: true },
    { date: '2026-06-02', isWorked: true },
    { date: '2026-06-03', isWorked: true },
    { date: '2026-06-04', isWorked: true },
    { date: '2026-06-05', isWorked: true },
    { date: '2026-06-06', isWorked: false }, // repos posé
  ];
  const r = validateMaxConsecutiveWorked({ scheduledDate: '2026-06-06', dailyWork });
  assert.equal(r.ok, true);
  assert.equal(r.maxRun, 5);
});

test('validateMaxConsecutiveWorked — 6 j consécutifs KO', () => {
  const dailyWork = [
    { date: '2026-06-01', isWorked: true },
    { date: '2026-06-02', isWorked: true },
    { date: '2026-06-03', isWorked: true },
    { date: '2026-06-04', isWorked: true },
    { date: '2026-06-05', isWorked: true },
    { date: '2026-06-06', isWorked: true },
    { date: '2026-06-07', isWorked: false },
  ];
  const r = validateMaxConsecutiveWorked({ scheduledDate: '2026-06-07', dailyWork });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'MAX_CONSECUTIVE_EXCEEDED');
  assert.equal(r.maxRun, 6);
});

test('validateMaxConsecutiveWorked — la pose casse la série', () => {
  // 4 j travaillés, pose au 5e, puis 3 travaillés → maxRun = 4
  const dailyWork = [
    { date: '2026-06-01', isWorked: true },
    { date: '2026-06-02', isWorked: true },
    { date: '2026-06-03', isWorked: true },
    { date: '2026-06-04', isWorked: true },
    { date: '2026-06-05', isWorked: true }, // pose ici → devient false
    { date: '2026-06-06', isWorked: true },
    { date: '2026-06-07', isWorked: true },
    { date: '2026-06-08', isWorked: true },
  ];
  const r = validateMaxConsecutiveWorked({ scheduledDate: '2026-06-05', dailyWork });
  assert.equal(r.ok, true);
  assert.equal(r.maxRun, 4);
});

// ─── validateRestPose (agrégat) ──────────────────────────────
test('validateRestPose — cumul OK', () => {
  const r = validateRestPose({
    scheduledDate: '2026-06-30',
    requestDate: '2026-06-01',
    dailyWork: [
      { date: '2026-06-29', isWorked: true },
      { date: '2026-06-30', isWorked: true },
    ],
  });
  assert.equal(r.ok, true);
  assert.equal(r.failures.length, 0);
});

test('validateRestPose — cumule 2 échecs', () => {
  const r = validateRestPose({
    scheduledDate: '2026-06-30',
    requestDate: '2026-06-25', // seulement 5 j de prévenance
    dailyWork: [
      { date: '2026-06-24', isWorked: true },
      { date: '2026-06-25', isWorked: true },
      { date: '2026-06-26', isWorked: true },
      { date: '2026-06-27', isWorked: true },
      { date: '2026-06-28', isWorked: true },
      { date: '2026-06-29', isWorked: true },
      { date: '2026-06-30', isWorked: false }, // pose
    ],
  });
  assert.equal(r.ok, false);
  assert.equal(r.failures.length, 2);
  const codes = r.failures.map((f) => f.code);
  assert.ok(codes.includes('NOTICE_TOO_SHORT'));
  assert.ok(codes.includes('MAX_CONSECUTIVE_EXCEEDED'));
});

// ─── checkForfaitEligibility ─────────────────────────────────
test('checkForfaitEligibility — non permanent KO', () => {
  const r = checkForfaitEligibility({
    type: 'intermittent',
    classificationLevel: 5,
    annualSalary: 50000,
    minCategorySalary: 30000,
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'NOT_PERMANENT'));
});

test('checkForfaitEligibility — niveau < 4 KO', () => {
  const r = checkForfaitEligibility({
    type: 'permanent',
    classificationLevel: 3,
    annualSalary: 50000,
    minCategorySalary: 30000,
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'CLASSIFICATION_TOO_LOW'));
});

test('checkForfaitEligibility — salaire < min + 20% KO', () => {
  // min = 30 000, +20% = 36 000 requis
  const r = checkForfaitEligibility({
    type: 'permanent',
    classificationLevel: 5,
    annualSalary: 32000,
    minCategorySalary: 30000,
  });
  assert.equal(r.ok, false);
  const err = r.errors.find((e) => e.code === 'SALARY_BELOW_MIN');
  assert.ok(err);
  assert.equal(err.required, 36000);
});

test('checkForfaitEligibility — tous critères OK', () => {
  const r = checkForfaitEligibility({
    type: 'permanent',
    classificationLevel: 4,
    annualSalary: 40000,
    minCategorySalary: 30000,
  });
  assert.equal(r.ok, true);
  assert.equal(r.errors.length, 0);
});

test('checkForfaitEligibility — sans min salary défini = pas de vérif salaire', () => {
  const r = checkForfaitEligibility({
    type: 'permanent',
    classificationLevel: 4,
    annualSalary: 20000,
    minCategorySalary: null,
  });
  assert.equal(r.ok, true);
});

// ─── daysBetween ─────────────────────────────────────────────
test('daysBetween — passage année', () => {
  assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1);
});

test('daysBetween — année bissextile 2024', () => {
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
});

// ─── Défauts conventionnels ──────────────────────────────────
test('REST_POSE_DEFAULTS — valeurs conventionnelles', () => {
  assert.equal(REST_POSE_DEFAULTS.NOTICE_MIN_DAYS, 14);
  assert.equal(REST_POSE_DEFAULTS.MAX_CONSECUTIVE_WORKED_DAYS, 5);
  assert.equal(REST_POSE_DEFAULTS.HALF_DAY_HOURS_THRESHOLD, 4);
});
