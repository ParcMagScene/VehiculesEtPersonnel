import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db, { addToHistory, getHistory } from './database.js';
import { setupClientsRoutes, setupDriversRoutes, setupLocationsRoutes, setupGaragesRoutes, setupConfigRoutes } from './routes.js';

const app = express();
const PORT = 3002;
const JWT_SECRET = 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

// Middleware d'authentification
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });
    req.user = user;
    next();
  });
}

// Middleware pour vérifier les droits admin
function requireAdmin(req, res, next) {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

// ============ AUTHENTIFICATION ============

// Inscription
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    
    // Vérifier si la colonne is_admin existe dans authorized_emails
    try {
      const columns = db.prepare("PRAGMA table_info(authorized_emails)").all();
      const hasIsAdminColumn = columns.some(col => col.name === 'is_admin');
      
      if (!hasIsAdminColumn) {
        db.prepare("ALTER TABLE authorized_emails ADD COLUMN is_admin INTEGER DEFAULT 0").run();
        console.log('✅ Colonne is_admin ajoutée à authorized_emails');
      }
    } catch (error) {
      console.log('Info: Colonne is_admin déjà présente');
    }
    
    // Vérifier si l'email est autorisé
    const authStmt = db.prepare('SELECT * FROM authorized_emails WHERE email = ? AND status = ?');
    const authorized = authStmt.get(email, 'pending');
    
    if (!authorized) {
      return res.status(403).json({ error: 'Email non autorisé. Contactez un administrateur.' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Utiliser le flag is_admin de authorized_emails (ou 0 par défaut)
    const isAdmin = authorized.is_admin || 0;
    const stmt = db.prepare('INSERT INTO users (email, name, password_hash, is_admin) VALUES (?, ?, ?, ?)');
    const result = stmt.run(email, name, passwordHash, isAdmin);
    
    // Marquer l'email comme activé
    const updateStmt = db.prepare('UPDATE authorized_emails SET status = ?, activated_at = CURRENT_TIMESTAMP WHERE email = ?');
    updateStmt.run('activated', email);
    
    console.log(`✅ Nouvel utilisateur enregistré: ${email} (admin: ${isAdmin ? 'oui' : 'non'})`);
    
    res.json({ id: result.lastInsertRowid, email, name, isAdmin: isAdmin === 1 });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Connexion
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email);
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Liste des utilisateurs (pour le sélecteur de connexion)
app.get('/api/auth/users', (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email, name, is_admin FROM users ORDER BY name');
    const users = stmt.all();
    res.json(users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isAdmin: u.is_admin === 1
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ VÉHICULES ============

app.get('/api/vehicles', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM vehicles ORDER BY order_index');
    const vehicles = stmt.all();
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vehicles', authenticateToken, (req, res) => {
  try {
    const vehicle = req.body;
    const stmt = db.prepare(`
      INSERT INTO vehicles (id, name, type, registration, brand, model, color, owner, comment, 
                           display_color, photo, order_index, is_location, created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      vehicle.id, vehicle.name, vehicle.type, vehicle.registration, vehicle.brand,
      vehicle.model, vehicle.color, vehicle.owner, vehicle.comment, vehicle.displayColor,
      vehicle.photo, vehicle.order || 0, vehicle.isLocation ? 1 : 0, req.user.id, req.user.id
    );
    
    addToHistory('vehicle', vehicle.id, 'created', vehicle, req.user.id, req.user.name);
    
    res.json({ success: true, id: vehicle.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/vehicles/:id', authenticateToken, (req, res) => {
  try {
    const vehicle = req.body;
    const stmt = db.prepare(`
      UPDATE vehicles 
      SET name = ?, type = ?, registration = ?, brand = ?, model = ?, color = ?,
          owner = ?, comment = ?, display_color = ?, photo = ?, order_index = ?,
          is_location = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      vehicle.name, vehicle.type, vehicle.registration, vehicle.brand, vehicle.model,
      vehicle.color, vehicle.owner, vehicle.comment, vehicle.displayColor, vehicle.photo,
      vehicle.order || 0, vehicle.isLocation ? 1 : 0, req.user.id, req.params.id
    );
    
    addToHistory('vehicle', req.params.id, 'updated', vehicle, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/vehicles/:id', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM vehicles WHERE id = ?');
    stmt.run(req.params.id);
    
    addToHistory('vehicle', req.params.id, 'deleted', null, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ RÉSERVATIONS ============

app.get('/api/reservations', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM reservations');
    const reservations = stmt.all();
    
    // Mapper snake_case vers camelCase
    const mappedReservations = reservations.map(r => ({
      id: r.id,
      vehicleId: r.vehicle_id,
      clientName: r.client_name,
      driverName: r.driver_name,
      locationName: r.location_name,
      prestationName: r.prestation_name,
      date: r.start_date,
      startDate: r.start_date,
      period: r.start_period,
      startPeriod: r.start_period,
      endDate: r.end_date,
      endPeriod: r.end_period,
      status: r.status,
      comment: r.comment,
      affaire: r.affaire,
      googleEventId: r.google_event_id,
      isTournee: r.is_tournee === 1,
      linkedEventIds: r.linked_event_ids ? JSON.parse(r.linked_event_ids) : null,
      notes: r.notes,
      createdBy: r.created_by,
      modifiedBy: r.modified_by,
      createdAt: r.created_at,
      modifiedAt: r.modified_at
    }));
    
    res.json(mappedReservations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reservations', authenticateToken, (req, res) => {
  try {
    const reservation = req.body;
    const stmt = db.prepare(`
      INSERT INTO reservations (id, vehicle_id, start_date, start_period, end_date, end_period, 
                               client_name, driver_name, location_name, prestation_name, 
                               notes, google_event_id, affaire, is_tournee, linked_event_ids, created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      reservation.id,
      reservation.vehicle_id,
      reservation.start_date,
      reservation.start_period || 'AM',
      reservation.end_date,
      reservation.end_period || 'PM',
      reservation.client_name || '',
      reservation.driver_name || '',
      reservation.location_name || '',
      reservation.prestation_name || '',
      reservation.notes || '',
      reservation.google_event_id || '',
      reservation.affaire || '',
      reservation.is_tournee ? 1 : 0,
      reservation.linked_event_ids ? JSON.stringify(reservation.linked_event_ids) : null,
      req.user.id,
      req.user.id
    );
    
    addToHistory('reservation', reservation.id, 'created', reservation, req.user.id, req.user.name);
    
    // Récupérer la réservation complète avec les infos du véhicule
    const createdReservation = db.prepare(`
      SELECT r.*, v.name as vehicle_name, v.type as vehicle_type, v.registration as immatriculation
      FROM reservations r
      JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = ?
    `).get(reservation.id);
    
    // Mapper au format attendu par le frontend
    const mappedReservation = {
      id: createdReservation.id,
      vehicleId: createdReservation.vehicle_id,
      vehicleName: createdReservation.vehicle_name,
      vehicleType: createdReservation.vehicle_type,
      immatriculation: createdReservation.immatriculation,
      startDate: createdReservation.start_date,
      startPeriod: createdReservation.start_period,
      endDate: createdReservation.end_date,
      endPeriod: createdReservation.end_period,
      // Rétrocompatibilité
      date: createdReservation.start_date,
      period: createdReservation.start_period,
      clientName: createdReservation.client_name,
      driverName: createdReservation.driver_name,
      locationName: createdReservation.location_name,
      prestationName: createdReservation.prestation_name,
      notes: createdReservation.notes,
      googleEventId: createdReservation.google_event_id,
      affaire: createdReservation.affaire,
      isTournee: Boolean(createdReservation.is_tournee),
      linkedEventIds: createdReservation.linked_event_ids ? JSON.parse(createdReservation.linked_event_ids) : []
    };
    
    res.json(mappedReservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/reservations/:id', authenticateToken, (req, res) => {
  try {
    const reservation = req.body;
    const stmt = db.prepare(`
      UPDATE reservations 
      SET vehicle_id = ?, start_date = ?, start_period = ?, end_date = ?, end_period = ?,
          client_name = ?, driver_name = ?, location_name = ?, prestation_name = ?,
          notes = ?, google_event_id = ?, affaire = ?, is_tournee = ?, linked_event_ids = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      reservation.vehicleId || reservation.vehicle_id,
      reservation.date || reservation.start_date,
      reservation.period || reservation.start_period || 'AM',
      reservation.endDate || reservation.end_date,
      reservation.endPeriod || reservation.end_period || 'PM',
      reservation.clientName || reservation.client_name || '',
      reservation.driverName || reservation.driver_name || '',
      reservation.locationName || reservation.location_name || '',
      reservation.prestationName || reservation.prestation_name || '',
      reservation.notes || '',
      reservation.googleEventId || reservation.google_event_id || '',
      reservation.affaire || '',
      reservation.isTournee || reservation.is_tournee ? 1 : 0,
      (reservation.linkedEventIds || reservation.linked_event_ids) ? JSON.stringify(reservation.linkedEventIds || reservation.linked_event_ids) : null,
      req.user.id,
      req.params.id
    );
    
    addToHistory('reservation', req.params.id, 'updated', reservation, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/reservations/:id', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM reservations WHERE id = ?');
    stmt.run(req.params.id);
    
    addToHistory('reservation', req.params.id, 'deleted', null, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DEMANDES DE RÉSERVATION ============

app.get('/api/reservation-requests', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT rr.*, u.name as requester_name, u.email as requester_email
      FROM reservation_requests rr
      LEFT JOIN users u ON rr.requested_by = u.id
      ORDER BY rr.requested_at DESC
    `);
    const requests = stmt.all();
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reservation-requests', authenticateToken, (req, res) => {
  try {
    const request = req.body;
    const stmt = db.prepare(`
      INSERT INTO reservation_requests (id, vehicle_id, start_date, start_period, end_date, end_period,
                                       client_name, driver_name, location_name, prestation_name, notes, requested_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      request.id,
      request.vehicle_id,
      request.start_date,
      request.start_period || 'AM',
      request.end_date,
      request.end_period || 'PM',
      request.client_name || '',
      request.driver_name || '',
      request.location_name || '',
      request.prestation_name || '',
      request.notes || '',
      req.user.id
    );
    
    res.json({ success: true, id: request.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/reservation-requests/:id/approve', authenticateToken, (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    const userStmt = db.prepare('SELECT is_admin FROM users WHERE id = ?');
    const user = userStmt.get(req.user.id);
    
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    // Récupérer la demande
    const requestStmt = db.prepare('SELECT * FROM reservation_requests WHERE id = ?');
    const request = requestStmt.get(req.params.id);
    
    if (!request) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }

    // Créer la réservation
    const insertStmt = db.prepare(`
      INSERT INTO reservations (id, vehicle_id, start_date, start_period, end_date, end_period,
                               client_name, driver_name, location_name, prestation_name, notes,
                               created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertStmt.run(
      request.id,
      request.vehicle_id,
      request.start_date,
      request.start_period,
      request.end_date,
      request.end_period,
      request.client_name,
      request.driver_name,
      request.location_name,
      request.prestation_name,
      request.notes,
      req.user.id,
      req.user.id
    );

    // Mettre à jour le statut de la demande
    const updateStmt = db.prepare(`
      UPDATE reservation_requests 
      SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(req.user.id, req.params.id);
    
    addToHistory('reservation_request', req.params.id, 'approved', request, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/reservation-requests/:id/reject', authenticateToken, (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    const userStmt = db.prepare('SELECT is_admin FROM users WHERE id = ?');
    const user = userStmt.get(req.user.id);
    
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const updateStmt = db.prepare(`
      UPDATE reservation_requests 
      SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = ?
      WHERE id = ?
    `);
    updateStmt.run(req.user.id, req.body.reason || '', req.params.id);
    
    addToHistory('reservation_request', req.params.id, 'rejected', { reason: req.body.reason }, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MAINTENANCES ============

app.get('/api/maintenances', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM maintenances');
    const maintenances = stmt.all();
    
    // Mapper snake_case vers camelCase pour compatibilité frontend
    const mappedMaintenances = maintenances.map(m => ({
      id: m.id,
      vehicleId: m.vehicle_id,
      vehicleName: m.vehicle_name,
      type: m.type,
      status: m.status,
      date: m.date,
      startDate: m.date,
      endDate: m.end_date,
      description: m.description,
      garageId: m.garage_id,
      cost: m.cost,
      mileage: m.mileage,
      notes: m.notes,
      isImmobilized: m.is_immobilized,
      createdBy: m.created_by,
      modifiedBy: m.modified_by,
      createdAt: m.created_at,
      modifiedAt: m.modified_at
    }));
    
    res.json(mappedMaintenances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/maintenances', authenticateToken, (req, res) => {
  try {
    const maintenance = req.body;
    
    // VALIDATION : Les non-admins ne peuvent créer que des signalements (status='reported')
    if (!req.user.is_admin && maintenance.status !== 'reported') {
      return res.status(403).json({ 
        error: 'Accès refusé',
        message: 'Vous ne pouvez que signaler des pannes. Pour programmer une intervention, contactez un administrateur.'
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO maintenances (id, vehicle_id, vehicle_name, type, status, date, end_date, 
                               description, garage_id, cost, mileage, notes, is_immobilized, 
                               created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      maintenance.id,
      maintenance.vehicle_id,
      maintenance.vehicle_name || '',
      maintenance.type || 'other',
      maintenance.status || 'pending',
      maintenance.date,
      maintenance.end_date || maintenance.date,
      maintenance.description || '',
      maintenance.garage_id || null,
      maintenance.cost || null,
      maintenance.mileage || null,
      maintenance.notes || '',
      maintenance.is_immobilized ? 1 : 0,
      req.user.id,
      req.user.id
    );
    
    addToHistory('maintenance', maintenance.id, 'created', maintenance, req.user.id, req.user.name);
    
    res.json({ success: true, id: maintenance.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/maintenances/:id', authenticateToken, (req, res) => {
  try {
    const maintenance = req.body;
    
    // VALIDATION : Les non-admins ne peuvent modifier que leurs propres signalements
    if (!req.user.is_admin) {
      // Vérifier si la maintenance appartient à l'utilisateur
      const existing = db.prepare('SELECT created_by, status FROM maintenances WHERE id = ?').get(req.params.id);
      
      if (!existing) {
        return res.status(404).json({ error: 'Maintenance introuvable' });
      }
      
      if (existing.created_by !== req.user.id) {
        return res.status(403).json({ 
          error: 'Accès refusé',
          message: 'Vous ne pouvez modifier que vos propres signalements.'
        });
      }
      
      if (maintenance.status !== 'reported') {
        return res.status(403).json({ 
          error: 'Accès refusé',
          message: 'Vous ne pouvez que signaler des pannes.'
        });
      }
    }
    
    const stmt = db.prepare(`
      UPDATE maintenances 
      SET vehicle_id = ?, type = ?, status = ?, date = ?, end_date = ?, description = ?, 
          garage_id = ?, cost = ?, mileage = ?, notes = ?, is_immobilized = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      maintenance.vehicleId || maintenance.vehicle_id,
      maintenance.type,
      maintenance.status,
      maintenance.startDate || maintenance.date,
      maintenance.endDate || maintenance.end_date || maintenance.startDate || maintenance.date,
      maintenance.description,
      maintenance.garageId || maintenance.garage_id || null,
      maintenance.cost || null,
      maintenance.mileage || null,
      maintenance.notes || null,
      maintenance.isImmobilized || maintenance.is_immobilized ? 1 : 0,
      req.user.id,
      req.params.id
    );
    
    addToHistory('maintenance', req.params.id, 'updated', maintenance, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/maintenances/:id', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM maintenances WHERE id = ?');
    stmt.run(req.params.id);
    
    addToHistory('maintenance', req.params.id, 'deleted', null, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ HISTORIQUE ============

app.get('/api/history/:entityType/:entityId', authenticateToken, (req, res) => {
  try {
    const history = getHistory(req.params.entityType, req.params.entityId);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GESTION DES UTILISATEURS (ADMIN) ============

// Lister les emails autorisés
app.get('/api/admin/authorized-emails', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT ae.*, u.name as user_name 
      FROM authorized_emails ae
      LEFT JOIN users u ON ae.email = u.email
      ORDER BY ae.added_at DESC
    `);
    const emails = stmt.all();
    res.json(emails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ajouter un email autorisé
app.post('/api/admin/authorized-emails', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { email } = req.body;
    const stmt = db.prepare('INSERT INTO authorized_emails (email, added_by) VALUES (?, ?)');
    const result = stmt.run(email, req.user.id);
    res.json({ id: result.lastInsertRowid, email, status: 'pending' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Supprimer un email autorisé
app.delete('/api/admin/authorized-emails/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM authorized_emails WHERE id = ?');
    stmt.run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lister tous les utilisateurs
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email, name, is_admin, created_at FROM users ORDER BY created_at DESC');
    const users = stmt.all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Réinitialiser le mot de passe d'un utilisateur
app.post('/api/admin/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    stmt.run(passwordHash, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Changer son propre mot de passe
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(req.user.id);
    
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updateStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    updateStmt.run(passwordHash, req.user.id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DEMANDES D'ACCÈS ============

// Créer une demande d'accès
app.post('/api/access-requests', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email et nom requis' });
    }

    // Vérifier si l'email existe déjà
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà enregistré' });
    }

    // Vérifier si une demande est déjà en cours
    const existingRequest = db.prepare(
      'SELECT * FROM access_requests WHERE email = ? AND status = ?'
    ).get(email, 'pending');
    
    if (existingRequest) {
      return res.status(400).json({ error: 'Une demande est déjà en cours pour cet email' });
    }

    // Créer la demande
    const stmt = db.prepare(`
      INSERT INTO access_requests (email, name, status)
      VALUES (?, ?, 'pending')
    `);
    
    const result = stmt.run(email, name);
    
    res.json({ 
      success: true, 
      message: 'Demande envoyée avec succès. Vous serez notifié par email une fois approuvée.',
      id: result.lastInsertRowid 
    });
  } catch (error) {
    console.error('Erreur création demande d\'accès:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lister les demandes d'accès (admin seulement)
app.get('/api/access-requests', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT ar.*, u.name as reviewed_by_name
      FROM access_requests ar
      LEFT JOIN users u ON ar.reviewed_by = u.id
      ORDER BY 
        CASE ar.status 
          WHEN 'pending' THEN 1 
          WHEN 'approved' THEN 2 
          WHEN 'rejected' THEN 3 
        END,
        ar.created_at DESC
    `);
    
    const requests = stmt.all();
    res.json(requests);
  } catch (error) {
    console.error('Erreur récupération demandes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Approuver/rejeter une demande (admin seulement)
app.patch('/api/access-requests/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, is_admin } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status invalide' });
    }

    // Récupérer la demande
    const request = db.prepare('SELECT * FROM access_requests WHERE id = ?').get(id);
    if (!request) {
      return res.status(404).json({ error: 'Demande non trouvée' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Cette demande a déjà été traitée' });
    }

    // Mettre à jour le statut
    const updateStmt = db.prepare(`
      UPDATE access_requests 
      SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    updateStmt.run(status, req.user.id, id);

    // Si approuvée, créer l'email autorisé
    if (status === 'approved') {
      // Vérifier si la colonne is_admin existe, sinon l'ajouter
      try {
        const columns = db.prepare("PRAGMA table_info(authorized_emails)").all();
        const hasIsAdminColumn = columns.some(col => col.name === 'is_admin');
        
        if (!hasIsAdminColumn) {
          db.prepare("ALTER TABLE authorized_emails ADD COLUMN is_admin INTEGER DEFAULT 0").run();
          console.log('✅ Colonne is_admin ajoutée à authorized_emails');
        }
      } catch (error) {
        console.log('Info: Colonne is_admin déjà présente ou erreur:', error.message);
      }

      const authStmt = db.prepare(`
        INSERT INTO authorized_emails (email, status, is_admin)
        VALUES (?, 'pending', ?)
        ON CONFLICT(email) DO UPDATE SET is_admin = excluded.is_admin
      `);
      
      try {
        authStmt.run(request.email, is_admin ? 1 : 0);
        console.log(`✅ Email autorisé: ${request.email} (admin: ${is_admin ? 'oui' : 'non'})`);
      } catch (error) {
        console.error('Erreur ajout email autorisé:', error);
      }
    }

    res.json({ success: true, message: `Demande ${status === 'approved' ? 'approuvée' : 'rejetée'}` });
  } catch (error) {
    console.error('Erreur traitement demande:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Compter les demandes en attente (admin)
app.get('/api/access-requests/count/pending', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM access_requests WHERE status = ?');
    const result = stmt.get('pending');
    res.json({ count: result.count });
  } catch (error) {
    console.error('Erreur comptage demandes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============ GESTION DES EMAILS AUTORISÉS (ADMIN) ============

// Récupérer tous les emails autorisés
app.get('/api/authorized-emails', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM authorized_emails ORDER BY created_at DESC');
    const emails = stmt.all();
    res.json(emails);
  } catch (error) {
    console.error('Erreur récupération emails:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter un email autorisé (admin)
app.post('/api/authorized-emails', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }
    
    // Vérifier si l'email existe déjà
    const checkStmt = db.prepare('SELECT * FROM authorized_emails WHERE email = ?');
    const existing = checkStmt.get(email);
    
    if (existing) {
      return res.status(400).json({ error: 'Cet email est déjà autorisé' });
    }
    
    const stmt = db.prepare('INSERT INTO authorized_emails (email, status) VALUES (?, ?)');
    const result = stmt.run(email, 'pending');
    
    res.json({ id: result.lastInsertRowid, email, status: 'pending' });
  } catch (error) {
    console.error('Erreur ajout email:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un email autorisé (admin)
app.delete('/api/authorized-emails/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM authorized_emails WHERE id = ?');
    stmt.run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression email:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============ GESTION DES UTILISATEURS (ADMIN) ============

// Récupérer tous les utilisateurs
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email, name, is_admin, created_at FROM users ORDER BY created_at DESC');
    const users = stmt.all();
    res.json(users.map(u => ({
      ...u,
      isAdmin: u.is_admin === 1
    })));
  } catch (error) {
    console.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour un utilisateur (admin)
app.patch('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isAdmin, newPassword } = req.body;
    
    if (isAdmin !== undefined) {
      const stmt = db.prepare('UPDATE users SET is_admin = ? WHERE id = ?');
      stmt.run(isAdmin ? 1 : 0, id);
    }
    
    if (newPassword) {
      const passwordHash = await bcrypt.hash(newPassword, 10);
      const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
      stmt.run(passwordHash, id);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur mise à jour utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un utilisateur (admin)
app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    
    // Empêcher la suppression de son propre compte
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }
    
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    stmt.run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Routes pour clients, drivers, locations, garages, config
setupClientsRoutes(app, authenticateToken);
setupDriversRoutes(app, authenticateToken);
setupLocationsRoutes(app, authenticateToken);
setupGaragesRoutes(app, authenticateToken);
setupConfigRoutes(app, authenticateToken);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur backend démarré sur http://0.0.0.0:${PORT}`);
  console.log(`📡 Accessible depuis le réseau sur http://192.168.205.75:${PORT}`);
});
