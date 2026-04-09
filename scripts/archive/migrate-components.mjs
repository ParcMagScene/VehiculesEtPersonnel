#!/usr/bin/env node
// Script de migration : réorganise les composants en dossiers domaine
// et met à jour tous les imports dans le projet

import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, readdirSync } from 'fs';
import { join, dirname, relative, basename, extname } from 'path';

const ROOT = process.cwd();
const COMP = join(ROOT, 'src/components');

// ═══ Mapping composant → dossier cible ═══
const MOVES = {
  // vehicles/
  'Calendar': 'vehicles',
  'VehicleDetailPanel': 'vehicles',
  'VehicleDetailsModal': 'vehicles',
  'VehicleMaintenanceModal': 'vehicles',
  'VehiclePickerCards': 'vehicles',
  'PlanningView': 'vehicles',
  'DepotMap': 'vehicles',
  'TruckModelPanel': 'vehicles',
  'DriverSelect': 'vehicles',
  'LocationDialog': 'vehicles',
  'LocationSelector': 'vehicles',
  'ReservationModal': 'vehicles',
  'ReservationEquipment': 'vehicles',
  'ReservationRequestsPanel': 'vehicles',
  'ClientDialog': 'vehicles',
  'TripDetailsModal': 'vehicles',
  'GoogleCalendarBanner': 'vehicles',
  'GoogleCalendarConfig': 'vehicles',
  'GoogleEventFormModal': 'vehicles',
  'MaintenanceDialog': 'vehicles',
  'MaintenanceReportModal': 'vehicles',

  // affaires/
  'AffairesPanel': 'affaires',
  'AffaireDetailPanel': 'affaires',
  'AffaireImportModal': 'affaires',
  'BLImportModal': 'affaires',
  'BLImportLocPrestaModal': 'affaires',
  'BLMultiImportModal': 'affaires',
  'BLBatchAnalysis': 'affaires',
  'SavImportModal': 'affaires',

  // personnel/
  'PersonnelPanel': 'personnel',
  'PersonnelAgenda': 'personnel',
  'PersonnelDetailPanel': 'personnel',
  'PersonnelImportModal': 'personnel',
  'PersonnelContextMenu': 'personnel',
  'AssignmentDialog': 'personnel',
  'PositionsTab': 'personnel',
  'SkillsTab': 'personnel',
  'personnelConstants': 'personnel',

  // leaves/
  'LeavesTab': 'leaves',
  'LeaveRequestForm': 'leaves',
  'LeaveRequestsPanel': 'leaves',
  'LeaveValidationPanel': 'leaves',
  'leaveConstants': 'leaves',

  // equipment/
  'EquipmentPanel': 'equipment',
  'EquipmentBatchLabels': 'equipment',
  'EquipmentLabelPrint': 'equipment',
  'EquipmentImportModal': 'equipment',
  'EquipmentSheetPrint': 'equipment',

  // planning/
  'PlanningPanel': 'planning',
  'TaskPlanningPanel': 'planning',
  'TaskEditModal': 'planning',
  'TaskPDFExportModal': 'planning',
  'EventDetailsModal': 'planning',
  'EventTaskModal': 'planning',
  'InterventionModal': 'planning',
  'OverdueInterventionModal': 'planning',
  'PeriodCalendarModal': 'planning',

  // messaging/
  'MessagingPanel': 'messaging',

  // mailing/
  'MailingPanel': 'mailing',

  // annuaire/
  'AnnuairePanel': 'annuaire',
  'ContactsCSVImportDialog': 'annuaire',

  // orders/
  'OrdersPanel': 'orders',
  'CataloguePanel': 'orders',
  'StockPanel': 'orders',

  // management/
  'ManagementPanel': 'management',
  'UserManagement': 'management',
  'AccessRequestModal': 'management',
  'DashboardPanel': 'management',
  'ReportsPanel': 'management',

  // auth/
  'LoginForm': 'auth',
  'ChangePassword': 'auth',
  'ProfileEditModal': 'auth',
  'MonEspacePanel': 'auth',
  'MobileAccess': 'auth',
  'UserPreferencesModal': 'auth',
};

// ═══ Étape 1 : Créer les dossiers ═══
const folders = [...new Set(Object.values(MOVES))];
for (const folder of folders) {
  const dir = join(COMP, folder);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`📁 Créé: components/${folder}/`);
  }
}

// ═══ Étape 2 : Déplacer les fichiers (jsx + css) ═══
const movedFiles = new Map(); // oldBaseName → { folder, extensions }

