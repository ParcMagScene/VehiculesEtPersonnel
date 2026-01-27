import * as XLSX from 'xlsx';
import { format, parse } from 'date-fns';
import { fr } from 'date-fns/locale';

// Couleurs pour les véhicules
const vehicleColors = {
  0: '#3b82f6',
  1: '#8b5cf6',
  2: '#ec4899',
  3: '#f59e0b',
  4: '#10b981',
  5: '#ef4444',
  6: '#06b6d4',
  7: '#f97316',
};

export const parseExcelReservations = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Chercher la feuille avec le plus de données
        let bestSheet = null;
        let maxDataCells = 0;
        
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
          const cellCount = (range.e.r - range.s.r) * (range.e.c - range.s.c);
          
          if (cellCount > maxDataCells) {
            maxDataCells = cellCount;
            bestSheet = sheetName;
          }
        });
        
        const sheetName = bestSheet;
        const worksheet = workbook.Sheets[sheetName];
        
        // Obtenir la plage de cellules
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        
        // Trouver la ligne contenant les dates
        let dateRow = -1;
        for (let r = 0; r < Math.min(20, range.e.r); r++) {
          const cellC = worksheet[XLSX.utils.encode_cell({ r, c: 2 })];
          const cellD = worksheet[XLSX.utils.encode_cell({ r, c: 3 })];
          
          if ((cellC?.t === 'n' || cellD?.t === 'n') && 
              (typeof cellC?.v === 'number' || typeof cellD?.v === 'number')) {
            dateRow = r;
            break;
          }
        }
        
        if (dateRow === -1) {
          throw new Error('Ligne de dates non trouvée');
        }
        
        // Extraire les dates à partir de la colonne C (index 2)
        const dates = [];
        
        for (let col = 2; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: dateRow, c: col });
          const cell = worksheet[cellAddress];
          
          if (cell && cell.v) {
            let date;
            
            if (cell.t === 'n' && typeof cell.v === 'number') {
              const excelDate = cell.v;
              const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
              const year = jsDate.getFullYear();
              const month = String(jsDate.getMonth() + 1).padStart(2, '0');
              const day = String(jsDate.getDate()).padStart(2, '0');
              date = `${year}-${month}-${day}`;
            } else {
              let dateStr = cell.v.toString().trim();
              const match = dateStr.match(/(\d+)\s+(\w+)/);
              if (match) {
                const day = match[1];
                const monthName = match[2];
                const monthMap = {
                  'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
                  'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
                  'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
                };
                const month = monthMap[monthName.toLowerCase()] || '01';
                const yearCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: 0 })];
                const year = yearCell && yearCell.v ? yearCell.v.toString().split('/')[2] : '2026';
                date = `${year}-${month}-${day.padStart(2, '0')}`;
              }
            }
            
            if (date) {
              dates.push(date);
            }
          }
        }
        
        // Extraire les véhicules et réservations
        const vehicles = [];
        const reservations = [];
        let vehicleIndex = 0;
        
        // Parcourir les lignes par paires (AM et PM) - commencer après la ligne de dates
        for (let row = dateRow + 1; row <= range.e.r; row += 2) {
          // Ligne AM
          const vehicleCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
          if (!vehicleCell || !vehicleCell.v) continue;
          
          const vehicleName = vehicleCell.v.toString().trim();
          vehicleIndex++;
          
          const vehicle = {
            id: vehicleIndex,
            name: vehicleName,
            type: '',
            color: vehicleColors[vehicleIndex % Object.keys(vehicleColors).length]
          };
          vehicles.push(vehicle);
          
          // Traiter les réservations AM et PM
          const periods = [
            { row: row, period: 'AM' },
            { row: row + 1, period: 'PM' }
          ];
          
          periods.forEach(({ row: currentRow, period }) => {
            let currentBlock = null;
            
            for (let col = 2; col <= 2 + dates.length - 1; col++) {
              const cellAddress = XLSX.utils.encode_cell({ r: currentRow, c: col });
              const cell = worksheet[cellAddress];
              const cellValue = cell && cell.v ? cell.v.toString().trim() : '';
              
              const dateIndex = col - 2;
              const dateStr = dates[dateIndex];
              
              if (!dateStr) continue;
              
              if (cellValue && cellValue !== 'AM' && cellValue !== 'PM') {
                if (!currentBlock || currentBlock.clientName !== cellValue) {
                  if (currentBlock && currentBlock.dates.length > 0) {
                    reservations.push({
                      id: `reservation-${Date.now()}-${Math.random()}`,
                      vehicleId: `vehicle-${vehicleIndex}`,
                      startDate: currentBlock.dates[0],
                      startPeriod: currentBlock.period,
                      endDate: currentBlock.dates[currentBlock.dates.length - 1],
                      endPeriod: currentBlock.period,
                      clientName: currentBlock.clientName,
                      driverName: '',
                      locationName: '',
                      prestationName: '',
                      notes: ''
                    });
                  }
                  
                  currentBlock = {
                    clientName: cellValue,
                    period: period,
                    dates: [dateStr]
                  };
                } else {
                  // Continuer le bloc
                  currentBlock.dates.push(dateStr);
                }
              } else {
                if (currentBlock && currentBlock.dates.length > 0) {
                  reservations.push({
                    id: `reservation-${Date.now()}-${Math.random()}`,
                    vehicleId: `vehicle-${vehicleIndex}`,
                    startDate: currentBlock.dates[0],
                    startPeriod: currentBlock.period,
                    endDate: currentBlock.dates[currentBlock.dates.length - 1],
                    endPeriod: currentBlock.period,
                    clientName: currentBlock.clientName,
                    driverName: '',
                    locationName: '',
                    prestationName: '',
                    notes: ''
                  });
                  currentBlock = null;
                }
              }
            }
            
            if (currentBlock && currentBlock.dates.length > 0) {
              reservations.push({
                id: `reservation-${Date.now()}-${Math.random()}`,
                vehicleId: `vehicle-${vehicleIndex}`,
                startDate: currentBlock.dates[0],
                startPeriod: currentBlock.period,
                endDate: currentBlock.dates[currentBlock.dates.length - 1],
                endPeriod: currentBlock.period,
                clientName: currentBlock.clientName,
                driverName: '',
                locationName: '',
                prestationName: '',
                notes: ''
              });
            }
          });
        }
        
        resolve({ vehicles, reservations });
      } catch (error) {
        console.error('❌ Erreur lors de l\'analyse:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};
