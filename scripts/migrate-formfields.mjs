#!/usr/bin/env node
/**
 * Passe W — Migration form-group → FormField DS
 * 
 * Pattern:
 *   <div className="form-group"...>
 *     <label...>Label Text</label>
 *     <Input/Select/Textarea/etc />
 *   </div>
 * →
 *   <FormField className="form-group" label="Label Text"...>
 *     <Input/Select/Textarea/etc />
 *   </FormField>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.join(__dirname, '..', 'apps', 'web', 'src', 'components');
const DRY_RUN = process.argv.includes('--dry-run');

function findFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'ui' && entry.name !== 'node_modules') {
      results.push(...findFiles(full));
    } else if (entry.name.endsWith('.jsx')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('className="form-group"') || content.includes("className=\"form-group ")) {
        results.push(full);
      }
    }
  }
  return results;
}

function countTag(line, tag) {
  // Count opening tags like <div or <div> or <div ... but NOT </div>
  const openRe = new RegExp(`<${tag}[\\s>/]`, 'g');
  const closeRe = new RegExp(`</${tag}>`, 'g');
  const selfCloseRe = new RegExp(`<${tag}[^>]*/\\s*>`, 'g');
  const opens = (line.match(openRe) || []).length;
  const selfCloses = (line.match(selfCloseRe) || []).length;
  const closes = (line.match(closeRe) || []).length;
  return { opens: opens - selfCloses, closes };
}

function migrateFile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let modified = false;
  let count = 0;
  const skipped = [];

  // Process bottom-to-top to preserve line numbers  
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];

    // Match <div className="form-group"...>
    // Supports: className="form-group", className="form-group form-group--inline"
    const divMatch = line.match(/^(\s*)<div\s+className="form-group([^"]*)"([^>]*)>/);
    if (!divMatch) continue;

    const indent = divMatch[1];
    const extraClasses = divMatch[2]; // e.g. " form-group--inline"
    const extraAttrs = divMatch[3];   // e.g. ` style={{ marginBottom: 16 }}`

    // Find the <label> — should be within next 3 lines
    let labelStartLine = -1;
    let labelEndLine = -1;
    let labelFullText = '';

    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const trimmed = lines[j].trim();
      if (trimmed.startsWith('<label')) {
        labelStartLine = j;
        // Accumulate lines until </label>
        let buf = '';
        for (let k = j; k < Math.min(j + 6, lines.length); k++) {
          buf += (buf ? '\n' : '') + lines[k];
          if (buf.includes('</label>')) {
            labelEndLine = k;
            break;
          }
        }
        labelFullText = buf;
        break;
      }
      if (trimmed !== '') break; // Non-empty non-label → skip
    }

    if (labelStartLine === -1 || labelEndLine === -1) {
      skipped.push({ line: i + 1, reason: 'no label found' });
      continue;
    }

    // Extract htmlFor
    const htmlForMatch = labelFullText.match(/htmlFor="([^"]+)"/);
    const htmlFor = htmlForMatch ? htmlForMatch[1] : '';

    // Extract label content (between > and </label>)
    const contentMatch = labelFullText.match(/>\s*\n?([\s\S]*?)\s*<\/label>/);
    if (!contentMatch) {
      skipped.push({ line: i + 1, reason: 'cannot parse label content' });
      continue;
    }

    let labelContent = contentMatch[1].trim();
    let isRequired = false;

    // Detect required markers
    if (labelContent.endsWith('*')) {
      isRequired = true;
      labelContent = labelContent.replace(/\s*\*\s*$/, '').trim();
    }
    if (labelContent.includes('<span className="required">')) {
      isRequired = true;
      labelContent = labelContent.replace(/<span\s+className="required">\s*\*?\s*<\/span>/, '').trim();
    }

    // Check for JSX expressions or nested elements — use JSX label prop
    const hasJsx = labelContent.includes('{') || labelContent.includes('<');
    if (hasJsx) {
      skipped.push({ line: i + 1, reason: `complex label: ${labelContent.substring(0, 50)}` });
      continue;
    }

    // Escape quotes in label
    const escapedLabel = labelContent.replace(/"/g, '\\"');

    // Find the closing </div> by tracking depth of ALL tags that could nest
    let depth = 0;
    let closeIndex = -1;
    for (let j = i; j < lines.length; j++) {
      const l = lines[j];
      // Simple depth tracking based on <div and </div>
      const divInfo = countTag(l, 'div');
      depth += divInfo.opens - divInfo.closes;
      if (depth === 0 && j > i) {
        closeIndex = j;
        break;
      }
    }

    if (closeIndex === -1) {
      skipped.push({ line: i + 1, reason: 'cannot find closing </div>' });
      continue;
    }

    // Build FormField opening tag
    let className = 'form-group' + extraClasses;
    let props = `className="${className}" label="${escapedLabel}"`;
    if (htmlFor) props += ` htmlFor="${htmlFor}"`;
    if (isRequired) props += ' required';
    if (extraAttrs.trim()) props += extraAttrs;

    // Apply replacements (bottom to top within this block)
    // 1. Replace closing </div> with </FormField>
    lines[closeIndex] = lines[closeIndex].replace('</div>', '</FormField>');

    // 2. Remove label line(s)
    lines.splice(labelStartLine, labelEndLine - labelStartLine + 1);

    // 3. Replace opening <div> with <FormField>
    lines[i] = `${indent}<FormField ${props}>`;

    modified = true;
    count++;
  }

  if (modified && !DRY_RUN) {
    let content = lines.join('\n');

    // Add FormField to DS import if needed
    if (!content.includes('FormField')) {
      const dsMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]@\/design-system['"]/);
      if (dsMatch) {
        const oldImport = dsMatch[0];
        const imports = dsMatch[1].trimEnd();
        const lastChar = imports.endsWith(',') ? '' : ',';
        const newImport = oldImport.replace(
          `{${dsMatch[1]}}`,
          `{${imports}${lastChar} FormField}`
        );
        content = content.replace(oldImport, newImport);
      } else {
        // No DS import yet — add one after the last import
        const lastImportIdx = content.lastIndexOf('\nimport ');
        if (lastImportIdx !== -1) {
          const endOfLine = content.indexOf('\n', lastImportIdx + 1);
          content = content.slice(0, endOfLine + 1)
            + "import { FormField } from '@/design-system';\n"
            + content.slice(endOfLine + 1);
        }
      }
    }

    fs.writeFileSync(filePath, content);
  }

  return { count, skipped };
}

// Run
const files = findFiles(webDir);
let total = 0;
let totalSkipped = 0;
const baseDir = path.join(__dirname, '..');

console.log(DRY_RUN ? '=== DRY RUN ===' : '=== MIGRATION ===');
console.log();

for (const file of files.sort()) {
  const rel = path.relative(baseDir, file);
  const { count, skipped } = migrateFile(file);
  if (count > 0 || skipped.length > 0) {
    console.log(`${rel}: ${count} migrated, ${skipped.length} skipped`);
    for (const s of skipped) {
      console.log(`  ⚠ L${s.line}: ${s.reason}`);
    }
    total += count;
    totalSkipped += skipped.length;
  }
}

console.log(`\n✅ Total: ${total} migrated, ${totalSkipped} skipped`);
