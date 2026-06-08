// ═══════════════════════════════════════════════════════════════
// map-label-placement.js — Placement adaptatif des bulles de noms
// Essaie plusieurs directions et offsets avant de masquer un label,
// pour qu'un maximum de lieux restent étiquetés sans chevauchement.
// ═══════════════════════════════════════════════════════════════

const DIRECTIONS = ['top', 'right', 'bottom', 'left'];

const baseOffsetFor = (dir) => {
  switch (dir) {
    case 'top':
      return [0, -12];
    case 'right':
      return [12, 0];
    case 'bottom':
      return [0, 12];
    case 'left':
      return [-12, 0];
    default:
      return [0, -12];
  }
};

const grownOffset = (dir, extra) => {
  switch (dir) {
    case 'top':
      return [0, -(12 + extra)];
    case 'right':
      return [12 + extra, 0];
    case 'bottom':
      return [0, 12 + extra];
    case 'left':
      return [-(12 + extra), 0];
    default:
      return [0, -(12 + extra)];
  }
};

const labelBoxFor = (loc) => {
  const width = Math.min(260, Math.max(88, (loc.name?.length || 0) * 8 + 24));
  return { width, height: 28 };
};

const placeBox = (pt, dir, offset, dims) => {
  const [ox, oy] = offset;
  if (dir === 'top') {
    return {
      x: pt.x + ox - dims.width / 2,
      y: pt.y + oy - dims.height,
      w: dims.width,
      h: dims.height,
    };
  }
  if (dir === 'bottom') {
    return {
      x: pt.x + ox - dims.width / 2,
      y: pt.y + oy,
      w: dims.width,
      h: dims.height,
    };
  }
  if (dir === 'right') {
    return {
      x: pt.x + ox,
      y: pt.y + oy - dims.height / 2,
      w: dims.width,
      h: dims.height,
    };
  }
  // left
  return {
    x: pt.x + ox - dims.width,
    y: pt.y + oy - dims.height / 2,
    w: dims.width,
    h: dims.height,
  };
};

const intersects = (a, b) =>
  !(a.x + a.w + 4 < b.x || b.x + b.w + 4 < a.x || a.y + a.h + 2 < b.y || b.y + b.h + 2 < a.y);

const insideFrame = (box, size, inset = 0) =>
  box.x >= inset &&
  box.y >= inset &&
  box.x + box.w <= size.x - inset &&
  box.y + box.h <= size.y - inset;

/**
 * Calcule, pour chaque marker visible dans la vue, la meilleure direction
 * et offset pour son label sans chevaucher les autres.
 *
 * @param {Object} args
 * @param {import('leaflet').Map} args.map
 * @param {Array<{id: any, name: string, lat: number, lng: number}>} args.locations
 * @param {Object<string,string>} [args.preferredDirections] - direction préférée par id de location
 * @param {number} [args.frameInset=0] - marge réservée le long des bords (pour les indicateurs offscreen)
 * @returns {Map<any, { dir: 'top'|'right'|'bottom'|'left', offset: [number,number] }>}
 */
export function computeLabelPlacements({
  map,
  locations,
  preferredDirections = {},
  frameInset = 0,
}) {
  const placements = new Map();
  if (!map || !Array.isArray(locations) || locations.length === 0) return placements;

  const bounds = map.getBounds();
  const size = map.getSize();
  const occupied = [];

  // Tri stable : descendants par latitude → labels du haut placés en premier
  const ordered = [...locations].sort((a, b) => b.lat - a.lat);

  for (const loc of ordered) {
    if (!bounds.contains([loc.lat, loc.lng])) continue;

    const pt = map.latLngToContainerPoint([loc.lat, loc.lng]);
    const dims = labelBoxFor(loc);
    const preferred = preferredDirections[loc.id] || 'top';

    // Ordre d'essai : préférée d'abord, puis les autres en sens horaire
    const startIdx = Math.max(0, DIRECTIONS.indexOf(preferred));
    const dirOrder = [
      DIRECTIONS[startIdx % 4],
      DIRECTIONS[(startIdx + 1) % 4],
      DIRECTIONS[(startIdx + 2) % 4],
      DIRECTIONS[(startIdx + 3) % 4],
    ];

    let placed = null;
    // Essayer chaque direction avec un offset croissant (12, +6, +14, +24)
    for (const extra of [0, 6, 14, 24]) {
      for (const dir of dirOrder) {
        const offset = extra === 0 ? baseOffsetFor(dir) : grownOffset(dir, extra);
        const box = placeBox(pt, dir, offset, dims);
        if (!insideFrame(box, size, frameInset)) continue;
        if (occupied.some((other) => intersects(box, other))) continue;
        placed = { dir, offset, box };
        break;
      }
      if (placed) break;
    }

    if (placed) {
      occupied.push(placed.box);
      placements.set(loc.id, { dir: placed.dir, offset: placed.offset });
    }
  }

  return placements;
}

export { DIRECTIONS as LABEL_DIRECTIONS };
