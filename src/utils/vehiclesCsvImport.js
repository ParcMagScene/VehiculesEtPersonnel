/**
 * Import des véhicules depuis le fichier VÉHICULES.csv
 */

export function parseVehiclesCsv(text) {
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('Fichier CSV vide ou invalide');
  }
  
  const header = lines[0].split(',').map(h => h.trim());
  
  // Palette de couleurs pour l'affichage
  const displayColors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#06b6d4', '#6366f1', '#ef4444', '#f97316', '#14b8a6',
    '#a855f7', '#84cc16', '#f43f5e', '#eab308', '#06b6d4'
  ];
  
  const vehicles = [];
  let colorIndex = 0;
  let order = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parser la ligne en gérant les virgules dans les valeurs
    const values = parseCsvLine(line);
    
    if (values.length < header.length) {
      continue;
    }
    
    const name = values[0]?.trim() || '';
    const type = values[1]?.trim() || '';
    const registration = values[2]?.trim() || '';
    const brand = values[3]?.trim() || '';
    const color = values[4]?.trim() || '';
    const model = values[5]?.trim() || '';
    const comment = values[6]?.trim() || '';
    const owner = values[7]?.trim() || '';
    
    // Construire l'ID au format Excel (ex: "20M3-DL-622-TF")
    let vehicleId = '';
    if (type && registration) {
      // Extraire le type court (ex: "VL 20 m3" -> "20M3")
      const typeShort = type.replace(/VL\s+/i, '').replace(/\s+m3/i, 'M3').replace(/\s+/g, '').toUpperCase();
      vehicleId = `${typeShort}-${registration}`;
    } else if (name) {
      // Fallback: utiliser le nom simplifié
      vehicleId = name.replace(/\s+/g, '-').toUpperCase();
    } else {
      vehicleId = crypto.randomUUID();
    }
    
    // Déterminer si c'est un véhicule de location
    const isLocation = comment.toLowerCase().includes('location') || 
                       name.toLowerCase().includes('loc') ||
                       owner.toLowerCase() === 'externe';
    
    const vehicle = {
      id: vehicleId,
      name,
      type,
      registration,
      brand,
      color,
      model,
      comment,
      owner,
      displayColor: displayColors[colorIndex % displayColors.length],
      order: isLocation ? 1000 + order : order,
      isLocation
    };
    
    if (vehicle.name) {
      vehicles.push(vehicle);
      colorIndex++;
      order++;
    }
  }
  
  vehicles.sort((a, b) => a.order - b.order);
  
  return vehicles;
}

/**
 * Parse une ligne CSV en gérant les virgules dans les valeurs entre guillemets
 */
function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Ajouter la dernière valeur
  values.push(current);
  
  return values;
}
