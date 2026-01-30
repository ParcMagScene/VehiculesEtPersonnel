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

// ============ AUTHENTIFICATION ============

// Inscription
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const stmt = db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)');
    const result = stmt.run(email, name, passwordHash);
    
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
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
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
      INSERT INTO reservations (id, vehicle_id, start_date, end_date, client_name, driver_name,
                               pickup_location, return_location, notes, google_event_id, created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      reservation.id, reservation.vehicleId, reservation.startDate, reservation.endDate,
      reservation.clientName, reservation.driverName, reservation.pickupLocation,
      reservation.returnLocation, reservation.notes, reservation.googleEventId,
      req.user.id, req.user.id
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
    res.json(maintenances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/maintenances', authenticateToken, (req, res) => {
  try {
    const maintenance = req.body;
    const stmt = db.prepare(`
      INSERT INTO maintenances (id, vehicle_id, type, status, date, description, garage, cost, created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      maintenance.id, maintenance.vehicleId, maintenance.type, maintenance.status,
      maintenance.date, maintenance.description, maintenance.garage, maintenance.cost,
      req.user.id, req.user.id
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
