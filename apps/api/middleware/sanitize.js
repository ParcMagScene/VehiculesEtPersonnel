import xssFilter from 'xss';

const xssOptions = { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] };

// Champs exemptés de la sanitization (base64, mots de passe)
const EXEMPT_FIELDS = [
  'signature', 'signatureAdmin', 'signatureEmployee',
  'signature_admin', 'signature_employee',
  'password', 'newPassword', 'currentPassword'
];

// [SEC FIX] Champs signature doivent être du base64 valide (data URI PNG/JPEG)
const SIGNATURE_FIELDS = ['signature', 'signatureAdmin', 'signatureEmployee', 'signature_admin', 'signature_employee'];
const BASE64_DATA_URI = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
function isValidSignature(val) {
  if (typeof val !== 'string') return false;
  if (val.length === 0) return true; // vide = pas de signature
  return BASE64_DATA_URI.test(val);
}

function sanitizeValue(val) {
  if (typeof val === 'string') return xssFilter(val, xssOptions);
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val && typeof val === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(val)) clean[k] = sanitizeValue(v);
    return clean;
  }
  return val;
}

/**
 * Middleware global de sanitisation XSS sur les entrées texte
 */
export function xssSanitize(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (SIGNATURE_FIELDS.includes(key)) {
        // [SEC FIX] Valider que les signatures sont bien du base64 image
        if (value && !isValidSignature(value)) {
          req.body[key] = ''; // rejeter les signatures invalides
        }
      } else if (!EXEMPT_FIELDS.includes(key)) {
        req.body[key] = sanitizeValue(value);
      }
    }
  }
  next();
}
