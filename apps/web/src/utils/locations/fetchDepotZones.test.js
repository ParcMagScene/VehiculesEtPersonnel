// apps/web/src/utils/locations/fetchDepotZones.test.js
//
// Tests unitaires : bascule v1/v2 avec fallback strict.
// Ticket T-P0-12b.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAllDepotZones, fetchDepotZones, readLocationsV2ClientFlag } from './fetchDepotZones';

function makeApi(overrides = {}) {
  return {
    getEquipmentDepotZones: vi.fn(async (id) => ({
      version: '2.0',
      name: `Depot v1 ${id}`,
      depotId: String(id),
      svgWidth: 900,
      svgHeight: 1000,
      floors: [],
      categories: [],
      zones: [{ id: 'z-v1' }],
    })),
    getAllDepotZones: vi.fn(async () => ({
      depots: [{ id: '1', name: 'V1', depotId: '1', zones: [{ id: 'z-v1' }] }],
    })),
    v2GetDepot: vi.fn(async (id) => ({
      data: {
        depot: {
          depot_id: String(id),
          name: `Depot v2 ${id}`,
          version: '2.0',
          svg_width: 900,
          svg_height: 1000,
          floors: [{ id: 'RDC' }],
          categories: [],
          zones: [{ id: 'z-v2' }],
        },
      },
    })),
    v2ListDepots: vi.fn(async () => ({
      data: {
        depots: [
          { depot_id: '1', name: 'V2 1', version: '2.0' },
          { depot_id: '2', name: 'V2 2', version: '2.0' },
        ],
      },
    })),
    ...overrides,
  };
}

describe('fetchDepotZones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('utilise v1 par defaut (useV2=false)', async () => {
    const api = makeApi();
    const res = await fetchDepotZones(api, { depotId: 1 });
    expect(api.getEquipmentDepotZones).toHaveBeenCalledWith(1);
    expect(api.v2GetDepot).not.toHaveBeenCalled();
    expect(res.zones[0].id).toBe('z-v1');
  });

  it('utilise v2 et adapte au shape v1 quand useV2=true', async () => {
    const api = makeApi();
    const res = await fetchDepotZones(api, { useV2: true, depotId: 2 });
    expect(api.v2GetDepot).toHaveBeenCalledWith(2);
    expect(api.getEquipmentDepotZones).not.toHaveBeenCalled();
    expect(res).toMatchObject({
      depotId: '2',
      svgWidth: 900,
      svgHeight: 1000,
      zones: [{ id: 'z-v2' }],
    });
    expect(res).not.toHaveProperty('svg_width');
  });

  it('fallback silencieux vers v1 si le flag serveur est desactive', async () => {
    const err = Object.assign(new Error('feature off'), { code: 'FEATURE_DISABLED' });
    const api = makeApi({
      v2GetDepot: vi.fn(async () => {
        throw err;
      }),
    });
    const res = await fetchDepotZones(api, { useV2: true, depotId: 1 });
    expect(api.v2GetDepot).toHaveBeenCalled();
    expect(api.getEquipmentDepotZones).toHaveBeenCalledWith(1);
    expect(res.zones[0].id).toBe('z-v1');
  });

  it('fallback vers v1 sur erreur v2 arbitraire', async () => {
    const api = makeApi({
      v2GetDepot: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    const res = await fetchDepotZones(api, { useV2: true, depotId: 1 });
    expect(res).not.toBeNull();
    expect(api.getEquipmentDepotZones).toHaveBeenCalled();
  });

  it('depotId defaut = 1 si non fourni', async () => {
    const api = makeApi();
    await fetchDepotZones(api, { useV2: false });
    expect(api.getEquipmentDepotZones).toHaveBeenCalledWith(1);
  });
});

describe('fetchAllDepotZones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('utilise v1 par defaut', async () => {
    const api = makeApi();
    const res = await fetchAllDepotZones(api);
    expect(api.getAllDepotZones).toHaveBeenCalled();
    expect(res.depots).toHaveLength(1);
    expect(api.v2ListDepots).not.toHaveBeenCalled();
  });

  it('combine v2ListDepots + v2GetDepot puis adapte au shape v1', async () => {
    const api = makeApi();
    const res = await fetchAllDepotZones(api, { useV2: true });
    expect(api.v2ListDepots).toHaveBeenCalled();
    expect(api.v2GetDepot).toHaveBeenCalledTimes(2);
    expect(res.depots).toHaveLength(2);
    expect(res.depots[0]).toMatchObject({
      depotId: '1',
      svgWidth: 900,
      zones: [{ id: 'z-v2' }],
    });
  });

  it('fallback vers v1 si v2ListDepots renvoie 404 FEATURE_DISABLED', async () => {
    const err = Object.assign(new Error('feature off'), { code: 'FEATURE_DISABLED' });
    const api = makeApi({
      v2ListDepots: vi.fn(async () => {
        throw err;
      }),
    });
    const res = await fetchAllDepotZones(api, { useV2: true });
    expect(api.getAllDepotZones).toHaveBeenCalled();
    expect(res.depots).toHaveLength(1);
  });

  it('fallback vers v1 si un v2GetDepot echoue (payload incomplet)', async () => {
    const api = makeApi({
      v2GetDepot: vi.fn(async (id) => {
        if (id === '2') throw new Error('depot 2 KO');
        return {
          data: {
            depot: {
              depot_id: '1',
              name: 'V2 1',
              version: '2.0',
              svg_width: 900,
              svg_height: 1000,
              floors: [],
              categories: [],
              zones: [{ id: 'z-v2' }],
            },
          },
        };
      }),
    });
    const res = await fetchAllDepotZones(api, { useV2: true });
    expect(api.getAllDepotZones).toHaveBeenCalled();
    expect(res.depots).toHaveLength(1);
  });
});

describe('readLocationsV2ClientFlag', () => {
  it('renvoie true pour 1/true/on/yes (case-insensitive)', () => {
    expect(readLocationsV2ClientFlag({ VITE_FEATURE_V2_LOCATIONS: '1' })).toBe(true);
    expect(readLocationsV2ClientFlag({ VITE_FEATURE_V2_LOCATIONS: 'true' })).toBe(true);
    expect(readLocationsV2ClientFlag({ VITE_FEATURE_V2_LOCATIONS: 'ON' })).toBe(true);
    expect(readLocationsV2ClientFlag({ VITE_FEATURE_V2_LOCATIONS: 'Yes' })).toBe(true);
  });

  it('renvoie false pour valeurs absentes ou fausses', () => {
    expect(readLocationsV2ClientFlag({})).toBe(false);
    expect(readLocationsV2ClientFlag({ VITE_FEATURE_V2_LOCATIONS: '' })).toBe(false);
    expect(readLocationsV2ClientFlag({ VITE_FEATURE_V2_LOCATIONS: '0' })).toBe(false);
    expect(readLocationsV2ClientFlag({ VITE_FEATURE_V2_LOCATIONS: 'off' })).toBe(false);
    expect(readLocationsV2ClientFlag({ VITE_FEATURE_V2_LOCATIONS: undefined })).toBe(false);
  });
});
