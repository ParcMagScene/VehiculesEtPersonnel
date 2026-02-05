import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import db, { addToHistory, getHistory } from './database.js';
import { setupClientsRoutes, setupDriversRoutes, setupLocationsRoutes, setupGaragesRoutes, setupConfigRoutes } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;
const JWT_SECRET = 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

// Servir les fichiers statiques depuis le dossier public/attachments
const attachmentsPath = path.join(__dirname, '..', 'public', 'attachments');
app.use('/attachments', express.static(attachmentsPath));

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
    
    if (!user) {
      console.log(`❌ Tentative de connexion - Utilisateur non trouvé: ${email}`);
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      console.log(`❌ Tentative de connexion - Mot de passe incorrect pour: ${email}`);
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    console.log(`✅ Authentification réussie pour: ${email}`);
    
    // Vérifier que l'email est autorisé
    const authorizedEmailStmt = db.prepare('SELECT * FROM authorized_emails WHERE email = ? AND status = \'activated\'');
    const authorizedEmail = authorizedEmailStmt.get(email);
    
    if (!authorizedEmail) {
      console.log(`❌ Accès refusé - Email non autorisé: ${email}`);
      return res.status(403).json({ 
        error: 'EMAIL_NOT_AUTHORIZED',
        message: 'Votre email n\'est pas autorisé à accéder à cette application. Veuillez contacter un administrateur.' 
      });
    }
    
    // Vérifier si une réinitialisation est requise
    if (user.password_reset_required === 1) {
      return res.status(403).json({
        error: 'PASSWORD_RESET_REQUIRED',
        message: 'Votre compte a été réinitialisé. Vous devez définir un nouveau mot de passe.',
        userId: user.id,
        email: user.email
      });
    }
    
    // PERMETTRE LES SESSIONS MULTIPLES
    // Les utilisateurs peuvent maintenant se connecter sur plusieurs appareils simultanément
    // Pas de vérification de session active, on crée simplement un nouveau token
    
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Enregistrer la session
    const tokenHash = Buffer.from(token).toString('base64').substring(0, 50);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const insertSessionStmt = db.prepare(`
      INSERT INTO active_sessions (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `);
    insertSessionStmt.run(user.id, tokenHash, expiresAt);
    
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Forcer une nouvelle connexion en fermant les sessions actives
app.post('/api/auth/force-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email);
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    // Vérifier que l'email est autorisé
    const authorizedEmailStmt = db.prepare('SELECT * FROM authorized_emails WHERE email = ? AND status = \'activated\'');
    const authorizedEmail = authorizedEmailStmt.get(email);
    
    if (!authorizedEmail) {
      console.log(`❌ Force-login refusé - Email non autorisé: ${email}`);
      return res.status(403).json({ 
        error: 'EMAIL_NOT_AUTHORIZED',
        message: 'Votre email n\'est pas autorisé à accéder à cette application. Veuillez contacter un administrateur.' 
      });
    }
    
    // Supprimer toutes les sessions actives de cet utilisateur
    const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
    deleteSessionsStmt.run(user.id);
    
    // Créer un nouveau token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Enregistrer la nouvelle session
    const tokenHash = Buffer.from(token).toString('base64').substring(0, 50);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const insertSessionStmt = db.prepare(`
      INSERT INTO active_sessions (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `);
    insertSessionStmt.run(user.id, tokenHash, expiresAt);
    
    res.json({ 
      token, 
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 },
      message: 'Toutes les autres sessions ont été fermées'
    });
  } catch (error) {
    console.error('Erreur force-login:', error);
    res.status(500).json({ error: error.message });
  }
});

