/**
 * _migrate-tooltips.cjs — Pass 3 (simplified)
 * Migre les title="..." natifs vers <Tooltip content="..." position="bottom">
 *
 * Approche : cherche chaque ligne avec title="...", identifie le tag parent,
 * trouve la fermeture via compteur de profondeur, puis enveloppe.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'apps', 'web', 'src', 'components');

const TARGET_FILES = [
  'Header.jsx',
  'HelpModal.jsx',
  'affaires/AffaireDetailPanel.jsx',
  'affaires/AffairesPanel.jsx',
  'affaires/BLImportLocPrestaModal.jsx',
  'annuaire/AnnuairePanel.jsx',
  'equipment/EquipmentPanel.jsx',
  'leaves/LeavesTab.jsx',
  'management/UserManagement.jsx',
  'mobile/MobilePlanning.jsx',
  'orders/OrdersPanel.jsx',
  'orders/StockPanel.jsx',
  'orders/SupplierCatalogPanel.jsx',
  'personnel/PersonnelDetailPanel.jsx',
  'personnel/PersonnelPanel.jsx',
  'planning/EventDetailsModal.jsx',
  'planning/TaskPlanningPanel.jsx',
  'vehicles/Calendar.jsx',
  'vehicles/DepotMap.jsx',
  'vehicles/DepotMapEditor.jsx',
  'vehicles/LocationDialog.jsx',
  'vehicles/MaintenanceReportModal.jsx',
  'video/PlaybackPanel.jsx',
  'video/VideoPanel.jsx',
];

const INTERACTIVE_TAGS = ['Button', 'button', 'span', 'label'];
const SKIP_TAGS = ['SectionHeader', 'Input', 'input', 'select', 'option', 'textarea', 'img'];

/**
 * Find which JSX tag "owns" the title attribute on line lineIdx.
 * Returns { tagName, tagLineIdx } or null.
 */
