// Tests unitaires des helpers de normalisation des désignations (L7).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanDesignation,
  isLikelyHeader,
  isAmbiguousRef,
  normalizeRef,
  mergeContinuationLines,
  scoreDesignation,
  summarizeDesignationQuality,
} from '../apps/web/src/utils/catalogDesignation.js';

test('cleanDesignation: trim + collapse spaces', () => {
  assert.equal(cleanDesignation('  Console   numérique   '), 'Console numérique');
});

test('cleanDesignation: supprime leader dots et trailing HT/€', () => {
  assert.equal(cleanDesignation('LumiPar 6UQ . . . . . . . 144,20 € HT'), 'LumiPar 6UQ 144,20');
  // Note : le prix lui-même reste, seuls leader-dots + marqueurs € / HT en fin sont retirés.
});

test('cleanDesignation: retire les leader dots quand seuls', () => {
  assert.equal(cleanDesignation('Console A&H ........'), 'Console A&H');
});

test('cleanDesignation: retire numérotation en tête', () => {
  assert.equal(cleanDesignation('1. Console numérique'), 'Console numérique');
  assert.equal(cleanDesignation('• Câble XLR 3m'), 'Câble XLR 3m');
  assert.equal(cleanDesignation('- Pied de micro'), 'Pied de micro');
});

test('cleanDesignation: gère espaces insécables', () => {
  assert.equal(
    cleanDesignation('Console\u00A0numérique\u00A0\u00A0QU-16'),
    'Console numérique QU-16',
  );
});

test('cleanDesignation: null/undefined/empty', () => {
  assert.equal(cleanDesignation(null), '');
  assert.equal(cleanDesignation(undefined), '');
  assert.equal(cleanDesignation(''), '');
  assert.equal(cleanDesignation('   '), '');
});

test('cleanDesignation: retire « €» et « HT » même en chaîne avec espace insécable', () => {
  assert.equal(cleanDesignation('Pied K&M 210/9 144,20 €\u00A0HT'), 'Pied K&M 210/9 144,20');
});

test('isLikelyHeader: en-têtes classiques', () => {
  assert.equal(isLikelyHeader('Désignation'), true);
  assert.equal(isLikelyHeader('Code'), true);
  assert.equal(isLikelyHeader('Référence'), true);
  assert.equal(isLikelyHeader('Prix HT'), true);
  assert.equal(isLikelyHeader('PAGE 4 / 12'), true);
  assert.equal(isLikelyHeader('Total'), true);
  assert.equal(isLikelyHeader('www.fournisseur.fr'), true);
});

test('isLikelyHeader: vraies désignations', () => {
  assert.equal(isLikelyHeader('Console numérique QU-16'), false);
  assert.equal(isLikelyHeader('Câble XLR 3m'), false);
  assert.equal(isLikelyHeader('Pied de micro K&M 210/9'), false);
});

test('isLikelyHeader: chaînes courtes / vides', () => {
  assert.equal(isLikelyHeader(''), true);
  assert.equal(isLikelyHeader(null), true);
  assert.equal(isLikelyHeader('AB'), true);
});

test('isAmbiguousRef: refs ambiguës', () => {
  assert.equal(isAmbiguousRef('1'), true);
  assert.equal(isAmbiguousRef('12'), true);
  assert.equal(isAmbiguousRef('123'), true);
  assert.equal(isAmbiguousRef('2026'), true);
  assert.equal(isAmbiguousRef('1,5'), true);
  assert.equal(isAmbiguousRef('12.50'), true);
  assert.equal(isAmbiguousRef('10:30'), true);
  assert.equal(isAmbiguousRef('Page'), true);
  assert.equal(isAmbiguousRef(''), true);
  assert.equal(isAmbiguousRef(null), true);
});

test('isAmbiguousRef: refs valides', () => {
  assert.equal(isAmbiguousRef('SAH-QU16'), false);
  assert.equal(isAmbiguousRef('003291'), false); // ≥ 5 chiffres
  assert.equal(isAmbiguousRef('ML024'), false);
  assert.equal(isAmbiguousRef('DRISSE/1N'), false);
  assert.equal(isAmbiguousRef('SD25025'), false);
});

test('normalizeRef: nettoie ponctuation parasite', () => {
  assert.equal(normalizeRef('  SAH-QU16  '), 'SAH-QU16');
  assert.equal(normalizeRef('(ML024)'), 'ML024');
  assert.equal(normalizeRef('"SD25025"'), 'SD25025');
  assert.equal(normalizeRef('SAH QU16'), 'SAHQU16'); // collapse interne
  assert.equal(normalizeRef(null), null);
  assert.equal(normalizeRef(''), null);
});

