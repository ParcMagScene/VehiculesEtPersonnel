import { MAG_SCENE } from './map-utils';

const STORAGE_KEY = 'emag.locations.mapViewState.v1';

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeCenter(center, fallback) {
  if (!Array.isArray(center) || center.length !== 2) return fallback;
  const lat = Number(center[0]);
  const lng = Number(center[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fallback;
  return [lat, lng];
}

function sanitizeView(view) {
  if (!view || typeof view !== 'object') return null;
  const center = sanitizeCenter(view.center, null);
  const zoom = Number(view.zoom);
  if (!center || !Number.isFinite(zoom)) return null;
  return { center, zoom };
}

function sanitizeRadius(radius, fallback) {
  const value = Number(radius);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(500, Math.min(100000, Math.round(value)));
}

export function getDefaultMapViewState() {
  return {
    generalView: null,
    localView: null,
    printGeneralView: null,
    printLocalView: null,
    localZone: {
      center: [...MAG_SCENE],
      radius: 5000,
    },
  };
}

export function loadMapViewState() {
  const defaults = getDefaultMapViewState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const zone = parsed?.localZone || {};

    return {
      generalView: sanitizeView(parsed?.generalView),
      localView: sanitizeView(parsed?.localView),
      printGeneralView: sanitizeView(parsed?.printGeneralView),
      printLocalView: sanitizeView(parsed?.printLocalView),
      localZone: {
        center: sanitizeCenter(zone.center, defaults.localZone.center),
        radius: sanitizeRadius(zone.radius, defaults.localZone.radius),
      },
    };
  } catch {
    return defaults;
  }
}

export function saveMapViewState(state) {
  if (!state || typeof state !== 'object') return;

  const payload = {
    generalView: sanitizeView(state.generalView),
    localView: sanitizeView(state.localView),
    printGeneralView: sanitizeView(state.printGeneralView),
    printLocalView: sanitizeView(state.printLocalView),
    localZone: {
      center: sanitizeCenter(state.localZone?.center, MAG_SCENE),
      radius: sanitizeRadius(state.localZone?.radius, 5000),
    },
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore persistence errors (private mode, quota exceeded, etc.)
  }
}

export function normalizeViewForStorage(view) {
  const center = sanitizeCenter(view?.center, null);
  const zoom = Number(view?.zoom);
  if (!center || !isFiniteNumber(zoom)) return null;

  return {
    center: [Number(center[0].toFixed(6)), Number(center[1].toFixed(6))],
    zoom: Number(zoom.toFixed(2)),
  };
}
