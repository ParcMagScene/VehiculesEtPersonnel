import db from './database.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dossier pour les fichiers de messagerie
const UPLOADS_DIR = join(__dirname, '..', 'public', 'messaging-uploads');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

export function setupMessagingRoutes(app, authenticateToken) {

  // ═══════════════════════════════════════
  // CONVERSATIONS
  // ═══════════════════════════════════════

  // GET /api/messaging/conversations — Liste des conversations de l'utilisateur
  app.get('/api/messaging/conversations', authenticateToken, (req, res) => {
    try {
      const conversations = db.prepare(`
        SELECT c.id, c.type, c.title, c.created_at, c.updated_at,
          cp.last_read_at,
          (SELECT COUNT(*) FROM messages m 
           WHERE m.conversation_id = c.id 
           AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
           AND m.sender_id != ?
          ) as unread_count,
          (SELECT m2.content FROM messages m2 
           WHERE m2.conversation_id = c.id 
           ORDER BY m2.created_at DESC LIMIT 1
          ) as last_message,
          (SELECT m3.created_at FROM messages m3 
           WHERE m3.conversation_id = c.id 
           ORDER BY m3.created_at DESC LIMIT 1
          ) as last_message_at,
          (SELECT u.name FROM messages m4 
           JOIN users u ON m4.sender_id = u.id
           WHERE m4.conversation_id = c.id 
           ORDER BY m4.created_at DESC LIMIT 1
          ) as last_message_sender
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE cp.user_id = ?
        ORDER BY COALESCE(
          (SELECT MAX(m5.created_at) FROM messages m5 WHERE m5.conversation_id = c.id),
          c.created_at
        ) DESC
      `).all(req.user.id, req.user.id);

      // Pour chaque conversation, récupérer les participants
      const participantsStmt = db.prepare(`
        SELECT u.id, u.name, u.email
        FROM conversation_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id = ?
      `);

      const result = conversations.map(conv => ({
        ...conv,
        participants: participantsStmt.all(conv.id),
      }));

      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // POST /api/messaging/conversations — Créer une conversation
  app.post('/api/messaging/conversations', authenticateToken, (req, res) => {
    try {
      const { type = 'direct', title, participantIds = [] } = req.body;

      // Pour les conversations directes, vérifier qu'il n'en existe pas déjà une
      if (type === 'direct' && participantIds.length === 1) {
        const existing = db.prepare(`
          SELECT c.id FROM conversations c
          JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = ?
          JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = ?
          WHERE c.type = 'direct'
        `).get(req.user.id, participantIds[0]);

        if (existing) {
          return res.json({ id: existing.id, existing: true });
        }
      }

      const result = db.prepare(
        'INSERT INTO conversations (type, title, created_by) VALUES (?, ?, ?)'
      ).run(type, title || null, req.user.id);

      const convId = result.lastInsertRowid;

      // Ajouter le créateur comme participant
      const addParticipant = db.prepare(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)'
      );
      addParticipant.run(convId, req.user.id);

      // Ajouter les autres participants
      for (const pid of participantIds) {
        if (pid !== req.user.id) {
          addParticipant.run(convId, pid);
        }
      }

      res.json({ id: convId, success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ═══════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════

  // GET /api/messaging/conversations/:id/messages — Messages d'une conversation
  app.get('/api/messaging/conversations/:id/messages', authenticateToken, (req, res) => {
    try {
      const convId = req.params.id;
      const limit = parseInt(req.query.limit) || 50;
      const before = req.query.before; // cursor-based pagination

      // Vérifier que l'utilisateur est participant
      const isParticipant = db.prepare(
        'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
      ).get(convId, req.user.id);

      if (!isParticipant) {
        return res.status(403).json({ error: 'Non autorisé' });
      }

      let query = `
        SELECT m.id, m.content, m.type, m.created_at, m.edited_at,
          m.sender_id, u.name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
      `;
      const params = [convId];

      if (before) {
        query += ' AND m.id < ?';
        params.push(before);
      }

      query += ' ORDER BY m.created_at DESC LIMIT ?';
      params.push(limit);

      const messages = db.prepare(query).all(...params);

      // Récupérer les pièces jointes pour chaque message de type file/image/video
      const attachStmt = db.prepare(
        'SELECT id, filename, original_name, mime_type, size FROM message_attachments WHERE message_id = ?'
      );

      const result = messages.map(m => ({
        ...m,
        attachments: m.type !== 'text' ? attachStmt.all(m.id) : [],
      })).reverse(); // Remettre dans l'ordre chronologique

      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // POST /api/messaging/conversations/:id/messages — Envoyer un message
  app.post('/api/messaging/conversations/:id/messages', authenticateToken, (req, res) => {
    try {
      const convId = req.params.id;
      const { content, type = 'text' } = req.body;

      // Vérifier que l'utilisateur est participant
      const isParticipant = db.prepare(
        'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
      ).get(convId, req.user.id);

      if (!isParticipant) {
        return res.status(403).json({ error: 'Non autorisé' });
      }

      const result = db.prepare(
        'INSERT INTO messages (conversation_id, sender_id, content, type) VALUES (?, ?, ?, ?)'
      ).run(convId, req.user.id, content, type);

      // Mettre à jour le timestamp de la conversation
      db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(convId);

      // Marquer comme lu pour l'expéditeur
      db.prepare(
        'UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?'
      ).run(convId, req.user.id);

      res.json({
        id: result.lastInsertRowid,
        conversation_id: parseInt(convId),
        sender_id: req.user.id,
        sender_name: req.user.name,
        content,
        type,
        created_at: new Date().toISOString(),
        attachments: [],
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // POST /api/messaging/conversations/:id/messages/file — Envoyer un fichier
  app.post('/api/messaging/conversations/:id/messages/file', authenticateToken, (req, res) => {
    try {
      const convId = req.params.id;

      // Vérifier participation
      const isParticipant = db.prepare(
        'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
      ).get(convId, req.user.id);

      if (!isParticipant) {
        return res.status(403).json({ error: 'Non autorisé' });
      }

      // Traiter le multipart form data (le fichier est dans req.body en base64 ou via multer)
      const { filename, data, mimeType } = req.body;
      if (!filename || !data) {
        return res.status(400).json({ error: 'Fichier manquant' });
      }

      // Déterminer le type de message
      let msgType = 'file';
      if (mimeType && mimeType.startsWith('image/')) msgType = 'image';
      else if (mimeType && mimeType.startsWith('video/')) msgType = 'video';

      // Sauvegarder le fichier
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`;
      const filePath = join(UPLOADS_DIR, uniqueName);
      const buffer = Buffer.from(data, 'base64');
      writeFileSync(filePath, buffer);

      // Créer le message
      const msgResult = db.prepare(
        'INSERT INTO messages (conversation_id, sender_id, content, type) VALUES (?, ?, ?, ?)'
      ).run(convId, req.user.id, filename, msgType);

      const messageId = msgResult.lastInsertRowid;

      // Créer l'attachement
      db.prepare(
        'INSERT INTO message_attachments (message_id, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?)'
      ).run(messageId, uniqueName, filename, mimeType || 'application/octet-stream', buffer.length);

      // Mettre à jour la conversation
      db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(convId);
      db.prepare(
        'UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?'
      ).run(convId, req.user.id);

      res.json({
        id: messageId,
        conversation_id: parseInt(convId),
        sender_id: req.user.id,
        sender_name: req.user.name,
        content: filename,
        type: msgType,
        created_at: new Date().toISOString(),
        attachments: [{
          id: null,
          filename: uniqueName,
          original_name: filename,
          mime_type: mimeType || 'application/octet-stream',
          size: buffer.length,
        }],
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // POST /api/messaging/conversations/:id/read — Marquer comme lu
  app.post('/api/messaging/conversations/:id/read', authenticateToken, (req, res) => {
    try {
      db.prepare(
        'UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?'
      ).run(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // GET /api/messaging/unread-count — Nombre total de messages non lus
  app.get('/api/messaging/unread-count', authenticateToken, (req, res) => {
    try {
      const result = db.prepare(`
        SELECT COALESCE(SUM(
          (SELECT COUNT(*) FROM messages m 
           WHERE m.conversation_id = c.id 
           AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
           AND m.sender_id != ?
          )
        ), 0) as total_unread
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE cp.user_id = ?
      `).get(req.user.id, req.user.id);

      res.json({ unread: result.total_unread });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });
}