for (const [name, folder] of Object.entries(MOVES)) {
  const extensions = [];
  for (const ext of ['.jsx', '.js', '.css']) {
    const src = join(COMP, `${name}${ext}`);
    const dst = join(COMP, folder, `${name}${ext}`);
    if (existsSync(src)) {
      renameSync(src, dst);
      extensions.push(ext);
    }
  }
  if (extensions.length > 0) {
    movedFiles.set(name, { folder, extensions });
    console.log(`  → ${name} (${extensions.join(', ')}) → ${folder}/`);
  }
}

console.log(`\n✅ ${movedFiles.size} composants déplacés dans ${folders.length} dossiers\n`);

// ═══ Étape 3 : Trouver tous les fichiers source à mettre à jour ═══
function findSourceFiles(dir, result = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, dist, .git, backups
      if (['node_modules', 'dist', 'dist-backup', '.git', 'backups', 'server'].includes(entry.name)) continue;
      findSourceFiles(full, result);
    } else if (/\.(jsx?|tsx?|css)$/.test(entry.name)) {
      result.push(full);
    }
  }
  return result;
}

const srcDir = join(ROOT, 'src');
const allFiles = findSourceFiles(srcDir);
console.log(`🔍 ${allFiles.length} fichiers source à scanner\n`);

// ═══ Étape 4 : Mettre à jour les imports ═══
// Import patterns:
// import X from './ComponentName'       (sibling → may need path change)
// import X from '../components/X'       (from hooks/contexts → needs update)
// import('./components/X')              (lazy in App.jsx)
// import './ComponentName.css'          (CSS co-located)

let totalUpdates = 0;

for (const filePath of allFiles) {
  if (filePath.endsWith('.css')) continue; // No import statements in CSS (except @import which we don't touch)
  
  let content = readFileSync(filePath, 'utf8');
  let modified = false;
  const fileDir = dirname(filePath);

  // Match all import-like patterns
  const importRegex = /(from\s+['"]|import\s*\(\s*['"]|import\s+['"])([^'"]+)(['"])/g;

  const newContent = content.replace(importRegex, (match, prefix, importPath, suffix) => {
    // Only process relative imports
    if (!importPath.startsWith('.')) return match;

    // Resolve the import to an absolute path
    const resolvedDir = join(fileDir, importPath);
    
    // Extract the base name (without extension) from the import path
    const importBaseName = basename(importPath).replace(/\.(jsx?|tsx?|css)$/, '');
    const importExt = extname(importPath);
    
    // Check if this import references a moved component
    const moveInfo = movedFiles.get(importBaseName);
    if (!moveInfo) return match; // Not a moved component

    // Determine the old and new absolute paths
    let oldAbsPath, newAbsPath;
    
    if (importExt === '.css') {
      oldAbsPath = join(COMP, `${importBaseName}.css`);
      newAbsPath = join(COMP, moveInfo.folder, `${importBaseName}.css`);
    } else {
      // JS/JSX imports (may or may not have extension)
      oldAbsPath = join(COMP, `${importBaseName}.jsx`);
      if (!moveInfo.extensions.includes('.jsx')) {
        oldAbsPath = join(COMP, `${importBaseName}.js`);
      }
      newAbsPath = join(COMP, moveInfo.folder, basename(oldAbsPath));
    }

    // Compute the correct relative path from the current file to the new location
    let newRelPath = relative(fileDir, newAbsPath);
    
    // Ensure it starts with ./ or ../
    if (!newRelPath.startsWith('.')) {
      newRelPath = './' + newRelPath;
    }
    
    // Normalize path separators
    newRelPath = newRelPath.replace(/\\/g, '/');
    
    // If no extension in original import, strip it from new path too
    if (!importExt && !importPath.endsWith('.css')) {
      newRelPath = newRelPath.replace(/\.(jsx?|tsx?)$/, '');
    }

    // Check if the path actually changed
    if (importPath === newRelPath) return match;
    
    modified = true;
    return `${prefix}${newRelPath}${suffix}`;
  });

  if (modified) {
    writeFileSync(filePath, newContent, 'utf8');
    const relPath = relative(ROOT, filePath);
    const changes = (content.match(importRegex) || []).length;
    console.log(`  ✏️  ${relPath}`);
    totalUpdates++;
  }
}

console.log(`\n✅ ${totalUpdates} fichiers mis à jour`);

// ═══ Étape 5 : Nettoyage backup api.js ═══
const bakFile = join(ROOT, 'src/utils/api.js.bak');
if (existsSync(bakFile)) {
  renameSync(bakFile, join(ROOT, 'src/utils/api.js.bak'));
  console.log('\n💡 api.js.bak conservé pour référence');
}

console.log('\n🎉 Migration terminée ! Lancer `npx vite build` pour vérifier.');
