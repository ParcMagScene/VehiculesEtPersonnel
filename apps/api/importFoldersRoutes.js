import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public');

const FOLDER_ROOTS = {
  affaires: [
    { label: 'Pièces jointes', path: 'attachments' },
    { label: 'BL importés', path: 'bl-imports' },
  ],
  catalogues: [{ label: 'Catalogues', path: 'catalogues' }],
  stocks: [{ label: 'Imports stocks', path: 'imports/stocks' }],
  sav: [{ label: 'Imports SAV', path: 'imports/sav' }],
  controles: [{ label: 'Rapports de contrôles', path: 'Rapports Contrôles' }],
  vehicules: [{ label: 'Contrôles véhicules', path: 'pv' }],
  personnel: [{ label: 'Imports personnel', path: 'imports/personnel' }],
  annuaire: [{ label: 'Imports annuaire', path: 'imports' }],
};

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function findConfiguredRoot(sectionId, relativePath) {
  if (!Object.hasOwn(FOLDER_ROOTS, sectionId)) return null;
  const roots = FOLDER_ROOTS[sectionId];

  const candidate = path.resolve(PUBLIC_DIR, relativePath);
  if (!isWithin(PUBLIC_DIR, candidate)) return null;

  return (
    roots.find(({ path: rootPath }) => {
      const root = path.resolve(PUBLIC_DIR, rootPath);
      return candidate === root || candidate.startsWith(`${root}${path.sep}`);
    }) || null
  );
}

async function listDirectory(sectionId, relativePath) {
  const rootEntry = findConfiguredRoot(sectionId, relativePath);
  if (!rootEntry) return null;

  const rootPath = path.resolve(PUBLIC_DIR, rootEntry.path);
  const directoryPath = path.resolve(PUBLIC_DIR, relativePath);

  try {
    const [realRoot, realDirectory] = await Promise.all([
      fs.realpath(rootPath),
      fs.realpath(directoryPath),
    ]);
    if (!isWithin(realRoot, realDirectory)) return null;

    const directoryEntries = await fs.readdir(realDirectory, { withFileTypes: true });
    const entries = directoryEntries
      .filter((entry) => entry.isDirectory() || entry.isFile())
      .map((entry) => {
        const entryPath = path.join(relativePath, entry.name);
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: entryPath.split(path.sep).join('/'),
        };
      })
      .sort((left, right) => {
        if (left.type !== right.type) return left.type === 'directory' ? -1 : 1;
        return left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' });
      });

    return { label: rootEntry.label, entries };
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return { label: rootEntry.label, entries: [] };
    }
    throw error;
  }
}

export function setupImportFoldersRoutes(app, authenticateToken) {
  app.get('/api/import-folders/:sectionId', authenticateToken, async (req, res) => {
    if (!Object.hasOwn(FOLDER_ROOTS, req.params.sectionId)) {
      return res.status(404).json({ success: false, error: 'Section inconnue' });
    }
    const roots = FOLDER_ROOTS[req.params.sectionId];

    const requestedPath = typeof req.query.path === 'string' ? req.query.path : '';
    try {
      if (!requestedPath) {
        const folders = roots.map((root) => ({
          name: root.label,
          type: 'directory',
          path: root.path,
        }));
        return res.json({ success: true, path: '', entries: folders });
      }

      const directory = await listDirectory(req.params.sectionId, requestedPath);
      if (!directory) return res.status(400).json({ success: false, error: 'Dossier invalide' });
      res.json({ success: true, path: requestedPath, ...directory });
    } catch (error) {
      logger.error('GET /api/import-folders error:', error);
      res.status(500).json({ success: false, error: 'Impossible de lire le dossier' });
    }
  });

  app.get('/api/import-folders/:sectionId/file', authenticateToken, async (req, res) => {
    const requestedPath = typeof req.query.path === 'string' ? req.query.path : '';
    const rootEntry = findConfiguredRoot(req.params.sectionId, requestedPath);
    if (!rootEntry) return res.status(400).json({ success: false, error: 'Fichier invalide' });

    try {
      const rootPath = await fs.realpath(path.resolve(PUBLIC_DIR, rootEntry.path));
      const filePath = await fs.realpath(path.resolve(PUBLIC_DIR, requestedPath));
      if (!isWithin(rootPath, filePath) || filePath === rootPath) {
        return res.status(400).json({ success: false, error: 'Fichier invalide' });
      }

      const stat = await fs.stat(filePath);
      if (!stat.isFile())
        return res.status(404).json({ success: false, error: 'Fichier introuvable' });

      res.set('Cache-Control', 'private, no-store');
      res.sendFile(filePath, (error) => {
        if (error) {
          logger.error('GET /api/import-folders file error:', error);
          if (!res.headersSent) {
            res
              .status(error.statusCode || 500)
              .json({ success: false, error: 'Impossible de lire le fichier' });
          }
        }
      });
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        return res.status(404).json({ success: false, error: 'Fichier introuvable' });
      }
      logger.error('GET /api/import-folders file error:', error);
      res.status(500).json({ success: false, error: 'Impossible de lire le fichier' });
    }
  });
}
