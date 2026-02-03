import db, { addToHistory } from './database.js';

// ============ CLIENTS ============

export function setupClientsRoutes(app, authenticateToken) {
  app.get('/api/clients', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM clients');
      const clients = stmt.all();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/clients', authenticateToken, (req, res) => {
    try {
      const client = req.body;
      const stmt = db.prepare(`
        INSERT INTO clients (name, email, phone, address, created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(client.name, client.email, client.phone, client.address, req.user.id, req.user.id);
      
      addToHistory('client', result.lastInsertRowid, 'created', client, req.user.id, req.user.name);
      
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/clients/:id', authenticateToken, (req, res) => {
    try {
      const client = req.body;
      const stmt = db.prepare(`
        UPDATE clients 
        SET name = ?, email = ?, phone = ?, address = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(client.name, client.email, client.phone, client.address, req.user.id, req.params.id);
      
      addToHistory('client', req.params.id, 'updated', client, req.user.id, req.user.name);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/clients/:id', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('DELETE FROM clients WHERE id = ?');
      stmt.run(req.params.id);
      
      addToHistory('client', req.params.id, 'deleted', null, req.user.id, req.user.name);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ============ CONDUCTEURS ============

export function setupDriversRoutes(app, authenticateToken) {
  app.get('/api/drivers', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM drivers');
      const drivers = stmt.all();
      res.json(drivers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/drivers', authenticateToken, (req, res) => {
    try {
      const driver = req.body;
      const stmt = db.prepare(`
        INSERT INTO drivers (name, license_number, phone, created_by, modified_by)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(driver.name, driver.license_number, driver.phone, req.user.id, req.user.id);
      
      addToHistory('driver', result.lastInsertRowid, 'created', driver, req.user.id, req.user.name);
      
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/drivers/:id', authenticateToken, (req, res) => {
    try {
      const driver = req.body;
      const stmt = db.prepare(`
        UPDATE drivers 
        SET name = ?, license_number = ?, phone = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(driver.name, driver.license_number, driver.phone, req.user.id, req.params.id);
      
      addToHistory('driver', req.params.id, 'updated', driver, req.user.id, req.user.name);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/drivers/:id', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('DELETE FROM drivers WHERE id = ?');
      stmt.run(req.params.id);
      
      addToHistory('driver', req.params.id, 'deleted', null, req.user.id, req.user.name);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ============ LIEUX ============

export function setupLocationsRoutes(app, authenticateToken) {
  app.get('/api/locations', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM locations');
      const locations = stmt.all();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/locations', authenticateToken, (req, res) => {
    try {
      const location = req.body;
      const stmt = db.prepare(`
        INSERT INTO locations (name, address, lat, lng, place_id, created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(location.name, location.address, location.lat, location.lng, location.place_id, req.user.id, req.user.id);
      
      addToHistory('location', result.lastInsertRowid, 'created', location, req.user.id, req.user.name);
      
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/locations/:id', authenticateToken, (req, res) => {
    try {
      const location = req.body;
      const stmt = db.prepare(`
        UPDATE locations 
        SET name = ?, address = ?, lat = ?, lng = ?, place_id = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(location.name, location.address, location.lat, location.lng, location.place_id, req.user.id, req.params.id);
      
      addToHistory('location', req.params.id, 'updated', location, req.user.id, req.user.name);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/locations/:id', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('DELETE FROM locations WHERE id = ?');
      stmt.run(req.params.id);
      
      addToHistory('location', req.params.id, 'deleted', null, req.user.id, req.user.name);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ============ GARAGES ============

export function setupGaragesRoutes(app, authenticateToken) {
  app.get('/api/garages', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM garages');
      const garages = stmt.all();
      res.json(garages);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/garages', authenticateToken, (req, res) => {
    try {
      const garage = req.body;
      const stmt = db.prepare(`
        INSERT INTO garages (name, address, phone, email, created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(garage.name, garage.address, garage.phone, garage.email, req.user.id, req.user.id);
      
      addToHistory('garage', result.lastInsertRowid, 'created', garage, req.user.id, req.user.name);
      
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/garages/:id', authenticateToken, (req, res) => {
    try {
      const garage = req.body;
      const stmt = db.prepare(`
        UPDATE garages 
        SET name = ?, address = ?, phone = ?, email = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(garage.name, garage.address, garage.phone, garage.email, req.user.id, req.params.id);
      
      addToHistory('garage', req.params.id, 'updated', garage, req.user.id, req.user.name);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/garages/:id', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('DELETE FROM garages WHERE id = ?');
      stmt.run(req.params.id);
      
      addToHistory('garage', req.params.id, 'deleted', null, req.user.id, req.user.name);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ============ CONFIGURATION ============

export function setupConfigRoutes(app, authenticateToken) {
  app.get('/api/config/:key', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
      const config = stmt.get(req.params.key);
      res.json(config ? JSON.parse(config.value) : null);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/config/:key', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO config (key, value, modified_by, modified_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run(req.params.key, JSON.stringify(req.body), req.user.id);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Routes spécifiques pour Google Calendar (admin uniquement via middleware)
  app.get('/api/config/google/client-id', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
      const config = stmt.get('google_client_id');
      res.json({ value: config ? config.value : '' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/config/google/calendar-id', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
      const config = stmt.get('google_calendar_id');
      res.json({ value: config ? config.value : '' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/config/google/maps-api-key', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
      const config = stmt.get('google_maps_api_key');
      res.json({ value: config ? config.value : '' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/config/google/client-id', authenticateToken, (req, res) => {
    try {
      const { value } = req.body;
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO config (key, value, modified_by, modified_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run('google_client_id', value, req.user.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/config/google/calendar-id', authenticateToken, (req, res) => {
    try {
      const { value } = req.body;
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO config (key, value, modified_by, modified_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run('google_calendar_id', value, req.user.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/config/google/maps-api-key', authenticateToken, (req, res) => {
    try {
      const { value } = req.body;
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO config (key, value, modified_by, modified_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run('google_maps_api_key', value, req.user.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
