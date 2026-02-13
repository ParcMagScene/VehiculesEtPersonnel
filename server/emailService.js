/**
 * Service d'envoi d'emails pour eM@g
 * Utilise nodemailer avec configuration SMTP stockée en base
 */
import nodemailer from 'nodemailer';
import logger from './logger.js';

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
        pass: config.smtp_pass,
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
      from: `"${emailConfig.from_name || 'eM@g'}" <${emailConfig.smtp_user}>`,
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
      "SELECT email FROM users WHERE role = 'admin' AND email IS NOT NULL AND email != ''"
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
          <p><strong>Nom :</strong> ${requestData.name || 'Non renseigné'}</p>
          <p><strong>Email :</strong> ${requestData.email || 'Non renseigné'}</p>
          <p><strong>Identifiant demandé :</strong> ${requestData.username || 'Non renseigné'}</p>
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
          <p><strong>Véhicule :</strong> ${reservation.vehicleName || 'N/A'}</p>
          <p><strong>Du :</strong> ${reservation.startDate || ''} (${reservation.startPeriod || ''})</p>
          <p><strong>Au :</strong> ${reservation.endDate || ''} (${reservation.endPeriod || ''})</p>
          <p><strong>Client :</strong> ${reservation.clientName || 'Non spécifié'}</p>
          <p><strong>Créée par :</strong> ${creatorName || 'Inconnu'}</p>
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
          <p><strong>Personnel :</strong> ${assignment.personName || 'N/A'}</p>
          <p><strong>Date :</strong> ${assignment.day || ''}</p>
          <p><strong>Période :</strong> ${assignment.period || ''}</p>
          <p><strong>Affaire :</strong> ${assignment.affaireName || 'Non spécifiée'}</p>
          <p><strong>Par :</strong> ${creatorName || 'Inconnu'}</p>
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
          <p><strong>Véhicule :</strong> ${vehicleName}</p>
          <p><strong>Description :</strong> ${intervention.description || 'N/A'}</p>
          <p><strong>Prévu du :</strong> ${intervention.startDate || ''} au ${intervention.endDate || ''}</p>
          <p><strong>Statut :</strong> ${intervention.status || 'En cours'}</p>
        </div>
      </div>
    `,
  });
}

export default {
  initEmailTransporter,
  alertAccessRequest,
  alertReservationCreated,
  alertAssignmentCreated,
  alertOverdueIntervention,
};
