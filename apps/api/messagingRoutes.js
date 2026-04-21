import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';

import db from './database.js';
import logger from './logger.js';
import { messageSchema } from './schemas/crud.js';
import { validate } from './schemas/imports.js';

// ═══════════════════════════════════════
// SSE — Server-Sent Events pour la messagerie temps réel
// ═══════════════════════════════════════
const sseClients = new Map(); // userId → Set<res>

export function notifyUser(userId, event, data) {
  const clients = sseClients.get(userId);
  if (!clients) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

function getConversationParticipantIds(conversationId) {
  return db
    .prepare('SELECT user_id FROM conversation_participants WHERE conversation_id = ?')
    .all(conversationId)
    .map((r) => r.user_id);
}

function getUnreadCountForUser(userId) {
  const result = db
    .prepare(
      `
    SELECT COUNT(*) as total_unread
    FROM messages m
    JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
    WHERE cp.user_id = ?
      AND m.sender_id != ?
      AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
  `,
    )
    .get(userId, userId);
  return result.total_unread;
}

function getUnreadCountsForUsers(userIds) {
  const counts = new Map();
  if (!Array.isArray(userIds) || userIds.length === 0) return counts;

  const placeholders = userIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `
    SELECT cp.user_id, COUNT(*) as total_unread
    FROM messages m
    JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
    WHERE cp.user_id IN (${placeholders})
      AND m.sender_id != cp.user_id
      AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
    GROUP BY cp.user_id
  `,
    )
    .all(...userIds);

  for (const userId of userIds) counts.set(userId, 0);
  for (const row of rows) counts.set(row.user_id, row.total_unread);

  return counts;
}

function getConversationUnreadCountsForUsers(conversationId, userIds) {
  const counts = new Map();
  if (!Array.isArray(userIds) || userIds.length === 0) return counts;

  const placeholders = userIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `
    SELECT cp.user_id, COUNT(*) as conversation_unread
    FROM messages m
    JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
    WHERE m.conversation_id = ?
      AND cp.user_id IN (${placeholders})
      AND m.sender_id != cp.user_id
      AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
    GROUP BY cp.user_id
  `,
    )
    .all(conversationId, ...userIds);

  for (const userId of userIds) counts.set(userId, 0);
  for (const row of rows) counts.set(row.user_id, row.conversation_unread);

  return counts;
}

// [AUDIT Phase 4] Types MIME autorisés pour les uploads messagerie
const MESSAGING_ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const MESSAGING_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 Mo

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dossier pour les fichiers de messagerie
const UPLOADS_DIR = join(__dirname, '..', '..', 'public', 'messaging-uploads');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

