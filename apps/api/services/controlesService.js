// ═══════════════════════════════════════════════════════════════
// services/controlesService.js — Logique métier pure
//
// Fonctions exportées :
//   - STATUSES                    : constantes
//   - computeStatus(control, now) : recalcule le statut d'après les dates
//   - addDays(isoDate, days)      : utilitaire date
//   - performControl(db, id, payload, userId)
//   - recomputeAllStatuses(db)    : appelée par le scheduler
// ═══════════════════════════════════════════════════════════════

export const STATUS = {
  A_FAIRE: 'A_FAIRE',
  EN_RETARD: 'EN_RETARD',
  MANQUE: 'MANQUE',
  EFFECTUE: 'EFFECTUE',
};

export function todayIso(now = new Date()) {
  // Heure LOCALE du serveur (pas UTC) : évite que les utilisateurs voient
  // la « date d'hier » entre minuit local et minuit UTC. Le serveur de prod
  // doit tourner dans la TZ des opérateurs (Indian/Reunion ou Europe/Paris).
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

export function diffDays(fromIso, toIso) {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * Calcule le statut d'un contrôle.
 *  - EFFECTUE : last_done_date >= today ET next_due > today (juste fait)
 *  - A_FAIRE  : next_due_date >= today
 *  - EN_RETARD: today > next_due_date ET (today - next_due) <= missed_after_days
 *  - MANQUE   : today > next_due_date + missed_after_days  → auto-reprogrammation
 */
export function computeStatus(control, now = new Date()) {
  const today = todayIso(now);
  const due = control.next_due_date;
  if (!due) return STATUS.A_FAIRE;
  if (due >= today) return STATUS.A_FAIRE;
  const overdueDays = diffDays(due, today);
  const missedAfter = Number(control.missed_after_days || 30);
  if (overdueDays > missedAfter) return STATUS.MANQUE;
  return STATUS.EN_RETARD;
}

/**
 * Effectue un contrôle (insère history, met à jour next_due_date, last_done_date, status).
 * Retourne { control, history }.
 *
 * Cooldown : refuse 409 si un performControl a déjà été enregistré pour ce contrôle
 * dans les `cooldownMs` dernières millisecondes (anti double-clic + anti-spam UI).
 * Le cooldown s'évalue sur `control_history.created_at` (timestamp serveur),
 * et non sur `performed_at` (date métier saisie). Désactivable via `payload.skipCooldown`
 * pour les usages internes (scheduler MANQUE, scripts d'import).
 */
const PERFORM_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 h

export function performControl(db, controlId, payload, userId = null) {
  const ctrl = db
    .prepare(
      `SELECT ec.*, ct.default_periodicity_days, ct.missed_after_days
         FROM equipment_controls ec
         JOIN control_types ct ON ct.id = ec.control_type_id
        WHERE ec.id = ? AND ec.is_active = 1`,
    )
    .get(controlId);
  if (!ctrl) {
    const err = new Error('Contrôle introuvable');
    err.statusCode = 404;
    throw err;
  }

  // ─── Cooldown anti-doublon (par défaut 24 h, bypass via skipCooldown) ───
  if (!payload.skipCooldown) {
    const last = db
      .prepare(
        `SELECT created_at FROM control_history
          WHERE equipment_control_id = ?
          ORDER BY id DESC LIMIT 1`,
      )
      .get(controlId);
    if (last && last.created_at) {
      const lastMs = new Date(last.created_at.replace(' ', 'T') + 'Z').getTime();
      if (!Number.isNaN(lastMs) && Date.now() - lastMs < PERFORM_COOLDOWN_MS) {
        const err = new Error(
          'Contrôle déjà effectué dans les dernières 24 h. ' +
            "Pour corriger une erreur, modifiez la dernière entrée d'historique.",
        );
        err.statusCode = 409;
        throw err;
      }
    }
  }

  const performedAt = payload.performed_at;
  const periodicity = Number(ctrl.periodicity_days || ctrl.default_periodicity_days || 365);
  const nextDue = payload.next_due_date || addDays(performedAt, periodicity);
  const documents = payload.documents ? JSON.stringify(payload.documents) : null;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO control_history
        (equipment_control_id, performed_at, performed_by, status,
         previous_due_date, next_due_date, notes, documents)
       VALUES (?, ?, ?, 'EFFECTUE', ?, ?, ?, ?)`,
    ).run(
      controlId,
      performedAt,
      userId,
      ctrl.next_due_date,
      nextDue,
      payload.notes || null,
      documents,
    );

    db.prepare(
      `UPDATE equipment_controls
          SET last_done_date = ?,
              next_due_date  = ?,
              status         = 'A_FAIRE',
              updated_at     = CURRENT_TIMESTAMP
        WHERE id = ?`,
    ).run(performedAt, nextDue, controlId);
  });
  tx();

  return getControlById(db, controlId);
}

export function getControlById(db, id) {
  return db
    .prepare(
      `SELECT ec.*, ct.code AS type_code, ct.name AS type_name,
              ct.missed_after_days, ct.default_periodicity_days,
              u.name AS assigned_name, u.email AS assigned_email
         FROM equipment_controls ec
         JOIN control_types ct ON ct.id = ec.control_type_id
    LEFT JOIN users u ON u.id = ec.assigned_to
        WHERE ec.id = ?`,
    )
    .get(id);
}

/**
 * Recalcule le status de tous les contrôles actifs.
 * Pour ceux passés MANQUE : insère une entrée history et reprogramme next_due_date.
 * Retourne { reviewed, changed, missed }.
 */
export function recomputeAllStatuses(db, now = new Date()) {
  const rows = db
    .prepare(
      `SELECT ec.id, ec.next_due_date, ec.status, ec.periodicity_days,
              ct.missed_after_days, ct.default_periodicity_days
         FROM equipment_controls ec
         JOIN control_types ct ON ct.id = ec.control_type_id
        WHERE ec.is_active = 1`,
    )
    .all();

  let changed = 0;
  let missed = 0;
  const updateStmt = db.prepare(
    `UPDATE equipment_controls SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  );
  const insHist = db.prepare(
    `INSERT INTO control_history
       (equipment_control_id, performed_at, status, previous_due_date, next_due_date, notes)
     VALUES (?, ?, 'MANQUE', ?, ?, ?)`,
  );
  const updateMissed = db.prepare(
    `UPDATE equipment_controls
        SET status = 'A_FAIRE',
            next_due_date = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
  );

  const today = todayIso(now);
  const tx = db.transaction(() => {
    for (const r of rows) {
      const newStatus = computeStatus(r, now);
      if (newStatus === STATUS.MANQUE) {
        // Auto-reprogrammation : trace + nouveau next_due
        const periodicity = Number(r.periodicity_days || r.default_periodicity_days || 365);
        const newDue = addDays(today, periodicity);
        insHist.run(r.id, today, r.next_due_date, newDue, '[auto] Contrôle marqué manqué');
        updateMissed.run(newDue, r.id);
        missed++;
        changed++;
      } else if (newStatus !== r.status) {
        updateStmt.run(newStatus, r.id);
        changed++;
      }
    }
  });
  tx();

  return { reviewed: rows.length, changed, missed };
}
