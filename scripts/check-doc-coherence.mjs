import fs from 'fs';
import path from 'path';
import process from 'process';

const rootDir = process.cwd();

const requiredApiModules = [
  { setup: 'setupAuthRoutes', doc: 'auth.md', label: 'Auth & Accès' },
  { setup: 'setupVehicleRoutes', doc: 'vehicles.md', label: 'Véhicules & Réservations' },
  { setup: 'setupPersonsRoutes', doc: 'personnel.md', label: 'Personnel & Planning' },
  { setup: 'setupEquipmentRoutes', doc: 'equipment.md', label: 'Matériel & SAV' },
  { setup: 'setupAffairesRoutes', doc: 'affaires.md', label: 'Affaires' },
  { setup: 'setupOrdersRoutes', doc: 'orders.md', label: 'Commandes & Fournisseurs' },
  { setup: 'setupStockItemsRoutes', doc: 'stock.md', label: 'Stock' },
  { setup: 'setupPlanningRoutes', doc: 'planning.md', label: 'Planning & Tâches' },
  { setup: 'setupSuiviRoutes', doc: 'suivi.md', label: 'Suivi personnel' },
  { setup: 'setupMessagingRoutes', doc: 'messaging.md', label: 'Messagerie' },
  { setup: 'setupLeaveRoutes', doc: 'leaves.md', label: 'Congés' },
  { setup: 'setupAnnuaireClientsRoutes', doc: 'annuaire.md', label: 'Annuaire' },
  { setup: 'setupVideoRoutes', doc: 'video.md', label: 'Vidéo' },
  { setup: 'setupDisplayRoutes', doc: 'display.md', label: 'Affichage TV' },
  { setup: 'setupSonosRoutes', doc: 'sonos.md', label: 'Sonos' },
  { setup: 'setupAttachmentsRoutes', doc: 'attachments.md', label: 'Pièces jointes' },
  { setup: 'setupSupplierCatalogRoutes', doc: 'supplier-catalog.md', label: 'Catalogue fournisseurs' },
  { setup: 'setupInventoryRoutes', doc: 'inventory.md', label: 'Inventaire' },
  { setup: 'setupGoogleRoutes', doc: 'google.md', label: 'Google OAuth2' },
  { setup: 'setupTOTPRoutes', doc: 'totp.md', label: '2FA TOTP' },
  { setup: 'setupProfileRoutes', doc: 'auth.md', label: 'Profil utilisateur' },
];

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function listMarkdownFiles(relativeDir) {
  const baseDir = path.join(rootDir, relativeDir);
  const results = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(path.relative(rootDir, absolute).replace(/\\/g, '/'));
      }
    }
  }

  walk(baseDir);
  return results.sort();
}

function fail(errors) {
  console.error('Documentation coherence check failed:\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

function isSetupMounted(serverContent, setupName) {
  const escapedName = setupName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escapedName}\\s*\\(\\s*app\\b`);
  return pattern.test(serverContent);
}

function main() {
  const errors = [];
  const fixMode = process.argv.includes('--fix');

  const serverContent = read('apps/api/server.js');
  const apiReadme = read('docs/api/README.md');
  const docsIndexPath = path.join(rootDir, 'docs/docs-index.json');
  const docsIndexRaw = read('docs/docs-index.json');
  const docsIndex = JSON.parse(docsIndexRaw);

  const docsMarkdownFiles = listMarkdownFiles('docs');
  const apiMarkdownFiles = listMarkdownFiles('docs/api').map((file) => file.replace('docs/api/', ''));

  if (docsIndex.totalFiles !== docsMarkdownFiles.length) {
    if (fixMode) {
      docsIndex.totalFiles = docsMarkdownFiles.length;
      docsIndex.generated = new Date().toISOString().slice(0, 10);
      fs.writeFileSync(docsIndexPath, JSON.stringify(docsIndex, null, 2) + '\n', 'utf8');
      console.log(`✏️  docs-index.json totalFiles régénéré: ${docsMarkdownFiles.length}`);
    } else {
      errors.push(
        `docs/docs-index.json totalFiles=${docsIndex.totalFiles} mais ${docsMarkdownFiles.length} fichiers .md ont été trouvés dans docs/ (lancer: npm run docs:fix)`,
      );
    }
  }

  const indexedApiFiles = (docsIndex.sections?.api?.files || []).map((file) =>
    file.replace('docs/api/', ''),
  );

  for (const apiFile of indexedApiFiles) {
    if (!apiMarkdownFiles.includes(apiFile)) {
      errors.push(`docs/docs-index.json référence un fichier API absent: docs/api/${apiFile}`);
    }
  }

  for (const apiFile of apiMarkdownFiles) {
    if (apiFile === 'README.md') continue;
    if (!indexedApiFiles.includes(apiFile)) {
      errors.push(`docs/api/${apiFile} existe mais n'est pas indexé dans docs/docs-index.json`);
    }
  }

  const linkedDocFiles = Array.from(apiReadme.matchAll(/\[[^\]]+\]\(([^)]+\.md)(?:#[^)]+)?\)/g))
    .map((match) => match[1])
    .filter((file) => file !== 'README.md');

  for (const module of requiredApiModules) {
    if (!isSetupMounted(serverContent, module.setup)) {
      errors.push(`Module actif attendu non détecté dans apps/api/server.js: ${module.setup}`);
    }

    if (!fs.existsSync(path.join(rootDir, 'docs/api', module.doc))) {
      errors.push(`Documentation API manquante pour ${module.label}: docs/api/${module.doc}`);
    }

    if (!linkedDocFiles.includes(module.doc)) {
      errors.push(`docs/api/README.md ne référence pas docs/api/${module.doc} pour ${module.label}`);
    }
  }

  if (errors.length > 0) {
    fail(errors);
  }

  console.log('Documentation coherence check passed');
  console.log(`- docs/: ${docsMarkdownFiles.length} fichiers Markdown`);
  console.log(`- docs/api/: ${apiMarkdownFiles.length} fichiers Markdown`);
  console.log(`- modules API vérifiés: ${requiredApiModules.length}`);
}

main();