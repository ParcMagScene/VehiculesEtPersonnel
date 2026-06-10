// ═══════════════════════════════════════════════════════════════
// personalActionsRoutes.js
//
// Auth éphémère « actions personnelles » : permet au compte Equipe
// partagé (commun@magsav.com) de déclencher une action en se ré-
// authentifiant ponctuellement comme un membre du personnel, sans
// changer de session JWT.
//
// Endpoint : POST /api/personal-actions/perform
//
// Sécurité :
//   - authenticateToken (compte Equipe en cours)
//   - email du compte === TEAM_ACCOUNT_EMAIL (`commun@magsav.com` par défaut)
//   - vérification PIN/password du personnel (services/personalAuth.js)
//   - rate limit dédié (personalActionsLimiter)
//   - audit obligatoire dans personal_actions_log (succès comme échec)
//
// Le dispatcher repose sur un registry `actionType -> handler` :
// chaque commit fonctionnel suivant enregistre les handlers dont il
// a besoin (create_assignment, request_leave, declare_unavailability).
// ═══════════════════════════════════════════════════════════════

import db from './database.js';
import logger from './logger.js';
import { validate } from './schemas/imports.js';
import { personalActionPerformSchema } from './schemas/auth.js';
import { verifyPersonalCredentials } from './services/personalAuth.js';

const TEAM_ACCOUNT_EMAIL = (process.env.TEAM_ACCOUNT_EMAIL || 'commun@magsav.com')
  .trim()
  .toLowerCase();

// Registry de handlers d'actions personnelles.
// Signature : (ctx) => Promise<{ targetType?: string, targetId?: number, result: any }>
//   ctx = { db, person, personalUser, contextUser, payload, req }
const handlers = new Map();

/**
 * Enregistre un handler pour un type d'action personnelle.
 * Idempotent : un re-enregistrement écrase le précédent.
 */
export function registerPersonalActionHandler(actionType, handler) {
  if (typeof handler !== 'function') {
    throw new Error(`Handler invalide pour action ${actionType}`);
  }
  handlers.set(actionType, handler);
}

/** Pour les tests : remettre le registry à zéro. */
export function _clearPersonalActionHandlers() {
  handlers.clear();
}

/** Pour les tests / introspection. */
export function _hasPersonalActionHandler(actionType) {
  return handlers.has(actionType);
}

function isTeamAccount(user) {
  if (!user || !user.email) return false;
  return String(user.email).trim().toLowerCase() === TEAM_ACCOUNT_EMAIL;
}

function summarizePayload(payload) {
  try {
    const safe = { ...payload };
    // Whitelist taille raisonnable + retire toute clé sensible
    delete safe.pin;
    delete safe.password;
    delete safe.password_hash;
    const json = JSON.stringify(safe);
    return json.length > 1000 ? json.slice(0, 1000) + '…' : json;
  } catch {
    return null;
  }
}

