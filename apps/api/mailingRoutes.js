/**
 * Routes du module Mailing Avancé
 * Templates, envoi, historique
 */
import { initEmailTransporter, getTransporter } from './emailService.js';
import logger from './logger.js';
import db from './database.js';

/**
 * Substitue les variables {{var}} dans un texte
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function substituteVariables(text, vars = {}) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? escapeHtml(vars[key]) : match;
  });
}

export function setupMailingRoutes(app, authenticateToken, requireAdmin) {

  // ═══ TEMPLATES ═══════════════════════════════════════════

  // GET /api/mail-templates — Liste des templates
  app.get('/api/mail-templates', authenticateToken, requireAdmin, (req, res) => {
    try {
      const templates = db.prepare(`
        SELECT mt.*, u.name as created_by_name
        FROM mail_templates mt
        LEFT JOIN users u ON u.id = mt.created_by
        ORDER BY mt.updated_at DESC
      `).all();
      res.json(templates.map(t => ({
        ...t,
        variables: JSON.parse(t.variables || '[]'),
      })));
    } catch (err) {
      logger.error('Erreur liste templates:', err);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // GET /api/mail-templates/:id — Détail d'un template
  app.get('/api/mail-templates/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const tpl = db.prepare('SELECT * FROM mail_templates WHERE id = ?').get(req.params.id);
      if (!tpl) return res.status(404).json({ success: false, error: 'Template non trouvé' });
      res.json({ ...tpl, variables: JSON.parse(tpl.variables || '[]') });
    } catch (err) {
      logger.error('Erreur détail template:', err);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /api/mail-templates — Créer un template
  app.post('/api/mail-templates', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, subject, html_body, variables, category } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Nom obligatoire' });

      const result = db.prepare(`
        INSERT INTO mail_templates (name, subject, html_body, variables, category, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        name,
        subject || '',
        html_body || '',
        JSON.stringify(variables || []),
        category || 'general',
        req.user.id
      );

      res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Template créé' });
    } catch (err) {
      logger.error('Erreur création template:', err);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // PUT /api/mail-templates/:id — Modifier un template
  app.put('/api/mail-templates/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, subject, html_body, variables, category } = req.body;
      const existing = db.prepare('SELECT id FROM mail_templates WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Template non trouvé' });

      db.prepare(`
        UPDATE mail_templates
        SET name = ?, subject = ?, html_body = ?, variables = ?, category = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        name || '',
        subject || '',
        html_body || '',
        JSON.stringify(variables || []),
        category || 'general',
        req.params.id
      );

      res.json({ success: true, message: 'Template mis à jour' });
    } catch (err) {
      logger.error('Erreur modification template:', err);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // DELETE /api/mail-templates/:id — Supprimer un template
  app.delete('/api/mail-templates/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const result = db.prepare('DELETE FROM mail_templates WHERE id = ?').run(req.params.id);
      if (result.changes === 0) return res.status(404).json({ success: false, error: 'Template non trouvé' });
      res.json({ success: true, message: 'Template supprimé' });
    } catch (err) {
      logger.error('Erreur suppression template:', err);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ═══ ENVOI D'EMAIL ════════════════════════════════════════

  // POST /api/mailing/send — Envoyer un email (avec ou sans template)
  app.post('/api/mailing/send', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { template_id, recipients, subject, html_body, variables } = req.body;

      if (!recipients || recipients.length === 0) {
        return res.status(400).json({ success: false, error: 'Au moins un destinataire requis' });
      }

      const config = db.prepare('SELECT * FROM email_config WHERE id = 1').get();
      if (!config || !config.enabled || !config.smtp_host || !config.smtp_user) {
        return res.status(400).json({ success: false, error: 'Configuration SMTP non activée' });
      }

      // Déterminer sujet et contenu
      let finalSubject = subject || '';
      let finalHtml = html_body || '';

      if (template_id) {
        const tpl = db.prepare('SELECT * FROM mail_templates WHERE id = ?').get(template_id);
        if (tpl) {
          finalSubject = finalSubject || tpl.subject;
          finalHtml = finalHtml || tpl.html_body;
        }
      }

      // Substitution des variables
      const vars = variables || {};
      finalSubject = substituteVariables(finalSubject, vars);
      finalHtml = substituteVariables(finalHtml, vars);

      if (!finalSubject) {
        return res.status(400).json({ success: false, error: 'Sujet obligatoire' });
      }

      // Utiliser le transporteur singleton de emailService
      const { transporter: transport, emailConfig } = getTransporter();
      if (!transport) {
        // Fallback : réinitialiser le transporteur si non-initialisé
        initEmailTransporter(db);
        const retry = getTransporter();
        if (!retry.transporter) {
          return res.status(500).json({ success: false, error: 'Transporteur email non configuré' });
        }
      }
      const activeTransport = transport || getTransporter().transporter;
      const fromName = emailConfig?.from_name || config.from_name || 'eM@g';
      const fromEmail = emailConfig?.smtp_user || config.smtp_user;

      const recipientList = Array.isArray(recipients) ? recipients : [recipients];
      const results = [];

      for (const to of recipientList) {
        try {
          await activeTransport.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to,
            subject: `[eM@g] ${finalSubject}`,
            html: finalHtml,
            text: finalSubject,
          });

          // Log en historique
          db.prepare(`
            INSERT INTO mail_history (template_id, recipients, subject, status, sent_by)
            VALUES (?, ?, ?, 'sent', ?)
          `).run(template_id || null, to, finalSubject, req.user.id);

          results.push({ to, status: 'sent' });
        } catch (err) {
          db.prepare(`
            INSERT INTO mail_history (template_id, recipients, subject, status, error_message, sent_by)
            VALUES (?, ?, ?, 'error', ?, ?)
          `).run(template_id || null, to, finalSubject, err.message, req.user.id);

          results.push({ to, status: 'error', error: err.message });
        }
      }

      const sent = results.filter(r => r.status === 'sent').length;
      const errors = results.filter(r => r.status === 'error').length;

      res.json({
        message: `${sent} email(s) envoyé(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}`,
        results,
      });
    } catch (err) {
      logger.error('Erreur envoi mailing:', err);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /api/mailing/preview — Prévisualiser un email avec variables substituées
  app.post('/api/mailing/preview', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { template_id, subject, html_body, variables } = req.body;

      let finalSubject = subject || '';
      let finalHtml = html_body || '';

      if (template_id) {
        const tpl = db.prepare('SELECT * FROM mail_templates WHERE id = ?').get(template_id);
        if (tpl) {
          finalSubject = finalSubject || tpl.subject;
          finalHtml = finalHtml || tpl.html_body;
        }
      }

      const vars = variables || {};
      finalSubject = substituteVariables(finalSubject, vars);
      finalHtml = substituteVariables(finalHtml, vars);

      res.json({ subject: finalSubject, html: finalHtml });
    } catch (err) {
      logger.error('Erreur preview mailing:', err);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ═══ HISTORIQUE ═══════════════════════════════════════════

  // GET /api/mailing/history — Historique des envois
  app.get('/api/mailing/history', authenticateToken, requireAdmin, (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const history = db.prepare(`
        SELECT mh.*, u.name as sent_by_name, mt.name as template_name
        FROM mail_history mh
        LEFT JOIN users u ON u.id = mh.sent_by
        LEFT JOIN mail_templates mt ON mt.id = mh.template_id
        ORDER BY mh.sent_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);

      const total = db.prepare('SELECT COUNT(*) as count FROM mail_history').get().count;

      res.json({ history, total });
    } catch (err) {
      logger.error('Erreur historique mailing:', err);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ═══ CONTACTS DISPONIBLES ═════════════════════════════════

  // GET /api/mailing/contacts — Liste des contacts avec email
  app.get('/api/mailing/contacts', authenticateToken, requireAdmin, (req, res) => {
    try {
      const contacts = [];

      // Utilisateurs
      const users = db.prepare("SELECT id, name, email FROM users WHERE email IS NOT NULL AND email != '' LIMIT 2000").all();
      users.forEach(u => contacts.push({ type: 'user', id: u.id, name: u.name, email: u.email }));

      // Personnel
      try {
        const persons = db.prepare("SELECT id, first_name || ' ' || last_name as name, email FROM persons WHERE email IS NOT NULL AND email != '' LIMIT 2000").all();
        persons.forEach(p => contacts.push({ type: 'person', id: p.id, name: p.name, email: p.email }));
      } catch { /* table pas encore créée */ }

      // Clients
      try {
        const clients = db.prepare("SELECT id, name, email FROM clients WHERE email IS NOT NULL AND email != '' LIMIT 2000").all();
        clients.forEach(c => contacts.push({ type: 'client', id: c.id, name: c.name, email: c.email }));
      } catch { /* table pas encore créée */ }

      // Fournisseurs
      try {
        const suppliers = db.prepare("SELECT id, name, email FROM suppliers WHERE email IS NOT NULL AND email != '' LIMIT 2000").all();
        suppliers.forEach(s => contacts.push({ type: 'supplier', id: s.id, name: s.name, email: s.email }));
      } catch { /* table pas encore créée */ }

      res.json(contacts);
    } catch (err) {
      logger.error('Erreur contacts mailing:', err);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });
}
