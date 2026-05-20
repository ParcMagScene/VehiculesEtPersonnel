// ═══════════════════════════════════════════════════════════════
// apps/web/src/utils/magNumber.js
//
// Pendant frontend de apps/api/services/magNumber.js.
// Gardé en duplicate volontaire : le bundle Vite n'importe pas de
// fichiers backend (chemins, runtime). Toute modification doit être
// répercutée des deux côtés (cf. tests/locmat-import.test.js).
//
// Règles : un numéro MAG est de la forme LETTRES + CHIFFRES (ex VX1, E09)
// et est TOUJOURS séparé du numéro de série par " - " (au moins un espace
// de chaque côté du tiret). Sans espaces ⇒ pas un MAG.
// ═══════════════════════════════════════════════════════════════

export const MAG_NUMBER_RE = /^[A-Z]{1,3}[0-9]{1,4}$/;
export const MAG_SEPARATOR_RE = /\s+-\s+/;

export function normalizeMagNumber(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (s === '') return null;
  return MAG_NUMBER_RE.test(s) ? s : null;
}

export function isMagNumber(raw) {
  return normalizeMagNumber(raw) !== null;
}

export function parseMagSerial(rawSerial) {
  const raw = String(rawSerial == null ? '' : rawSerial).trim();
  if (!raw) return { coreSerial: '', magNumber: null };
  const parts = raw.split(MAG_SEPARATOR_RE);
  if (parts.length !== 2) return { coreSerial: raw, magNumber: null };
  const a = parts[0].trim();
  const b = parts[1].trim();
  const aMag = normalizeMagNumber(a);
  const bMag = normalizeMagNumber(b);
  if (aMag && !bMag) return { coreSerial: b, magNumber: aMag };
  if (bMag && !aMag) return { coreSerial: a, magNumber: bMag };
  return { coreSerial: raw, magNumber: null };
}
