import { GENERIC_IMAGES } from '../../utils/genericImages';

/**
 * Transforme une URL `/Photos/...` en URL de vignette WebP via l'endpoint
 * backend `/api/photos/thumb`. Sizes autorisées : 60, 80, 120, 160, 240.
 * Retourne l'URL d'origine si elle ne pointe pas vers /Photos/.
 */
export const toThumbUrl = (src, size = 80) => {
  if (!src || typeof src !== 'string') return src;
  if (!src.startsWith('/Photos/')) return src;
  const rel = src.slice('/Photos/'.length);
  return `/api/photos/thumb?p=${encodeURIComponent(rel)}&size=${size}`;
};

// Recherche flexible de zone : exact → codes → préfixe (ex: "G" → "G1", "A3" → "A1")
export const findZone = (zoneList, zid) => {
  if (!zoneList || !zid) return null;
  const exact = zoneList.find((z) => z.id === zid || z.codes?.includes(zid));
  if (exact) return exact;
  const upper = zid.toUpperCase();
  return (
    zoneList.find(
      (z) => z.id.toUpperCase().startsWith(upper) || upper.startsWith(z.id.toUpperCase()),
    ) || null
  );
};

export const normalizeStr = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const tokenize = (s) =>
  (s || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);

export const matchPhotoToEquipment = (photos, eq) => {
  // Priorité 0 : image générique manuellement choisie (format "generic:group/key")
  if (eq.photo && eq.photo.startsWith('generic:')) {
    const [groupKey, key] = eq.photo.slice(8).split('/');
    return GENERIC_IMAGES[groupKey]?.[key] || null;
  }
  if (!photos || photos.length === 0) return null;
  // Priorité : photo manuellement associée en DB
  if (eq.photo) {
    if (photos.includes(eq.photo)) return `/Photos/Matériel/${eq.photo}`;
  }
  const ref = normalizeStr(eq.reference);
  const name = normalizeStr(eq.name);
  const refTokens = tokenize(eq.reference);
  const nameTokens = tokenize(eq.name);
  // Pré-calculer les noms de fichiers normalisés
  const photoEntries = photos.map((p) => ({
    file: p,
    norm: normalizeStr(p.replace(/\.[^.]+$/, '')),
  }));
  // 1) Match exact sur référence
  for (const { file, norm } of photoEntries) {
    if (ref && norm === ref) return `/Photos/Matériel/${file}`;
  }
  // 2) La référence est contenue dans le nom du fichier ou inversement
  for (const { file, norm } of photoEntries) {
    if (ref && ref.length > 2 && (norm.includes(ref) || ref.includes(norm)))
      return `/Photos/Matériel/${file}`;
  }
  // 3) Match par tokens de la référence (ex: "8XT" dans "8XT-L-ACOUSTICS.jpg")
  for (const { file, norm } of photoEntries) {
    for (const token of refTokens) {
      if (token.length > 2 && norm.includes(token)) return `/Photos/Matériel/${file}`;
    }
  }
  // 4) Match sur le nom de l'équipement
  for (const { file, norm } of photoEntries) {
    if (name && norm.length > 3 && (norm.includes(name) || name.includes(norm)))
      return `/Photos/Matériel/${file}`;
  }
  // 5) Match par tokens significatifs du nom (longueur >= 4 pour éviter faux positifs)
  for (const { file, norm } of photoEntries) {
    for (const token of nameTokens) {
      if (token.length >= 4 && norm.includes(token)) return `/Photos/Matériel/${file}`;
    }
  }
  return null;
};

export const matchLogoToBrand = (logos, brand) => {
  if (!logos || !brand || logos.length === 0) return null;
  const b = normalizeStr(brand);
  if (!b) return null;
  for (const l of logos) {
    const ln = normalizeStr(l.replace(/\.[^.]+$/, ''));
    if (ln.includes(b) || b.includes(ln)) return `/Logos/${l}`;
  }
  return null;
};

export const getCategoryHierarchy = (eq, categories) => {
  if (!eq || !categories || categories.length === 0) return null;
  const catId = eq.categoryId || eq.category_id;
  if (!catId) return null;
  const cat = categories.find((c) => c.id === catId);
  if (!cat) return null;
  const result = { family: null, subfamily: null, category: null };
  if (cat.level === 'family') {
    result.family = cat;
  } else if (cat.level === 'subfamily') {
    result.subfamily = cat;
    result.family = categories.find((c) => c.id === (cat.parentId || cat.parent_id));
  } else if (cat.level === 'category') {
    result.category = cat;
    const sub = categories.find((c) => c.id === (cat.parentId || cat.parent_id));
    if (sub) {
      result.subfamily = sub;
      result.family = categories.find((c) => c.id === (sub.parentId || sub.parent_id));
    }
  }
  return result;
};
