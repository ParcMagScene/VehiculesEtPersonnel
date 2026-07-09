#!/usr/bin/env node
/**
 * Tests intégration — videoProxyService + videoRoutes (T-P0-17).
 *
 * Cible :
 * - `isBlockedIP` : SSRF guard (IPv4 + IPv6).
 * - `buildRtspUrl` : validation format URI, refus SSRF, construction propre.
 * - `encryptPassword` / `decryptPassword` : roundtrip AES-256-GCM.
 * - `maskRtspUri` (videoRoutes) : masquage des credentials avant log.
 *
 * Aucun accès réseau, aucune écriture DB.
 */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import db from '../../apps/api/database.js';
import { maskRtspUri } from '../../apps/api/videoRoutes.js';
import {
  buildRtspUrl,
  decryptPassword,
  encryptPassword,
  isBlockedIP,
} from '../../apps/api/videoProxyService.js';

// videoRoutes.js importe database.js -> ouverture du fichier SQLite. On ferme
// explicitement en fin de suite pour que `node --test` puisse se terminer.
after(() => db.close());

describe('videoProxyService.isBlockedIP (T-P0-17 SSRF)', () => {
  it('bloque IPv4 loopback', () => {
    assert.equal(isBlockedIP('127.0.0.1'), true);
    assert.equal(isBlockedIP('127.5.5.5'), true);
  });

  it('bloque IPv4 privees (RFC1918 partielles) et link-local', () => {
    // La regex actuelle bloque : 10.*, 172.16-31.*, 169.254.*, 0.*, 255.*
    assert.equal(isBlockedIP('10.0.0.1'), true);
    assert.equal(isBlockedIP('10.255.255.255'), true);
    assert.equal(isBlockedIP('172.16.0.1'), true);
    assert.equal(isBlockedIP('172.31.255.255'), true);
    assert.equal(isBlockedIP('169.254.169.254'), true, 'AWS metadata IP');
    assert.equal(isBlockedIP('0.0.0.0'), true);
    assert.equal(isBlockedIP('255.255.255.255'), true);
  });

  it('bloque IPv6 loopback et link-local', () => {
    assert.equal(isBlockedIP('::1'), true);
    assert.equal(isBlockedIP('::ffff:127.0.0.1'), true);
    assert.equal(isBlockedIP('fe80::1'), true);
    assert.equal(isBlockedIP('fc00::1'), true);
    assert.equal(isBlockedIP('fd00::1'), true);
  });

  it('rejette input null/undefined/vide', () => {
    assert.equal(isBlockedIP(null), true);
    assert.equal(isBlockedIP(undefined), true);
    assert.equal(isBlockedIP(''), true);
  });

  it('rejette formats invalides', () => {
    assert.equal(isBlockedIP('not-an-ip'), true);
    // NB : la regex actuelle est laxe et accepte les nombres > 255 au format
    // IPv4 (ex. 999.999.999.999). BLOCKED_RANGES ne matche pas non plus donc
    // le resultat est false. Comportement documente, durcissement futur possible.
    assert.equal(isBlockedIP('999.999.999.999'), false);
  });

  it('accepte 192.168.x.x et 8.8.8.8 (LAN interne + public)', () => {
    // 192.168.* n'est PAS dans BLOCKED_RANGES actuellement (les cameras
    // eM@g sont sur ce reseau LAN). Comportement voulu, documente.
    assert.equal(isBlockedIP('192.168.1.10'), false);
    assert.equal(isBlockedIP('8.8.8.8'), false);
    assert.equal(isBlockedIP('1.1.1.1'), false);
  });
});

