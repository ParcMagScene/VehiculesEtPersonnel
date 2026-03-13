#!/usr/bin/env node
/**
 * Smoke test pour verification rapide du backend eM@g (DEV)
 *
 * Usage:
 *   SMOKE_EMAIL=xxx SMOKE_PASSWORD=yyy node scripts/smoke-test.js
 *
 * Ce script teste des endpoints publics + (si les credentials sont fournis)
 * l'authentification + la session.
 */

const API = process.env.API_URL || 'http://localhost:3003/api';
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

async function run() {
  console.log('🧪 Smoke test eM@g backend');
  console.log('API URL:', API);

  await testPublicEndpoint('/auth/users-public');
  await testPublicEndpoint('/debug/route-test');
  await testPublicEndpoint('/debug/routes');

  if (email && password) {
    console.log('\n🔐 Test auth (login)');
    const token = await testLogin(email, password);
    if (token) {
      await testAuthEndpoint('/debug/session', token);
    }
  } else {
    console.log('\nℹ️  Aucune paire SMOKE_EMAIL/SMOKE_PASSWORD fournie, tests login désactivés');
  }
}

async function testPublicEndpoint(path) {
  const url = `${API}${path}`;
  try {
    const res = await fetch(url);
    const body = await res.text();
    console.log(`\n→ GET ${path} --> ${res.status}`);
    console.log(body.slice(0, 512));
  } catch (err) {
    console.error(`\n✖ erreur GET ${path}:`, err.message);
  }
}

async function testLogin(email, password) {
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    console.log(`\n→ POST /auth/login --> ${res.status}`, data.error ? data.error : 'OK');
    if (res.ok && data.token) {
      console.log('  ✅ Token reçu (longueur', data.token.length, ')');
      return data.token;
    }
  } catch (err) {
    console.error('✖ erreur login:', err.message);
  }
  return null;
}

async function testAuthEndpoint(path, token) {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`\n→ GET ${path} (auth) --> ${res.status}`);
    console.log(JSON.stringify(data, null, 2).slice(0, 1024));
  } catch (err) {
    console.error(`✖ erreur GET ${path}:`, err.message);
  }
}

run().catch(err => {
  console.error('Erreur smoke test:', err);
  process.exit(1);
});
