// services/forfait/repository.js
// Accès DB pour entretiens obligatoires, alertes (droit d'alerte),
// et poses de repos. Fonctions synchrones (better-sqlite3).

// ─── Entretiens (annuel + semestriel) ───────────────────────────

export function listEntretiens(db, personId, year) {
  const rows = year
    ? db
        .prepare(
          'SELECT * FROM forfait_entretiens WHERE person_id = ? AND year = ? ORDER BY scheduled_date DESC, id DESC',
        )
        .all(personId, year)
    : db
        .prepare(
          'SELECT * FROM forfait_entretiens WHERE person_id = ? ORDER BY year DESC, scheduled_date DESC, id DESC',
        )
        .all(personId);
  return rows;
}

export function createEntretien(db, entretien, userId) {
  const stmt = db.prepare(`
    INSERT INTO forfait_entretiens
      (person_id, year, type, scheduled_date, held_date, workload_ok,
       work_life_balance_ok, compensation_ok, comments, next_actions,
       document_path, status, created_by, modified_by)
    VALUES
      (@person_id, @year, @type, @scheduled_date, @held_date, @workload_ok,
       @work_life_balance_ok, @compensation_ok, @comments, @next_actions,
       @document_path, @status, @user_id, @user_id)
  `);
  const info = stmt.run({
    person_id: entretien.personId,
    year: entretien.year,
    type: entretien.type,
    scheduled_date: entretien.scheduledDate ?? null,
    held_date: entretien.heldDate ?? null,
    workload_ok: entretien.workloadOk == null ? null : entretien.workloadOk ? 1 : 0,
    work_life_balance_ok:
      entretien.workLifeBalanceOk == null ? null : entretien.workLifeBalanceOk ? 1 : 0,
    compensation_ok: entretien.compensationOk == null ? null : entretien.compensationOk ? 1 : 0,
    comments: entretien.comments ?? null,
    next_actions: entretien.nextActions ?? null,
    document_path: entretien.documentPath ?? null,
    status: entretien.status ?? (entretien.heldDate ? 'held' : 'scheduled'),
    user_id: userId ?? null,
  });
  return getEntretien(db, info.lastInsertRowid);
}

export function getEntretien(db, id) {
  return db.prepare('SELECT * FROM forfait_entretiens WHERE id = ?').get(id);
}

export function updateEntretien(db, id, patch, userId) {
  const allowed = [
    'scheduled_date',
    'held_date',
    'workload_ok',
    'work_life_balance_ok',
    'compensation_ok',
    'comments',
    'next_actions',
    'document_path',
    'status',
  ];
  const sets = [];
  const params = { id, user_id: userId ?? null };
  for (const key of allowed) {
    const camel = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    if (patch[camel] !== undefined) {
      sets.push(`${key} = @${key}`);
      params[key] =
        key.endsWith('_ok') && patch[camel] != null ? (patch[camel] ? 1 : 0) : patch[camel];
    }
  }
  if (sets.length === 0) return getEntretien(db, id);
  sets.push('modified_by = @user_id', 'modified_at = CURRENT_TIMESTAMP');
  db.prepare(`UPDATE forfait_entretiens SET ${sets.join(', ')} WHERE id = @id`).run(params);
  return getEntretien(db, id);
}

/**
 * Statut de conformité d'une personne sur l'année (entretiens attendus).
 * Attendu : 1 annuel + 2 semestriels (S1, S2).
 */
export function getEntretienComplianceForYear(db, personId, year) {
  const rows = db
    .prepare(
      'SELECT type, held_date, status FROM forfait_entretiens WHERE person_id = ? AND year = ?',
    )
    .all(personId, year);
  const annuel = rows.find((r) => r.type === 'annuel' && r.status === 'held');
  const semestriels = rows.filter((r) => r.type === 'semestriel' && r.status === 'held');
  return {
    year,
    annuelHeld: Boolean(annuel),
    annuelDate: annuel?.held_date ?? null,
    semestrielsHeldCount: semestriels.length,
    compliant: Boolean(annuel) && semestriels.length >= 2,
    missing: [
      ...(annuel ? [] : ['annuel']),
      ...Array.from({ length: Math.max(0, 2 - semestriels.length) }, () => 'semestriel'),
    ],
  };
}

