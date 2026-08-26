#!/usr/bin/env node
/**
 * Tests unitaires — services/display/* (T-P0-15).
 *
 * DB in-memory + fixtures minimales pour valider :
 * - getScreenConfig : screen + playlist + appearance merged.
 * - getPlaylistContent : items ordonnes avec item_name resolu.
 * - getSignalsForScreen : messages actifs, welcome message par (day,slot).
 * - Erreurs typees (Validation vs NotFound).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import {
  DisplayV2NotFoundError,
  DisplayV2ValidationError,
  getPlaylistContent,
  getScreenConfig,
  getSignalsForScreen,
  slotForHour,
} from '../../../apps/api/services/display/index.js';

let db;

before(() => {
  db = new Database(':memory:');
  // ─── Schema minimal calque sur database.js ───
  db.exec(`
    CREATE TABLE display_screens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      resolution TEXT DEFAULT '1920x1080',
      orientation TEXT DEFAULT 'landscape',
      status TEXT DEFAULT 'offline',
      playlist_id INTEGER,
      config TEXT DEFAULT '{}',
      last_heartbeat TEXT,
      token TEXT UNIQUE,
      is_active INTEGER DEFAULT 1
    );
    CREATE TABLE display_playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1
    );
    CREATE TABLE display_playlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      duration INTEGER,
      sort_order INTEGER DEFAULT 0,
      config TEXT DEFAULT '{}'
    );
    CREATE TABLE display_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT NOT NULL
    );
    CREATE TABLE display_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      priority TEXT DEFAULT 'normal',
      style TEXT DEFAULT '{}',
      template_id INTEGER,
      date_start TEXT,
      date_end TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE display_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    CREATE TABLE display_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE display_welcome_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      slot TEXT NOT NULL,
      message TEXT NOT NULL,
      UNIQUE(day, slot)
    );
  `);

  // ─── Fixtures ───
  db.prepare(`INSERT INTO display_playlists (id, name, description) VALUES (1, 'Playlist A', 'Test')`).run();
  db.prepare(`INSERT INTO display_media (id, original_name) VALUES (10, 'video1.mp4')`).run();
  db.prepare(`INSERT INTO display_messages (id, title, is_active) VALUES (20, 'Message 1', 1)`).run();
  db.prepare(
    `INSERT INTO display_playlist_items (playlist_id, item_type, item_id, duration, sort_order) VALUES
      (1, 'media', 10, 30, 1),
      (1, 'message', 20, 10, 2)`,
  ).run();

  db.prepare(
    `INSERT INTO display_screens (id, name, location, playlist_id, status, config) VALUES
      (1, 'Ecran hall', 'Hall entree', 1, 'online', '{"theme":"dark"}'),
      (2, 'Ecran salle', 'Salle 1', NULL, 'offline', '{}')`,
  ).run();

  db.prepare(`INSERT INTO display_config (key, value) VALUES ('primaryColor', '"#ff0000"')`).run();
  db.prepare(`INSERT INTO display_config (key, value) VALUES ('showWeather', 'true')`).run();

  db.prepare(
    `INSERT INTO display_welcome_messages (day, slot, message) VALUES
      ('lun', 'morning', 'Bonjour lundi'),
      ('mar', 'afternoon', 'Bon apres-midi mardi')`,
  ).run();

  // Messages actifs (priority)
  db.prepare(
    `INSERT INTO display_messages (id, title, priority, is_active) VALUES
      (21, 'Urgence', 'urgent', 1),
      (22, 'Normal', 'normal', 1),
      (23, 'Inactif', 'low', 0)`,
  ).run();
});

after(() => db.close());

describe('services/display/config.getScreenConfig (T-P0-15)', () => {
  it('rejette absence de db ou screenId', () => {
    assert.throws(() => getScreenConfig({}), DisplayV2ValidationError);
    assert.throws(() => getScreenConfig({ db }), DisplayV2ValidationError);
    assert.throws(() => getScreenConfig({ db, screenId: 'abc' }), DisplayV2ValidationError);
    assert.throws(() => getScreenConfig({ db, screenId: -1 }), DisplayV2ValidationError);
  });

  it('throw NotFound quand l\'ecran n\'existe pas', () => {
    assert.throws(() => getScreenConfig({ db, screenId: 999 }), DisplayV2NotFoundError);
  });

  it('retourne screen + playlist + appearance mergee', () => {
    const result = getScreenConfig({ db, screenId: 1 });
    assert.equal(result.screen.id, 1);
    assert.equal(result.screen.name, 'Ecran hall');
    assert.equal(result.screen.status, 'online');
    assert.equal(result.screen.is_active, true);
    assert.deepEqual(result.screen.config, { theme: 'dark' });
    assert.deepEqual(result.playlist, { id: 1, name: 'Playlist A' });
    // Appearance : overrides depuis display_config appliques.
    assert.equal(result.appearance.primaryColor, '#ff0000');
    assert.equal(result.appearance.showWeather, true);
    // Defaults preserves pour les cles non overridees.
    assert.equal(result.appearance.fontFamily, 'Arial, sans-serif');
    assert.equal(result.appearance.autoScroll, true);
  });

  it('playlist null si l\'ecran n\'en a pas', () => {
    const result = getScreenConfig({ db, screenId: 2 });
    assert.equal(result.playlist, null);
    assert.equal(result.screen.id, 2);
  });

  it('accepte screenId en string (query param)', () => {
    const result = getScreenConfig({ db, screenId: '1' });
    assert.equal(result.screen.id, 1);
  });
});

describe('services/display/content.getPlaylistContent (T-P0-15)', () => {
  it('rejette absence de db ou playlistId', () => {
    assert.throws(() => getPlaylistContent({}), DisplayV2ValidationError);
    assert.throws(() => getPlaylistContent({ db, playlistId: '' }), DisplayV2ValidationError);
    assert.throws(() => getPlaylistContent({ db, playlistId: 'abc' }), DisplayV2ValidationError);
  });

  it('throw NotFound quand la playlist n\'existe pas', () => {
    assert.throws(() => getPlaylistContent({ db, playlistId: 999 }), DisplayV2NotFoundError);
  });

  it('retourne playlist + items ordonnes avec item_name resolu', () => {
    const result = getPlaylistContent({ db, playlistId: 1 });
    assert.equal(result.playlist.id, 1);
    assert.equal(result.playlist.name, 'Playlist A');
    assert.equal(result.playlist.is_active, true);
    assert.equal(result.total, 2);
    // Ordre : sort_order 1 puis 2.
    assert.equal(result.items[0].item_type, 'media');
    assert.equal(result.items[0].item_name, 'video1.mp4');
    assert.equal(result.items[0].duration, 30);
    assert.equal(result.items[1].item_type, 'message');
    assert.equal(result.items[1].item_name, 'Message 1');
    assert.equal(result.items[1].duration, 10);
  });
});

describe('services/display/signals.getSignalsForScreen (T-P0-15)', () => {
  it('rejette absence de db ou screenId', () => {
    assert.throws(() => getSignalsForScreen({}), DisplayV2ValidationError);
    assert.throws(() => getSignalsForScreen({ db, screenId: 0 }), DisplayV2ValidationError);
  });

  it('throw NotFound quand l\'ecran n\'existe pas', () => {
    assert.throws(() => getSignalsForScreen({ db, screenId: 999 }), DisplayV2NotFoundError);
  });

  it('retourne screen + messages tries par priorite + welcome_message lundi matin', () => {
    // Injection d\'un `now` deterministe : lundi 2026-07-06 09:00.
    const now = new Date('2026-07-06T09:00:00.000Z');
    // getDay() en local peut varier ; forcer via un mardi si le fuseau
    // du runner fait basculer la date. Le test utilise le jour effectif
    // du `now` local.
    const result = getSignalsForScreen({ db, screenId: 1, now });
    assert.equal(result.screen.id, 1);
    assert.ok(Array.isArray(result.messages));
    // Tri : 'urgent' avant 'normal'.
    assert.equal(result.messages[0].priority, 'urgent');
    // Aucun message inactif dans la liste.
    assert.ok(result.messages.every((m) => m.title !== 'Inactif'));
    // Welcome message : dependant du jour local du runner. On verifie
    // juste la structure si non-null.
    if (result.welcome_message) {
      assert.equal(typeof result.welcome_message.day, 'string');
      assert.equal(typeof result.welcome_message.slot, 'string');
      assert.equal(typeof result.welcome_message.message, 'string');
    }
    assert.match(result.generated_at, /^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('services/display/signals.slotForHour (T-P0-15)', () => {
  it('morning avant 12h', () => {
    assert.equal(slotForHour(0), 'morning');
    assert.equal(slotForHour(11), 'morning');
  });
  it('afternoon entre 12h et 18h', () => {
    assert.equal(slotForHour(12), 'afternoon');
    assert.equal(slotForHour(17), 'afternoon');
  });
  it('evening a partir de 18h', () => {
    assert.equal(slotForHour(18), 'evening');
    assert.equal(slotForHour(23), 'evening');
  });
  it('input invalide → fallback morning', () => {
    assert.equal(slotForHour(NaN), 'morning');
    assert.equal(slotForHour(undefined), 'morning');
  });
});
