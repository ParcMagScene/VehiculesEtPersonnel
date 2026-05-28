import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Crée un storage Multer avec gestion automatique du dossier de destination
 * @param {string} subDir - Sous-dossier dans public/ (ex: 'bl-imports', 'attachments')
 * @param {string} prefix - Préfixe des noms de fichiers (ex: 'bl', 'attach')
 */
function createStorage(subDir, prefix) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(__dirname, '..', '..', '..', 'public', subDir);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${prefix}-${uniqueSuffix}${ext}`);
    },
  });
}

/**
 * Upload BL — pour l'import de bons de livraison (PDF, images)
 */
export const uploadBL = multer({
  storage: createStorage('bl-imports', 'bl'),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|jpg|jpeg|png|gif|webp|tiff?)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Type de fichier non supporté. Formats acceptés : PDF, JPG, PNG, GIF, WEBP, TIFF',
        ),
      );
    }
  },
});

/**
 * Upload média — pour le dashboard d'affichage (images, vidéos)
 */
const mediaDir = path.join(__dirname, '..', '..', '..', 'public', 'display-media');
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

export const uploadMedia = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, mediaDir),
    filename: (_req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
      cb(null, `display-${unique}-${safeName}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/ogg',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Type MIME non autorisé : ${file.mimetype}`));
    }
  },
});

/**
 * Upload attachments — pièces jointes génériques
 */
export const uploadAttachment = multer({
  storage: createStorage('attachments/TEMP', 'attach'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|jpg|jpeg|png|gif|webp|doc|docx|xls|xlsx|csv|txt)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté'));
    }
  },
});

/**
 * Upload messaging — fichiers dans les conversations
 */
export const uploadMessaging = multer({
  storage: createStorage('messaging-uploads', 'msg'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|jpg|jpeg|png|gif|webp|doc|docx|xls|xlsx|csv|txt|mp4|mp3|zip)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté pour la messagerie'));
    }
  },
});

export { createStorage };

/**
 * Upload PV — Procès-Verbaux de contrôle (PDF uniquement)
 * Stockés dans public/pv/ et servis derrière authenticateToken.
 */
export const uploadPv = multer({
  storage: createStorage('pv', 'pv'),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
  fileFilter: (_req, file, cb) => {
    const isPdfExt = /\.pdf$/i.test(path.extname(file.originalname));
    const isPdfMime = file.mimetype === 'application/pdf';
    if (isPdfExt && isPdfMime) cb(null, true);
    else cb(new Error('Seuls les fichiers PDF sont acceptés pour les PV'));
  },
});
