// apps/web/src/utils/affairesLoader.test.js
//
// Ticket : T-P0-09b (Affaires v2 — dogfooding UI lecture).
// Couvre la nouvelle branche v2 (flag on/off, fallback FEATURE_DISABLED,
// fallback erreur, fallback v1 par defaut) sans regression sur le
// contrat existant (IDB cache, offline fallback).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({
  default: {
    getAffaires: vi.fn(),
    v2ListAffaires: vi.fn(),
  },
}));

vi.mock('./indexedDB', () => ({
  loadFromIndexedDB: vi.fn(),
  saveToIndexedDB: vi.fn().mockResolvedValue(undefined),
  STORES: { affaires: 'affaires' },
}));

vi.mock('./logger', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock du reader de flag pour piloter les scenarios sans toucher
// a `import.meta.env` (qui n'est pas facilement injectable ici).
vi.mock('./affaires/v2Adapters.js', async () => {
  const actual = await vi.importActual('./affaires/v2Adapters.js');
  return {
    ...actual,
    readAffairesV2ClientFlag: vi.fn(() => false),
  };
});

// Recharge le module avant chaque test pour reinitialiser l'etat
// interne (aucun ici, mais pratique en cas d'ajout futur).
async function loadModule() {
  vi.resetModules();
  return await import('./affairesLoader.js');
}

describe('affairesLoader.fetchAffaires — chemin v1 (flag off)', () => {
  let api;
  let readAffairesV2ClientFlag;

  beforeEach(async () => {
    ({ default: api } = await import('./api'));
    ({ readAffairesV2ClientFlag } = await import('./affaires/v2Adapters.js'));
    readAffairesV2ClientFlag.mockReturnValue(false);
    api.getAffaires.mockReset();
    api.v2ListAffaires.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('appelle v1 uniquement quand flag off', async () => {
    api.getAffaires.mockResolvedValue([{ id: 1, numeroAffaire: 'A-1' }]);
    const { fetchAffaires } = await loadModule();
    const out = await fetchAffaires();
    expect(api.getAffaires).toHaveBeenCalledTimes(1);
    expect(api.v2ListAffaires).not.toHaveBeenCalled();
    expect(out.affaires).toEqual([{ id: 1, numeroAffaire: 'A-1' }]);
    expect(out.fromCache).toBe(false);
    expect(out.error).toBeNull();
  });

  it('fallback IDB si v1 echoue', async () => {
    const { loadFromIndexedDB } = await import('./indexedDB');
    api.getAffaires.mockRejectedValue(new Error('offline'));
    loadFromIndexedDB.mockResolvedValue([{ id: 42, numeroAffaire: 'CACHED' }]);
    const { fetchAffaires } = await loadModule();
    const out = await fetchAffaires();
    expect(out.fromCache).toBe(true);
    expect(out.affaires).toEqual([{ id: 42, numeroAffaire: 'CACHED' }]);
    expect(out.error).toBeInstanceOf(Error);
  });
});

describe('affairesLoader.fetchAffaires — chemin v2 (flag on)', () => {
  let api;
  let readAffairesV2ClientFlag;

  beforeEach(async () => {
    ({ default: api } = await import('./api'));
    ({ readAffairesV2ClientFlag } = await import('./affaires/v2Adapters.js'));
    readAffairesV2ClientFlag.mockReturnValue(true);
    api.getAffaires.mockReset();
    api.v2ListAffaires.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('appelle v2 quand flag on et adapte le shape', async () => {
    api.v2ListAffaires.mockResolvedValue({
      data: {
        items: [
          { id: 10, numero_affaire: 'A-10', date_debut: '2026-07-01' },
          { id: 11, numero_affaire: 'A-11', date_debut: '2026-07-02' },
        ],
        has_more: false,
        next_cursor: null,
      },
    });
    const { fetchAffaires } = await loadModule();
    const out = await fetchAffaires();
    expect(api.v2ListAffaires).toHaveBeenCalledTimes(1);
    expect(api.getAffaires).not.toHaveBeenCalled();
    expect(out.affaires).toHaveLength(2);
    expect(out.affaires[0].numeroAffaire).toBe('A-10');
    expect(out.affaires[0].dateDebut).toBe('2026-07-01');
    expect(out.fromCache).toBe(false);
    expect(out.error).toBeNull();
  });

  it('fallback v1 silencieux si v2 renvoie FEATURE_DISABLED', async () => {
    const err = new Error('feature off');
    err.code = 'FEATURE_DISABLED';
    api.v2ListAffaires.mockRejectedValue(err);
    api.getAffaires.mockResolvedValue([{ id: 1, numeroAffaire: 'FALLBACK-V1' }]);
    const { fetchAffaires } = await loadModule();
    const { default: logger } = await import('./logger');
    logger.warn.mockClear();
    const out = await fetchAffaires();
    expect(api.v2ListAffaires).toHaveBeenCalledTimes(1);
    expect(api.getAffaires).toHaveBeenCalledTimes(1);
    expect(out.affaires).toEqual([{ id: 1, numeroAffaire: 'FALLBACK-V1' }]);
    // FEATURE_DISABLED : pas de warn (bruit inutile en dev)
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('fallback v1 avec log warn si erreur reseau v2', async () => {
    api.v2ListAffaires.mockRejectedValue(new Error('boom'));
    api.getAffaires.mockResolvedValue([{ id: 2, numeroAffaire: 'RESCUE' }]);
    const { fetchAffaires } = await loadModule();
    const { default: logger } = await import('./logger');
    logger.warn.mockClear();
    const out = await fetchAffaires();
    expect(out.affaires).toEqual([{ id: 2, numeroAffaire: 'RESCUE' }]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[affaires v2]'),
      expect.any(Error),
    );
  });

  it('fallback v1 si api.v2ListAffaires absent (client non enregistre)', async () => {
    // eslint-disable-next-line no-import-assign
    delete api.v2ListAffaires;
    api.getAffaires.mockResolvedValue([{ id: 3, numeroAffaire: 'V1-ONLY' }]);
    const { fetchAffaires } = await loadModule();
    const out = await fetchAffaires();
    expect(out.affaires).toEqual([{ id: 3, numeroAffaire: 'V1-ONLY' }]);
    // Restaure pour les tests suivants
    api.v2ListAffaires = vi.fn();
  });
});
