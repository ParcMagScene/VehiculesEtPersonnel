import xssFilter from 'xss';

const xssOptions = { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] };

// Champs exemptés de la sanitization (base64, mots de passe)
const EXEMPT_FIELDS = [
  'signature', 'signatureAdmin', 'signatureEmployee',
  'signature_admin', 'signature_employee',
  'password', 'newPassword', 'currentPassword'
];

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
      if (!EXEMPT_FIELDS.includes(key)) {
        req.body[key] = sanitizeValue(value);
      }
    }
  }
  next();
}
