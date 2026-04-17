// ═══════════════════════════════════════════════════════════════
// MODULE GESTION DES CONGÉS — Routes API Express
// Conforme Code du travail, IDCC 3252
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import db, { addToHistory } from './database.js';
import { alertLeaveCreated, alertLeaveDecision } from './emailService.js';
import logger from './logger.js';
import { validate } from './schemas/imports.js';
import {
  balanceUpdateSchema,
  calculateSchema,
  holidaySchema,
  justificationSchema,
  leaveCreateSchema,
  leaveDecisionSchema,
  leaveSignSchema,
} from './schemas/leaves.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════
// CONSTANTES MÉTIER — Code du travail + IDCC 3252
// ═══════════════════════════════════════

// Acquisition : 2,5 jours ouvrables / mois = 30 jours / an
const DAYS_PER_YEAR = 30;

// Période de référence : 1er juin → 31 mai
const REF_PERIOD_START_MONTH = 6; // juin

// Congé principal : min 12 jours ouvrables consécutifs entre 1er mai et 31 octobre
const MIN_CONSECUTIVE_DAYS = 12;
const SUMMER_START_MONTH = 5;
const SUMMER_END_MONTH = 10;

// Fermeture annuelle : 24 décembre → 1er janvier

// Date limite de pose des congés : 28 février
const DEADLINE_MONTH = 2;
const DEADLINE_DAY = 28;

// Délai minimum de modification : 1 mois avant le départ
const MIN_MODIFICATION_DAYS = 30;

// Congés exceptionnels — Durées légales (jours ouvrables)
// Conforme Code du travail Art. L3142-1 et IDCC 3252
const EXCEPTIONAL_LEAVE_DURATIONS = {
  mariage_salarie: { days: 4, label: 'Mariage du salarié', requiresJustification: true },
  pacs: { days: 4, label: "Conclusion d'un PACS", requiresJustification: true },
  mariage_enfant: { days: 1, label: "Mariage d'un enfant", requiresJustification: true },
  naissance: { days: 3, label: 'Naissance ou adoption', requiresJustification: true },
  deces_conjoint: { days: 3, label: 'Décès du conjoint/partenaire', requiresJustification: true },
  deces_enfant: { days: 12, label: "Décès d'un enfant (< 25 ans)", requiresJustification: true },
  deces_parent: { days: 3, label: 'Décès père/mère', requiresJustification: true },
  deces_beau_parent: { days: 3, label: 'Décès beau-père/belle-mère', requiresJustification: true },
  deces_frere_soeur: { days: 3, label: 'Décès frère/sœur', requiresJustification: true },
  deces_grand_parent: { days: 1, label: 'Décès grand-parent', requiresJustification: false },
  annonce_handicap: { days: 5, label: 'Annonce handicap enfant', requiresJustification: true },
  demenagement: { days: 1, label: 'Déménagement', requiresJustification: false },
};

// Types de congés
const LEAVE_TYPES = {
  conge_paye: { label: 'Congés payés annuels', icon: '🏖️', color: '#60a5fa', deductsBalance: true },
  sans_solde: { label: 'Congé sans solde', icon: '💤', color: '#fb923c', deductsBalance: false },
  exceptionnel: {
    label: 'Congé exceptionnel',
    icon: '🎉',
    color: '#a78bfa',
    deductsBalance: false,
  },
  maladie: {
    label: 'Congé maladie',
    icon: '🏥',
    color: '#f87171',
    deductsBalance: false,
    requiresJustification: true,
  },
  parental: { label: 'Congé parental', icon: '👶', color: '#f472b6', deductsBalance: false },
  sabbatique: { label: 'Congé sabbatique', icon: '🌍', color: '#34d399', deductsBalance: false },
  formation: { label: 'Congé de formation', icon: '🎓', color: '#8b5cf6', deductsBalance: false },
  fermeture: {
    label: 'Congés imposés (fermeture)',
    icon: '🔒',
    color: '#6b7280',
    deductsBalance: true,
  },
};

// ═══════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════

/**
 * Calcule le nombre de jours ouvrables (lundi → samedi) entre deux dates,
 * en excluant les jours fériés.
 * Conforme art. L3141-3 du Code du travail (jours ouvrables).
 */
function calcWorkingDays(startDate, endDate, startPeriod = 'AM', endPeriod = 'PM') {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return 0;

  // Récupérer les jours fériés pour la période
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const holidays = new Set();
  for (let y = startYear; y <= endYear; y++) {
    const rows = db.prepare('SELECT date FROM public_holidays WHERE year = ?').all(y);
    rows.forEach((r) => holidays.add(r.date));
  }

  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getDay(); // 0=dim, 1=lun, ..., 6=sam
    const dateStr = d.toISOString().split('T')[0];
    // Jours ouvrables = lundi (1) à samedi (6), hors dimanches (0) et fériés
    if (dow !== 0 && !holidays.has(dateStr)) {
      count++;
    }
    d.setDate(d.getDate() + 1);
  }

  // Ajustements demi-journées
  if (startPeriod === 'PM' && count > 0) count -= 0.5;
  if (endPeriod === 'AM' && count > 0) count -= 0.5;

  return Math.max(0, count);
}

/**
 * Détermine la période de référence pour une date donnée.
 * Période de référence : 1er juin N → 31 mai N+1
 */
function getReferencePeriod(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  if (month >= REF_PERIOD_START_MONTH) {
    return {
      start: `${year}-06-01`,
      end: `${year + 1}-05-31`,
      label: `${year}/${year + 1}`,
    };
  }
  return {
    start: `${year - 1}-06-01`,
    end: `${year}-05-31`,
    label: `${year - 1}/${year}`,
  };
}

/**
 * Vérifie si une date tombe dans la période de fermeture annuelle
 * (24 décembre → 1er janvier).
 */
function isInClosurePeriod(date) {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return (month === 12 && day >= 24) || (month === 1 && day <= 1);
}

/**
 * Vérifie si la demande respecte la règle des 12 jours consécutifs
 * entre le 1er mai et le 31 octobre.
 */
function checkMainLeaveRule(startDate, endDate, workingDays) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startMonth = start.getMonth() + 1;
  const endMonth = end.getMonth() + 1;

  // Si la demande est entre mai et octobre et dure 12+ jours, c'est conforme
  if (
    startMonth >= SUMMER_START_MONTH &&
    endMonth <= SUMMER_END_MONTH &&
    workingDays >= MIN_CONSECUTIVE_DAYS
  ) {
    return { valid: true, message: 'Conforme à la règle des 12 jours consécutifs mai-octobre' };
  }

  return { valid: true, message: '' }; // Pas de violation pour les courtes périodes
}

