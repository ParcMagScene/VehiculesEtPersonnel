#!/usr/bin/env node

/**
 * Script pour générer automatiquement la liste des photos disponibles
 * Usage: node scripts/generate-photo-list.js
 */

import { readdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function generatePhotoList() {
  try {
    const photosDir = join(projectRoot, 'Photos');
    const files = await readdir(photosDir);
    
    // Filtrer pour ne garder que les images
    const photoFiles = files
      .filter(file => {
        const ext = file.toLowerCase();
        return ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png');
      })
      .sort();

    // Générer le fichier JSON
    const outputPath = join(projectRoot, 'public', 'photos-list.json');
    const content = JSON.stringify(photoFiles, null, 2);
    
    await writeFile(outputPath, content, 'utf-8');
    
    console.log(`✅ Liste des photos générée avec succès: ${photoFiles.length} fichiers`);
    console.log('📄 Fichier créé:', outputPath);
    photoFiles.forEach(file => console.log('  -', file));
    
  } catch (error) {
    console.error('❌ Erreur lors de la génération de la liste:', error);
    process.exit(1);
  }
}

generatePhotoList();
