export function getTaskReservationVehicles(db, date) {
  const rows = db
    .prepare(
      `SELECT ta.id AS task_id, v.id AS vehicle_id, v.name, v.registration
       FROM task_assignments ta
       LEFT JOIN affaires aff
         ON ta.affaire_num != ''
         AND UPPER(TRIM(ta.affaire_num)) = UPPER(TRIM(aff.numero_affaire))
       JOIN reservations r
         ON r.id = ta.reservation_id
         OR (
           ta.date >= r.start_date
           AND ta.date <= r.end_date
           AND (
             (
               ta.affaire_num != ''
               AND UPPER(TRIM(r.affaire)) = UPPER(TRIM(ta.affaire_num))
             )
             OR (
               (r.affaire IS NULL OR TRIM(r.affaire) = '')
               AND r.client_name IS NOT NULL
               AND ta.affaire_num != ''
               AND (
                 (
                   COALESCE(TRIM(aff.client), '') != ''
                   AND (
                     INSTR(LOWER(r.client_name), LOWER(TRIM(aff.client))) > 0
                     OR INSTR(LOWER(TRIM(aff.client)), LOWER(r.client_name)) > 0
                   )
                 )
                 OR (
                   COALESCE(TRIM(aff.nom), '') != ''
                   AND (
                     INSTR(LOWER(r.client_name), LOWER(TRIM(aff.nom))) > 0
                     OR INSTR(LOWER(TRIM(aff.nom)), LOWER(r.client_name)) > 0
                   )
                 )
                 OR (
                   COALESCE(TRIM(aff.titre), '') != ''
                   AND (
                     INSTR(LOWER(r.client_name), LOWER(TRIM(aff.titre))) > 0
                     OR INSTR(LOWER(TRIM(aff.titre)), LOWER(r.client_name)) > 0
                   )
                 )
               )
             )
           )
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
