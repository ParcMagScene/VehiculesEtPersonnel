export function getTaskReservationVehicles(db, date) {
  const rows = db
    .prepare(
      `SELECT ta.id AS task_id, v.id AS vehicle_id, v.name, v.registration
       FROM task_assignments ta
       JOIN reservations r
         ON r.id = ta.reservation_id
         OR (
           ta.affaire_num != ''
           AND UPPER(TRIM(r.affaire)) = UPPER(TRIM(ta.affaire_num))
           AND ta.date >= r.start_date
           AND ta.date <= r.end_date
         )
       JOIN vehicles v ON v.id = r.vehicle_id
       WHERE ta.date = ?
         AND ta.visible = 1
         AND ta.status != 'cancelled'
         AND ta.deleted_at IS NULL
       GROUP BY ta.id, v.id
       ORDER BY ta.id, v.name, v.registration`,
    )
    .all(date);
  const vehiclesByTask = new Map();
  for (const row of rows) {
    const taskId = String(row.task_id);
    if (!vehiclesByTask.has(taskId)) vehiclesByTask.set(taskId, []);
    vehiclesByTask.get(taskId).push({
      name: row.name || '',
      registration: row.registration || '',
    });
  }
  return vehiclesByTask;
}
