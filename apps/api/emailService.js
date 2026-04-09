/**
 * Service d'envoi d'emails pour eM@g
 * Utilise nodemailer avec configuration SMTP stockée en base
 */
import nodemailer from 'nodemailer';
import logger from './logger.js';
import { decryptPassword } from './videoProxyService.js';

/** Échappe les caractères HTML pour prévenir XSS dans les emails */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Sanitize un header email pour prévenir l'injection SMTP */
function sanitizeEmailHeader(str) {
  if (!str) return '';
  return String(str).replace(/[\r\n]/g, '');
}

let transporter = null;
let emailConfig = null;

/**
 * Initialise ou réinitialise le transporteur SMTP
 */
export function initEmailTransporter(db) {
  try {
    const config = db.prepare('SELECT * FROM email_config WHERE id = 1').get();
    if (!config || !config.smtp_host || !config.smtp_user) {
      emailConfig = null;
      transporter = null;
      return false;
    }

    emailConfig = config;
    transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port || 587,
      secure: config.smtp_secure === 1,
      auth: {
        user: config.smtp_user,
        pass: decryptPassword(config.smtp_pass) || config.smtp_pass,
      },
    });

    logger.info('Email transporter initialisé:', config.smtp_host);
    return true;
  } catch (err) {
    logger.error('Erreur init email transporter:', err.message);
    return false;
  }
}

/**
 * Retourne le transporteur et la config pour usage externe
 */
export function getTransporter() {
  return { transporter, emailConfig };
}

/**
 * Envoie un email
 */
async function sendEmail({ to, subject, html, text }) {
  if (!transporter || !emailConfig) {
    logger.warn('Email non envoyé (transporteur non configuré):', subject);
    return false;
  }

  if (!emailConfig.enabled) {
    logger.info('Email désactivé, non envoyé:', subject);
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `"${sanitizeEmailHeader(emailConfig.from_name || 'eM@g')}" <${emailConfig.smtp_user}>`,
      to,
      subject: `[eM@g] ${subject}`,
      html,
      text: text || subject,
    });

    logger.info('Email envoyé:', info.messageId, 'à', to);
    return true;
  } catch (err) {
    logger.error('Erreur envoi email:', err.message);
    return false;
  }
}

/**
 * Récupère les destinataires admin (tous les utilisateurs admin avec email)
 */
function getAdminEmails(db) {
  try {
    const admins = db.prepare(
      "SELECT email FROM users WHERE is_admin = 1 AND email IS NOT NULL AND email != ''"
    ).all();
    return admins.map(a => a.email);
  } catch {
    return [];
  }
}

/**
 * Récupère l'email d'un utilisateur par son ID
 */