describe('videoProxyService.buildRtspUrl (T-P0-17 SSRF)', () => {
  it('accepte rtsp_url pre-formee si scheme rtsp/rtsps', () => {
    const camera = { rtsp_url: 'rtsp://192.168.1.10:554/stream1' };
    assert.equal(buildRtspUrl(camera, ''), 'rtsp://192.168.1.10:554/stream1');
    const camera2 = { rtsp_url: 'rtsps://camera.local/live' };
    assert.equal(buildRtspUrl(camera2, ''), 'rtsps://camera.local/live');
  });

  it('rejette rtsp_url avec scheme invalide', () => {
    assert.throws(() => buildRtspUrl({ rtsp_url: 'http://x/y' }, ''), /rtsp:\/\/|rtsps:\/\//);
    assert.throws(() => buildRtspUrl({ rtsp_url: 'file:///etc/passwd' }, ''), /rtsp:\/\/|rtsps:\/\//);
  });

  it('throw SSRF quand camera.ip est bloquee', () => {
    assert.throws(
      () => buildRtspUrl({ ip: '127.0.0.1', brand: 'hikvision', username: 'a' }, 'p'),
      /SSRF/,
    );
    assert.throws(() => buildRtspUrl({ ip: '169.254.169.254' }, 'p'), /SSRF/);
    assert.throws(() => buildRtspUrl({ ip: '::1' }, 'p'), /SSRF/);
  });

  it('construit une URL rtsp valide pour IP autorisee (Hikvision par defaut)', () => {
    const url = buildRtspUrl(
      { ip: '192.168.1.10', username: 'admin', brand: 'hikvision', channel: 1 },
      'secret',
    );
    assert.match(url, /^rtsp:\/\/admin:secret@192\.168\.1\.10:554\/Streaming\/Channels\/101/);
  });
});

describe('videoProxyService.encryptPassword / decryptPassword (T-P0-17 credential leak)', () => {
  it('roundtrip preserve le plaintext', () => {
    const secret = 'M0nP@ssword!avec$péciaux';
    const encrypted = encryptPassword(secret);
    assert.notEqual(encrypted, secret, 'ne doit pas etre le plaintext');
    assert.equal(decryptPassword(encrypted), secret);
  });

  it("encryptPassword input vide/null renvoie null (pas de chiffrement inutile)", () => {
    assert.equal(encryptPassword(''), null);
    assert.equal(encryptPassword(null), null);
    assert.equal(encryptPassword(undefined), null);
  });

  it('decryptPassword renvoie null pour input invalide', () => {
    assert.equal(decryptPassword(''), null);
    assert.equal(decryptPassword(null), null);
    assert.equal(decryptPassword('not:properly:formatted'), null);
    assert.equal(decryptPassword('only-one-part'), null);
  });

  it('chaque chiffrement genere un IV different (non deterministe)', () => {
    const secret = 'meme_password';
    const e1 = encryptPassword(secret);
    const e2 = encryptPassword(secret);
    assert.notEqual(e1, e2, 'deux chiffrements du meme plaintext doivent differer');
    // Mais les deux se dechiffrent bien vers le meme plaintext
    assert.equal(decryptPassword(e1), secret);
    assert.equal(decryptPassword(e2), secret);
  });
});

describe('videoRoutes.maskRtspUri (T-P0-17 log leak)', () => {
  it('masque user:pass@ dans rtsp://', () => {
    assert.equal(
      maskRtspUri('rtsp://admin:secret@192.168.1.10:554/cam/realmonitor'),
      'rtsp://***@192.168.1.10:554/cam/realmonitor',
    );
  });

  it('masque user@ (sans password)', () => {
    assert.equal(maskRtspUri('rtsp://admin@10.0.0.1/live'), 'rtsp://***@10.0.0.1/live');
  });

  it('preserve URI sans credentials', () => {
    assert.equal(
      maskRtspUri('rtsp://192.168.1.10:554/stream1'),
      'rtsp://192.168.1.10:554/stream1',
    );
  });

  it('gere rtsps://, http://, https:// (defense en profondeur)', () => {
    assert.equal(
      maskRtspUri('rtsps://u:p@cam.local/live'),
      'rtsps://***@cam.local/live',
    );
    assert.equal(maskRtspUri('http://u:p@example.com/'), 'http://***@example.com/');
  });

  it('retourne null pour input vide/invalide', () => {
    assert.equal(maskRtspUri(null), null);
    assert.equal(maskRtspUri(undefined), null);
    assert.equal(maskRtspUri(''), null);
    assert.equal(maskRtspUri(42), null);
  });
});
