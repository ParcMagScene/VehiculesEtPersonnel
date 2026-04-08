#!/usr/bin/env node
/**
 * Tests d'intégration API — eM@g backend
 *
 * Pré-requis : le serveur de dev doit tourner sur localhost:3003
 *   NODE_ENV=development node apps/api/server.js --dev
 *
 * Usage :
 *   node --test tests/api-integration.test.js
 *
 * Avec credentials (pour tests authentifiés) :
 *   TEST_EMAIL=admin@example.com TEST_PASSWORD=xxx node --test tests/api-integration.test.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API_URL || 'http://localhost:3003/api';
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────
async function api(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data, ok: res.ok };
}

// ────────────────────────────────────────────────────
// 1. Endpoints publics
// ────────────────────────────────────────────────────
describe('Endpoints publics', () => {
  it('GET /auth/users-public retourne un tableau', async () => {
    const { status, data } = await api('GET', '/auth/users-public');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), 'La réponse doit être un tableau');
    if (data.length > 0) {
      for (const u of data) {
        assert.ok(u.name, 'Chaque utilisateur doit avoir un nom');
        assert.ok(u.email, 'Chaque utilisateur doit avoir un email');
        assert.equal(u.password_hash, undefined, 'password_hash ne doit JAMAIS etre expose');
      }
    }
  });

  it('GET /debug/route-test retourne ok (dev)', async () => {
    const { status, data } = await api('GET', '/debug/route-test');
    assert.equal(status, 200);
    assert.equal(data.ok, true);
  });

  it('GET /debug/routes retourne la liste des routes', async () => {
    const { status, data } = await api('GET', '/debug/routes');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.routes), 'data.routes doit être un tableau');
    assert.ok(data.routes.length > 10, 'Il devrait y avoir au moins 10 routes');
  });

  it('POST /auth/login sans identifiants → 400 ou 401', async () => {
    const { status } = await api('POST', '/auth/login', { body: {} });
    assert.ok([400, 401].includes(status), `Attendu 400/401, reçu ${status}`);
  });

  it('POST /auth/login avec email invalide → 401', async () => {
    const { status } = await api('POST', '/auth/login', {
      body: { email: 'nonexistent@test.invalid', password: 'wrong' },
    });
    assert.equal(status, 401);
  });
});

// ────────────────────────────────────────────────────
// 2. Endpoints protégés (sans token)
// ────────────────────────────────────────────────────
describe('Endpoints protégés — sans token', () => {
  const protectedPaths = [
    '/vehicles',
    '/personnel/planning',
    '/planning/tasks',
    '/equipment/catalog',
  ];

  for (const path of protectedPaths) {
    it(`GET ${path} sans token → 401/403`, async () => {
      const { status } = await api('GET', path);
      assert.ok([401, 403].includes(status), `Attendu 401/403 pour ${path}, reçu ${status}`);
    });
  }
});

// ────────────────────────────────────────────────────
// 3. Authentification complète (si credentials fournis)
// ────────────────────────────────────────────────────
describe('Auth complète (nécessite TEST_EMAIL / TEST_PASSWORD)', { skip: !TEST_EMAIL || !TEST_PASSWORD }, () => {
  let token;

  before(async () => {
    const { status, data } = await api('POST', '/auth/login', {
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    assert.equal(status, 200, `Login failed: ${JSON.stringify(data)}`);
    assert.ok(data.token, 'Token manquant');
    token = data.token;
  });

  it('Token reçu est un JWT valide (3 segments)', () => {
    const parts = token.split('.');
    assert.equal(parts.length, 3, 'Un JWT doit avoir 3 segments séparés par "."');
  });

  it('GET /vehicles avec token → 200', async () => {
    const { status, data } = await api('GET', '/vehicles', { token });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), 'Devrait être un tableau de véhicules');
  });

  it('GET /personnel avec token → 200', async () => {
    const { status, data } = await api('GET', '/personnel', { token });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), 'Devrait être un tableau de personnel');
  });

  it('GET /planning/tasks avec token → 200', async () => {
    const { status } = await api('GET', '/planning/tasks', { token });
    assert.equal(status, 200);
  });

  it('GET /display-config avec token → 200', async () => {
    const { status } = await api('GET', '/display-config', { token });
    assert.equal(status, 200);
  });

  it('GET /equipment/catalog avec token → 200', async () => {
    const { status } = await api('GET', '/equipment/catalog', { token });
    assert.equal(status, 200);
  });

  it('GET /equipment-all-depot-zones avec token → 200', async () => {
    const { status, data } = await api('GET', '/equipment-all-depot-zones', { token });
    assert.equal(status, 200);
    assert.ok(data.depots, 'Réponse doit contenir depots');
    assert.equal(data.depots.length, 2, 'Doit retourner 2 dépôts');
  });

  it('GET /affaires avec token → 200', async () => {
    const { status } = await api('GET', '/affaires', { token });
    assert.equal(status, 200);
  });

  it('GET /orders avec token → 200', async () => {
    const { status } = await api('GET', '/orders', { token });
    assert.equal(status, 200);
  });

  it('POST /auth/logout avec token → 200', async () => {
    const { status } = await api('POST', '/auth/logout', { token });
    assert.equal(status, 200);
  });

  after(async () => {
    // Token encore valide? On tente de vérifier que le logout l'a invalidé.
    const { status } = await api('GET', '/vehicles', { token });
    // Après logout, le token devrait être refusé (401/403).
    assert.ok([401, 403].includes(status), `Après logout le token devrait être invalide, reçu ${status}`);
  });
});

// ────────────────────────────────────────────────────
// 4. Sécurité : endpoints qui ne doivent PAS fuiter de données sensibles
// ────────────────────────────────────────────────────
describe('Sécurité — pas de fuite de données', () => {
  it('GET /auth/users-public ne contient jamais password_hash', async () => {
    const { data } = await api('GET', '/auth/users-public');
    for (const u of (data || [])) {
      assert.equal(u.password_hash, undefined, 'password_hash ne doit JAMAIS etre expose');
      assert.equal(u.password, undefined, 'password ne doit JAMAIS etre expose');
    }
  });

  it('Token JWT forgé → rejeté', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.FAKE_SIGNATURE';
    const { status } = await api('GET', '/vehicles', { token: fakeToken });
    assert.ok([401, 403].includes(status), `Token forgé devrait être rejeté, reçu ${status}`);
  });

  it('Header Authorization vide → rejeté', async () => {
    const { status } = await api('GET', '/vehicles', { token: '' });
    assert.ok([401, 403].includes(status));
  });
});

// ────────────────────────────────────────────────────
// 5. Reset mot de passe — flux OTP (sans réellement reset)
// ────────────────────────────────────────────────────
describe('Reset mot de passe — validation des entrées', () => {
  it('POST /auth/self-reset-password sans body → 400', async () => {
    const { status } = await api('POST', '/auth/self-reset-password', { body: {} });
    assert.ok([400, 401].includes(status), `Attendu 400/401, reçu ${status}`);
  });

  it('POST /auth/set-new-password sans OTP → 400', async () => {
    const { status } = await api('POST', '/auth/set-new-password', { body: {} });
    assert.ok([400, 401].includes(status), `Attendu 400/401, reçu ${status}`);
  });

  it('POST /auth/set-new-password avec OTP invalide → 400/401/404', async () => {
    const { status } = await api('POST', '/auth/set-new-password', {
      body: { email: 'fake@test.com', resetToken: '000000', newPassword: 'TestPass123!' },
    });
    // 404 = utilisateur inexistant, 400 = OTP invalide, 401 = token invalide
    assert.ok([400, 401, 404].includes(status), `OTP invalide devrait etre rejete, recu ${status}`);
  });
});
