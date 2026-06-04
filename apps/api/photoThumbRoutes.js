// Génère des vignettes WebP à la volée pour /public/Photos/.
// Cache disque dans /public/Photos/.thumbs/{size}/<path>.webp (idempotent).
// Endpoint public (les photos sources le sont déjà via Caddy/static).
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PHOTOS_ROOT = path.resolve(__dirname, '..', '..', 'public', 'Photos');
const THUMBS_ROOT = path.join(PHOTOS_ROOT, '.thumbs');

// Liste blanche : évite la création d'un nombre arbitraire de variantes.
const ALLOWED_SIZES = new Set([60, 80, 120, 160, 240]);

// In-flight dedup : plusieurs requêtes simultanées sur la même vignette
// partagent la même génération.
const inFlight = new Map();

async function ensureThumb(srcPath, thumbFile, size) {
  if (inFlight.has(thumbFile)) return inFlight.get(thumbFile);
  const p = (async () => {
    await fs.promises.mkdir(path.dirname(thumbFile), { recursive: true });
    await sharp(srcPath)
      .rotate() // auto-orient depuis EXIF
      .resize(size, size, { fit: 'cover', withoutEnlargement: false })
      .webp({ quality: 75 })
      .toFile(thumbFile);
  })();
  inFlight.set(thumbFile, p);
  try {
    await p;
  } finally {
    inFlight.delete(thumbFile);
  }
}

export function setupPhotoThumbRoutes(app) {
  app.get('/api/photos/thumb', async (req, res) => {
    try {
      const size = Number(req.query.size) || 80;
      if (!ALLOWED_SIZES.has(size)) {
        return res.status(400).json({ error: 'size invalide (60/80/120/160/240)' });
      }
      const relPath = String(req.query.p || '');
      if (!relPath || relPath.includes('\0') || relPath.includes('..')) {
        return res.status(400).json({ error: 'chemin invalide' });
      }
      if (path.isAbsolute(relPath)) {
        return res.status(400).json({ error: 'chemin invalide' });
      }
      const srcPath = path.resolve(PHOTOS_ROOT, relPath);
      // Garde anti path-traversal : srcPath doit rester sous PHOTOS_ROOT.
      if (!srcPath.startsWith(PHOTOS_ROOT + path.sep)) {
        return res.status(400).json({ error: 'chemin hors racine' });
      }
      // Ne pas servir de vignettes pour les fichiers cachés / .thumbs.
      if (srcPath.includes(`${path.sep}.thumbs${path.sep}`)) {
        return res.status(400).json({ error: 'chemin invalide' });
      }
      if (!fs.existsSync(srcPath)) {
        return res.status(404).json({ error: 'photo introuvable' });
      }

      const thumbFile = path.join(THUMBS_ROOT, String(size), relPath + '.webp');

      res.set('Cache-Control', 'public, max-age=2592000, immutable');
      res.set('Content-Type', 'image/webp');

      if (!fs.existsSync(thumbFile)) {
        await ensureThumb(srcPath, thumbFile, size);
      }
      return res.sendFile(thumbFile);
    } catch (err) {
      logger.error('photo thumb error:', err?.message || err);
      return res.status(500).json({ error: 'erreur génération vignette' });
    }
  });
}

export default setupPhotoThumbRoutes;
