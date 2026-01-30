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
    
    // Vérifier si l'email est autorisé
    const authStmt = db.prepare('SELECT * FROM authorized_emails WHERE email = ? AND status = ?');
    const authorized = authStmt.get(email, 'pending');
    
    if (!authorized) {
      return res.status(403).json({ error: 'Email non autorisé. Contactez un administrateur.' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const stmt = db.prepare('INSERT INTO users (email, name, password_hash, is_admin) VALUES (?, ?, ?, 0)');
    const result = stmt.run(email, name, passwordHash);
    
    // Marquer l'email comme activé
    const updateStmt = db.prepare('UPDATE authorized_emails SET status = ?, activated_at = CURRENT_TIMESTAMP WHERE email = ?');
    updateStmt.run('activated', email);
    
    res.json({ id: result.lastInsertRowid, email, name });
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
    res.json(reservations);
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
                               notes, google_event_id, affaire, is_tournee, created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      req.user.id,
      req.user.id
    );
    
    addToHistory('reservation', reservation.id, 'created', reservation, req.user.id, req.user.name);
    
    res.json({ success: true, id: reservation.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/reservations/:id', authenticateToken, (req, res) => {
  try {
    const reservation = req.body;
    const stmt = db.prepare(`
      UPDATE reservations 
      SET vehicle_id = ?, start_date = ?, end_date = ?, client_name = ?, driver_name = ?,
          pickup_location = ?, return_location = ?, notes = ?, google_event_id = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      reservation.vehicleId, reservation.startDate, reservation.endDate, reservation.clientName,
      reservation.driverName, reservation.pickupLocation, reservation.returnLocation,
      reservation.notes, reservation.googleEventId, req.user.id, req.params.id
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

// ============ MAINTENANCES ============

app.get('/api/maintenances', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM maintenances');
    const maintenances = stmt.all();
    
    // Mapper 'date' vers 'start_date' pour compatibilité frontend
    const mappedMaintenances = maintenances.map(m => ({
      ...m,
      start_date: m.date
    }));
    
    res.json(mappedMaintenances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/maintenances', authenticateToken, (req, res) => {
  try {
    const maintenance = req.body;
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
    const stmt = db.prepare(`
      UPDATE maintenances 
      SET vehicle_id = ?, type = ?, status = ?, date = ?, description = ?, garage = ?, cost = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      maintenance.vehicleId, maintenance.type, maintenance.status, maintenance.date,
      maintenance.description, maintenance.garage, maintenance.cost, req.user.id, req.params.id
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
    const { status } = req.body;
    
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
      const authStmt = db.prepare(`
        INSERT INTO authorized_emails (email, name, status)
        VALUES (?, ?, 'pending')
      `);
      
      try {
        authStmt.run(request.email, request.name);
      } catch (error) {
        // Si l'email existe déjà dans authorized_emails, pas grave
        console.log('Email déjà autorisé:', request.email);
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
