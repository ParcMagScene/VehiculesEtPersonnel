#!/usr/bin/env node
/**
 * Codemod eM@g — Correctifs automatiques
 * 
 * Usage :
 *   node scripts/codemod-audit-fixes.mjs --dry-run   # Affiche les modifications sans les appliquer
 *   node scripts/codemod-audit-fixes.mjs              # Applique les modifications
 * 
 * Corrections appliquées :
 *   1. addEventListener('scroll', ...) → { passive: true }
 *   2. Calendar.jsx syncRowHeights → séparer lectures/écritures
 *   3. FicheSuivi.jsx crypto.randomUUID → fallback compatible
 *   4. useSwipeAction.js → addEventListener imperatif { passive: false }
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const changes = [];

function patchFile(relPath, patches) {
  const absPath = resolve(ROOT, relPath);
  if (!existsSync(absPath)) {
    console.warn(`⚠️  Fichier introuvable : ${relPath}`);
    return;
  }
  let content = readFileSync(absPath, 'utf8');
  let modified = false;

  for (const { find, replace, description } of patches) {
    if (typeof find === 'string') {
      if (content.includes(find)) {
        content = content.replace(find, replace);
        changes.push({ file: relPath, description, status: 'applied' });
        modified = true;
      } else {
        changes.push({ file: relPath, description, status: 'NOT_FOUND' });
      }
    } else {
      // RegExp
      if (find.test(content)) {
        content = content.replace(find, replace);
        changes.push({ file: relPath, description, status: 'applied' });
        modified = true;
      } else {
        changes.push({ file: relPath, description, status: 'NOT_FOUND' });
      }
    }
  }

  if (modified && !DRY_RUN) {
    writeFileSync(absPath, content, 'utf8');
  }
}

// ─── Fix 1: Calendar.jsx — scroll listeners passive ───
patchFile('apps/web/src/components/vehicles/Calendar.jsx', [
  {
    find: `vehicleColumn.addEventListener('scroll', onScroll);`,
    replace: `vehicleColumn.addEventListener('scroll', onScroll, { passive: true });`,
    description: 'scroll listener → passive: true (vehicleColumn)',
  },
  {
    find: `scrollArea.addEventListener('scroll', onScroll);`,
    replace: `scrollArea.addEventListener('scroll', onScroll, { passive: true });`,
    description: 'scroll listener → passive: true (scrollArea)',
  },
]);

// ─── Fix 2: GoogleCalendarBanner.jsx — scroll listeners passive ───
patchFile('apps/web/src/components/vehicles/GoogleCalendarBanner.jsx', [
  {
    find: `calendarScrollArea.addEventListener('scroll', handleCalendarScroll);`,
    replace: `calendarScrollArea.addEventListener('scroll', handleCalendarScroll, { passive: true });`,
    description: 'scroll listener → passive: true (calendarScrollArea)',
  },
  {
    find: `bannerScrollArea.addEventListener('scroll', handleBannerScroll);`,
    replace: `bannerScrollArea.addEventListener('scroll', handleBannerScroll, { passive: true });`,
    description: 'scroll listener → passive: true (bannerScrollArea)',
  },
]);

// ─── Fix 3: Calendar.jsx — syncRowHeights reflow batching ───
patchFile('apps/web/src/components/vehicles/Calendar.jsx', [
  {
    find: `      leftChildren.forEach((leftChild, index) => {
        const gridChild = gridChildren[index];
        if (!gridChild) return;
        const leftHeight = leftChild.offsetHeight;
        if (gridChild.classList.contains('vehicle-row')) {
          gridChild.querySelectorAll('.time-slot').forEach((slot) => {
            slot.style.height = \`\${leftHeight}px\`;
            slot.style.minHeight = \`\${leftHeight}px\`;
          });
        } else if (gridChild.classList.contains('vehicle-section-separator')) {
          gridChild.style.height = \`\${leftHeight}px\`;`,
    replace: `      // Batch reads then writes to avoid forced reflow
      const heights = leftChildren.map((c) => c.offsetHeight);
      leftChildren.forEach((leftChild, index) => {
        const gridChild = gridChildren[index];
        if (!gridChild) return;
        const leftHeight = heights[index];
        if (gridChild.classList.contains('vehicle-row')) {
          gridChild.querySelectorAll('.time-slot').forEach((slot) => {
            slot.style.height = \`\${leftHeight}px\`;
            slot.style.minHeight = \`\${leftHeight}px\`;
          });
        } else if (gridChild.classList.contains('vehicle-section-separator')) {
          gridChild.style.height = \`\${leftHeight}px\`;`,
    description: 'syncRowHeights: batch layout reads before writes (anti-reflow)',
  },
]);

// ─── Fix 4: FicheSuivi.jsx — crypto.randomUUID fallback ───
patchFile('apps/web/src/components/suivi/FicheSuivi.jsx', [
  {
    find: `    _key: crypto.randomUUID(),`,
    replace: `    _key: crypto.randomUUID?.() ?? (Math.random().toString(36).slice(2) + Date.now().toString(36)),`,
    description: 'crypto.randomUUID fallback (newEntry)',
  },
  {
    find: `        _key: e.id || crypto.randomUUID(),`,
    replace: `        _key: e.id || (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)),`,
    description: 'crypto.randomUUID fallback (entry mapping)',
  },
]);

// ─── Fix 5: useSwipeAction.js — imperative addEventListener for passive: false ───
const swipeActionNew = `import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook de swipe-to-action sur un élément de liste (style iOS).
 * Révèle des boutons d'action en dessous lors du glissement.
 *
 * @param {Object} options
 * @param {number} [options.threshold=70] - Distance en px pour révéler l'action
 * @param {boolean} [options.disabled=false]
 * @returns {{ getSwipeProps: (id) => touchProps, swipeState: { id, direction, offset }, resetSwipe: () => void }}
 */