// Déconnexion (nettoyer la session)
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    // Supprimer toutes les sessions de cet utilisateur
    const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
    const result = deleteSessionsStmt.run(userId);
    
    console.log(`🚪 Déconnexion: ${userEmail} - ${result.changes} session(s) fermée(s)`);
    
    res.json({ message: 'Déconnexion réussie', sessionsClosed: result.changes });
  } catch (error) {
    console.error('Erreur logout:', error);
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
    
    // Générer un ID côté serveur si non fourni ou invalide
    if (!reservation.id || reservation.id === 'null' || reservation.id === null) {
      reservation.id = `${Date.now()}.${Math.random()}`;
      console.log('⚠️ ID manquant, génération côté serveur:', reservation.id);
    }
    
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
    
    if (!createdReservation) {
      return res.status(500).json({ error: 'Erreur lors de la récupération de la réservation créée' });
    }
    
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
    console.log('🗑️ DELETE /api/reservations/:id - ID:', req.params.id);
    const stmt = db.prepare('DELETE FROM reservations WHERE id = ?');
    const result = stmt.run(req.params.id);
    console.log('✅ Suppression DB - changes:', result.changes);
    
    addToHistory('reservation', req.params.id, 'deleted', null, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur suppression réservation:', error);
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

// Récupérer les noms des utilisateurs (tous les utilisateurs authentifiés)
app.get('/api/users/names', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, name, email FROM users ORDER BY name');
    const users = stmt.all();
    res.json(users);
  } catch (error) {
    console.error('Erreur récupération noms utilisateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer tous les utilisateurs (admin uniquement)
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
      
      // Invalider toutes les sessions de cet utilisateur pour qu'il se reconnecte avec le nouveau statut
      const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
      const result = deleteSessionsStmt.run(id);
      console.log(`🔄 Statut admin modifié pour user ${id} - ${result.changes} session(s) invalidée(s)`);
    }
    
    if (newPassword) {
      const passwordHash = await bcrypt.hash(newPassword, 10);
      const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
      stmt.run(passwordHash, id);
      
      // Invalider toutes les sessions lors du changement de mot de passe
      const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
      const result = deleteSessionsStmt.run(id);
      console.log(`🔑 Mot de passe modifié pour user ${id} - ${result.changes} session(s) invalidée(s)`);
    }
    
    res.json({ success: true, message: 'Utilisateur mis à jour. Les sessions actives ont été fermées.' });
  } catch (error) {
    console.error('Erreur mise à jour utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Demander une réinitialisation de mot de passe (admin)
app.post('/api/users/:id/reset-password', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    
    // Marquer le compte comme nécessitant une réinitialisation
    const stmt = db.prepare('UPDATE users SET password_reset_required = 1 WHERE id = ?');
    stmt.run(id);
    
    // Invalider toutes les sessions
    const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
    const result = deleteSessionsStmt.run(id);
    
    // Récupérer l'email pour le retour
    const userStmt = db.prepare('SELECT email FROM users WHERE id = ?');
    const user = userStmt.get(id);
    
    console.log(`🔄 Réinitialisation demandée pour user ${id} (${user?.email}) - ${result.changes} session(s) fermée(s)`);
    
    res.json({ 
      success: true, 
      message: 'Réinitialisation demandée. L\'utilisateur devra définir un nouveau mot de passe.',
      email: user?.email
    });
  } catch (error) {
    console.error('Erreur demande réinitialisation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Vérifier si un compte nécessite une réinitialisation
app.post('/api/auth/check-reset', async (req, res) => {
  try {
    const { email } = req.body;
    
    const stmt = db.prepare('SELECT id, email, name, password_reset_required FROM users WHERE email = ?');
    const user = stmt.get(email);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json({ 
      resetRequired: user.password_reset_required === 1,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Erreur check reset:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Définir un nouveau mot de passe après réinitialisation
app.post('/api/auth/set-new-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    if (user.password_reset_required !== 1) {
      return res.status(400).json({ error: 'Aucune réinitialisation en attente pour ce compte' });
    }
    
    // Mettre à jour le mot de passe et retirer le flag
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updateStmt = db.prepare(`
      UPDATE users 
      SET password_hash = ?, password_reset_required = 0 
      WHERE id = ?
    `);
    updateStmt.run(passwordHash, user.id);
    
    // Supprimer toutes les anciennes sessions avant d'en créer une nouvelle
    const deleteOldSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
    deleteOldSessionsStmt.run(user.id);
    
    // Créer un token pour connecter directement l'utilisateur
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Enregistrer la session
    const tokenHash = Buffer.from(token).toString('base64').substring(0, 50);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const insertSessionStmt = db.prepare(`
      INSERT INTO active_sessions (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `);
    insertSessionStmt.run(user.id, tokenHash, expiresAt);
    
    console.log(`✅ Nouveau mot de passe défini pour ${user.email}`);
    
    res.json({ 
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 },
      message: 'Mot de passe défini avec succès'
    });
  } catch (error) {
    console.error('Erreur définition mot de passe:', error);
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
    
    // Avant de supprimer l'utilisateur, réassigner toutes ses données à l'admin qui fait la suppression
    const userId = parseInt(id);
    const adminId = req.user.id;
    
    // Réassigner les enregistrements dans toutes les tables qui référencent l'utilisateur
    const reassignQueries = [
      'UPDATE access_requests SET reviewed_by = ? WHERE reviewed_by = ?',
      'UPDATE vehicles SET created_by = ? WHERE created_by = ?',
      'UPDATE vehicles SET modified_by = ? WHERE modified_by = ?',
      'UPDATE reservations SET created_by = ? WHERE created_by = ?',
      'UPDATE reservations SET modified_by = ? WHERE modified_by = ?',
      'UPDATE clients SET created_by = ? WHERE created_by = ?',
      'UPDATE clients SET modified_by = ? WHERE modified_by = ?',
      'UPDATE drivers SET created_by = ? WHERE created_by = ?',
      'UPDATE drivers SET modified_by = ? WHERE modified_by = ?',
      'UPDATE locations SET created_by = ? WHERE created_by = ?',
      'UPDATE locations SET modified_by = ? WHERE modified_by = ?',
      'UPDATE garages SET created_by = ? WHERE created_by = ?',
      'UPDATE garages SET modified_by = ? WHERE modified_by = ?',
      'UPDATE maintenances SET reported_by = ? WHERE reported_by = ?',
      'UPDATE maintenances SET created_by = ? WHERE created_by = ?',
      'UPDATE maintenances SET modified_by = ? WHERE modified_by = ?',
      'UPDATE modification_history SET user_id = ? WHERE user_id = ?',
      'UPDATE config SET modified_by = ? WHERE modified_by = ?',
      'UPDATE reservation_requests SET requested_by = ? WHERE requested_by = ?',
      'UPDATE reservation_requests SET reviewed_by = ? WHERE reviewed_by = ?'
    ];
    
    // Exécuter toutes les mises à jour dans une transaction
    const transaction = db.transaction(() => {
      for (const query of reassignQueries) {
        const stmt = db.prepare(query);
        stmt.run(adminId, userId);
      }
      
      // Supprimer les sessions actives de l'utilisateur
      const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
      deleteSessionsStmt.run(userId);
      
      // Enfin supprimer l'utilisateur
      const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?');
      deleteUserStmt.run(userId);
    });
    
    transaction();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Routes pour clients, drivers, locations, garages, config
setupClientsRoutes(app, authenticateToken);
setupDriversRoutes(app, authenticateToken);
setupLocationsRoutes(app, authenticateToken);
setupGaragesRoutes(app, authenticateToken);
setupConfigRoutes(app, authenticateToken);

// Endpoint pour créer un dossier
app.post('/api/create-folder', (req, res) => {
  try {
    const { path: folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Chemin du dossier manquant' });
    }
    
    // Créer le dossier récursivement (avec tous les parents)
    fs.mkdirSync(folderPath, { recursive: true });
    
    res.json({ success: true, path: folderPath });
  } catch (error) {
    console.error('Erreur création dossier:', error);
    res.status(500).json({ error: error.message });
  }
});

// Configuration de multer pour l'upload de fichiers
// Configuration de multer pour l'upload de fichiers - upload temporaire
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'public', 'attachments', 'TEMP');
    
    // Créer le dossier temporaire s'il n'existe pas
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Nom temporaire unique
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accepter uniquement les PDF
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés'));
    }
  }
});

// Endpoint pour uploader un BL
app.post('/api/upload-bl', upload.single('pdf'), (req, res) => {
  console.log('📤 POST /api/upload-bl reçu');
  console.log('  - affaireId:', req.body.affaireId);
  console.log('  - file:', req.file ? req.file.originalname : 'AUCUN');
  
  try {
    if (!req.file) {
      console.error('❌ Aucun fichier dans la requête');
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    
    if (!req.body.affaireId) {
      console.error('❌ affaireId manquant');
      return res.status(400).json({ error: 'affaireId requis' });
    }
    
    // Déplacer le fichier du dossier TEMP vers le dossier de l'affaire
    const affaireDir = path.join(__dirname, '..', 'public', 'attachments', req.body.affaireId);
    if (!fs.existsSync(affaireDir)) {
      fs.mkdirSync(affaireDir, { recursive: true });
      console.log('📁 Dossier créé:', affaireDir);
    }
    
    // Extraire le nom de fichier original (enlever le timestamp)
    const originalName = req.file.originalname.replace(/^\d+-/, '');
    const finalPath = path.join(affaireDir, originalName);
    
    // Déplacer le fichier
    fs.renameSync(req.file.path, finalPath);
    console.log('✅ Fichier déplacé vers:', finalPath);
    
    const relativePath = path.join('attachments', req.body.affaireId, originalName);
    
    res.json({ 
      success: true, 
      path: relativePath,
      filename: originalName
    });
  } catch (error) {
    console.error('❌ Erreur upload BL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour uploader des pièces jointes génériques
app.post('/api/upload-attachment', upload.single('file'), (req, res) => {
  console.log('📤 POST /api/upload-attachment reçu');
  console.log('  - affaireId:', req.body.affaireId);
  console.log('  - file:', req.file ? req.file.originalname : 'AUCUN');
  
  try {
    if (!req.file) {
      console.error('❌ Aucun fichier dans la requête');
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    
    if (!req.body.affaireId) {
      console.error('❌ affaireId manquant');
      return res.status(400).json({ error: 'affaireId requis' });
    }
    
    // Déplacer le fichier du dossier TEMP vers le dossier de l'affaire
    const affaireDir = path.join(__dirname, '..', 'public', 'attachments', req.body.affaireId);
    if (!fs.existsSync(affaireDir)) {
      fs.mkdirSync(affaireDir, { recursive: true });
      console.log('📁 Dossier créé:', affaireDir);
    }
    
    // Extraire le nom de fichier original (enlever le timestamp)
    const originalName = req.file.originalname.replace(/^\d+-/, '');
    const finalPath = path.join(affaireDir, originalName);
    
    // Déplacer le fichier
    fs.renameSync(req.file.path, finalPath);
    console.log('✅ Fichier attaché sauvegardé:', finalPath);
    
    const relativePath = path.join('attachments', req.body.affaireId, originalName);
    
    res.json({ 
      success: true, 
      path: relativePath,
      filename: originalName,
      url: `/attachments/${req.body.affaireId}/${originalName}`
    });
  } catch (error) {
    console.error('❌ Erreur upload attachment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour lister les fichiers d'une affaire
app.get('/api/attachments/:affaireId', (req, res) => {
  try {
    const affaireId = req.params.affaireId;
    const dirPath = path.join(__dirname, '..', 'public', 'attachments', affaireId);
    
    // Vérifier si le dossier existe
    if (!fs.existsSync(dirPath)) {
      return res.json({ files: [] });
    }
    
    // Fonction pour formater la taille
    const formatSize = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };
    
    // Lire les fichiers du dossier
    const files = fs.readdirSync(dirPath)
      .filter(file => !file.startsWith('.')) // Ignorer les fichiers cachés
      .map(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: formatSize(stats.size),
          sizeBytes: stats.size,
          url: `/attachments/${affaireId}/${file}`,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // Trier par date décroissante
    
    res.json({ files });
  } catch (error) {
    console.error('Erreur liste fichiers:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur backend démarré sur http://0.0.0.0:${PORT}`);
  console.log(`📡 Accessible depuis le réseau sur http://192.168.205.75:${PORT}`);
});
