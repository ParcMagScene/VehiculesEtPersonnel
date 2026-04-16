import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

import logger from './logger.js';
import { validateFileType } from './middleware/validateFileType.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const attachmentsPath = path.join(__dirname, '..', '..', 'public', 'attachments');

// ── Helpers sécurité ──
function sanitizePath(basePath, relativePath) {
  const normalizedBase = path.resolve(basePath);
  const resolved = path.resolve(basePath, relativePath);
  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) return null;
  return resolved;
}

function sanitizeFilename(name) {
  // Supprimer les séquences de path traversal et les caractères dangereux
  return name
    .replace(/\.\.[/\\]/g, '')
    .replace(/[/\\]/g, '')
    .replace(/[<>:"|?*\x00-\x1f]/g, '_') // eslint-disable-line no-control-regex
    .substring(0, 255);
}

function isValidAffaireId(id) {
  return /^[a-zA-Z0-9À-ÿ\s\-_().]+$/.test(id);
}

// ── Multer configs ──
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', '..', 'public', 'attachments', 'TEMP');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  // [AUDIT FIX H2] Limite de taille pour les uploads BL
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés'));
    }
  },
});

const uploadAttachment = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedMimes = [
      'application/pdf',
      // [AUDIT FIX] SVG retiré — vecteur XSS potentiel (scripts embarqués)
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'audio/mpeg',
      'audio/wav',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non autorisé : ${file.mimetype}`));
    }
  },
});

export function setupAttachmentsRoutes(app, authenticateToken, requireAdmin) {
  // Créer un dossier (sécurisé)
  app.post('/api/create-folder', authenticateToken, (req, res) => {
    try {
      const { path: folderPath } = req.body;
      if (!folderPath) {
        return res.status(400).json({ success: false, error: 'Chemin du dossier manquant' });
      }
      const safePath = sanitizePath(attachmentsPath, folderPath.replace(attachmentsPath, ''));
      if (!safePath) {
        return res.status(403).json({ success: false, error: 'Chemin non autorisé' });
      }
      fs.mkdirSync(safePath, { recursive: true });
      res.json({ success: true, path: safePath });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Upload d'un BL (sécurisé)
  // [AUDIT FIX C1] Validation magic bytes PDF
  app.post(
    '/api/upload-bl',
    authenticateToken,
    upload.single('pdf'),
    validateFileType(['application/pdf']),
    (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
        }
        if (!req.body.affaireId) {
          return res.status(400).json({ success: false, error: 'affaireId requis' });
        }
        if (!isValidAffaireId(req.body.affaireId)) {
          return res.status(400).json({ success: false, error: "Identifiant d'affaire invalide" });
        }
        const affaireDir = sanitizePath(attachmentsPath, req.body.affaireId);
        if (!affaireDir) {
          return res.status(403).json({ success: false, error: 'Chemin non autorisé' });
        }
        if (!fs.existsSync(affaireDir)) {
          fs.mkdirSync(affaireDir, { recursive: true });
        }
        const originalName = sanitizeFilename(req.file.originalname.replace(/^\d+-/, ''));
        if (!originalName) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ success: false, error: 'Nom de fichier invalide' });
        }
        const finalPath = path.join(affaireDir, originalName);
        fs.renameSync(req.file.path, finalPath);
        const relativePath = path.join('attachments', req.body.affaireId, originalName);
        res.json({ success: true, path: relativePath, filename: originalName });
      } catch (error) {
        logger.error('❌ Erreur upload BL:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // Upload de pièces jointes génériques (sécurisé)
  app.post('/api/upload-attachment', authenticateToken, (req, res) => {
    uploadAttachment.single('file')(req, res, function (err) {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      try {
        if (!req.file) {
          return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
        }
        if (!req.body.affaireId) {
          return res.status(400).json({ success: false, error: 'affaireId requis' });
        }
        if (!isValidAffaireId(req.body.affaireId)) {
          return res.status(400).json({ success: false, error: "Identifiant d'affaire invalide" });
        }
        const affaireDir = sanitizePath(attachmentsPath, req.body.affaireId);
        if (!affaireDir) {
          return res.status(403).json({ success: false, error: 'Chemin non autorisé' });
        }
        if (!fs.existsSync(affaireDir)) {
          fs.mkdirSync(affaireDir, { recursive: true });
        }
        const originalName = sanitizeFilename(req.file.originalname.replace(/^\d+-/, ''));
        if (!originalName) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ success: false, error: 'Nom de fichier invalide' });
        }
        const finalPath = path.join(affaireDir, originalName);
        fs.renameSync(req.file.path, finalPath);
        const relativePath = path.join('attachments', req.body.affaireId, originalName);
        res.json({
          success: true,
          path: relativePath,
          filename: originalName,
          url: `/attachments/${req.body.affaireId}/${originalName}`,
        });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    });
  });

  // Lister les fichiers d'une affaire (sécurisé)
  app.get('/api/attachments/:affaireId', authenticateToken, (req, res) => {
    try {
      const affaireId = req.params.affaireId;
      if (!isValidAffaireId(affaireId)) {
        return res.status(400).json({ success: false, error: "Identifiant d'affaire invalide" });
      }
      const dirPath = sanitizePath(attachmentsPath, affaireId);
      if (!dirPath) {
        return res.status(403).json({ success: false, error: 'Chemin non autorisé' });
      }
      if (!fs.existsSync(dirPath)) {
        return res.json({ files: [] });
      }
      const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      };
      const files = fs
        .readdirSync(dirPath)
        .filter((file) => !file.startsWith('.'))
        .map((file) => {
          const filePath = path.join(dirPath, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: formatSize(stats.size),
            sizeBytes: stats.size,
            url: `/attachments/${affaireId}/${file}`,
            createdAt: stats.birthtime,
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      res.json({ files });
    } catch (error) {
      logger.error('Erreur liste fichiers:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Lister les affaires ayant des pièces jointes (sécurisé)
  app.get('/api/attachments-index', authenticateToken, (req, res) => {
    try {
      const attachDir = path.join(__dirname, '..', '..', 'public', 'attachments');
      if (!fs.existsSync(attachDir)) {
        return res.json({ affaires: [], counts: {} });
      }
      const affaires = [];
      const counts = {};
      fs.readdirSync(attachDir).forEach((name) => {
        if (name.startsWith('.') || name === 'TEMP') return;
        const subDir = path.join(attachDir, name);
        if (!fs.statSync(subDir).isDirectory()) return;
        const files = fs.readdirSync(subDir).filter((f) => !f.startsWith('.'));
        if (files.length > 0) {
          affaires.push(name);
          counts[name] = files.length;
        }
      });
      res.json({ affaires, counts });
    } catch (error) {
      logger.error('Erreur attachments-index:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Supprimer une pièce jointe (sécurisé)
  app.delete(
    '/api/attachments/:affaireId/:filename',
    authenticateToken,
    requireAdmin,
    (req, res) => {
      try {
        const { affaireId, filename } = req.params;
        if (!isValidAffaireId(affaireId)) {
          return res.status(400).json({ success: false, error: "Identifiant d'affaire invalide" });
        }
        const safePath = sanitizePath(attachmentsPath, path.join(affaireId, filename));
        if (!safePath) {
          return res.status(403).json({ success: false, error: 'Chemin non autorisé' });
        }
        if (!fs.existsSync(safePath)) {
          return res.status(404).json({ success: false, error: 'Fichier non trouvé' });
        }
        fs.unlinkSync(safePath);
        res.json({ success: true, message: `${filename} supprimé` });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );
} // end setupAttachmentsRoutes