export default function useSwipeAction({ threshold = 70, disabled = false } = {}) {
  const [swipeState, setSwipeState] = useState({ id: null, direction: null, offset: 0 });
  const touchRef = useRef({ startX: 0, startY: 0, id: null, locked: false });
  const elMapRef = useRef(new Map()); // element → itemId

  const resetSwipe = useCallback(() => {
    setSwipeState({ id: null, direction: null, offset: 0 });
  }, []);

  // Imperative touchmove handler — needs passive: false for preventDefault()
  const handleTouchMove = useCallback(
    (e) => {
      const ref = touchRef.current;
      const itemId = elMapRef.current.get(e.currentTarget);
      if (!itemId || ref.id !== itemId) return;

      const touch = e.touches[0];
      const dx = touch.clientX - ref.startX;
      const dy = touch.clientY - ref.startY;

      // Première décision : horizontal vs vertical
      if (!ref.locked) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
          ref.id = null; // scroll vertical → abandonner
          return;
        }
        if (Math.abs(dx) > 10) {
          ref.locked = true;
        } else {
          return;
        }
      }

      e.preventDefault(); // Fonctionne car passive: false
      const direction = dx > 0 ? 'right' : 'left';
      const offset = Math.min(Math.abs(dx), threshold + 20);
      setSwipeState({ id: itemId, direction, offset });
    },
    [threshold],
  );

  const getSwipeProps = useCallback(
    (itemId) => {
      if (disabled) return {};

      return {
        ref: (el) => {
          if (el) {
            elMapRef.current.set(el, itemId);
          }
        },
        onTouchStart: (e) => {
          // Fermer le swipe précédent si on touche un autre item
          if (swipeState.id && swipeState.id !== itemId) {
            resetSwipe();
          }
          const touch = e.touches[0];
          touchRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            id: itemId,
            locked: false,
          };
        },
        // touchmove is handled imperatively (see useEffect below)
        onTouchEnd: () => {
          const ref = touchRef.current;
          if (ref.id !== itemId || !ref.locked) return;

          // Si on a dépassé le seuil, rester ouvert
          if (swipeState.offset >= threshold) {
            setSwipeState((prev) => ({ ...prev, offset: threshold }));
          } else {
            resetSwipe();
          }
          touchRef.current = { startX: 0, startY: 0, id: null, locked: false };
        },
      };
    },
    [disabled, swipeState, threshold, resetSwipe],
  );

  // Attach imperative touchmove with { passive: false } on registered elements
  useEffect(() => {
    const elements = Array.from(elMapRef.current.keys());
    elements.forEach((el) => {
      el.addEventListener('touchmove', handleTouchMove, { passive: false });
    });
    return () => {
      elements.forEach((el) => {
        el.removeEventListener('touchmove', handleTouchMove);
      });
    };
  }, [handleTouchMove]);

  return { getSwipeProps, swipeState, resetSwipe };
}
`;

patchFile('apps/web/src/hooks/useSwipeAction.js', [
  {
    find: readFileSync(resolve(ROOT, 'apps/web/src/hooks/useSwipeAction.js'), 'utf8').trim(),
    replace: swipeActionNew.trim(),
    description: 'Réécriture complète: addEventListener imperatif { passive: false } pour touchmove',
  },
]);

// ─── Rapport ───
console.log('');
console.log(DRY_RUN ? '🔍 DRY RUN — Aucune modification appliquée' : '✅ Modifications appliquées');
console.log('─'.repeat(70));
console.log('');

const applied = changes.filter((c) => c.status === 'applied');
const notFound = changes.filter((c) => c.status === 'NOT_FOUND');

if (applied.length > 0) {
  console.log(`✅ ${applied.length} correction(s) ${DRY_RUN ? 'identifiée(s)' : 'appliquée(s)'} :`);
  for (const c of applied) {
    console.log(`   ${c.file} — ${c.description}`);
  }
}

if (notFound.length > 0) {
  console.log('');
  console.log(`⚠️  ${notFound.length} pattern(s) non trouvé(s) (déjà corrigé ou code modifié) :`);
  for (const c of notFound) {
    console.log(`   ${c.file} — ${c.description}`);
  }
}

console.log('');
console.log('📁 Fichiers impactés :');
const files = [...new Set(applied.map((c) => c.file))];
files.forEach((f) => console.log(`   ${f}`));
console.log('');
