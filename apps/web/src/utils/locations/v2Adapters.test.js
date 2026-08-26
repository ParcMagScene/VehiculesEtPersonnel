// apps/web/src/utils/locations/v2Adapters.test.js
//
// Tests unitaires des adaptateurs shape v2 -> shape v1
// (Ticket T-P0-12b).

import { describe, expect, it } from 'vitest';

import { adaptDepotsListV2ToV1, adaptDepotV2ToV1 } from './v2Adapters';

describe('adaptDepotV2ToV1', () => {
  it('retourne null pour une entree falsy ou non objet', () => {
    expect(adaptDepotV2ToV1(null)).toBeNull();
    expect(adaptDepotV2ToV1(undefined)).toBeNull();
    expect(adaptDepotV2ToV1('foo')).toBeNull();
    expect(adaptDepotV2ToV1(42)).toBeNull();
  });

  it('renomme snake_case -> camelCase et conserve zones/floors/categories', () => {
    const depotV2 = {
      depot_id: '1',
      name: 'Depot 1',
      version: '2.0',
      svg_width: 900,
      svg_height: 1000,
      floors: [{ id: 'RDC', label: 'Rez' }],
      categories: [{ id: 'son', label: 'Sono', color: '#00d4ff' }],
      zones: [{ id: 'z1', label: 'Zone 1', bbox: [0, 0, 10, 10] }],
      source_file: 'depot-zones.json',
      imported_at: '2026-07-10T00:00:00Z',
      updated_at: '2026-07-10T00:00:00Z',
    };
    const v1 = adaptDepotV2ToV1(depotV2);
    expect(v1).toMatchObject({
      version: '2.0',
      name: 'Depot 1',
      depotId: '1',
      svgWidth: 900,
      svgHeight: 1000,
      floors: [{ id: 'RDC', label: 'Rez' }],
      categories: [{ id: 'son', label: 'Sono', color: '#00d4ff' }],
      zones: [{ id: 'z1', label: 'Zone 1', bbox: [0, 0, 10, 10] }],
    });
    // Les cles v2 uniquement (source_file, imported_at, updated_at) ne
    // doivent pas polluer le payload v1 attendu par DepotMap.
    expect(v1).not.toHaveProperty('source_file');
    expect(v1).not.toHaveProperty('imported_at');
    expect(v1).not.toHaveProperty('updated_at');
    expect(v1).not.toHaveProperty('depot_id');
    expect(v1).not.toHaveProperty('svg_width');
    expect(v1).not.toHaveProperty('svg_height');
  });

  it('tolere les tableaux manquants ou invalides', () => {
    const v1 = adaptDepotV2ToV1({
      depot_id: '2',
      name: 'Depot 2',
      version: '2.0',
      svg_width: null,
      svg_height: null,
      floors: null,
      categories: 'nope',
      zones: undefined,
    });
    expect(v1.floors).toEqual([]);
    expect(v1.categories).toEqual([]);
    expect(v1.zones).toEqual([]);
    expect(v1.svgWidth).toBeNull();
    expect(v1.svgHeight).toBeNull();
  });

  it('fournit des valeurs par defaut pour version et name absents', () => {
    const v1 = adaptDepotV2ToV1({ depot_id: '9' });
    expect(v1.version).toBe('2.0');
    expect(v1.name).toBe('');
    expect(v1.depotId).toBe('9');
  });
});

describe('adaptDepotsListV2ToV1', () => {
  it('retourne { depots: [] } pour une entree vide/falsy', () => {
    expect(adaptDepotsListV2ToV1(null)).toEqual({ depots: [] });
    expect(adaptDepotsListV2ToV1(undefined)).toEqual({ depots: [] });
    expect(adaptDepotsListV2ToV1({})).toEqual({ depots: [] });
    expect(adaptDepotsListV2ToV1({ depots: null })).toEqual({ depots: [] });
  });

  it('mappe chaque depot compact vers un shape v1 sans zones', () => {
    const listV2 = {
      depots: [
        {
          depot_id: '1',
          name: 'Depot 1',
          version: '2.0',
          svg_width: 900,
          svg_height: 1000,
          zones_count: 49,
        },
        {
          depot_id: '2',
          name: 'Depot 2',
          version: '2.0',
          svg_width: 600,
          svg_height: 800,
          zones_count: 20,
        },
      ],
    };
    const v1 = adaptDepotsListV2ToV1(listV2);
    expect(v1.depots).toHaveLength(2);
    expect(v1.depots[0]).toEqual({
      id: '1',
      name: 'Depot 1',
      depotId: '1',
      version: '2.0',
      floors: [],
      categories: [],
      zones: [],
    });
    expect(v1.depots[1].id).toBe('2');
    expect(v1.depots[1].zones).toEqual([]);
  });
});