function getUserEmail(db, userId) {
  try {
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    return user?.email || null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════
// Alertes spécifiques
// ═══════════════════════════════════════

/**
 * Alerte : nouvelle demande d'accès
 */
export async function alertAccessRequest(db, requestData) {
  const admins = getAdminEmails(db);
  if (admins.length === 0) return;

  await sendEmail({
    to: admins.join(','),
    subject: 'Nouvelle demande d\'accès',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">🔑 Nouvelle demande d'accès</h2>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
          <p><strong>Nom :</strong> ${escapeHtml(requestData.name) || 'Non renseigné'}</p>
          <p><strong>Email :</strong> ${escapeHtml(requestData.email) || 'Non renseigné'}</p>
          <p><strong>Identifiant demandé :</strong> ${escapeHtml(requestData.username) || 'Non renseigné'}</p>
          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">
            Connectez-vous à eM@g pour approuver ou refuser cette demande.
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Alerte : nouvelle réservation créée
 */
export async function alertReservationCreated(db, reservation, creatorName) {
  const admins = getAdminEmails(db);
  if (admins.length === 0) return;

  await sendEmail({
    to: admins.join(','),
    subject: `Nouvelle réservation — ${reservation.vehicleName || 'Véhicule'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">📅 Nouvelle réservation</h2>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
          <p><strong>Véhicule :</strong> ${escapeHtml(reservation.vehicleName) || 'N/A'}</p>
          <p><strong>Du :</strong> ${escapeHtml(reservation.startDate) || ''} (${escapeHtml(reservation.startPeriod) || ''})</p>
          <p><strong>Au :</strong> ${escapeHtml(reservation.endDate) || ''} (${escapeHtml(reservation.endPeriod) || ''})</p>
          <p><strong>Client :</strong> ${escapeHtml(reservation.clientName) || 'Non spécifié'}</p>
          <p><strong>Créée par :</strong> ${escapeHtml(creatorName) || 'Inconnu'}</p>
        </div>
      </div>
    `,
  });
}

/**
 * Alerte : nouvelle affectation personnel
 */
export async function alertAssignmentCreated(db, assignment, creatorName) {
  const admins = getAdminEmails(db);
  if (admins.length === 0) return;

  await sendEmail({
    to: admins.join(','),
    subject: `Nouvelle affectation — ${assignment.personName || 'Personnel'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">👤 Nouvelle affectation</h2>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
          <p><strong>Personnel :</strong> ${escapeHtml(assignment.personName) || 'N/A'}</p>
          <p><strong>Date :</strong> ${escapeHtml(assignment.day) || ''}</p>
          <p><strong>Période :</strong> ${escapeHtml(assignment.period) || ''}</p>
          <p><strong>Affaire :</strong> ${escapeHtml(assignment.affaireName) || 'Non spécifiée'}</p>
          <p><strong>Par :</strong> ${escapeHtml(creatorName) || 'Inconnu'}</p>
        </div>
      </div>
    `,
  });
}

/**
 * Alerte : intervention en retard
 */
export async function alertOverdueIntervention(db, intervention, vehicleName) {
  const admins = getAdminEmails(db);
  if (admins.length === 0) return;

  await sendEmail({
    to: admins.join(','),
    subject: `⚠️ Intervention en retard — ${vehicleName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 20px; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">⚠️ Intervention en retard</h2>
        </div>
        <div style="background: #fef2f2; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #fecaca;">
          <p><strong>Véhicule :</strong> ${escapeHtml(vehicleName)}</p>
          <p><strong>Description :</strong> ${escapeHtml(intervention.description) || 'N/A'}</p>
          <p><strong>Prévu du :</strong> ${escapeHtml(intervention.startDate) || ''} au ${escapeHtml(intervention.endDate) || ''}</p>
          <p><strong>Statut :</strong> ${escapeHtml(intervention.status) || 'En cours'}</p>
        </div>
      </div>
    `,
  });
}

// ═══════════════════════════════════════
// Congés
// ═══════════════════════════════════════

/**
 * Alerte : nouvelle demande de congé (envoyée aux admins)
 */
export async function alertLeaveCreated(db, leave, personName) {
  const config = db.prepare('SELECT alert_leave FROM email_config WHERE id = 1').get();
  if (!config?.alert_leave) return;
  const admins = getAdminEmails(db);
  if (admins.length === 0) return;

  const typeLabel = leave.leave_type || leave.leaveType || 'Congé';
  await sendEmail({
    to: admins.join(','),
    subject: `Demande de congé — ${personName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">🏖️ Nouvelle demande de congé</h2>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
          <p><strong>Employé :</strong> ${escapeHtml(personName)}</p>
          <p><strong>Type :</strong> ${escapeHtml(typeLabel)}</p>
          <p><strong>Du :</strong> ${escapeHtml(leave.start_date || leave.startDate) || ''}</p>
          <p><strong>Au :</strong> ${escapeHtml(leave.end_date || leave.endDate) || ''}</p>
          <p><strong>Jours ouvrés :</strong> ${escapeHtml(leave.working_days || leave.workingDays) || '—'}</p>
          ${leave.employee_comment ? `<p><strong>Commentaire :</strong> ${escapeHtml(leave.employee_comment)}</p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">
            Connectez-vous à eM@g pour valider ou refuser cette demande.
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Alerte : décision sur une demande de congé (envoyée à l'employé)
 */
export async function alertLeaveDecision(db, leave, decisionBy) {
  const config = db.prepare('SELECT alert_leave FROM email_config WHERE id = 1').get();
  if (!config?.alert_leave) return;

  // Trouver l'email de l'employé
  const person = db.prepare('SELECT p.first_name, p.last_name, p.email FROM persons p WHERE p.id = ?').get(leave.person_id);
  const email = person?.email || getUserEmail(db, leave.user_id);
  if (!email) return;

  const personName = person ? `${person.first_name || ''} ${person.last_name || ''}`.trim() : 'Employé';
  const statusLabels = { accepted: '✅ Acceptée', refused: '❌ Refusée', modified: '✏️ Modifiée' };
  const statusLabel = statusLabels[leave.status] || leave.status;
  const bgColor = leave.status === 'accepted' ? '#10b981' : leave.status === 'refused' ? '#ef4444' : '#f59e0b';

  await sendEmail({
    to: email,
    subject: `Congé ${statusLabel} — ${personName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, ${bgColor} 0%, ${bgColor}dd 100%); padding: 20px; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">${statusLabel}</h2>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
          <p><strong>Demande :</strong> ${escapeHtml(leave.leave_type) || ''}</p>
          <p><strong>Du :</strong> ${escapeHtml(leave.start_date) || ''} au ${escapeHtml(leave.end_date) || ''}</p>
          <p><strong>Décision par :</strong> ${escapeHtml(decisionBy)}</p>
          ${leave.admin_comment ? `<p><strong>Commentaire :</strong> ${escapeHtml(leave.admin_comment)}</p>` : ''}
          ${leave.status === 'modified' ? `<p><strong>Nouvelles dates :</strong> ${escapeHtml(leave.modified_start_date) || ''} au ${escapeHtml(leave.modified_end_date) || ''}</p>` : ''}
        </div>
      </div>
    `,
  });
}

// ═══════════════════════════════════════
// Tickets SAV
// ═══════════════════════════════════════

/**
 * Alerte : nouveau ticket SAV créé
 */
export async function alertSavTicketCreated(db, ticket, creatorName) {
  const config = db.prepare('SELECT alert_sav FROM email_config WHERE id = 1').get();
  if (!config?.alert_sav) return;
  const admins = getAdminEmails(db);
  if (admins.length === 0) return;

  // Récupérer le nom de l'équipement
  const eq = db.prepare('SELECT name, serial_number FROM equipment WHERE id = ?').get(ticket.equipment_id);
  const eqName = eq?.name || `ID ${ticket.equipment_id}`;

  await sendEmail({
    to: admins.join(','),
    subject: `Ticket SAV — ${ticket.title || eqName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">🔧 Nouveau ticket SAV</h2>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
          <p><strong>Équipement :</strong> ${escapeHtml(eqName)}${eq?.serial_number ? ` (S/N: ${escapeHtml(eq.serial_number)})` : ''}</p>
          <p><strong>Titre :</strong> ${escapeHtml(ticket.title) || 'N/A'}</p>
          <p><strong>Type :</strong> ${escapeHtml(ticket.type) || 'panne'}</p>
          <p><strong>Priorité :</strong> ${escapeHtml(ticket.priority) || 'medium'}</p>
          ${ticket.description ? `<p><strong>Description :</strong> ${escapeHtml(ticket.description)}</p>` : ''}
          <p><strong>Créé par :</strong> ${escapeHtml(creatorName) || 'Inconnu'}</p>
          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">
            Connectez-vous à eM@g pour traiter ce ticket.
          </p>
        </div>
      </div>
    `,
  });
}

// ═══════════════════════════════════════
// Maintenances / Contrôles techniques
// ═══════════════════════════════════════

/**
 * Alerte : nouvelle maintenance ou contrôle technique créé
 */
export async function alertMaintenanceCreated(db, maintenance, vehicleName, creatorName) {
  const config = db.prepare('SELECT alert_maintenance FROM email_config WHERE id = 1').get();
  if (!config?.alert_maintenance) return;
  const admins = getAdminEmails(db);
  if (admins.length === 0) return;

  const isCT = !!maintenance.technical_control_type;
  const title = isCT ? `Contrôle technique ${maintenance.technical_control_type}` : 'Nouvelle maintenance';
  const icon = isCT ? '🔍' : '🔧';

  await sendEmail({
    to: admins.join(','),
    subject: `${title} — ${vehicleName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 20px; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">${icon} ${title}</h2>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
          <p><strong>Véhicule :</strong> ${escapeHtml(vehicleName)}</p>
          <p><strong>Type :</strong> ${escapeHtml(maintenance.type) || 'N/A'}${isCT ? ` (${escapeHtml(maintenance.technical_control_type)})` : ''}</p>
          <p><strong>Du :</strong> ${escapeHtml(maintenance.start_date) || ''} au ${escapeHtml(maintenance.end_date) || ''}</p>
          ${maintenance.description ? `<p><strong>Description :</strong> ${escapeHtml(maintenance.description)}</p>` : ''}
          ${maintenance.garage ? `<p><strong>Garage :</strong> ${escapeHtml(maintenance.garage)}</p>` : ''}
          <p><strong>Créé par :</strong> ${escapeHtml(creatorName) || 'Inconnu'}</p>
        </div>
      </div>
    `,
  });
}

export default {
  initEmailTransporter,
  getTransporter: () => ({ transporter, emailConfig }),
  alertAccessRequest,
  alertReservationCreated,
  alertAssignmentCreated,
  alertOverdueIntervention,
  alertLeaveCreated,
  alertLeaveDecision,
  alertSavTicketCreated,
  alertMaintenanceCreated,
};