/**
 * Vérifie si la date limite de pose est respectée (28 février pour l'année en cours).
 */
function checkDeadline(requestDate, startDate) {
  const start = new Date(startDate);
  const request = new Date(requestDate);
  const year = start.getFullYear();
  const deadline = new Date(`${year}-${String(DEADLINE_MONTH).padStart(2, '0')}-${DEADLINE_DAY}`);

  // Les congés doivent être posés avant le 28 février de l'année du départ
  if (request > deadline && start.getFullYear() === request.getFullYear()) {
    return {
      valid: false,
      message: `Les congés pour ${year} doivent être posés avant le 28 février ${year}`,
    };
  }
  return { valid: true };
}

/**
 * Vérifie si la modification est encore possible (> 1 mois avant le départ).
 */
function canModify(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  const diffDays = Math.floor((start - now) / (1000 * 60 * 60 * 24));
  return diffDays >= MIN_MODIFICATION_DAYS;
}

/**
 * Calcule le score de priorité pour l'arbitrage des demandes simultanées.
 * Critères entreprise : ancienneté, situation familiale, charge événementielle.
 */
function calculatePriorityScore(personId) {
  let score = 0;

  const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
  if (!person) return 0;

  // Ancienneté (basée sur created_at)
  if (person.created_at) {
    const years = Math.floor(
      (Date.now() - new Date(person.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    );
    score += Math.min(years * 2, 20); // Max 20 points pour l'ancienneté
  }

  // Type de contrat (permanents prioritaires)
  if (person.type === 'permanent' || person.type === 'salarié') score += 10;

  return score;
}

// ═══════════════════════════════════════
// ROUTES API
// ═══════════════════════════════════════

export function setupLeaveRoutes(app, authenticateToken, requireAdmin) {
  // ──────────────────────────────────────
  // CONSTANTES ET TYPES DE CONGÉS
  // ──────────────────────────────────────

  // GET /api/leaves/types — Liste des types de congés
  app.get('/api/leaves/types', authenticateToken, (req, res) => {
    res.json({
      leaveTypes: LEAVE_TYPES,
      exceptionalTypes: EXCEPTIONAL_LEAVE_DURATIONS,
    });
  });

  // GET /api/leaves/holidays — Jours fériés
  app.get('/api/leaves/holidays', authenticateToken, (req, res) => {
    try {
      const { year } = req.query;
      let holidays;
      if (year) {
        holidays = db
          .prepare('SELECT * FROM public_holidays WHERE year = ? ORDER BY date')
          .all(year);
      } else {
        holidays = db.prepare('SELECT * FROM public_holidays ORDER BY date').all();
      }
      res.json(holidays);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/leaves/holidays — Ajouter un jour férié (admin)
  app.post(
    '/api/leaves/holidays',
    authenticateToken,
    requireAdmin,
    validate(holidaySchema),
    (req, res) => {
      try {
        const { date, name } = req.body;
        const year = new Date(date).getFullYear();
        db.prepare(
          'INSERT OR IGNORE INTO public_holidays (date, name, year, is_custom) VALUES (?, ?, ?, 1)',
        ).run(date, name, year);
        res.json({ success: true });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // DELETE /api/leaves/holidays/:id — Supprimer un jour férié custom (admin)
  app.delete('/api/leaves/holidays/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      db.prepare('DELETE FROM public_holidays WHERE id = ? AND is_custom = 1').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ──────────────────────────────────────
  // CALCULS
  // ──────────────────────────────────────

  // POST /api/leaves/calculate — Calcul de jours ouvrables pour une période
  app.post('/api/leaves/calculate', authenticateToken, validate(calculateSchema), (req, res) => {
    try {
      const { startDate, endDate, startPeriod, endPeriod, leaveType, exceptionalType } = req.body;

      // Pour les congés exceptionnels, utiliser la durée légale
      if (
        leaveType === 'exceptionnel' &&
        exceptionalType &&
        EXCEPTIONAL_LEAVE_DURATIONS[exceptionalType]
      ) {
        const exceptInfo = EXCEPTIONAL_LEAVE_DURATIONS[exceptionalType];
        return res.json({
          workingDays: exceptInfo.days,
          isExceptional: true,
          fixedDuration: true,
          label: exceptInfo.label,
          requiresJustification: exceptInfo.requiresJustification,
        });
      }

      const workingDays = calcWorkingDays(
        startDate,
        endDate,
        startPeriod || 'AM',
        endPeriod || 'PM',
      );

      // Récupérer les jours fériés dans la période
      const start = new Date(startDate);
      const end = new Date(endDate);
      const holidaysInPeriod = [];
      for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
        const rows = db
          .prepare(
            'SELECT date, name FROM public_holidays WHERE year = ? AND date >= ? AND date <= ?',
          )
          .all(y, startDate, endDate);
        holidaysInPeriod.push(...rows);
      }

      // Vérifications légales
      const warnings = [];

      // Vérifier la date limite de pose
      const deadlineCheck = checkDeadline(new Date().toISOString().split('T')[0], startDate);
      if (!deadlineCheck.valid) warnings.push(deadlineCheck.message);

      // Vérifier la période de fermeture
      const d = new Date(startDate);
      while (d <= end) {
        if (isInClosurePeriod(d)) {
          warnings.push(
            'Cette période chevauche la fermeture annuelle (24/12 → 01/01). Les congés y sont imposés.',
          );
          break;
        }
        d.setDate(d.getDate() + 1);
      }

      // Règle des 12 jours consécutifs
      const mainLeaveCheck = checkMainLeaveRule(startDate, endDate, workingDays);
      if (mainLeaveCheck.message) warnings.push(mainLeaveCheck.message);

      res.json({
        workingDays,
        holidaysInPeriod,
        warnings,
        referencePeriod: getReferencePeriod(startDate),
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ──────────────────────────────────────
  // CRÉATION DE DEMANDE
  // ──────────────────────────────────────

  // POST /api/leaves — Créer une demande de congé
  app.post('/api/leaves', authenticateToken, validate(leaveCreateSchema), (req, res) => {
    try {
      const {
        personId,
        leaveType,
        exceptionalType,
        startDate,
        endDate,
        startPeriod,
        endPeriod,
        employeeComment,
        signatureEmployee,
      } = req.body;

      // Validations de base
      if (!personId || !startDate || !endDate) {
        return res
          .status(400)
          .json({ success: false, error: 'person_id, start_date et end_date sont requis' });
      }
      if (!leaveType || !LEAVE_TYPES[leaveType]) {
        return res.status(400).json({ success: false, error: 'Type de congé invalide' });
      }

      // Vérifier que la personne existe
      const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
      if (!person) return res.status(404).json({ success: false, error: 'Personne non trouvée' });

      // Vérifier les dates
      if (new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({
          success: false,
          error: 'La date de fin doit être postérieure à la date de début',
        });
      }

      // Calculer les jours ouvrables
      let workingDays;
      if (
        leaveType === 'exceptionnel' &&
        exceptionalType &&
        EXCEPTIONAL_LEAVE_DURATIONS[exceptionalType]
      ) {
        workingDays = EXCEPTIONAL_LEAVE_DURATIONS[exceptionalType].days;
      } else {
        workingDays = calcWorkingDays(startDate, endDate, startPeriod || 'AM', endPeriod || 'PM');
      }

      if (workingDays <= 0) {
        return res.status(400).json({
          success: false,
          error: 'La période sélectionnée ne contient aucun jour ouvrable',
        });
      }

      // Vérifier le justificatif pour congé maladie et certains congés exceptionnels
      const typeConfig = LEAVE_TYPES[leaveType];
      if (typeConfig.requiresJustification && leaveType === 'maladie') {
        // Le justificatif sera uploadé en pièce jointe séparément
      }

      // Vérifier le solde pour les congés payés
      if (leaveType === 'conge_paye') {
        const year = new Date(startDate).getFullYear();
        const balance = db
          .prepare('SELECT * FROM leave_balances WHERE person_id = ? AND year = ? AND type = ?')
          .get(personId, year, 'conge_paye');

        if (balance) {
          const remaining = balance.days_entitled - balance.days_taken;
          if (workingDays > remaining) {
            return res.status(400).json({
              error: `Solde insuffisant. Restant : ${remaining} jours, demandé : ${workingDays} jours`,
              balance: { entitled: balance.days_entitled, taken: balance.days_taken, remaining },
            });
          }
        }
      }

      // Vérifier les chevauchements avec d'autres demandes acceptées
      const overlapping = db
        .prepare(
          `
        SELECT * FROM leave_requests 
        WHERE person_id = ? AND status IN ('pending', 'accepted')
        AND start_date <= ? AND end_date >= ?
      `,
        )
        .all(personId, endDate, startDate);

      if (overlapping.length > 0) {
        return res.status(409).json({
          error: 'Une demande de congé existe déjà pour cette période',
          existing: overlapping,
        });
      }

      // Calculer le score de priorité
      const priorityScore = calculatePriorityScore(personId);

      // Trouver le user_id associé à cette personne
      const userId = person.user_id || null;

      // Insérer la demande
      const result = db
        .prepare(
          `
        INSERT INTO leave_requests (
          person_id, user_id, request_date, leave_type, exceptional_type,
          start_date, end_date, start_period, end_period, working_days,
          employee_comment, status, signature_employee, signature_employee_date,
          priority_score
        ) VALUES (?, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
      `,
        )
        .run(
          personId,
          userId,
          leaveType,
          exceptionalType || null,
          startDate,
          endDate,
          startPeriod || 'AM',
          endPeriod || 'PM',
          workingDays,
          employeeComment || null,
          signatureEmployee || null,
          signatureEmployee ? new Date().toISOString() : null,
          priorityScore,
        );

      // Historiser la création
      db.prepare(
        `
        INSERT INTO leave_request_history (leave_request_id, action, new_value, performed_by)
        VALUES (?, 'created', ?, ?)
      `,
      ).run(
        result.lastInsertRowid,
        JSON.stringify({ leaveType, startDate, endDate, workingDays }),
        req.user.id,
      );

      // Créer aussi une entrée dans availabilities pour la visibilité dans le planning
      db.prepare(
        `
        INSERT INTO availabilities (person_id, start_date, end_date, start_period, end_period,
          type, reason, source, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'leave_request', 'pending', ?)
      `,
      ).run(
        personId,
        startDate,
        endDate,
        startPeriod || 'AM',
        endPeriod || 'PM',
        leaveType,
        employeeComment || `Demande de ${LEAVE_TYPES[leaveType]?.label || leaveType}`,
        req.user.id,
      );

      const created = db
        .prepare('SELECT * FROM leave_requests WHERE id = ?')
        .get(result.lastInsertRowid);

      addToHistory(
        'leave_request',
        result.lastInsertRowid,
        'created',
        { leaveType, startDate, endDate, workingDays },
        req.user.id,
        req.user.name,
      );

      // Alerte email aux admins
      try {
        const person = db
          .prepare('SELECT first_name, last_name FROM persons WHERE id = ?')
          .get(personId);
        const personName = person
          ? `${person.first_name || ''} ${person.last_name || ''}`.trim()
          : req.user.name;
        alertLeaveCreated(db, created, personName);
      } catch (emailErr) {
        logger.warn('Alerte email congé:', emailErr.message);
      }

      res.status(201).json(created);
    } catch (error) {
      logger.error('Erreur POST /api/leaves:', error);
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ──────────────────────────────────────
  // CONSULTATION
  // ──────────────────────────────────────

  // GET /api/leaves/mine — Mes demandes de congés (basé sur user_id ou person_id)
  app.get('/api/leaves/mine', authenticateToken, (req, res) => {
    try {
      // Trouver la personne liée à l'utilisateur
      const person = db.prepare('SELECT id FROM persons WHERE user_id = ?').get(req.user.id);
      if (!person) {
        return res.json([]); // Pas de profil personnel lié
      }

      const requests = db
        .prepare(
          `
        SELECT lr.*, p.first_name, p.last_name, p.email as person_email,
               u.name as decision_by_name
        FROM leave_requests lr
        JOIN persons p ON p.id = lr.person_id
        LEFT JOIN users u ON u.id = lr.decision_by
        WHERE lr.person_id = ?
        ORDER BY lr.created_at DESC
      `,
        )
        .all(person.id);

      res.json(requests);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/leaves — Toutes les demandes (admin uniquement)
  app.get('/api/leaves', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { status, personId, leaveType, startDate, endDate } = req.query;

      let sql = `
        SELECT lr.*, p.first_name, p.last_name, p.email as person_email, p.photo as person_photo,
               p.type as person_type, p.contract_type, p.created_at as person_created_at,
               u.name as decision_by_name
        FROM leave_requests lr
        JOIN persons p ON p.id = lr.person_id
        LEFT JOIN users u ON u.id = lr.decision_by
      `;
      const conditions = [];
      const params = [];

      if (status) {
        conditions.push('lr.status = ?');
        params.push(status);
      }
      if (personId) {
        conditions.push('lr.person_id = ?');
        params.push(personId);
      }
      if (leaveType) {
        conditions.push('lr.leave_type = ?');
        params.push(leaveType);
      }
      if (startDate) {
        conditions.push('lr.end_date >= ?');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('lr.start_date <= ?');
        params.push(endDate);
      }

      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
      sql += ' ORDER BY lr.created_at DESC';

      const requests = db.prepare(sql).all(...params);
      res.json(requests);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/leaves/pending — Demandes en attente (admin)
  app.get('/api/leaves/pending', authenticateToken, requireAdmin, (req, res) => {
    try {
      const requests = db
        .prepare(
          `
        SELECT lr.*, p.first_name, p.last_name, p.email as person_email, p.photo as person_photo,
               p.type as person_type, p.contract_type, p.created_at as person_created_at
        FROM leave_requests lr
        JOIN persons p ON p.id = lr.person_id
        WHERE lr.status = 'pending'
        ORDER BY lr.priority_score DESC, lr.created_at ASC
      `,
        )
        .all();
      res.json(requests);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/leaves/pending/count — Nombre de demandes en attente (admin)
  app.get('/api/leaves/pending/count', authenticateToken, requireAdmin, (req, res) => {
    try {
      const result = db
        .prepare('SELECT COUNT(*) as count FROM leave_requests WHERE status = ?')
        .get('pending');
      res.json({ count: result.count });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // GET /api/leaves/:id — Détail d'une demande
  app.get('/api/leaves/:id', authenticateToken, (req, res) => {
    try {
      const request = db
        .prepare(
          `
        SELECT lr.*, p.first_name, p.last_name, p.email as person_email, p.photo as person_photo,
               p.type as person_type, p.contract_type, p.created_at as person_created_at,
               u.name as decision_by_name, p.user_id as owner_user_id
        FROM leave_requests lr
        JOIN persons p ON p.id = lr.person_id
        LEFT JOIN users u ON u.id = lr.decision_by
        WHERE lr.id = ?
      `,
        )
        .get(req.params.id);

      if (!request) return res.status(404).json({ success: false, error: 'Demande non trouvée' });

      // Vérifier propriété : propriétaire ou admin
      const currentUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
      if (currentUser?.is_admin !== 1 && request.owner_user_id !== req.user.id) {
        return res
          .status(403)
          .json({ success: false, error: 'Accès non autorisé à cette demande' });
      }
      delete request.owner_user_id;

      // Charger l'historique
      request.history = db
        .prepare(
          `
        SELECT lrh.*, u.name as performer_name
        FROM leave_request_history lrh
        LEFT JOIN users u ON u.id = lrh.performed_by
        WHERE lrh.leave_request_id = ?
        ORDER BY lrh.performed_at
      `,
        )
        .all(req.params.id);

      // Marquer la réception si admin et pas encore fait
      if (currentUser?.is_admin && !request.reception_date && request.status === 'pending') {
        db.prepare('UPDATE leave_requests SET reception_date = datetime("now") WHERE id = ?').run(
          req.params.id,
        );
        request.reception_date = new Date().toISOString();
      }

      res.json(request);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ──────────────────────────────────────
  // DÉCISION (VALIDATION HIÉRARCHIQUE)
  // ──────────────────────────────────────

  // PUT /api/leaves/:id/decision — Accepter, refuser ou modifier une demande (admin)
  app.put(
    '/api/leaves/:id/decision',
    authenticateToken,
    requireAdmin,
    validate(leaveDecisionSchema),
    (req, res) => {
      try {
        const { status, adminComment, modifiedStartDate, modifiedEndDate, signatureAdmin } =
          req.body;

        const existing = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id);
        if (!existing)
          return res.status(404).json({ success: false, error: 'Demande non trouvée' });

        // Empêcher un admin d'approuver/modifier sa propre demande
        if (existing.user_id === req.user.id) {
          return res.status(403).json({
            success: false,
            error: 'Vous ne pouvez pas traiter votre propre demande de congé',
          });
        }

        if (existing.status !== 'pending') {
          return res.status(400).json({
            success: false,
            error: 'Seules les demandes en attente peuvent être traitées',
          });
        }

        // Motif obligatoire pour refus et modification
        if ((status === 'refused' || status === 'modified') && !adminComment) {
          return res.status(400).json({
            success: false,
            error: 'Le motif est obligatoire pour un refus ou une modification',
          });
        }

        // Pour une modification, vérifier les nouvelles dates
        let modifiedWorkingDays = null;
        if (status === 'modified') {
          if (!modifiedStartDate || !modifiedEndDate) {
            return res.status(400).json({
              success: false,
              error: 'Les nouvelles dates sont requises pour une modification',
            });
          }
          modifiedWorkingDays = calcWorkingDays(
            modifiedStartDate,
            modifiedEndDate,
            existing.start_period,
            existing.end_period,
          );
        }

        // Transaction atomique pour la décision
        const effectiveStartDate = status === 'modified' ? modifiedStartDate : existing.start_date;
        const effectiveEndDate = status === 'modified' ? modifiedEndDate : existing.end_date;
        const availStatus =
          status === 'accepted' || status === 'modified' ? 'approved' : 'rejected';

        db.transaction(() => {
          // Mettre à jour la demande
          db.prepare(
            `
          UPDATE leave_requests SET
            status = ?, admin_comment = ?, decision_date = datetime('now'), decision_by = ?,
            modified_start_date = ?, modified_end_date = ?, modified_working_days = ?,
            signature_admin = ?, signature_admin_date = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
          ).run(
            status,
            adminComment || null,
            req.user.id,
            modifiedStartDate || null,
            modifiedEndDate || null,
            modifiedWorkingDays,
            signatureAdmin || null,
            signatureAdmin ? new Date().toISOString() : null,
            req.params.id,
          );

          // Si accepté ou modifié, mettre à jour le solde de congés (si type déductible)
          if (
            (status === 'accepted' || status === 'modified') &&
            LEAVE_TYPES[existing.leave_type]?.deductsBalance
          ) {
            const effectiveDays =
              status === 'modified' ? modifiedWorkingDays : existing.working_days;
            const year = new Date(existing.start_date).getFullYear();

            const balance = db
              .prepare('SELECT * FROM leave_balances WHERE person_id = ? AND year = ? AND type = ?')
              .get(existing.person_id, year, existing.leave_type);

            if (balance) {
              db.prepare('UPDATE leave_balances SET days_taken = days_taken + ? WHERE id = ?').run(
                effectiveDays,
                balance.id,
              );
            } else {
              db.prepare(
                'INSERT INTO leave_balances (person_id, year, type, days_entitled, days_taken) VALUES (?, ?, ?, ?, ?)',
              ).run(existing.person_id, year, existing.leave_type, DAYS_PER_YEAR, effectiveDays);
            }
          }

          // Mettre à jour la disponibilité correspondante dans le planning
          db.prepare(
            `
          UPDATE availabilities SET 
            status = ?, approved_by = ?, approved_at = datetime('now'),
            rejection_reason = ?,
            start_date = ?, end_date = ?
          WHERE person_id = ? AND source = 'leave_request'
            AND start_date = ? AND end_date = ?
        `,
          ).run(
            availStatus,
            req.user.id,
            status === 'refused' ? adminComment : null,
            effectiveStartDate,
            effectiveEndDate,
            existing.person_id,
            existing.start_date,
            existing.end_date,
          );

          // Historiser la décision
          db.prepare(
            `
          INSERT INTO leave_request_history (leave_request_id, action, old_value, new_value, performed_by)
          VALUES (?, 'status_changed', ?, ?, ?)
        `,
          ).run(
            req.params.id,
            JSON.stringify({ status: 'pending' }),
            JSON.stringify({ status, adminComment, modifiedStartDate, modifiedEndDate }),
            req.user.id,
          );
        })();

        addToHistory(
          'leave_request',
          req.params.id,
          `decision_${status}`,
          { adminComment, modifiedStartDate, modifiedEndDate },
          req.user.id,
          req.user.name,
        );

        const updated = db
          .prepare(
            `
        SELECT lr.*, p.first_name, p.last_name, u.name as decision_by_name
        FROM leave_requests lr
        JOIN persons p ON p.id = lr.person_id
        LEFT JOIN users u ON u.id = lr.decision_by
        WHERE lr.id = ?
      `,
          )
          .get(req.params.id);

        // Alerte email à l'employé (décision)
        try {
          alertLeaveDecision(db, { ...updated, status }, req.user.name);
        } catch (emailErr) {
          logger.warn('Alerte email décision congé:', emailErr.message);
        }

        res.json(updated);
      } catch (error) {
        logger.error('Erreur PUT /api/leaves/:id/decision:', error);
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ──────────────────────────────────────
  // SIGNATURE
  // ──────────────────────────────────────

  // PUT /api/leaves/:id/sign — Ajouter une signature (salarié ou admin)
  app.put('/api/leaves/:id/sign', authenticateToken, validate(leaveSignSchema), (req, res) => {
    try {
      const { signature, role } = req.body; // role = 'employee' ou 'admin'

      const existing = db
        .prepare(
          'SELECT lr.*, p.user_id as owner_user_id FROM leave_requests lr JOIN persons p ON p.id = lr.person_id WHERE lr.id = ?',
        )
        .get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Demande non trouvée' });

      // Vérifier propriété pour signature employee, ou admin pour signature admin
      const currentUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
      if (role === 'employee' && existing.owner_user_id !== req.user.id) {
        return res
          .status(403)
          .json({ success: false, error: 'Vous ne pouvez signer que vos propres demandes' });
      }
      if (role === 'admin' && currentUser?.is_admin !== 1) {
        return res.status(403).json({ success: false, error: 'Accès admin requis' });
      }

      if (role !== 'employee' && role !== 'admin') {
        return res
          .status(400)
          .json({ success: false, error: 'Rôle invalide. Valeurs : employee, admin' });
      }

      db.transaction(() => {
        if (role === 'employee') {
          db.prepare(
            `
            UPDATE leave_requests SET signature_employee = ?, signature_employee_date = datetime('now'), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          ).run(signature, req.params.id);
        } else {
          db.prepare(
            `
            UPDATE leave_requests SET signature_admin = ?, signature_admin_date = datetime('now'), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          ).run(signature, req.params.id);
        }

        // Historiser
        db.prepare(
          `
          INSERT INTO leave_request_history (leave_request_id, action, new_value, performed_by)
          VALUES (?, 'signed', ?, ?)
        `,
        ).run(req.params.id, JSON.stringify({ role }), req.user.id);
      })();

      const updated = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ──────────────────────────────────────
  // ANNULATION
  // ──────────────────────────────────────

  // PUT /api/leaves/:id/cancel — Annuler une demande (salarié, si délai respecté)
  app.put('/api/leaves/:id/cancel', authenticateToken, (req, res) => {
    try {
      const existing = db
        .prepare(
          'SELECT lr.*, p.user_id as owner_user_id FROM leave_requests lr JOIN persons p ON p.id = lr.person_id WHERE lr.id = ?',
        )
        .get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Demande non trouvée' });

      // Vérifier propriété : propriétaire ou admin
      const currentUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
      if (currentUser?.is_admin !== 1 && existing.owner_user_id !== req.user.id) {
        return res
          .status(403)
          .json({ success: false, error: 'Vous ne pouvez annuler que vos propres demandes' });
      }

      // Seules les demandes pending ou accepted peuvent être annulées
      if (!['pending', 'accepted'].includes(existing.status)) {
        return res
          .status(400)
          .json({ success: false, error: 'Cette demande ne peut plus être annulée' });
      }

      // Si acceptée, vérifier le délai de modification (1 mois)
      if (existing.status === 'accepted' && !canModify(existing.start_date)) {
        return res.status(400).json({
          error:
            "Modification impossible : le départ est dans moins d'un mois. Contactez votre responsable.",
        });
      }

      db.transaction(() => {
        db.prepare(
          `
          UPDATE leave_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `,
        ).run(req.params.id);

        // Si la demande était acceptée et avait réduit le solde, le rétablir
        if (existing.status === 'accepted' && LEAVE_TYPES[existing.leave_type]?.deductsBalance) {
          const year = new Date(existing.start_date).getFullYear();
          db.prepare(
            `
            UPDATE leave_balances SET days_taken = MAX(0, days_taken - ?) 
            WHERE person_id = ? AND year = ? AND type = ?
          `,
          ).run(existing.working_days, existing.person_id, year, existing.leave_type);
        }

        // Supprimer l'entrée de disponibilité correspondante
        db.prepare(
          `
          DELETE FROM availabilities 
          WHERE person_id = ? AND source = 'leave_request'
            AND start_date = ? AND end_date = ?
        `,
        ).run(existing.person_id, existing.start_date, existing.end_date);

        // Historiser
        db.prepare(
          `
          INSERT INTO leave_request_history (leave_request_id, action, old_value, performed_by)
          VALUES (?, 'cancelled', ?, ?)
        `,
        ).run(req.params.id, JSON.stringify({ status: existing.status }), req.user.id);
      })();

      res.json({ success: true, message: 'Demande annulée' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ──────────────────────────────────────
  // UPLOAD JUSTIFICATIF
  // ──────────────────────────────────────

  // POST /api/leaves/:id/justification — Upload du justificatif
  app.post(
    '/api/leaves/:id/justification',
    authenticateToken,
    validate(justificationSchema),
    (req, res) => {
      try {
        const existing = db
          .prepare(
            'SELECT lr.*, p.user_id as owner_user_id FROM leave_requests lr JOIN persons p ON p.id = lr.person_id WHERE lr.id = ?',
          )
          .get(req.params.id);
        if (!existing)
          return res.status(404).json({ success: false, error: 'Demande non trouvée' });

        // Vérifier propriété : propriétaire ou admin
        const currentUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
        if (currentUser?.is_admin !== 1 && existing.owner_user_id !== req.user.id) {
          return res
            .status(403)
            .json({ success: false, error: 'Vous ne pouvez modifier que vos propres demandes' });
        }

        // Le fichier est envoyé en base64 dans le body
        const { filename, data } = req.body;
        if (!filename || !data) {
          return res
            .status(400)
            .json({ success: false, error: 'Fichier requis (filename + data en base64)' });
        }

        // [SECURITY] Valider l'extension du fichier
        const ALLOWED_JUSTIFICATION_EXTS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
        const MAX_JUSTIFICATION_SIZE = 10 * 1024 * 1024; // 10 Mo
        const ext = path.extname(filename).toLowerCase();
        if (!ALLOWED_JUSTIFICATION_EXTS.includes(ext)) {
          return res.status(400).json({
            success: false,
            error: 'Type de fichier non autorisé (PDF, JPG, PNG, WebP uniquement)',
          });
        }

        // [SECURITY] Décoder et vérifier la taille
        const buffer = Buffer.from(data, 'base64');
        if (buffer.length > MAX_JUSTIFICATION_SIZE) {
          return res
            .status(400)
            .json({ success: false, error: 'Fichier trop volumineux (max 10 Mo)' });
        }

        // Créer le dossier de justificatifs
        const justificationsDir = path.join(
          __dirname,
          '..',
          '..',
          'public',
          'leave-justifications',
        );
        if (!fs.existsSync(justificationsDir)) {
          fs.mkdirSync(justificationsDir, { recursive: true });
        }

        // Sauvegarder le fichier
        const safeName = `${existing.id}_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const filePath = path.join(justificationsDir, safeName);
        fs.writeFileSync(filePath, buffer);

        // Mettre à jour la demande
        db.prepare(
          `
        UPDATE leave_requests SET justification_path = ?, justification_filename = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        ).run(`/leave-justifications/${safeName}`, filename, req.params.id);

        res.json({ success: true, path: `/leave-justifications/${safeName}` });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ──────────────────────────────────────
  // SOLDES DE CONGÉS (enrichi)
  // ──────────────────────────────────────

  // GET /api/leaves/balances — Soldes de congés avec calcul automatique (admin)
  app.get('/api/leaves/balances', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { personId, year } = req.query;
      const targetYear = year || new Date().getFullYear();

      if (personId) {
        const balance = getOrCreateBalance(personId, targetYear);
        return res.json(balance);
      }

      // Tous les personnels actifs
      const persons = db
        .prepare("SELECT id, first_name, last_name FROM persons WHERE status = 'active'")
        .all();
      const balances = persons.map((p) => ({
        ...p,
        balance: getOrCreateBalance(p.id, targetYear),
      }));

      res.json(balances);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // PUT /api/leaves/balances — Mettre à jour le solde (admin)
  app.put(
    '/api/leaves/balances',
    authenticateToken,
    requireAdmin,
    validate(balanceUpdateSchema),
    (req, res) => {
      try {
        const { personId, year, type, daysEntitled } = req.body;

        const leaveType = type || 'conge_paye';
        const entitled = daysEntitled !== undefined ? daysEntitled : DAYS_PER_YEAR;

        const existing = db
          .prepare('SELECT * FROM leave_balances WHERE person_id = ? AND year = ? AND type = ?')
          .get(personId, year, leaveType);

        if (existing) {
          db.prepare('UPDATE leave_balances SET days_entitled = ? WHERE id = ?').run(
            entitled,
            existing.id,
          );
        } else {
          db.prepare(
            'INSERT INTO leave_balances (person_id, year, type, days_entitled, days_taken) VALUES (?, ?, ?, ?, 0)',
          ).run(personId, year, leaveType, entitled);
        }

        res.json(getOrCreateBalance(personId, year));
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ──────────────────────────────────────
  // GÉNÉRATION PDF
  // ──────────────────────────────────────

  // GET /api/leaves/:id/pdf — Générer et télécharger le PDF récapitulatif
  app.get('/api/leaves/:id/pdf', authenticateToken, (req, res) => {
    try {
      const request = db
        .prepare(
          `
        SELECT lr.*, p.first_name, p.last_name, p.email as person_email,
               p.type as person_type, p.contract_type,
               u.name as decision_by_name, p.user_id as owner_user_id
        FROM leave_requests lr
        JOIN persons p ON p.id = lr.person_id
        LEFT JOIN users u ON u.id = lr.decision_by
        WHERE lr.id = ?
      `,
        )
        .get(req.params.id);

      if (!request) return res.status(404).json({ success: false, error: 'Demande non trouvée' });

      // Vérifier propriété : propriétaire ou admin
      const currentUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
      if (currentUser?.is_admin !== 1 && request.owner_user_id !== req.user.id) {
        return res
          .status(403)
          .json({ success: false, error: 'Accès non autorisé à cette demande' });
      }
      delete request.owner_user_id;

      // Générer le HTML du PDF
      const html = generateLeaveRequestPdfHtml(request);

      // Retourner le HTML (le client le convertira en PDF via window.print/jsPDF)
      res.json({
        html,
        request,
        filename: `conge_${request.first_name}_${request.last_name}_${request.start_date}.pdf`,
      });
    } catch (error) {
      logger.error('Erreur PDF:', error);
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ──────────────────────────────────────
  // STATISTIQUES
  // ──────────────────────────────────────

  // GET /api/leaves/stats — Statistiques congés (admin)
  app.get('/api/leaves/stats', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { year } = req.query;
      const targetYear = year || new Date().getFullYear();

      const stats = {
        total: db
          .prepare(
            'SELECT COUNT(*) as count FROM leave_requests WHERE strftime("%Y", start_date) = ?',
          )
          .get(String(targetYear)).count,
        pending: db
          .prepare(
            'SELECT COUNT(*) as count FROM leave_requests WHERE status = "pending" AND strftime("%Y", start_date) = ?',
          )
          .get(String(targetYear)).count,
        accepted: db
          .prepare(
            'SELECT COUNT(*) as count FROM leave_requests WHERE status = "accepted" AND strftime("%Y", start_date) = ?',
          )
          .get(String(targetYear)).count,
        refused: db
          .prepare(
            'SELECT COUNT(*) as count FROM leave_requests WHERE status = "refused" AND strftime("%Y", start_date) = ?',
          )
          .get(String(targetYear)).count,
        modified: db
          .prepare(
            'SELECT COUNT(*) as count FROM leave_requests WHERE status = "modified" AND strftime("%Y", start_date) = ?',
          )
          .get(String(targetYear)).count,
        totalDays: db
          .prepare(
            'SELECT COALESCE(SUM(working_days), 0) as total FROM leave_requests WHERE status IN ("accepted", "modified") AND strftime("%Y", start_date) = ?',
          )
          .get(String(targetYear)).total,
        byType: db
          .prepare(
            `
          SELECT leave_type, COUNT(*) as count, COALESCE(SUM(working_days), 0) as total_days
          FROM leave_requests
          WHERE strftime("%Y", start_date) = ? AND status IN ('accepted', 'modified')
          GROUP BY leave_type
        `,
          )
          .all(String(targetYear)),
        byMonth: db
          .prepare(
            `
          SELECT strftime("%m", start_date) as month, COUNT(*) as count
          FROM leave_requests
          WHERE strftime("%Y", start_date) = ? AND status IN ('accepted', 'modified')
          GROUP BY strftime("%m", start_date)
          ORDER BY month
        `,
          )
          .all(String(targetYear)),
      };

      res.json(stats);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ──────────────────────────────────────
  // CONFLITS & ARBITRAGE
  // ──────────────────────────────────────

  // GET /api/leaves/conflicts — Demandes simultanées (admin)
  app.get('/api/leaves/conflicts', authenticateToken, requireAdmin, (req, res) => {
    try {
      // Trouver les demandes qui se chevauchent et sont pending
      const pending = db
        .prepare(
          `
        SELECT lr.*, p.first_name, p.last_name, p.type as person_type
        FROM leave_requests lr
        JOIN persons p ON p.id = lr.person_id
        WHERE lr.status = 'pending'
        ORDER BY lr.priority_score DESC, lr.start_date
      `,
        )
        .all();

      // Grouper les conflits
      const conflicts = [];
      for (let i = 0; i < pending.length; i++) {
        for (let j = i + 1; j < pending.length; j++) {
          if (
            pending[i].start_date <= pending[j].end_date &&
            pending[i].end_date >= pending[j].start_date
          ) {
            conflicts.push({
              request1: pending[i],
              request2: pending[j],
              overlapStart:
                pending[i].start_date > pending[j].start_date
                  ? pending[i].start_date
                  : pending[j].start_date,
              overlapEnd:
                pending[i].end_date < pending[j].end_date
                  ? pending[i].end_date
                  : pending[j].end_date,
            });
          }
        }
      }

      res.json(conflicts);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ──────────────────────────────────────
  // HISTORIQUE
  // ──────────────────────────────────────

  // GET /api/leaves/:id/history — Historique d'une demande
  app.get('/api/leaves/:id/history', authenticateToken, (req, res) => {
    try {
      // Vérifier propriété : propriétaire ou admin
      const leaveReq = db
        .prepare(
          'SELECT lr.person_id, p.user_id as owner_user_id FROM leave_requests lr JOIN persons p ON p.id = lr.person_id WHERE lr.id = ?',
        )
        .get(req.params.id);
      if (!leaveReq) return res.status(404).json({ success: false, error: 'Demande non trouvée' });
      const currentUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
      if (currentUser?.is_admin !== 1 && leaveReq.owner_user_id !== req.user.id) {
        return res
          .status(403)
          .json({ success: false, error: 'Accès non autorisé à cette demande' });
      }

      const history = db
        .prepare(
          `
        SELECT lrh.*, u.name as performer_name
        FROM leave_request_history lrh
        LEFT JOIN users u ON u.id = lrh.performed_by
        WHERE lrh.leave_request_id = ?
        ORDER BY lrh.performed_at
      `,
        )
        .all(req.params.id);
      res.json(history);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ──────────────────────────────────────
  // HELPER : getOrCreateBalance
  // ──────────────────────────────────────

  function getOrCreateBalance(personId, year) {
    let balance = db
      .prepare('SELECT * FROM leave_balances WHERE person_id = ? AND year = ? AND type = ?')
      .get(personId, year, 'conge_paye');

    if (!balance) {
      db.prepare(
        'INSERT INTO leave_balances (person_id, year, type, days_entitled, days_taken) VALUES (?, ?, ?, ?, 0)',
      ).run(personId, year, 'conge_paye', DAYS_PER_YEAR);
      balance = db
        .prepare('SELECT * FROM leave_balances WHERE person_id = ? AND year = ? AND type = ?')
        .get(personId, year, 'conge_paye');
    }

    // Vérifier le report de l'année précédente (jusqu'au 31 décembre)
    const prevYear = parseInt(year) - 1;
    const prevBalance = db
      .prepare('SELECT * FROM leave_balances WHERE person_id = ? AND year = ? AND type = ?')
      .get(personId, prevYear, 'conge_paye');

    let carryOver = 0;
    if (prevBalance) {
      const remaining = prevBalance.days_entitled - prevBalance.days_taken;
      // Report autorisé jusqu'au 31 décembre de l'année suivante
      const today = new Date();
      const carryOverDeadline = new Date(`${year}-12-31`);
      if (remaining > 0 && today <= carryOverDeadline) {
        carryOver = remaining;
      }
    }

    return {
      ...balance,
      remaining: balance.days_entitled - balance.days_taken,
      carryOver,
      totalAvailable: balance.days_entitled - balance.days_taken + carryOver,
    };
  }
}

// ═══════════════════════════════════════
// GÉNÉRATEUR PDF HTML
// ═══════════════════════════════════════

function generateLeaveRequestPdfHtml(request) {
  const statusLabels = {
    pending: 'En attente de validation',
    accepted: 'Acceptée',
    refused: 'Refusée',
    modified: 'Modifiée',
    cancelled: 'Annulée',
  };

  const statusColors = {
    pending: '#f59e0b',
    accepted: '#10b981',
    refused: '#ef4444',
    modified: '#3b82f6',
    cancelled: '#6b7280',
  };

  const leaveTypeLabels = {
    conge_paye: 'Congés payés annuels',
    sans_solde: 'Congé sans solde',
    exceptionnel: 'Congé exceptionnel',
    maladie: 'Congé maladie',
    parental: 'Congé parental',
    sabbatique: 'Congé sabbatique',
    formation: 'Congé de formation',
    fermeture: 'Congés imposés (fermeture)',
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const exceptionalLabel =
    request.exceptional_type && EXCEPTIONAL_LEAVE_DURATIONS[request.exceptional_type]
      ? ` — ${EXCEPTIONAL_LEAVE_DURATIONS[request.exceptional_type].label}`
      : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Demande de congé — ${request.first_name} ${request.last_name}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; line-height: 1.5; font-size: 11pt; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
    .company { font-size: 18pt; font-weight: bold; color: #1e40af; }
    .company-sub { font-size: 9pt; color: #64748b; }
    .doc-title { text-align: center; font-size: 16pt; font-weight: bold; color: #1e40af; margin: 20px 0; text-transform: uppercase; letter-spacing: 1px; }
    .doc-ref { text-align: center; font-size: 9pt; color: #94a3b8; margin-bottom: 25px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 11pt; font-weight: bold; color: #1e40af; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: 180px 1fr; gap: 6px 15px; }
    .info-label { font-weight: 600; color: #475569; }
    .info-value { color: #1e293b; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 10pt; color: white; background: ${statusColors[request.status] || '#6b7280'}; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
    .sig-box { width: 45%; text-align: center; }
    .sig-label { font-weight: 600; color: #475569; margin-bottom: 8px; }
    .sig-img { max-width: 200px; max-height: 80px; margin: 10px auto; }
    .sig-date { font-size: 9pt; color: #94a3b8; }
    .sig-line { border-bottom: 1px solid #cbd5e1; height: 60px; margin: 10px 0; }
    .legal { margin-top: 30px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 8pt; color: #94a3b8; }
    .legal-title { font-weight: 600; color: #64748b; margin-bottom: 4px; }
    .footer { text-align: center; font-size: 8pt; color: #94a3b8; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">${process.env.COMPANY_NAME || 'Mon Entreprise'}</div>
      <div class="company-sub">Convention collective IDCC 3252<br>Prestataires de services du spectacle vivant</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:9pt;color:#64748b">Réf. demande n°${request.id}</div>
      <div style="font-size:9pt;color:#64748b">Date : ${formatDate(request.request_date)}</div>
    </div>
  </div>

  <div class="doc-title">Demande de congé</div>
  <div class="doc-ref">Document généré le ${formatDate(new Date().toISOString())} — Application eM@g</div>

  <div class="section">
    <div class="section-title">Identité du salarié</div>
    <div class="info-grid">
      <div class="info-label">Nom et prénom :</div>
      <div class="info-value">${request.last_name} ${request.first_name}</div>
      <div class="info-label">Type :</div>
      <div class="info-value">${request.person_type || '—'}</div>
      <div class="info-label">Contrat :</div>
      <div class="info-value">${request.contract_type || '—'}</div>
      <div class="info-label">Email :</div>
      <div class="info-value">${request.person_email || '—'}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Détails de la demande</div>
    <div class="info-grid">
      <div class="info-label">Type de congé :</div>
      <div class="info-value">${leaveTypeLabels[request.leave_type] || request.leave_type}${exceptionalLabel}</div>
      <div class="info-label">Période demandée :</div>
      <div class="info-value">Du ${formatDate(request.start_date)} (${request.start_period === 'AM' ? 'matin' : 'après-midi'}) au ${formatDate(request.end_date)} (${request.end_period === 'AM' ? 'matin' : 'après-midi'})</div>
      <div class="info-label">Jours ouvrables :</div>
      <div class="info-value"><strong>${request.working_days} jour${request.working_days > 1 ? 's' : ''}</strong></div>
      ${
        request.employee_comment
          ? `
      <div class="info-label">Remarques du salarié :</div>
      <div class="info-value">${request.employee_comment}</div>`
          : ''
      }
    </div>
  </div>

  <div class="section">
    <div class="section-title">Décision hiérarchique</div>
    <div class="info-grid">
      <div class="info-label">Statut :</div>
      <div class="info-value"><span class="status-badge">${statusLabels[request.status]}</span></div>
      ${
        request.decision_date
          ? `
      <div class="info-label">Date de décision :</div>
      <div class="info-value">${formatDate(request.decision_date)}</div>`
          : ''
      }
      ${
        request.decision_by_name
          ? `
      <div class="info-label">Décidé par :</div>
      <div class="info-value">${request.decision_by_name}</div>`
          : ''
      }
      ${
        request.admin_comment
          ? `
      <div class="info-label">Motif / Commentaire :</div>
      <div class="info-value">${request.admin_comment}</div>`
          : ''
      }
      ${
        request.modified_start_date
          ? `
      <div class="info-label">Période modifiée :</div>
      <div class="info-value">Du ${formatDate(request.modified_start_date)} au ${formatDate(request.modified_end_date)} (${request.modified_working_days || '?'} jours)</div>`
          : ''
      }
      ${
        request.reception_date
          ? `
      <div class="info-label">Date de réception :</div>
      <div class="info-value">${formatDate(request.reception_date)}</div>`
          : ''
      }
    </div>
  </div>

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-label">Signature du salarié</div>
      ${
        request.signature_employee
          ? `<img class="sig-img" src="${request.signature_employee}" alt="Signature salarié" />`
          : '<div class="sig-line"></div>'
      }
      <div class="sig-date">${request.signature_employee_date ? formatDate(request.signature_employee_date) : 'Non signé'}</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Signature de l'employeur</div>
      ${
        request.signature_admin
          ? `<img class="sig-img" src="${request.signature_admin}" alt="Signature admin" />`
          : '<div class="sig-line"></div>'
      }
      <div class="sig-date">${request.signature_admin_date ? formatDate(request.signature_admin_date) : 'Non signé'}</div>
    </div>
  </div>

  <div class="legal">
    <div class="legal-title">Références légales</div>
    <p>
      • Code du travail — Articles L3141-1 à L3141-33 (Congés payés)<br>
      • Convention collective IDCC 3252 — Prestataires de services du spectacle vivant<br>
      • Politique de gestion des congés de l'entreprise<br>
      • Acquisition : 2,5 jours ouvrables par mois travaillé (30 jours/an)<br>
      • Période de référence : 1er juin → 31 mai<br>
      • Congé principal : minimum 12 jours ouvrables consécutifs entre le 1er mai et le 31 octobre<br>
      • Date limite de pose des congés : 28 février de l'année concernée<br>
      • Modification impossible moins d'un mois avant le départ (sauf circonstances exceptionnelles)
    </p>
  </div>

  <div class="footer">
    ${process.env.COMPANY_NAME || 'Mon Entreprise'} — eM@g — Document confidentiel — ${new Date().getFullYear()}
  </div>
</body>
</html>`;
}

export { EXCEPTIONAL_LEAVE_DURATIONS, LEAVE_TYPES };