function findOwnerTag(lines, lineIdx) {
  // Check the line itself first
  for (const tag of INTERACTIVE_TAGS) {
    if (lines[lineIdx].match(new RegExp(`<${tag}\\b`))) {
      return { tagName: tag, tagLineIdx: lineIdx };
    }
  }
  // Look backwards for an unclosed tag
  for (let j = lineIdx - 1; j >= Math.max(0, lineIdx - 8); j--) {
    const ln = lines[j];
    for (const tag of INTERACTIVE_TAGS) {
      if (ln.match(new RegExp(`<${tag}\\b`))) {
        return { tagName: tag, tagLineIdx: j };
      }
    }
    // If we hit a line with a closing tag or a skip tag, stop
    if (ln.match(/<\//) || ln.match(/<[A-Z]/)) break;
  }
  return null;
}

/**
 * Check if the title belongs to a tag we should skip.
 */
function shouldSkip(lines, lineIdx) {
  for (const tag of SKIP_TAGS) {
    if (lines[lineIdx].match(new RegExp(`<${tag}\\b`))) return true;
  }
  // Skip title= that's a prop on a Dialog/Modal
  if (lines[lineIdx].match(/^\s+title="/)) {
    for (let j = lineIdx - 1; j >= Math.max(0, lineIdx - 5); j--) {
      if (lines[j].match(/<(Dialog|Modal|AlertModal|FormField)\b/i)) return true;
    }
  }
  return false;
}

/**
 * Find the closing line for a JSX element starting at tagLineIdx with tagName.
 * Uses depth counting.
 */
function findClosingIdx(lines, tagLineIdx, tagName) {
  const openRe = new RegExp(`<${tagName}\\b`);
  const closeRe = new RegExp(`</${tagName}>`);

  // First: does the tag self-close?
  // Scan from tagLineIdx to find where the opening tag ends
  let inTag = true; // we're inside the <Tag ... > opening tag
  let depth = 0;

  for (let j = tagLineIdx; j < Math.min(lines.length, tagLineIdx + 30); j++) {
    const ln = lines[j];

    if (inTag) {
      // We're still inside the opening tag's attributes
      // Count self-closes of THIS tag (unlikely for Button, but possible)
      if (ln.match(/\/>\s*(\/\*.*\*\/)?\s*$/)) {
        // Line ends with /> — self-closing
        return { closeIdx: j, selfClosing: true };
      }
      // Check if line ends with > (tag open closes, children start)
      // We need to check that this > is not inside {...} or a string
      // Simple heuristic: if line ends with > and is on tagLineIdx or has tag attributes
      if (j === tagLineIdx) {
        // Find the last > on this line after the tag name
        const tagPos = ln.search(openRe);
        if (tagPos >= 0) {
          const rest = ln.substring(tagPos);
          if (rest.match(/>\s*$/)) {
            inTag = false;
            depth = 1; // tag is open
          }
        }
      } else {
        // Continuation line for tag attributes
        if (ln.match(/>\s*$/)) {
          inTag = false;
          depth = 1;
        }
      }
    } else {
      // We're inside children, track depth
      // Count opening tags of same name
      const opens = (ln.match(openRe) || []).length;
      const closes = (ln.match(closeRe) || []).length;
      depth += opens - closes;
      if (depth <= 0) {
        return { closeIdx: j, selfClosing: false };
      }
    }
  }
  return null;
}

let totalChanges = 0;
let totalFiles = 0;

for (const relFile of TARGET_FILES) {
  const filePath = path.join(ROOT, relFile);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  SKIP (missing): ${relFile}`);
    continue;
  }

  let lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let fileChanges = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Find static title="..." (skip dynamic title={...})
    const titleMatch = line.match(/ title="([^"]+)"/);
    if (!titleMatch) { i++; continue; }

    // Should we skip this?
    if (shouldSkip(lines, i)) { i++; continue; }

    // Find owner tag
    const owner = findOwnerTag(lines, i);
    if (!owner) { i++; continue; }        

    const { tagName, tagLineIdx } = owner;

    // Check if already wrapped in <Tooltip>
    const prevLine = tagLineIdx > 0 ? lines[tagLineIdx - 1] : '';
    if (prevLine.includes('<Tooltip') || lines[tagLineIdx].includes('<Tooltip')) { i++; continue; }

    const titleText = titleMatch[1];

    // ═══ CASE A: Fully inline on one line ═══
    // Pattern: ... <span ... title="X">text</span> ...
    // Handle even if surrounded by {cond && ...}
    const inlineRe = new RegExp(`(<${tagName}\\b[^>]*?) title="${titleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"([^>]*>.*?</${tagName}>)`);
    const inlineMatch = line.match(inlineRe);
    if (inlineMatch) {
      // Single-line: check if there's a JSX conditional wrapper
      const indent = lines[i].match(/^(\s*)/)[1];
      const withoutTitle = line.replace(/ title="[^"]+"/, '');
      
      // Find the <Tag...>...</Tag> portion and wrap it
      const tagFullRe = new RegExp(`(<${tagName}\\b[^>]*>.*?</${tagName}>)`);
      const tagFullMatch = withoutTitle.match(tagFullRe);
      if (tagFullMatch) {
        const before = withoutTitle.substring(0, tagFullMatch.index);
        const tagPortion = tagFullMatch[1];
        const after = withoutTitle.substring(tagFullMatch.index + tagPortion.length);
        const escapedTitle = titleText.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        lines[i] = `${before}<Tooltip content="${escapedTitle}" position="bottom">${tagPortion}</Tooltip>${after}`;
        fileChanges++;
        i++;
        continue;
      }
    }

    // ═══ CASE B: Multi-line element ═══
    // Find closing BEFORE removing title
    const result = findClosingIdx(lines, tagLineIdx, tagName);
    if (!result) {
      console.log(`  ⚠️  No close for <${tagName}> at ${relFile}:${i + 1} — title preserved`);
      i++;
      continue;
    }

    const { closeIdx } = result;

    // NOW remove title (only after confirming we can wrap)
    lines[i] = lines[i].replace(/ title="[^"]+"/, '');
    lines[i] = lines[i].replace(/ {2,}/g, ' ');

    const indent = lines[tagLineIdx].match(/^(\s*)/)[1];
    const escapedTitle = titleText.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

    if (tagLineIdx === closeIdx) {
      // Single-line (self-closing or same-line close), inline wrap
      const trimmed = lines[tagLineIdx].trimStart();
      lines[tagLineIdx] = `${indent}<Tooltip content="${escapedTitle}" position="bottom">${trimmed}</Tooltip>`;
      fileChanges++;
      i++;
    } else {
      // Multi-line element: insert Tooltip lines into the array
      lines.splice(closeIdx + 1, 0, `${indent}</Tooltip>`);
      lines.splice(tagLineIdx, 0, `${indent}<Tooltip content="${escapedTitle}" position="bottom">`);
      lines[tagLineIdx + 1] = `${indent}  ${lines[tagLineIdx + 1].trimStart()}`;
      fileChanges++;
      i = closeIdx + 3;
    }
  }

  if (fileChanges > 0) {
    let content = lines.join('\n');

    // Ensure Tooltip import exists
    if (!content.match(/\bTooltip\b.*from.*['"]@\/design-system['"]/)) {
      const dsImportMatch = content.match(/(import\s*\{[^}]*)(}\s*from\s*['"]@\/design-system['"])/);
      if (dsImportMatch) {
        if (!dsImportMatch[1].includes('Tooltip')) {
          content = content.replace(
            dsImportMatch[0],
            dsImportMatch[1] + ', Tooltip' + dsImportMatch[2]
          );
        }
      } else {
        const lastImportIdx = content.lastIndexOf('\nimport ');
        if (lastImportIdx >= 0) {
          const endOfLine = content.indexOf('\n', lastImportIdx + 1);
          content = content.slice(0, endOfLine + 1) + "import { Tooltip } from '@/design-system';\n" + content.slice(endOfLine + 1);
        }
      }
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${relFile}: ${fileChanges} title→Tooltip`);
    totalChanges += fileChanges;
    totalFiles++;
  } else {
    console.log(`⏭️  ${relFile}: 0 changes`);
  }
}

console.log(`\n═══ Total: ${totalChanges} changes in ${totalFiles} files ═══`);
