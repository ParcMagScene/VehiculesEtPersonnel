import { fileTypeFromFile } from 'file-type';
import fs from 'fs';

import logger from '../logger.js';

/**
 * Middleware post-multer : vérifie les magic bytes du fichier uploadé.
 * Supprime le fichier et renvoie 400 si le contenu ne correspond pas aux MIME autorisés.
 *
 * @param {string[]} allowedMimes - Liste des MIME types autorisés (ex: ['image/jpeg', 'image/png'])
 */
export function validateFileType(allowedMimes) {
  return async (req, res, next) => {
    // Si pas de fichier (multer n'a rien accepté), laisser la route gérer
    if (!req.file) return next();

    try {
      const result = await fileTypeFromFile(req.file.path);

      if (!result) {
        // Pas de magic bytes détectés — autoriser les formats texte (CSV, TXT, PDF text-based)
        // Les PDF sont généralement détectés, mais en cas de doute on vérifie l'extension
        const ext = req.file.originalname?.toLowerCase() || '';
        if (ext.endsWith('.csv') || ext.endsWith('.txt')) {
          return next();
        }
        fs.unlinkSync(req.file.path);
        logger.warn(`[SEC] Upload rejeté (magic bytes inconnus): ${req.file.originalname}`);
        return res.status(400).json({ error: 'Type de fichier non reconnu' });
      }

      if (!allowedMimes.includes(result.mime)) {
        fs.unlinkSync(req.file.path);
        logger.warn(
          `[SEC] Upload rejeté (MIME réel: ${result.mime}, déclaré: ${req.file.mimetype}): ${req.file.originalname}`,
        );
        return res
          .status(400)
          .json({ error: `Type de fichier non autorisé (détecté : ${result.mime})` });
      }

      // Stocker le MIME réel pour usage éventuel
      req.file.detectedMime = result.mime;
      next();
    } catch (err) {
      logger.error('[SEC] Erreur validation magic bytes:', err);
      // En cas d'erreur de lecture, supprimer le fichier par sécurité
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Erreur validation fichier' });
    }
  };
}

/**
 * Version pour multer.array() — vérifie chaque fichier du tableau req.files
 */
export function validateFileTypes(allowedMimes) {
  return async (req, res, next) => {
    if (!req.files || req.files.length === 0) return next();

    try {
      for (const file of req.files) {
        const result = await fileTypeFromFile(file.path);

        if (!result) {
          const ext = file.originalname?.toLowerCase() || '';
          if (ext.endsWith('.csv') || ext.endsWith('.txt')) continue;
          // Supprimer tous les fichiers uploadés
          for (const f of req.files) {
            if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
          }
          logger.warn(`[SEC] Upload batch rejeté (magic bytes inconnus): ${file.originalname}`);
          return res
            .status(400)
            .json({ error: `Type de fichier non reconnu : ${file.originalname}` });
        }

        if (!allowedMimes.includes(result.mime)) {
          for (const f of req.files) {
            if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
          }
          logger.warn(
            `[SEC] Upload batch rejeté (MIME réel: ${result.mime}): ${file.originalname}`,
          );
          return res.status(400).json({
            error: `Type non autorisé pour ${file.originalname} (détecté : ${result.mime})`,
          });
        }

        file.detectedMime = result.mime;
      }
      next();
    } catch (err) {
      logger.error('[SEC] Erreur validation magic bytes batch:', err);
      if (req.files) {
        for (const f of req.files) {
          if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
        }
      }
      res.status(500).json({ error: 'Erreur validation fichiers' });
    }
  };
}
