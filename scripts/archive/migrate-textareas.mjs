#!/usr/bin/env node
/**
 * Passe K — Migration automatique <textarea → <Textarea (DS)
 * Usage: node scripts/migrate-textareas.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../apps/web/src');

// All files with <textarea occurrences (from audit)
const FILES = [
  'components/video/CameraSettingsModal.jsx',
  'components/Header.jsx',
  'components/mailing/MailingPanel.jsx',
  'components/annuaire/AnnuairePanel.jsx',
  'components/DisplayDashboard/MessageFormModal.jsx',
  'components/DisplayDashboard/PlaylistFormModal.jsx',
  'components/leaves/LeaveRequestForm.jsx',
  'components/DisplayDashboard/WelcomeMessagesTab.jsx',
  'components/DisplayDashboard/TemplateFormModal.jsx',
  'components/leaves/LeaveValidationPanel.jsx',
  'components/DynamicDisplayDialog.jsx',
  'components/personnel/PersonnelPanel.jsx',
  'components/personnel/AssignmentDialog.jsx',
  'components/planning/TaskEditModal.jsx',
  'components/vehicles/GoogleEventFormModal.jsx',
  'components/planning/InterventionModal.jsx',
  'components/planning/OverdueInterventionModal.jsx',
  'components/vehicles/MaintenanceDialog.jsx',
  'components/affaires/AffaireDetailPanel.jsx',
  'components/affaires/AffaireImportModal.jsx',
  'components/vehicles/ReservationModal.jsx',
  'components/mobile/MobileReservations.jsx',
  'components/mobile/MobileEquipmentQR.jsx',
  'components/vehicles/ReservationRequestsPanel.jsx',
  'components/equipment/EquipmentPanel.jsx',
  'components/messaging/MessagingPanel.jsx',
  'components/orders/StockPanel.jsx',
  'components/mobile/MobileLeaves.jsx',
  'components/orders/OrdersPanel.jsx',
  'components/mobile/MobileMaintenances.jsx',
];

let totalMigrated = 0;
let filesModified = 0;

for (const relPath of FILES) {
  const absPath = resolve(root, relPath);
  let code;
  try {
    code = readFileSync(absPath, 'utf8');
  } catch {
    console.warn(`⚠️  Fichier introuvable: ${relPath}`);
    continue;
  }

  // Count textareas before
  const count = (code.match(/<textarea[\s/>]/g) || []).length;
  if (count === 0) {
    console.log(`⏭️  ${relPath} — aucun <textarea trouvé`);
    continue;
  }

  let modified = code;

  // 1. Replace <textarea with <Textarea (opening tags)
  modified = modified.replace(/<textarea(\s)/g, '<Textarea$1');
  modified = modified.replace(/<textarea\/>/g, '<Textarea/>');

  // 2. Replace </textarea> with </Textarea> (closing tags, if any)
  modified = modified.replace(/<\/textarea>/g, '</Textarea>');

  // 3. Add Textarea to existing DS import
  const dsImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]@\/design-system['"]/;
  const match = modified.match(dsImportRegex);

  if (match) {
    const imports = match[1];
    if (!imports.includes('Textarea')) {
      // Add Textarea after Input if present, else at end
      let newImports;
      if (imports.includes('Input')) {
        newImports = imports.replace(/Input/, 'Input, Textarea');
      } else {
        newImports = imports.trimEnd() + ', Textarea';
      }
      modified = modified.replace(dsImportRegex, `import {${newImports}} from '@/design-system'`);
    }
  } else {
    // No DS import — add one
    // Find the last import line
    const lines = modified.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^import\s/)) lastImportIdx = i;
    }
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, "import { Textarea } from '@/design-system';");
      modified = lines.join('\n');
    }
  }

  if (modified !== code) {
    writeFileSync(absPath, modified, 'utf8');
    const newCount = (modified.match(/<Textarea[\s/>]/g) || []).length;
    console.log(`✅ ${relPath} — ${newCount} Textarea(s) migrés`);
    totalMigrated += newCount;
    filesModified++;
  }
}

console.log(`\n═══ Passe K terminée ═══`);
console.log(`📊 ${totalMigrated} <textarea> → <Textarea> dans ${filesModified} fichiers`);
