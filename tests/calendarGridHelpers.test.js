// Tests des helpers purs de grille calendrier (FIX 2).

import assert from 'node:assert/strict';
import { test } from 'node:test';

const { COLS_BY_VIEW, buildGridTemplateColumns, computeGridSpan } = await import(
  '../apps/web/src/hooks/calendarGridHelpers.js'
);

test('COLS_BY_VIEW - 14 (week) / 62 (month)', () => {
  assert.equal(COLS_BY_VIEW.week, 14);
  assert.equal(COLS_BY_VIEW.month, 62);
});

test('buildGridTemplateColumns - week utilise --cal-day-min-width', () => {
  const css = buildGridTemplateColumns('week');
  assert.match(css, /repeat\(14, minmax\(var\(--cal-day-min-width\),/);
});

test('buildGridTemplateColumns - month utilise --cal-day-min-width-month', () => {
  const css = buildGridTemplateColumns('month');
  assert.match(css, /repeat\(62, minmax\(var\(--cal-day-min-width-month\),/);
});

test('buildGridTemplateColumns - fallback week sur viewMode inconnu', () => {
  assert.match(buildGridTemplateColumns('foo'), /repeat\(14/);
});

test('computeGridSpan - mardi midi → mercredi midi (week)', () => {
  const viewStart = new Date('2026-05-04T00:00:00Z');
  const span = computeGridSpan({
    startDate: new Date('2026-05-05T12:00:00Z'),
    endDate: new Date('2026-05-06T12:00:00Z'),
    viewStart,
    cols: 14,
  });
  assert.ok(span);
  assert.equal(span.gridColumnStart, 4);
  assert.equal(span.gridColumnEnd, 6);
});

test('computeGridSpan - dates absentes → null', () => {
  assert.equal(computeGridSpan({ viewStart: new Date(), cols: 14 }), null);
});

test('computeGridSpan - item antérieur au viewStart clamp à 1', () => {
  const viewStart = new Date('2026-05-04T00:00:00Z');
  const span = computeGridSpan({
    startDate: new Date('2026-05-02T00:00:00Z'),
    endDate: new Date('2026-05-04T12:00:00Z'),
    viewStart,
    cols: 14,
  });
  assert.ok(span);
  assert.equal(span.gridColumnStart, 1);
});

test('computeGridSpan - dates invalides → null', () => {
  const viewStart = new Date('2026-05-04T00:00:00Z');
  assert.equal(
    computeGridSpan({ startDate: 'not-a-date', endDate: 'still-not', viewStart, cols: 14 }),
    null,
  );
});
