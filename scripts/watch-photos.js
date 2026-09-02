#!/usr/bin/env node

/**
 * Script de surveillance du dossier Photos
 * Régénère automatiquement la liste quand de nouveaux fichiers sont ajoutés
 * Usage: node scripts/watch-photos.js
 */

import { watch } from 'fs';
import { exec } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const photosDir = join(projectRoot, 'Photos');

console.log('👀 Surveillance du dossier Photos activée...');
console.log('📁 Dossier surveillé:', photosDir);
console.log('🔄 La liste sera mise à jour automatiquement à chaque changement\n');

let timeout;

watch(photosDir, { recursive: false }, (eventType, filename) => {
  if (!filename) return;
  
  const ext = filename.toLowerCase();
  const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
  if (!IMAGE_EXTS.some((e) => ext.endsWith(e))) {
    return;
  }

  console.log(`📸 ${eventType}: ${filename}`);
  
  // Debounce: attendre 500ms avant de régénérer
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    console.log('🔄 Mise à jour de la liste des photos...');
    exec('npm run update-photos', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Erreur:', error);
        return;
      }
      if (stderr) {
        console.error(stderr);
      }
      console.log(stdout);
    });
  }, 500);
});

// Garder le processus actif
process.stdin.resume();
