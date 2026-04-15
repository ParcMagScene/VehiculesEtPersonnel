// Helpers de réponse API unifiée
// Format standard : { success: bool, data?, error?, code? }

/**
 * Réponse succès — { success: true, data }
 * @param {import('express').Response} res
 * @param {*} data — payload (objet, tableau, ou valeur simple)
 * @param {number} [status=200]
 */
export function apiSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

/**
 * Réponse erreur — { success: false, error, code? }
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [status=400]
 * @param {string} [code]
 */
export function apiError(res, message, status = 400, code) {
  const body = { success: false, error: message };
  if (code) body.code = code;
  return res.status(status).json(body);
}
