// Middleware centralisé de gestion d'erreurs Express
// Usage : throw dans un handler ou next(error) pour déléguer ici
import logger from '../logger.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(err, req, res, _next) {
  // Erreur métier (AppError)
  if (err instanceof AppError) {
    logger.warn(`[${err.code}] ${req.method} ${req.originalUrl}: ${err.message}`);
    const payload = { success: false, error: err.message, code: err.code };
    if (err.details) payload.details = err.details;
    return res.status(err.statusCode).json(payload);
  }

  // Erreur SQLite (better-sqlite3)
  if (err.code && err.code.startsWith('SQLITE_')) {
    logger.error(`[DB] ${req.method} ${req.originalUrl}: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Erreur base de données' });
  }

  // Erreur inattendue
  logger.error(`[UNHANDLED] ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ success: false, error: 'Erreur serveur interne' });
}