test('mergeContinuationLines: fusionne suite minuscule', () => {
  const isProductLine = (l) => /\d+[.,]\d{2}\s*€/.test(l);
  const lines = [
    'SAH-QU16 Console numérique 16 entrées 2 564,00 € HT',
    'avec écran tactile 7 pouces',
    'et 4 sorties FX',
    'SAH-QU32 Console numérique 32 entrées 4 800,00 € HT',
  ];
  const out = mergeContinuationLines(lines, { isProductLine });
  assert.equal(out.length, 2);
  assert.match(out[0], /16 entrées 2 564,00 € HT avec écran tactile 7 pouces et 4 sorties FX/);
  assert.match(out[1], /SAH-QU32/);
});

test('mergeContinuationLines: ne fusionne pas en-têtes ni nouveaux codes', () => {
  const isProductLine = (l) => /\d+[.,]\d{2}\s*€/.test(l);
  const lines = [
    'SAH-QU16 Console 2 564,00 € HT',
    'SECTION SONORISATION', // en-tête (majuscules)
    'Code Désignation Prix', // en-tête
    'XYZ-001 Autre produit 100,00 € HT', // commence par code
  ];
  const out = mergeContinuationLines(lines, { isProductLine });
  // out[0] = produit, out[1] = section (en-tête), out[2] = en-tête tableau, out[3] = produit
  assert.equal(out.length, 4);
  assert.match(out[0], /^SAH-QU16/);
  assert.match(out[3], /^XYZ-001/);
});

test('mergeContinuationLines: continuations vides ou invalides', () => {
  const isProductLine = () => true;
  assert.deepEqual(mergeContinuationLines([], { isProductLine }), []);
  assert.deepEqual(mergeContinuationLines(['  ', ''], { isProductLine }), []);
});

test('mergeContinuationLines: lève si isProductLine manquant', () => {
  assert.throws(() => mergeContinuationLines(['a'], {}), /isProductLine/);
});

test('scoreDesignation: bonnes désignations ≥ 80', () => {
  assert.ok(scoreDesignation('Console numérique QU-16') >= 80);
  assert.ok(scoreDesignation('Câble XLR mâle/femelle 3m') >= 80);
  assert.ok(scoreDesignation('Pied de micro K&M 210/9 noir') >= 80);
});

test('scoreDesignation: mauvaises désignations < 60', () => {
  assert.ok(scoreDesignation('') < 60);
  assert.ok(scoreDesignation('AB') < 60);
  assert.ok(scoreDesignation('Code') < 60);
  assert.ok(scoreDesignation('PAGE 4') < 60);
});

test('summarizeDesignationQuality: agrège les scores', () => {
  const items = [
    { designation: 'Console numérique QU-16' },
    { designation: 'Câble XLR 3m' },
    { designation: 'Pied de micro K&M 210/9' },
    { designation: '' },
  ];
  const s = summarizeDesignationQuality(items);
  assert.equal(s.count, 4);
  assert.equal(s.validCount, 3);
  assert.equal(s.validRate, 75);
  assert.ok(s.avgScore > 50);
});

test('summarizeDesignationQuality: vide', () => {
  const s = summarizeDesignationQuality([]);
  assert.deepEqual(s, { count: 0, avgScore: 0, validCount: 0, validRate: 0 });
});

// ── Cible 6.1 : fiabilité ≥ 95 % sur un échantillon de désignations réelles
test('summarizeDesignationQuality: ≥ 95% sur échantillon réaliste (Algam/ESL/LA-BS)', () => {
  const items = [
    { designation: 'QU-16 Console numérique 16 entrées rackable' },
    { designation: 'LumiPar 6UQ projecteur LED PAR 6x12W' },
    { designation: 'Drisse polypropylène ø 1 mm noire 200 m' },
    { designation: 'Câble XLR mâle/femelle 3m Cordial' },
    { designation: 'Pied de micro K&M 210/9 noir' },
    { designation: 'Connecteur Neutrik NC3MXX XLR mâle 3 broches' },
    { designation: 'Enceinte amplifiée RCF ART 712-A MK4' },
    { designation: 'Manille lyre acier 5T galvanisée' },
    { designation: 'Élingue ronde 1T x 2m violette' },
    { designation: 'Projecteur LED Chauvet Rogue R2 Wash' },
    { designation: 'Console DJ Pioneer DJM-900NXS2 4 canaux' },
    { designation: 'Pince de fixation Doughty C-Clamp 50mm' },
    { designation: 'Câble HDMI 2.0 Procab 5m' },
    { designation: 'Boîtier de scène Stagg 12x4 25m' },
    { designation: 'Microphone dynamique Shure SM58' },
    { designation: 'Direct box DI passive Radial JDI' },
    { designation: 'Amplificateur de puissance Crown XLi800' },
    { designation: 'Casque retour Sennheiser HD 25' },
    { designation: 'Égaliseur graphique 31 bandes BSS FCS-960' },
    { designation: 'Sub-grave actif RCF SUB 8003-AS II' },
  ];
  const s = summarizeDesignationQuality(items);
  assert.ok(s.validRate >= 95, `Attendu ≥ 95%, obtenu ${s.validRate}% (avg ${s.avgScore})`);
});