export function setupMessagingRoutes(app, authenticateToken) {
  // ═══════════════════════════════════════
  // SSE ENDPOINT
  // ═══════════════════════════════════════
  app.get('/api/messaging/sse', authenticateToken, (req, res) => {
    const userId = req.user.id;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Heartbeat toutes les 30s pour garder la connexion
    const heartbeat = setInterval(() => {
      try {
        res.write(':heartbeat\n\n');
      } catch {
        /* noop */
      }
    }, 30000);

    // Enregistrer le client
    if (!sseClients.has(userId)) sseClients.set(userId, new Set());
    sseClients.get(userId).add(res);

    // Envoyer le compteur non-lu initial
    try {
      const unread = getUnreadCountForUser(userId);
      res.write(`event: unread_update\ndata: ${JSON.stringify({ unread })}\n\n`);
    } catch {
      /* silencieux */
    }

    req.on('close', () => {
      clearInterval(heartbeat);
      const clients = sseClients.get(userId);
      if (clients) {
        clients.delete(res);
        if (clients.size === 0) sseClients.delete(userId);
      }
    });
  });

  // ═══════════════════════════════════════
  // CONVERSATIONS
  // ═══════════════════════════════════════

  // GET /api/messaging/conversations — Liste des conversations de l'utilisateur
  app.get('/api/messaging/conversations', authenticateToken, (req, res) => {
    try {
      const parsePositiveInt = (value, fallback) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
      };
      const parseNonNegativeInt = (value, fallback) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
      };
      const parseBoolean = (value, fallback = true) => {
        if (value === undefined) return fallback;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          if (normalized === 'true' || normalized === '1') return true;
          if (normalized === 'false' || normalized === '0') return false;
        }
        return fallback;
      };

      const pageSize = Math.min(parsePositiveInt(req.query.limit ?? req.query.pageSize, 50), 200);
      const page = parsePositiveInt(req.query.page, 1);
      const hasOffset = req.query.offset !== undefined;
      const offset = hasOffset ? parseNonNegativeInt(req.query.offset, 0) : (page - 1) * pageSize;
      const includeParticipants = parseBoolean(req.query.includeParticipants, true);

      const conversations = db
        .prepare(
          `
        WITH user_conversations AS (
          SELECT c.id, c.type, c.title, c.created_at, c.updated_at, cp.last_read_at
          FROM conversations c
          JOIN conversation_participants cp ON c.id = cp.conversation_id
          WHERE cp.user_id = ?
        ),
        last_messages AS (
          SELECT m.conversation_id, m.content, m.created_at, u.name as sender_name
          FROM messages m
          JOIN users u ON u.id = m.sender_id
          JOIN (
            SELECT conversation_id, MAX(id) as max_message_id
            FROM messages
            GROUP BY conversation_id
          ) lm ON lm.max_message_id = m.id
        ),
        unread_counts AS (
          SELECT m.conversation_id, COUNT(*) as unread_count
          FROM messages m
          JOIN conversation_participants cp
            ON cp.conversation_id = m.conversation_id
           AND cp.user_id = ?
          WHERE m.sender_id != ?
            AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
          GROUP BY m.conversation_id
        )
        SELECT uc.id, uc.type, uc.title, uc.created_at, uc.updated_at, uc.last_read_at,
               COALESCE(ucount.unread_count, 0) as unread_count,
               lm.content as last_message,
               lm.created_at as last_message_at,
               lm.sender_name as last_message_sender,
               COALESCE(
                 uc.title,
                 (
                   SELECT GROUP_CONCAT(u.name, ', ')
                   FROM conversation_participants cp2
                   JOIN users u ON u.id = cp2.user_id
                   WHERE cp2.conversation_id = uc.id AND cp2.user_id != ?
                 ),
                 'Conversation'
               ) as display_name
        FROM user_conversations uc
        LEFT JOIN unread_counts ucount ON ucount.conversation_id = uc.id
        LEFT JOIN last_messages lm ON lm.conversation_id = uc.id
        ORDER BY COALESCE(lm.created_at, uc.created_at) DESC
        LIMIT ? OFFSET ?
      `,
        )
        .all(req.user.id, req.user.id, req.user.id, req.user.id, pageSize, offset);

      if (conversations.length === 0) {
        return res.json([]);
      }

      if (!includeParticipants) {
        return res.json(
          conversations.map((conv) => ({
            ...conv,
            participants: [],
          })),
        );
      }

      const conversationIds = conversations.map((c) => c.id);
      const placeholders = conversationIds.map(() => '?').join(',');
      const participantsRows = db
        .prepare(
          `
        SELECT cp.conversation_id, u.id, u.name, u.email
        FROM conversation_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id IN (${placeholders})
      `,
        )
        .all(...conversationIds);

      const participantsByConversation = new Map();
      for (const row of participantsRows) {
        if (!participantsByConversation.has(row.conversation_id)) {
          participantsByConversation.set(row.conversation_id, []);
        }
        participantsByConversation.get(row.conversation_id).push({
          id: row.id,
          name: row.name,
          email: row.email,
        });
      }

      const result = conversations.map((conv) => ({
        ...conv,
        participants: participantsByConversation.get(conv.id) || [],
      }));

      res.json(result);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/messaging/conversations — Créer une conversation
  app.post('/api/messaging/conversations', authenticateToken, (req, res) => {
    try {
      const { type = 'direct', title, participantIds = [] } = req.body;

      // Pour les conversations directes, vérifier qu'il n'en existe pas déjà une
      if (type === 'direct' && participantIds.length === 1) {
        const existing = db
          .prepare(
            `
          SELECT c.id FROM conversations c
          JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = ?
          JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = ?
          WHERE c.type = 'direct'
        `,
          )
          .get(req.user.id, participantIds[0]);

        if (existing) {
          return res.json({ id: existing.id, existing: true });
        }
      }

      const result = db
        .prepare('INSERT INTO conversations (type, title, created_by) VALUES (?, ?, ?)')
        .run(type, title || null, req.user.id);

      const convId = result.lastInsertRowid;

      // Ajouter le créateur comme participant
      const addParticipant = db.prepare(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
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
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ═══════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════

  // GET /api/messaging/conversations/:id/messages — Messages d'une conversation
  app.get('/api/messaging/conversations/:id/messages', authenticateToken, (req, res) => {
    try {
      const convId = req.params.id;
      const parsedLimit = Number.parseInt(req.query.limit, 10);
      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 50;
      const before = req.query.before; // cursor-based pagination

      // Vérifier que l'utilisateur est participant
      const isParticipant = db
        .prepare(
          'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
        )
        .get(convId, req.user.id);

      if (!isParticipant) {
        return res.status(403).json({ success: false, error: 'Non autorisé' });
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

      // Charger les pièces jointes en batch pour éviter le N+1
      const messageIdsWithAttachments = messages.filter((m) => m.type !== 'text').map((m) => m.id);

      const attachmentsByMessageId = new Map();
      if (messageIdsWithAttachments.length > 0) {
        const placeholders = messageIdsWithAttachments.map(() => '?').join(',');
        const rows = db
          .prepare(
            `
          SELECT id, message_id, filename, original_name, mime_type, size
          FROM message_attachments
          WHERE message_id IN (${placeholders})
        `,
          )
          .all(...messageIdsWithAttachments);

        for (const row of rows) {
          if (!attachmentsByMessageId.has(row.message_id)) {
            attachmentsByMessageId.set(row.message_id, []);
          }
          attachmentsByMessageId.get(row.message_id).push({
            id: row.id,
            filename: row.filename,
            original_name: row.original_name,
            mime_type: row.mime_type,
            size: row.size,
          });
        }
      }

      const result = messages
        .map((m) => ({
          ...m,
          attachments: m.type !== 'text' ? attachmentsByMessageId.get(m.id) || [] : [],
        }))
        .reverse(); // Remettre dans l'ordre chronologique

      res.json(result);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/messaging/conversations/:id/messages — Envoyer un message
  app.post(
    '/api/messaging/conversations/:id/messages',
    authenticateToken,
    validate(messageSchema),
    (req, res) => {
      try {
        const convId = req.params.id;
        const { content, type = 'text' } = req.body;

        // Vérifier que l'utilisateur est participant
        const isParticipant = db
          .prepare(
            'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
          )
          .get(convId, req.user.id);

        if (!isParticipant) {
          return res.status(403).json({ success: false, error: 'Non autorisé' });
        }

        const result = db
          .prepare(
            'INSERT INTO messages (conversation_id, sender_id, content, type) VALUES (?, ?, ?, ?)',
          )
          .run(convId, req.user.id, content, type);
        const messageId = Number(result.lastInsertRowid);
        const createdAt = new Date().toISOString();

        // Mettre à jour le timestamp de la conversation
        db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
          convId,
        );

        // Marquer comme lu pour l'expéditeur
        db.prepare(
          'UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?',
        ).run(convId, req.user.id);

        res.json({
          id: messageId,
          conversation_id: parseInt(convId),
          sender_id: req.user.id,
          sender_name: req.user.name,
          content,
          type,
          created_at: createdAt,
          attachments: [],
        });

        // SSE — notifier les autres participants
        const participants = getConversationParticipantIds(convId).filter(
          (pid) => pid !== req.user.id,
        );
        const unreadByUser = getUnreadCountsForUsers(participants);
        const conversationUnreadByUser = getConversationUnreadCountsForUsers(convId, participants);
        for (const pid of participants) {
          const unread = unreadByUser.get(pid) || 0;
          notifyUser(pid, 'new_message', {
            id: messageId,
            conversation_id: parseInt(convId),
            sender_id: req.user.id,
            sender_name: req.user.name,
            content,
            type,
            created_at: createdAt,
            attachments: [],
          });
          notifyUser(pid, 'unread_update', {
            unread,
            conversation_id: Number(convId),
            conversation_unread: conversationUnreadByUser.get(pid) || 0,
          });
        }
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // POST /api/messaging/conversations/:id/messages/file — Envoyer un fichier
  app.post('/api/messaging/conversations/:id/messages/file', authenticateToken, (req, res) => {
    try {
      const convId = req.params.id;

      // Vérifier participation
      const isParticipant = db
        .prepare(
          'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
        )
        .get(convId, req.user.id);

      if (!isParticipant) {
        return res.status(403).json({ success: false, error: 'Non autorisé' });
      }

      // Traiter le multipart form data (le fichier est dans req.body en base64 ou via multer)
      const { filename, data, mimeType } = req.body;
      if (!filename || !data) {
        return res.status(400).json({ success: false, error: 'Fichier manquant' });
      }

      // [AUDIT Phase 4] Valider le type MIME
      if (!mimeType || !MESSAGING_ALLOWED_MIMES.has(mimeType)) {
        return res.status(400).json({
          success: false,
          error: `Type de fichier non autorisé: ${mimeType || 'inconnu'}`,
        });
      }

      // [SECURITY] Vérifier aussi l'extension du fichier (le MIME client est spoofable)
      const ALLOWED_MSG_EXTS = [
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.webp',
        '.pdf',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
        '.csv',
        '.txt',
        '.mp4',
        '.webm',
        '.mov',
      ];
      const fileExt = extname(filename).toLowerCase();
      if (!ALLOWED_MSG_EXTS.includes(fileExt)) {
        return res.status(400).json({
          success: false,
          error: `Extension de fichier non autorisée: ${fileExt || 'aucune'}`,
        });
      }

      // [AUDIT Phase 4] Décoder et vérifier la taille
      const buffer = Buffer.from(data, 'base64');
      if (buffer.length > MESSAGING_MAX_FILE_SIZE) {
        return res
          .status(400)
          .json({ success: false, error: 'Fichier trop volumineux (max 25 Mo)' });
      }

      // Déterminer le type de message
      let msgType = 'file';
      if (mimeType.startsWith('image/')) msgType = 'image';
      else if (mimeType.startsWith('video/')) msgType = 'video';

      // [AUDIT Phase 4] Sanitize filename — basename pour éviter le path traversal
      const safeName = basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const filePath = join(UPLOADS_DIR, uniqueName);
      writeFileSync(filePath, buffer);

      // Créer le message
      const msgResult = db
        .prepare(
          'INSERT INTO messages (conversation_id, sender_id, content, type) VALUES (?, ?, ?, ?)',
        )
        .run(convId, req.user.id, filename, msgType);

      const messageId = msgResult.lastInsertRowid;
      const createdAt = new Date().toISOString();

      // Créer l'attachement
      db.prepare(
        'INSERT INTO message_attachments (message_id, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?)',
      ).run(messageId, uniqueName, filename, mimeType || 'application/octet-stream', buffer.length);

      // Mettre à jour la conversation
      db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        convId,
      );
      db.prepare(
        'UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?',
      ).run(convId, req.user.id);

      res.json({
        id: messageId,
        conversation_id: parseInt(convId),
        sender_id: req.user.id,
        sender_name: req.user.name,
        content: filename,
        type: msgType,
        created_at: createdAt,
        attachments: [
          {
            id: null,
            filename: uniqueName,
            original_name: filename,
            mime_type: mimeType || 'application/octet-stream',
            size: buffer.length,
          },
        ],
      });

      // SSE — notifier les autres participants
      const participants = getConversationParticipantIds(convId).filter(
        (pid) => pid !== req.user.id,
      );
      const unreadByUser = getUnreadCountsForUsers(participants);
      const conversationUnreadByUser = getConversationUnreadCountsForUsers(convId, participants);
      for (const pid of participants) {
        const unread = unreadByUser.get(pid) || 0;
        notifyUser(pid, 'new_message', {
          id: messageId,
          conversation_id: parseInt(convId),
          sender_id: req.user.id,
          sender_name: req.user.name,
          content: filename,
          type: msgType,
          created_at: createdAt,
          attachments: [
            {
              id: null,
              filename: uniqueName,
              original_name: filename,
              mime_type: mimeType || 'application/octet-stream',
              size: buffer.length,
            },
          ],
        });
        notifyUser(pid, 'unread_update', {
          unread,
          conversation_id: Number(convId),
          conversation_unread: conversationUnreadByUser.get(pid) || 0,
        });
      }
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/messaging/conversations/:id/read — Marquer comme lu
  app.post('/api/messaging/conversations/:id/read', authenticateToken, (req, res) => {
    try {
      db.prepare(
        'UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?',
      ).run(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // PUT /api/messaging/messages/:id — Modifier un message (auteur uniquement)
  app.put('/api/messaging/messages/:id', authenticateToken, (req, res) => {
    try {
      const { content } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ success: false, error: 'Contenu requis' });
      }

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
      if (!message) return res.status(404).json({ success: false, error: 'Message non trouvé' });
      if (message.sender_id !== req.user.id) {
        return res
          .status(403)
          .json({ success: false, error: 'Vous ne pouvez modifier que vos propres messages' });
      }

      db.prepare('UPDATE messages SET content = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        content.trim(),
        req.params.id,
      );

      const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // DELETE /api/messaging/messages/:id — Supprimer un message (auteur ou admin)
  app.delete('/api/messaging/messages/:id', authenticateToken, (req, res) => {
    try {
      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
      if (!message) return res.status(404).json({ success: false, error: 'Message non trouvé' });
      if (message.sender_id !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ success: false, error: 'Non autorisé' });
      }

      // Supprimer les pièces jointes associées
      db.prepare('DELETE FROM message_attachments WHERE message_id = ?').run(req.params.id);
      db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);

      res.json({ success: true, message: 'Message supprimé' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/messaging/unread-count — Nombre total de messages non lus
  app.get('/api/messaging/unread-count', authenticateToken, (req, res) => {
    try {
      const result = db
        .prepare(
          `
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
      `,
        )
        .get(req.user.id, req.user.id);

      res.json({ unread: result.total_unread });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}
