/**
 * Middleware d'authentification des écrans TV par token (header X-TV-Token)
 * Vérifie que le token correspond à un écran actif dans display_screens
 */
import db from '../database.js';

export function verifyTvToken(req, res, next) {
  const token = req.headers['x-tv-token'];
  if (!token || typeof token !== 'string' || token.length < 16) {
    return res.status(401).json({ error: 'Token TV manquant ou invalide' });
  }
  const screen = db.prepare('SELECT id FROM display_screens WHERE token = ? AND is_active = 1').get(token);
  if (!screen) {
    return res.status(403).json({ error: 'Token TV non reconnu' });
  }
  req.screenId = screen.id;
  next();
}

/**
 * Middleware TV optionnel : si un token est fourni il est validé,
 * sinon l'accès est autorisé sans authentification.
 * Utilisé pour les routes publiques du dashboard TV.
 */
export function optionalTvToken(req, _res, next) {
  const token = req.headers['x-tv-token'];
  if (token && typeof token === 'string' && token.length >= 16) {
    const screen = db.prepare('SELECT id FROM display_screens WHERE token = ? AND is_active = 1').get(token);
    if (screen) req.screenId = screen.id;
  }
  next();
}
