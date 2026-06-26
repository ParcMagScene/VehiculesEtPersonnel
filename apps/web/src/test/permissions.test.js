import { describe, expect, it } from 'vitest';

import {
  hasPermissionFlag,
  setPermissionFlag,
  userHasPermission,
  userIsAdmin,
  userIsReadOnly,
} from '../utils/permissions.js';

describe('permissions helpers', () => {
  it('userIsAdmin retourne true uniquement pour isAdmin=true', () => {
    expect(userIsAdmin({ isAdmin: true })).toBe(true);
    expect(userIsAdmin({ isAdmin: false })).toBe(false);
    expect(userIsAdmin(null)).toBe(false);
  });

  it('userHasPermission accepte les clés snake_case et camelCase', () => {
    const userSnake = { permissions: { can_manage_equipment_maintenance: true } };
    const userCamel = { permissions: { canManageEquipmentMaintenance: true } };

    expect(userHasPermission(userSnake, 'canManageEquipmentMaintenance')).toBe(true);
    expect(userHasPermission(userCamel, 'canManageEquipmentMaintenance')).toBe(true);
  });

  it('userHasPermission accepte les clés legacy canManageMaintenance', () => {
    const legacyUser = { permissions: { canManageMaintenance: true } };

    expect(userHasPermission(legacyUser, 'canManageVehicleMaintenance')).toBe(true);
  });

  it('userHasPermission applique le bypass admin par défaut', () => {
    const adminWithoutPermission = { isAdmin: true, permissions: {} };

    expect(userHasPermission(adminWithoutPermission, 'canManageCatalog')).toBe(true);
    expect(
      userHasPermission(adminWithoutPermission, 'canManageCatalog', { adminBypass: false }),
    ).toBe(false);
  });

  it('userIsReadOnly ne bypass pas admin et lit les deux formats de clés', () => {
    const adminReadOnlySnake = { isAdmin: true, permissions: { read_only: true } };
    const adminReadOnlyCamel = { isAdmin: true, permissions: { readOnly: true } };
    const adminNotReadOnly = { isAdmin: true, permissions: {} };

    expect(userIsReadOnly(adminReadOnlySnake)).toBe(true);
    expect(userIsReadOnly(adminReadOnlyCamel)).toBe(true);
    expect(userIsReadOnly(adminNotReadOnly)).toBe(false);
  });

  it('hasPermissionFlag lit les aliases sur un objet permissions brut', () => {
    const permissions = { can_manage_catalog: true };

    expect(hasPermissionFlag(permissions, 'canManageCatalog')).toBe(true);
  });

  it('setPermissionFlag met à jour toutes les variantes d’alias', () => {
    const permissions = {
      canManageEquipmentMaintenance: false,
      can_manage_equipment_maintenance: false,
    };

    const next = setPermissionFlag(permissions, 'canManageEquipmentMaintenance', true);

    expect(next.canManageEquipmentMaintenance).toBe(true);
    expect(next.can_manage_equipment_maintenance).toBe(true);
  });
});
