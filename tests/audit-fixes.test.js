#!/usr/bin/env node
/**
 * Tests des corrections audit Phases B + D — eM@g
 *
 * Phase B : Schémas Zod ajoutés (supplier, contacts, stock)
 * Phase D : Vidéo — chiffrement, sessions (cap + purge)
 *
 * Usage : node --test tests/audit-fixes.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ══════════════════════════════════════════
// Phase B — Schémas Zod (supplierImport, contacts, stock)
// ══════════════════════════════════════════
import {
  supplierImportSchema,
  contactsImportSchema,
  stockImportSchema,
} from '../apps/api/schemas/imports.js';

describe('[Phase B] supplierImportSchema', () => {
  it('accepte un import fournisseur valide', () => {
    const result = supplierImportSchema.safeParse({
      supplier_id: 1,
      filename: 'catalog.pdf',
      articles: [{ designation: 'Cable XLR 10m' }],
    });
    assert.ok(result.success, `Erreurs: ${JSON.stringify(result.error?.errors)}`);
  });

  it('accepte avec champs optionnels', () => {
    const result = supplierImportSchema.safeParse({
      supplier_id: 42,
      filename: 'test.pdf',
      file_size: 1024,
      page_count: 3,
      articles: [{
        designation: 'Enceinte DXR12',
        supplier_ref: 'YAM-DXR12',
        brand: 'Yamaha',
        price_ht: 599.99,
        currency: 'EUR',
      }],
    });
    assert.ok(result.success);
    assert.equal(result.data.articles[0].price_ht, 599.99);
  });

  it('rejette sans supplier_id', () => {
    const result = supplierImportSchema.safeParse({
      filename: 'test.pdf',
      articles: [{ designation: 'X' }],
    });
    assert.ok(!result.success);
  });

  it('rejette si articles vide', () => {
    const result = supplierImportSchema.safeParse({
      supplier_id: 1,
      filename: 'test.pdf',
      articles: [],
    });
    assert.ok(!result.success);
  });

  it('rejette si designation manquante', () => {
    const result = supplierImportSchema.safeParse({
      supplier_id: 1,
      filename: 'test.pdf',
      articles: [{ brand: 'Test' }],
    });
    assert.ok(!result.success);
  });

  it('defaults file_size et page_count à 0', () => {
    const result = supplierImportSchema.safeParse({
      supplier_id: 1,
      filename: 'test.pdf',
      articles: [{ designation: 'X' }],
    });
    assert.ok(result.success);
    assert.equal(result.data.file_size, 0);
    assert.equal(result.data.page_count, 0);
  });
});

describe('[Phase B] contactsImportSchema', () => {
  it('accepte avec champ name (anglais)', () => {
    const result = contactsImportSchema.safeParse({
      data: [{ name: 'Jean Dupont', phone: '0612345678' }],
    });
    assert.ok(result.success);
    assert.equal(result.data.mode, 'import'); // default
  });

  it('accepte avec champ nom_prenom (français)', () => {
    const result = contactsImportSchema.safeParse({
      data: [{ nom_prenom: 'Dupont Jean', telephone: '0612345678', societe: 'ACME' }],
      mode: 'preview',
    });
    assert.ok(result.success);
  });

  it('rejette si data vide', () => {
    const result = contactsImportSchema.safeParse({ data: [] });
    assert.ok(!result.success);
  });

  it('rejette si data > 5000', () => {
    const bigData = Array.from({ length: 5001 }, () => ({ name: 'X' }));
    const result = contactsImportSchema.safeParse({ data: bigData });
    assert.ok(!result.success);
  });
});

describe('[Phase B] stockImportSchema', () => {
  it('accepte un import stock minimal', () => {
    const result = stockImportSchema.safeParse({
      items: [{ name: 'Cable DMX 5m' }],
    });
    assert.ok(result.success);
    assert.equal(result.data.mode, 'upsert'); // default
  });

  it('coerce.number convertit string en number', () => {
    const result = stockImportSchema.safeParse({
      items: [{ name: 'Gaffer noir', quantity: '10', unit_price: '5.50', min_quantity: '2' }],
      mode: 'insert',
    });
    assert.ok(result.success);
    assert.equal(result.data.items[0].quantity, 10);
    assert.equal(result.data.items[0].unit_price, 5.5);
    assert.equal(result.data.items[0].min_quantity, 2);
  });

  it('coerce.number accepte 0 et null', () => {
    const result = stockImportSchema.safeParse({
      items: [{ name: 'Test', quantity: 0, unit_price: null }],
    });
    assert.ok(result.success);
    assert.equal(result.data.items[0].quantity, 0);
  });

  it('rejette si name manquant', () => {
    const result = stockImportSchema.safeParse({
      items: [{ reference: 'REF001' }],
    });
    assert.ok(!result.success);
  });

  it('rejette si items vide', () => {
    const result = stockImportSchema.safeParse({ items: [] });
    assert.ok(!result.success);
  });

  it('rejette quantity négative', () => {
    const result = stockImportSchema.safeParse({
      items: [{ name: 'Test', quantity: -5 }],
    });
    assert.ok(!result.success);
  });
});

// ══════════════════════════════════════════
// Phase D — Vidéo : chiffrement + sessions
// ══════════════════════════════════════════

// Fournir une clé de chiffrement de test (64 chars hex = 32 bytes)
// avant l'import du module pour éviter la lecture du .env
import crypto from 'node:crypto';
if (!process.env.VIDEO_CIPHER_KEY) {
  process.env.VIDEO_CIPHER_KEY = crypto.randomBytes(32).toString('hex');
}

import {
  encryptPassword,
  decryptPassword,
  generateSessionToken,
  storeSession,
  getSession,
  removeSession,
} from '../apps/api/videoProxyService.js';

describe('[Phase D] encryptPassword / decryptPassword', () => {
  it('encrypt → decrypt cycle identique', () => {
    const password = 'SuperSecret123!';
    const encrypted = encryptPassword(password);
    assert.ok(encrypted, 'Le chiffrement ne doit pas retourner null');
    assert.notEqual(encrypted, password, 'Le chiffrement ne doit pas être en clair');
    const decrypted = decryptPassword(encrypted);
    assert.equal(decrypted, password);
  });

  it('chaque chiffrement est unique (IV aléatoire)', () => {
    const enc1 = encryptPassword('test');
    const enc2 = encryptPassword('test');
    assert.notEqual(enc1, enc2, 'Deux chiffrements du même texte doivent différer');
  });

  it('format = iv:tag:encrypted (3 parties hex)', () => {
    const enc = encryptPassword('password');
    const parts = enc.split(':');
    assert.equal(parts.length, 3, 'Format attendu: iv:tag:encrypted');
    assert.ok(/^[0-9a-f]+$/.test(parts[0]), 'IV doit être hex');
    assert.ok(/^[0-9a-f]+$/.test(parts[1]), 'Tag doit être hex');
    assert.ok(/^[0-9a-f]+$/.test(parts[2]), 'Encrypted doit être hex');
  });

  it('encryptPassword(null) retourne null', () => {
    assert.equal(encryptPassword(null), null);
    assert.equal(encryptPassword(''), null);
  });

  it('decryptPassword avec données corrompues retourne null', () => {
    assert.equal(decryptPassword('invalid'), null);
    assert.equal(decryptPassword('aa:bb'), null);
    assert.equal(decryptPassword('aa:bb:cc'), null); // hex invalide
    assert.equal(decryptPassword(null), null);
  });
});

describe('[Phase D] Sessions — storeSession / getSession / removeSession', () => {
  it('store + get roundtrip', () => {
    const token = generateSessionToken();
    storeSession(token, { cameraId: 1, userId: 42 });
    const session = getSession(token);
    assert.ok(session, 'La session doit exister');
    assert.equal(session.cameraId, 1);
    assert.equal(session.userId, 42);
    assert.ok(session.createdAt, 'createdAt doit être défini');
    removeSession(token); // cleanup
  });

  it('getSession retourne null si token inconnu', () => {
    assert.equal(getSession('nonexistent-token'), null);
  });

  it('removeSession supprime la session', () => {
    const token = generateSessionToken();
    storeSession(token, { cameraId: 2 });
    removeSession(token);
    assert.equal(getSession(token), null);
  });

  it('generateSessionToken produit des tokens uniques de 64 chars hex', () => {
    const t1 = generateSessionToken();
    const t2 = generateSessionToken();
    assert.notEqual(t1, t2);
    assert.equal(t1.length, 64);
    assert.ok(/^[0-9a-f]+$/.test(t1));
  });
});