function logAttempt(entry) {
  try {
    db.prepare(
      `INSERT INTO personal_actions_log
        (context_user_id, personal_user_id, person_id, action_type,
         target_type, target_id, payload_summary, success, error_code, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      entry.context_user_id,
      entry.personal_user_id,
      entry.person_id,
      entry.action_type,
      entry.target_type ?? null,
      entry.target_id ?? null,
      entry.payload_summary ?? null,
      entry.success ? 1 : 0,
      entry.error_code ?? null,
      entry.ip ?? null,
      entry.user_agent ?? null,
    );
  } catch (e) {
    logger.warn('personal_actions_log insert failed:', e.message);
  }
}

export function setupPersonalActionsRoutes(app, authenticateToken) {
  app.post(
    '/api/personal-actions/perform',
    authenticateToken,
    validate(personalActionPerformSchema),
    async (req, res) => {
      const contextUser = req.user;
      const ip = req.ip || req.headers['x-forwarded-for'] || null;
      const userAgent = req.headers['user-agent'] || null;
      const { personId, pin, password, actionType, payload } = req.body;

      // 1. Le compte courant doit être le compte Equipe
      if (!isTeamAccount(contextUser)) {
        return res.status(403).json({
          success: false,
          error: 'Cette opération est réservée au compte Equipe',
        });
      }

      // 2. Vérifier les identifiants personnels
      const auth = await verifyPersonalCredentials({ db, personId, pin, password });
      if (!auth.ok) {
        // On log la tentative ratée si on connaît au moins le user lié
        // (sinon on ne peut pas remplir personal_user_id obligatoire).
        if (auth.code !== 'PERSON_NOT_FOUND' && auth.code !== 'NO_LINKED_USER') {
          logAttempt({
            context_user_id: contextUser.id,
            personal_user_id: 0, // inconnu si user bloqué/manquant — placeholder neutre
            person_id: personId,
            action_type: actionType,
            payload_summary: summarizePayload(payload),
            success: 0,
            error_code: auth.code,
            ip,
            user_agent: userAgent,
          });
        }
        // Message générique pour brute-force
        const publicMessage =
          auth.code === 'INVALID_CREDENTIALS' ? 'Identifiants incorrects' : auth.error;
        return res.status(auth.status).json({ success: false, error: publicMessage });
      }

      // 3. Refuser les comptes en lecture seule pour toute action perso
      let isReadOnly;
      try {
        const perms = auth.user.permissions ? JSON.parse(auth.user.permissions) : {};
        isReadOnly = !auth.user.is_admin && perms && perms.read_only === true;
      } catch {
        isReadOnly = false;
      }
      if (isReadOnly) {
        logAttempt({
          context_user_id: contextUser.id,
          personal_user_id: auth.user.id,
          person_id: auth.person.id,
          action_type: actionType,
          payload_summary: summarizePayload(payload),
          success: 0,
          error_code: 'READ_ONLY',
          ip,
          user_agent: userAgent,
        });
        return res.status(403).json({
          success: false,
          error: 'Compte en lecture seule — action impossible',
        });
      }

      // 4. Dispatcher
      const handler = handlers.get(actionType);
      if (!handler) {
        logAttempt({
          context_user_id: contextUser.id,
          personal_user_id: auth.user.id,
          person_id: auth.person.id,
          action_type: actionType,
          payload_summary: summarizePayload(payload),
          success: 0,
          error_code: 'NOT_IMPLEMENTED',
          ip,
          user_agent: userAgent,
        });
        return res.status(422).json({
          success: false,
          error: `Type d'action non supporté: ${actionType}`,
        });
      }

      try {
        const out = await handler({
          db,
          person: auth.person,
          personalUser: auth.user,
          contextUser,
          payload,
          req,
        });

        logAttempt({
          context_user_id: contextUser.id,
          personal_user_id: auth.user.id,
          person_id: auth.person.id,
          action_type: actionType,
          target_type: out?.targetType ?? null,
          target_id: out?.targetId ?? null,
          payload_summary: summarizePayload(payload),
          success: 1,
          ip,
          user_agent: userAgent,
        });

        return res.json({
          success: true,
          person: {
            id: auth.person.id,
            first_name: auth.person.first_name,
            last_name: auth.person.last_name,
          },
          actionType,
          result: out?.result ?? null,
        });
      } catch (err) {
        const status = Number.isInteger(err?.status) ? err.status : 500;
        const errorCode = err?.code || 'HANDLER_ERROR';
        logger.error(`Erreur handler personal-action ${actionType}:`, err);
        logAttempt({
          context_user_id: contextUser.id,
          personal_user_id: auth.user.id,
          person_id: auth.person.id,
          action_type: actionType,
          payload_summary: summarizePayload(payload),
          success: 0,
          error_code: errorCode,
          ip,
          user_agent: userAgent,
        });
        return res.status(status).json({
          success: false,
          error: err?.publicMessage || err?.message || 'Erreur lors de l\u2019exécution',
        });
      }
    },
  );
}
