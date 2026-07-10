// apps/web/src/utils/affaires/v2Adapters.test.js
//
// Ticket : T-P0-09b (Affaires v2 — dogfooding UI lecture).
// Tests unitaires purs (Vitest).

import { describe, expect, it } from 'vitest';

import {
  adaptAffairesListV2ToV1,
  adaptAffaireV2ToV1,
  adaptHistoryEntryV2ToV1,
  adaptHistoryListV2ToV1,
  readAffairesV2ClientFlag,
} from './v2Adapters.js';

describe('affaires/v2Adapters — adaptAffaireV2ToV1', () => {
  it('renvoie null pour une entree nulle/undefined/scalaire', () => {
    expect(adaptAffaireV2ToV1(null)).toBeNull();
    expect(adaptAffaireV2ToV1(undefined)).toBeNull();
    expect(adaptAffaireV2ToV1(42)).toBeNull();
    expect(adaptAffaireV2ToV1('foo')).toBeNull();
  });

  it('mappe snake_case v2 vers camelCase v1 (tous les champs cles)', () => {
    const input = {
      id: 12,
      numero_affaire: '2026-000123',
      nom: 'Concert X',
      type: 'Prestation',
      client: 'Client Y',
      interlocuteur: 'M. Dupont',
      tel: '0123456789',
      fax: null,
      date_debut: '2026-07-01',
      date_fin: '2026-07-03',
      devis: 'D-42',
      adresse_livraison: '10 rue X',
      titre: 'Concert X - salle Z',
      description: 'Descr courte',
      google_event_id: 'gcal-abc',
      event_name: 'Concert X',
      created_by: 5,
      created_at: '2026-06-01T10:00:00.000Z',
      modified_by: 7,
      modified_at: '2026-06-02T10:00:00.000Z',
    };
    const out = adaptAffaireV2ToV1(input);
    expect(out).toEqual({
      id: 12,
      numeroAffaire: '2026-000123',
      nom: 'Concert X',
      type: 'Prestation',
      client: 'Client Y',
      interlocuteur: 'M. Dupont',
      tel: '0123456789',
      fax: null,
      dateDebut: '2026-07-01',
      dateFin: '2026-07-03',
      devis: 'D-42',
      adresseLivraison: '10 rue X',
      titre: 'Concert X - salle Z',
      description: 'Descr courte',
      googleEventId: 'gcal-abc',
      eventName: 'Concert X',
      createdBy: 5,
      createdAt: '2026-06-01T10:00:00.000Z',
      modifiedBy: 7,
      modifiedAt: '2026-06-02T10:00:00.000Z',
    });
  });

  it('remplace les champs manquants par null (jamais undefined)', () => {
    const out = adaptAffaireV2ToV1({ id: 1, numero_affaire: 'A-1' });
    // Presence + valeur null pour tous les champs mappes
    expect(out.id).toBe(1);
    expect(out.numeroAffaire).toBe('A-1');
    expect(out.type).toBeNull();
    expect(out.dateDebut).toBeNull();
    expect(out.adresseLivraison).toBeNull();
    expect(out.eventName).toBeNull();
    expect(out.modifiedAt).toBeNull();
  });
});

describe('affaires/v2Adapters — adaptAffairesListV2ToV1', () => {
  it('renvoie [] pour non-array', () => {
    expect(adaptAffairesListV2ToV1(null)).toEqual([]);
    expect(adaptAffairesListV2ToV1(undefined)).toEqual([]);
    expect(adaptAffairesListV2ToV1({})).toEqual([]);
  });

  it('mappe chaque item et filtre les entrees invalides', () => {
    const items = [
      { id: 1, numero_affaire: 'A-1', date_debut: '2026-01-01' },
      null,
      { id: 2, numero_affaire: 'A-2' },
    ];
    const out = adaptAffairesListV2ToV1(items);
    expect(out).toHaveLength(2);
    expect(out[0].numeroAffaire).toBe('A-1');
    expect(out[0].dateDebut).toBe('2026-01-01');
    expect(out[1].numeroAffaire).toBe('A-2');
  });
});

describe('affaires/v2Adapters — adaptHistoryEntryV2ToV1', () => {
  it('renvoie null pour une entree nulle', () => {
    expect(adaptHistoryEntryV2ToV1(null)).toBeNull();
    expect(adaptHistoryEntryV2ToV1(undefined)).toBeNull();
  });

  it('mappe snake_case history v2 vers camelCase', () => {
    const input = {
      id: 100,
      affaire_id: 12,
      event_type: 'field_change',
      source: 'v2_api',
      field_name: 'client',
      old_value: 'Old',
      new_value: 'New',
      changed_by: 5,
      changed_at: '2026-07-10T12:00:00.000Z',
      notes: 'PATCH via UI',
    };
    expect(adaptHistoryEntryV2ToV1(input)).toEqual({
      id: 100,
      affaireId: 12,
      eventType: 'field_change',
      source: 'v2_api',
      fieldName: 'client',
      oldValue: 'Old',
      newValue: 'New',
      changedBy: 5,
      changedAt: '2026-07-10T12:00:00.000Z',
      notes: 'PATCH via UI',
    });
  });
});

describe('affaires/v2Adapters — adaptHistoryListV2ToV1', () => {
  it('renvoie [] pour non-array', () => {
    expect(adaptHistoryListV2ToV1(null)).toEqual([]);
  });

  it('mappe chaque entree', () => {
    const out = adaptHistoryListV2ToV1([
      { id: 1, affaire_id: 12, event_type: 'field_change' },
      { id: 2, affaire_id: 12, event_type: 'status_change' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].eventType).toBe('field_change');
    expect(out[1].eventType).toBe('status_change');
  });
});

describe('affaires/v2Adapters — readAffairesV2ClientFlag', () => {
  it('true pour 1 / true / on / yes (case-insensitive)', () => {
    expect(readAffairesV2ClientFlag({ VITE_FEATURE_V2_AFFAIRES: '1' })).toBe(true);
    expect(readAffairesV2ClientFlag({ VITE_FEATURE_V2_AFFAIRES: 'true' })).toBe(true);
    expect(readAffairesV2ClientFlag({ VITE_FEATURE_V2_AFFAIRES: 'ON' })).toBe(true);
    expect(readAffairesV2ClientFlag({ VITE_FEATURE_V2_AFFAIRES: 'Yes' })).toBe(true);
  });

  it('false pour 0 / off / no / autre / undefined', () => {
    expect(readAffairesV2ClientFlag({ VITE_FEATURE_V2_AFFAIRES: '0' })).toBe(false);
    expect(readAffairesV2ClientFlag({ VITE_FEATURE_V2_AFFAIRES: 'off' })).toBe(false);
    expect(readAffairesV2ClientFlag({ VITE_FEATURE_V2_AFFAIRES: 'no' })).toBe(false);
    expect(readAffairesV2ClientFlag({ VITE_FEATURE_V2_AFFAIRES: '' })).toBe(false);
    expect(readAffairesV2ClientFlag({})).toBe(false);
    expect(readAffairesV2ClientFlag()).toBe(false);
  });
});
