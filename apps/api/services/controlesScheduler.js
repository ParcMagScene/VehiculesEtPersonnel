// ═══════════════════════════════════════════════════════════════
// services/controlesScheduler.js
// Tourne 1× par jour (entre 08:00 et 08:05) :
//   1. recompute statuts (A_FAIRE / EN_RETARD / MANQUE auto-replan)
//   2. envoie rappels J-30, J-7, J-1, LATE, MISSED (idempotent via control_notifications)
// ═══════════════════════════════════════════════════════════════
import { alertControlePeriodique } from '../emailService.js';
import logger from '../logger.js';
import { addDays, recomputeAllStatuses, todayIso } from './controlesService.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const RUN_HOUR = 8;

let lastRunDay = null;
let timer = null;

function shouldRunNow(now = new Date()) {
  if (now.getHours() !== RUN_HOUR) return false;
  const day = now.toISOString().slice(0, 10);
  if (lastRunDay === day) return false;
  return true;
}

/**
 * Pour chaque contrôle, calcule les rappels à envoyer aujourd'hui en fonction
 * de la distance jours = next_due_date - today.
 */
async function sendDueReminders(db, now = new Date()) {
  const today = todayIso(now);
  const rows = db
    .prepare(
      `SELECT ec.id, ec.next_due_date, ec.status, ec.notes,
              ec.entity_type, ec.entity_id, ec.assigned_to,
              ct.code AS type_code, ct.name AS type_name,
              u.email AS assigned_email, u.name AS assigned_name,
              CASE
                WHEN ec.entity_type='vehicle'  THEN v.name
                WHEN ec.entity_type='equipment' THEN e.name
              END AS entity_name
         FROM equipment_controls ec
         JOIN control_types ct ON ct.id = ec.control_type_id
    LEFT JOIN users u  ON u.id = ec.assigned_to
    LEFT JOIN vehicles v  ON ec.entity_type='vehicle'  AND v.id  = ec.entity_id
    LEFT JOIN equipment e ON ec.entity_type='equipment' AND CAST(e.id AS TEXT) = ec.entity_id
        WHERE ec.is_active = 1`,
    )
    .all();

  let sent = 0;
  for (const ctrl of rows) {
    let kind = null;
    if (ctrl.next_due_date === addDays(today, 30)) kind = 'REMINDER_30';
    else if (ctrl.next_due_date === addDays(today, 7)) kind = 'REMINDER_7';
    else if (ctrl.next_due_date === addDays(today, 1)) kind = 'REMINDER_1';
    else if (ctrl.next_due_date < today && ctrl.status === 'EN_RETARD') kind = 'LATE';
    // MISSED : on s'appuie sur l'historique inséré par recompute (status=MANQUE)
    if (!kind) continue;

    // Anti-doublon : on a déjà notifié pour cette échéance + ce type ?
    const exists = db
      .prepare(
        `SELECT 1 FROM control_notifications
          WHERE equipment_control_id = ? AND type = ? AND for_due_date = ?
          LIMIT 1`,
      )
      .get(ctrl.id, kind, ctrl.next_due_date);
    if (exists) continue;

    const ok = await alertControlePeriodique(db, ctrl, kind);
    db.prepare(
      `INSERT OR IGNORE INTO control_notifications
        (equipment_control_id, type, recipient_id, recipient_email, for_due_date, success)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      ctrl.id,
      kind,
      ctrl.assigned_to || null,
      ctrl.assigned_email || null,
      ctrl.next_due_date,
      ok ? 1 : 0,
    );
    if (ok) sent++;
  }

  // Notifications pour les contrôles passés MANQUE aujourd'hui
  const missedToday = db
    .prepare(
      `SELECT h.equipment_control_id AS id, h.previous_due_date AS for_due_date,
              ec.notes, ec.entity_type, ec.entity_id, ec.assigned_to,
              ct.code AS type_code, ct.name AS type_name,
              u.email AS assigned_email, u.name AS assigned_name,
              CASE
                WHEN ec.entity_type='vehicle'  THEN v.name
                WHEN ec.entity_type='equipment' THEN e.name
              END AS entity_name
         FROM control_history h
         JOIN equipment_controls ec ON ec.id = h.equipment_control_id
         JOIN control_types ct ON ct.id = ec.control_type_id
    LEFT JOIN users u ON u.id = ec.assigned_to
    LEFT JOIN vehicles v  ON ec.entity_type='vehicle'  AND v.id  = ec.entity_id
    LEFT JOIN equipment e ON ec.entity_type='equipment' AND CAST(e.id AS TEXT) = ec.entity_id
        WHERE h.status = 'MANQUE' AND h.performed_at = ?`,
    )
    .all(today);

  for (const ctrl of missedToday) {
    const exists = db
      .prepare(
        `SELECT 1 FROM control_notifications
          WHERE equipment_control_id = ? AND type = 'MISSED' AND for_due_date = ?
          LIMIT 1`,
      )
      .get(ctrl.id, ctrl.for_due_date);
    if (exists) continue;
    const enriched = { ...ctrl, next_due_date: ctrl.for_due_date };
    const ok = await alertControlePeriodique(db, enriched, 'MISSED');
    db.prepare(
      `INSERT OR IGNORE INTO control_notifications
        (equipment_control_id, type, recipient_id, recipient_email, for_due_date, success)
       VALUES (?, 'MISSED', ?, ?, ?, ?)`,
    ).run(
      ctrl.id,
      ctrl.assigned_to || null,
      ctrl.assigned_email || null,
      ctrl.for_due_date,
      ok ? 1 : 0,
    );
    if (ok) sent++;
  }

  return sent;
}

/**
 * Tâche complète quotidienne — exposée pour tests/admin.
 */
export async function runControlesDailyTask(db, now = new Date()) {
  const recompute = recomputeAllStatuses(db, now);
  const sent = await sendDueReminders(db, now);
  return { ...recompute, notifications: sent };
}

/**
 * Démarre la boucle setInterval (5 min) qui déclenche la tâche à 08:00.
 */
export function startControlesScheduler(db) {
  if (timer) return;
  const tick = async () => {
    const now = new Date();
    if (!shouldRunNow(now)) return;
    lastRunDay = now.toISOString().slice(0, 10);
    try {
      const r = await runControlesDailyTask(db, now);
      logger.info(
        `[ContrôlesScheduler] OK — ${r.reviewed} revus, ${r.changed} changés, ${r.missed} manqués, ${r.notifications} notifs`,
      );
    } catch (e) {
      logger.error('[ContrôlesScheduler] erreur:', e);
    }
  };
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  // Tick immédiat au démarrage si on est dans le créneau
  setTimeout(tick, 5_000);
  logger.info('✅ Scheduler contrôles périodiques démarré (vérif 5 min, exécution 08:00)');
}

export function stopControlesScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
  lastRunDay = null;
}