// ─── Alertes (droit d'alerte) ───────────────────────────────────

export function listAlerts(db, personId, { status, year } = {}) {
  let sql = 'SELECT * FROM forfait_alerts WHERE person_id = ?';
  const params = [personId];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (year) {
    sql += ' AND alert_date LIKE ?';
    params.push(`${year}-%`);
  }
  sql += ' ORDER BY alert_date DESC, id DESC';
  return db.prepare(sql).all(...params);
}

export function createAlert(db, alert, userId) {
  const stmt = db.prepare(`
    INSERT INTO forfait_alerts
      (person_id, alert_date, source, category, reason, status, created_by)
    VALUES
      (@person_id, @alert_date, @source, @category, @reason, @status, @user_id)
  `);
  const info = stmt.run({
    person_id: alert.personId,
    alert_date: alert.alertDate || new Date().toISOString().slice(0, 10),
    source: alert.source || 'salarie',
    category: alert.category || 'charge_travail',
    reason: alert.reason,
    status: alert.status || 'open',
    user_id: userId ?? null,
  });
  return getAlert(db, info.lastInsertRowid);
}

export function getAlert(db, id) {
  return db.prepare('SELECT * FROM forfait_alerts WHERE id = ?').get(id);
}

export function resolveAlert(db, id, { response, status = 'resolved' }, userId) {
  db.prepare(
    `UPDATE forfait_alerts
     SET response = ?, response_date = date('now'),
         status = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(response ?? null, status, userId ?? null, id);
  return getAlert(db, id);
}

// ─── Poses de repos & pointages ─────────────────────────────────

export function listRestPoses(db, personId, { fromDate, toDate, type } = {}) {
  let sql = 'SELECT * FROM forfait_rest_poses WHERE person_id = ?';
  const params = [personId];
  if (fromDate) {
    sql += ' AND pose_date >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    sql += ' AND pose_date <= ?';
    params.push(toDate);
  }
  if (type) {
    sql += ' AND pose_type = ?';
    params.push(type);
  }
  sql += ' ORDER BY pose_date ASC, period ASC';
  return db.prepare(sql).all(...params);
}

export function createRestPose(db, pose, userId) {
  const stmt = db.prepare(`
    INSERT INTO forfait_rest_poses
      (person_id, pose_date, period, pose_type, hours_worked, worked_days_equiv,
       requested_at, requested_by, notes, status)
    VALUES
      (@person_id, @pose_date, @period, @pose_type, @hours_worked, @worked_days_equiv,
       @requested_at, @user_id, @notes, @status)
  `);
  const info = stmt.run({
    person_id: pose.personId,
    pose_date: pose.poseDate,
    period: pose.period || 'FULL',
    pose_type: pose.poseType || 'repos_conv',
    hours_worked: pose.hoursWorked ?? null,
    worked_days_equiv: pose.workedDaysEquiv ?? null,
    requested_at: pose.requestedAt || new Date().toISOString(),
    user_id: userId ?? null,
    notes: pose.notes ?? null,
    status: pose.status || 'planned',
  });
  return db.prepare('SELECT * FROM forfait_rest_poses WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Compte les jours consommés par type de pose sur une période.
 */
export function countPosesByType(db, personId, fromDate, toDate) {
  const rows = db
    .prepare(
      `SELECT pose_type,
              SUM(CASE WHEN period = 'FULL' THEN 1 ELSE 0.5 END) AS days
       FROM forfait_rest_poses
       WHERE person_id = ? AND pose_date >= ? AND pose_date <= ?
         AND status != 'cancelled'
       GROUP BY pose_type`,
    )
    .all(personId, fromDate, toDate);
  return Object.fromEntries(rows.map((r) => [r.pose_type, r.days]));
}
