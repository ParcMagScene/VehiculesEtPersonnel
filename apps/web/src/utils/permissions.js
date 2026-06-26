export const PERMISSION_KEYS = {
  readOnly: ['readOnly', 'read_only'],
  canManageVehicleMaintenance: [
    'canManageVehicleMaintenance',
    'can_manage_vehicle_maintenance',
    'canManageMaintenance',
    'can_manage_maintenance',
  ],
  canManageEquipmentMaintenance: [
    'canManageEquipmentMaintenance',
    'can_manage_equipment_maintenance',
  ],
  canManageCatalog: ['canManageCatalog', 'can_manage_catalog'],
  canManageTrucks: ['canManageTrucks', 'can_manage_trucks'],
};

export function userIsAdmin(user) {
  return user?.isAdmin === true;
}

export function hasPermissionFlag(permissions, permissionName) {
  const perms = permissions || {};
  const keys = PERMISSION_KEYS[permissionName] || [permissionName];
  return keys.some((key) => perms?.[key] === true);
}

export function setPermissionFlag(permissions, permissionName, value) {
  const keys = PERMISSION_KEYS[permissionName] || [permissionName];
  const next = { ...(permissions || {}) };
  for (const key of keys) next[key] = value;
  return next;
}

export function userHasPermission(user, permissionName, { adminBypass = true } = {}) {
  if (adminBypass && userIsAdmin(user)) return true;
  return hasPermissionFlag(user?.permissions, permissionName);
}

export function userIsReadOnly(user) {
  return userHasPermission(user, 'readOnly', { adminBypass: false });
}
