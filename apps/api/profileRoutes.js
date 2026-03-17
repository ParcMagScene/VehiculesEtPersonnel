import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import db from './database.js';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupProfileRoutes(app, authenticateToken, requireAdmin) {

// Multer pour upload d'avatars
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '..', '..', 'public', 'avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const userId = req.params.id || req.user.id;
    cb(null, `avatar-${userId}${ext}`);
  }
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont acceptées'));
    }
  }
});

// Mettre à jour son propre profil (nom)
app.patch('/api/users/me', authenticateToken, (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est requis' });
    }
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), req.user.id);
    const updated = db.prepare('SELECT id, email, name, is_admin, avatar FROM users WHERE id = ?').get(req.user.id);
    const user = { id: updated.id, email: updated.email, name: updated.name, isAdmin: updated.is_admin === 1, avatar: updated.avatar || null };
    res.json({ success: true, user });
  } catch (error) {
    logger.error('Erreur mise à jour profil:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload d'avatar
app.post('/api/users/me/avatar', authenticateToken, uploadAvatar.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier envoyé' });
    }
    const avatarUrl = `/avatars/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.user.id);
    const updated = db.prepare('SELECT id, email, name, is_admin, avatar FROM users WHERE id = ?').get(req.user.id);
    const user = { id: updated.id, email: updated.email, name: updated.name, isAdmin: updated.is_admin === 1, avatar: updated.avatar || null };
    logger.info(`📷 Avatar mis à jour pour ${updated.name}: ${avatarUrl}`);
    res.json({ success: true, user, avatarUrl });
  } catch (error) {
    logger.error('Erreur upload avatar:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer son avatar
app.delete('/api/users/me/avatar', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.user.id);
    if (user?.avatar) {
      const filePath = path.join(__dirname, '..', '..', 'public', user.avatar);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(req.user.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur suppression avatar:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir ses préférences utilisateur
app.get('/api/users/me/preferences', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT preferences FROM users WHERE id = ?').get(req.user.id);
    const prefs = user?.preferences ? JSON.parse(user.preferences) : {};
    res.json(prefs);
  } catch (error) {
    logger.error('Erreur récupération préférences:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour ses préférences utilisateur
app.put('/api/users/me/preferences', authenticateToken, (req, res) => {
  try {
    const prefs = JSON.stringify(req.body || {});
    db.prepare('UPDATE users SET preferences = ? WHERE id = ?').run(prefs, req.user.id);
    res.json(req.body);
  } catch (error) {
    logger.error('Erreur sauvegarde préférences:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============ ADMIN: MODIFIER LE PROFIL D'UN UTILISATEUR ============

// Mettre à jour le nom d'un utilisateur (admin)
app.patch('/api/users/:id/profile', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est requis' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), id);
    const updated = db.prepare('SELECT id, email, name, is_admin, avatar FROM users WHERE id = ?').get(id);
    const user = { id: updated.id, email: updated.email, name: updated.name, isAdmin: updated.is_admin === 1, avatar: updated.avatar || null };
    logger.info(`✏️ Admin ${req.user.id} a modifié le nom de user ${id} → ${name.trim()}`);
    res.json({ success: true, user });
  } catch (error) {
    logger.error('Erreur mise à jour profil utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload d'avatar pour un utilisateur (admin)
app.post('/api/users/:id/avatar', authenticateToken, requireAdmin, uploadAvatar.single('avatar'), (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier envoyé' });

    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const avatarUrl = `/avatars/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, id);
    const updated = db.prepare('SELECT id, email, name, is_admin, avatar FROM users WHERE id = ?').get(id);
    const user = { id: updated.id, email: updated.email, name: updated.name, isAdmin: updated.is_admin === 1, avatar: updated.avatar || null };
    logger.info(`📷 Admin ${req.user.id} a modifié l'avatar de user ${id}: ${avatarUrl}`);
    res.json({ success: true, user, avatarUrl });
  } catch (error) {
    logger.error('Erreur upload avatar utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer l'avatar d'un utilisateur (admin)
app.delete('/api/users/:id/avatar', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const target = db.prepare('SELECT avatar FROM users WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    if (target.avatar) {
      const filePath = path.join(__dirname, '..', '..', 'public', target.avatar);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(id);
    logger.info(`🗑️ Admin ${req.user.id} a supprimé l'avatar de user ${id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur suppression avatar utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

} // end setupProfileRoutes
