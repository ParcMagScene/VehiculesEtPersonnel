#!/usr/bin/env node
// Script pour corriger le CSV Personnel Locmat :
// 1. Normaliser les codes libres au format Pe + 12 chiffres
// 2. Normaliser les numéros de téléphone au format +33 (0) X XX XX XX XX

const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'public', 'imports', 'Personnel Locmat.csv');
const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.split(/\r?\n/).filter(l => l.trim());

// line 0 = "Personnel Locmat" (titre)
// line 1 = "Code Libre;Nom;Prénom;CP;Ville;Portable;Type" (en-tête)
const titleLine = lines[0];
const headerLine = lines[1];
const dataLines = lines.slice(2);

console.log('=== ANALYSE DU CSV ===');
console.log('Total lignes de données:', dataLines.length);

// ---- ÉTAPE 1 : Analyser les codes existants ----
let maxPeNum = 0;
const existingPeNums = new Set();
const codeAnalysis = { pe_correct: 0, pe_wrong_length: 0, non_pe: 0 };

for (const line of dataLines) {
  const code = line.split(';')[0].trim();
  const peMatch = code.match(/^Pe(\d+)$/i);
  if (peMatch) {
    const num = parseInt(peMatch[1]);
    existingPeNums.add(num);
    if (num > maxPeNum) maxPeNum = num;
    if (peMatch[1].length === 12) {
      codeAnalysis.pe_correct++;
    } else {
      codeAnalysis.pe_wrong_length++;
    }
  } else {
    codeAnalysis.non_pe++;
  }
}

console.log('\n--- Codes ---');
console.log('Codes Pe valides (12 chiffres):', codeAnalysis.pe_correct);
console.log('Codes Pe longueur incorrecte:', codeAnalysis.pe_wrong_length);
console.log('Codes non-Pe à corriger:', codeAnalysis.non_pe);
console.log('Plus grand numéro Pe existant:', maxPeNum);

// ---- ÉTAPE 2 : Normaliser les téléphones ----
function normalizePhone(phone) {
  if (!phone || !phone.trim()) return '';
  
  // Nettoyer : retirer espaces, tirets, points, parenthèses
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
  
  // Si commence par +33, retirer le +33
  if (cleaned.startsWith('+33')) {
    cleaned = cleaned.substring(3);
  }
  // Si commence par 0033
  else if (cleaned.startsWith('0033')) {
    cleaned = cleaned.substring(4);
  }
  // Si commence par 33 et fait 11 chiffres
  else if (cleaned.startsWith('33') && cleaned.length === 11) {
    cleaned = cleaned.substring(2);
  }
  
  // Si commence par 0, retirer le 0
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = cleaned.substring(1);
  }
  
  // Vérifier qu'on a bien 9 chiffres
  if (cleaned.length !== 9 || !/^\d{9}$/.test(cleaned)) {
    // Retourner tel quel si on ne peut pas normaliser
    return phone.trim();
  }
  
  // Formater : +33 (0) X XX XX XX XX
  const d = cleaned;
  return `+33 (0) ${d[0]} ${d[1]}${d[2]} ${d[3]}${d[4]} ${d[5]}${d[6]} ${d[7]}${d[8]}`;
}

// ---- ÉTAPE 3 : Générer les codes corrigés ----
let nextNum = maxPeNum + 1;

function getNextCode() {
  while (existingPeNums.has(nextNum)) {
    nextNum++;
  }
  const code = 'Pe' + String(nextNum).padStart(12, '0');
  existingPeNums.add(nextNum);
  nextNum++;
  return code;
}

function fixPeCode(code) {
  // Extraire le numéro et le re-padder à 12 chiffres
  const match = code.match(/^Pe(\d+)$/i);
  if (match) {
    return 'Pe' + match[1].padStart(12, '0');
  }
  return code;
}

// ---- ÉTAPE 4 : Traiter toutes les lignes ----
const outputLines = [titleLine, headerLine];
let codesFixed = 0;
let phonesFixed = 0;
const changeLog = [];

for (const line of dataLines) {
  const parts = line.split(';');
  const originalCode = parts[0].trim();
  const originalPhone = (parts[5] || '').trim();
  
  // Corriger le code
  let newCode;
  const peMatch = originalCode.match(/^Pe(\d+)$/i);
  if (peMatch) {
    if (peMatch[1].length === 12) {
      newCode = originalCode; // Déjà correct
    } else {
      newCode = fixPeCode(originalCode);
      codesFixed++;
      changeLog.push(`  Code: ${originalCode} → ${newCode}`);
    }
  } else {
    newCode = getNextCode();
    codesFixed++;
    changeLog.push(`  Code: ${originalCode} → ${newCode} (${parts[1]?.trim()} ${parts[2]?.trim()})`);
  }
  
  // Normaliser le téléphone
  const newPhone = normalizePhone(originalPhone);
  if (newPhone !== originalPhone && originalPhone) {
    phonesFixed++;
  }
  
  parts[0] = newCode;
  parts[5] = newPhone;
  
  outputLines.push(parts.join(';'));
}

console.log('\n--- Résultats ---');
console.log('Codes corrigés:', codesFixed);
console.log('Téléphones normalisés:', phonesFixed);

if (changeLog.length > 0) {
  console.log('\n--- Détail des changements de codes ---');
  changeLog.forEach(c => console.log(c));
}

// ---- ÉTAPE 5 : Écrire le fichier corrigé ----
fs.writeFileSync(csvPath, outputLines.join('\n'), 'utf8');
console.log('\n✅ Fichier CSV corrigé et sauvegardé !');
