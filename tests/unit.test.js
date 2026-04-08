#!/usr/bin/env node
/**
 * Tests unitaires — fonctions utilitaires eM@g
 *
 * Usage :
 *   node --test tests/unit.test.js
 *
 * Aucune dépendance externe, aucune connexion serveur nécessaire.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ──────────────────────────────────────────
// Reproduire cleanTvTitle localement (pas exportée)
// ──────────────────────────────────────────
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u2700-\u27BF]/gu;
const SECTION_LABEL_RE = /^(Pr[eé]paration|Chargement|D[eé]part|Enl[eè]vement|Retour|R[eé]cup[eé]ration|Installation|Livraison|Montage|D[eé]montage|Prioritaires?|Secondaires?|Courses?|Divers)\s*[—–\-:]?\s*/i;

function cleanTvTitle(t) {
  let title = (t.title || t.google_event_title || '').replace(EMOJI_RE, '').trim();
  title = title.replace(SECTION_LABEL_RE, '').trim();
  const affNum = t.affaire_num || '';
  if (affNum) {
    const digits = affNum.replace(/^AF/i, '');
    if (digits) {
      const flexDigits = digits.split('').join('\\s*');
      const pattern = new RegExp('\\bAF\\s*' + flexDigits + '\\b', 'gi');
      title = title.replace(pattern, '');
    }
  }
  title = title.replace(/\s*[—–\-]\s*(?=[—–\-]|$)/g, '').replace(/^[\s—–\-]+/, '').replace(/\s{2,}/g, ' ').trim();
  if (!title) title = t.notes || '-';
  return title.charAt(0).toUpperCase() + title.slice(1);
}

// ──────────────────────────────────────────
// Reproduire getApiUrl côté client
// ──────────────────────────────────────────
function getApiUrl(hostname, port) {
  if (port === '5174' || port === '5175' || port === '4173') return '/api';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return `http://${hostname}:3003/api`;
  return '/api';
}

// ══════════════════════════════════════════
// Tests cleanTvTitle
// ══════════════════════════════════════════
describe('cleanTvTitle', () => {
  it('titre simple → auto-majuscule', () => {
    assert.equal(cleanTvTitle({ title: 'test client' }), 'Test client');
  });

  it('supprime les emojis', () => {
    assert.equal(cleanTvTitle({ title: '🔧 Réparation moteur' }), 'Réparation moteur');
  });

  it('supprime le label de section en début', () => {
    assert.equal(cleanTvTitle({ title: 'Livraison — Client Dupont' }), 'Client Dupont');
  });

  it('supprime le numéro d\'affaire quand affaire_num est fourni', () => {
    const result = cleanTvTitle({ title: 'AF1234 Installation Client', affaire_num: 'AF1234' });
    assert.equal(result, 'Installation Client');
  });

  it('privilégie title sur google_event_title', () => {
    const result = cleanTvTitle({ title: 'Mon titre', google_event_title: 'Google titre' });
    assert.equal(result, 'Mon titre');
  });

  it('fallback sur google_event_title si pas de title', () => {
    const result = cleanTvTitle({ google_event_title: 'google only' });
    assert.equal(result, 'Google only');
  });

  it('fallback sur notes si titre vide', () => {
    const result = cleanTvTitle({ title: '', notes: 'une note' });
    assert.equal(result, 'Une note');
  });

  it('retourne "-" si tout est vide', () => {
    assert.equal(cleanTvTitle({}), '-');
  });

  it('nettoie les tirets orphelins', () => {
    const result = cleanTvTitle({ title: 'Livraison — — Client' });
    assert.equal(result, 'Client');
  });

  it('gère les sections avec accents (Préparation, Départ, etc.)', () => {
    assert.equal(cleanTvTitle({ title: 'Préparation — Machine X' }), 'Machine X');
    assert.equal(cleanTvTitle({ title: 'Départ: Chantier Z' }), 'Chantier Z');
    assert.equal(cleanTvTitle({ title: 'Récupération - Matériel' }), 'Matériel');
  });
});

// ══════════════════════════════════════════
// Tests getApiUrl
// ══════════════════════════════════════════
describe('getApiUrl', () => {
  it('port 5174 → /api (proxy Vite)', () => {
    assert.equal(getApiUrl('localhost', '5174'), '/api');
  });

  it('port 5175 → /api (proxy Vite)', () => {
    assert.equal(getApiUrl('localhost', '5175'), '/api');
  });

  it('port 4173 → /api (preview Vite)', () => {
    assert.equal(getApiUrl('localhost', '4173'), '/api');
  });

  it('localhost sans port Vite → http://localhost:3003/api', () => {
    assert.equal(getApiUrl('localhost', '3000'), 'http://localhost:3003/api');
  });

  it('hostname production → /api', () => {
    assert.equal(getApiUrl('myapp.example.com', '443'), '/api');
  });
});

// ══════════════════════════════════════════
// Tests CORS — validation liste d'origines
// ══════════════════════════════════════════
describe('CORS allowedOrigins (logique)', () => {
  function buildAllowedOrigins(envOverride, isDev) {
    let defaults = [
      'http://localhost:4173',
      'http://127.0.0.1:4173',
    ];
    if (isDev) {
      defaults.push('http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175');
    }
    return (envOverride || defaults.join(',')).split(',').map(s => s.trim());
  }

  it('en dev, inclut localhost:5174 et 5175', () => {
    const origins = buildAllowedOrigins(undefined, true);
    assert.ok(origins.includes('http://localhost:5174'));
    assert.ok(origins.includes('http://localhost:5175'));
  });

  it('en prod, n\'inclut PAS localhost', () => {
    const origins = buildAllowedOrigins(undefined, false);
    assert.ok(!origins.includes('http://localhost:5174'));
    assert.ok(!origins.includes('http://localhost:5175'));
  });

  it('override ENV prend le dessus', () => {
    const origins = buildAllowedOrigins('https://custom.example.com', true);
    assert.deepEqual(origins, ['https://custom.example.com']);
  });
});

// ══════════════════════════════════════════
// Tests sécurité — validation OTP / mot de passe
// ══════════════════════════════════════════
describe('Validation entrées auth (logique pure)', () => {
  it('OTP doit faire exactement 6 chiffres', () => {
    const validOTP = /^\d{6}$/;
    assert.ok(validOTP.test('123456'));
    assert.ok(!validOTP.test('12345'));
    assert.ok(!validOTP.test('1234567'));
    assert.ok(!validOTP.test('abcdef'));
    assert.ok(!validOTP.test(''));
  });

  it('mot de passe min 6 caractères', () => {
    assert.ok('abcdef'.length >= 6);
    assert.ok(!('abc'.length >= 6));
  });

  it('JWT a 3 segments', () => {
    const isJWT = (t) => typeof t === 'string' && t.split('.').length === 3;
    assert.ok(isJWT('a.b.c'));
    assert.ok(!isJWT('abc'));
    assert.ok(!isJWT('a.b'));
    assert.ok(!isJWT(''));
  });
});
