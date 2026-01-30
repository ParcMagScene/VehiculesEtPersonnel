import fs from 'fs';
import fetch from 'node-fetch';

const API_URL = 'http://192.168.205.75:3002/api';
const BACKUP_FILE = process.argv[2] || '../backup.json';

async function importBackup() {
  console.log('📦 Lecture du fichier backup:', BACKUP_FILE);
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));

  console.log('📊 Contenu du backup:');
  console.log('  - Véhicules:', backup.vehicles?.length || 0);
  console.log('  - Réservations:', backup.reservations?.length || 0);
  console.log('  - Clients:', backup.clients?.length || 0);
  console.log('  - Conducteurs:', backup.drivers?.length || 0);
  console.log('  - Lieux:', backup.locations?.length || 0);
  console.log('  - Garages:', backup.garages?.length || 0);
  console.log('  - Maintenances:', backup.maintenances?.length || 0);

  // Connexion
  console.log('\n🔐 Connexion...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      email: 'admin@magsav.com', 
      password: 'admin123' 
    })
  });
  
  if (!loginRes.ok) {
    throw new Error('Échec de connexion');
  }
  
  const { token } = await loginRes.json();
  console.log('✅ Connecté !');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Fonction pour normaliser les données avant import
  function normalizeReservation(item) {
    return {
      id: item.id,
      vehicle_id: item.vehicleId,
      start_date: item.date || item.startDate,
      start_period: item.period || item.startPeriod || 'AM',
      end_date: (item.endDate && item.endDate.includes('T')) 
        ? item.endDate.split('T')[0] 
        : item.endDate,
      end_period: item.endPeriod || 'PM',
      client_name: item.clientName || '',
      driver_name: item.driverName || '',
      location_name: item.locationName || '',
      prestation_name: item.prestationName || '',
      notes: item.notes || '',
      google_event_id: item.googleEventId || '',
      affaire: item.affaire || '',
      is_tournee: item.isTournee || false
    };
  }

  function normalizeMaintenance(item) {
    return {
      id: item.id,
      vehicle_id: item.vehicleId,
      vehicle_name: item.vehicleName || '',
      date: item.startDate || new Date().toISOString().split('T')[0],
      end_date: item.endDate || item.startDate || new Date().toISOString().split('T')[0],
      description: item.description || '',
      type: item.type || 'other',
      garage_id: item.garageId || null,
      cost: item.cost || null,
      mileage: item.mileage || null,
      status: item.status || 'pending',
      notes: item.notes || '',
      is_immobilized: item.isImmobilized || false
    };
  }

  // Fonction helper pour importer
  async function importData(endpoint, data, name) {
    if (!data || data.length === 0) {
      console.log(`⚠️  Aucun ${name} à importer`);
      return { success: 0, errors: 0 };
    }

    console.log(`\n📤 Import de ${data.length} ${name}...`);
    let success = 0;
    let errors = 0;

    for (const item of data) {
      try {
        // Normaliser les données selon le type
        let normalizedItem = item;
        if (endpoint === 'reservations') {
          normalizedItem = normalizeReservation(item);
        } else if (endpoint === 'maintenances') {
          normalizedItem = normalizeMaintenance(item);
        }
        
        const res = await fetch(`${API_URL}/${endpoint}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(normalizedItem)
        });

        if (res.ok) {
          success++;
          process.stdout.write('.');
        } else {
          const error = await res.json();
          errors++;
          process.stdout.write('X');
          if (errors === 1) console.log(`\n  Erreur: ${error.error}`);
        }
      } catch (err) {
        errors++;
        process.stdout.write('X');
      }
    }

    console.log(`\n✅ ${name}: ${success} réussis, ${errors} erreurs`);
    return { success, errors };
  }

  // Import dans l'ordre (à cause des dépendances)
  const results = {};
  
  results.vehicles = await importData('vehicles', backup.vehicles, 'véhicules');
  results.clients = await importData('clients', backup.clients, 'clients');
  results.drivers = await importData('drivers', backup.drivers, 'conducteurs');
  results.locations = await importData('locations', backup.locations, 'lieux');
  results.garages = await importData('garages', backup.garages, 'garages');
  results.reservations = await importData('reservations', backup.reservations, 'réservations');
  results.maintenances = await importData('maintenances', backup.maintenances, 'maintenances');

  // Configuration Google Calendar si présente
  if (backup.calendarConfig) {
    console.log('\n📅 Import configuration Google Calendar...');
    try {
      await fetch(`${API_URL}/config`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          key: 'googleCalendar',
          value: JSON.stringify(backup.calendarConfig)
        })
      });
      console.log('✅ Configuration importée');
    } catch (err) {
      console.log('⚠️  Erreur configuration:', err.message);
    }
  }

  console.log('\n\n🎉 Import terminé !');
  console.log('━'.repeat(50));
  console.log('Résumé:');
  Object.entries(results).forEach(([key, value]) => {
    if (value.success > 0 || value.errors > 0) {
      console.log(`  ${key}: ${value.success} ✅  ${value.errors} ❌`);
    }
  });
  console.log('━'.repeat(50));
}

importBackup().catch(err => {
  console.error('\n❌ Erreur:', err.message);
  process.exit(1);
});
