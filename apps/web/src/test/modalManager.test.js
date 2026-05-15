import { afterEach, describe, expect, it } from 'vitest';

import {
  __resetForTests,
  getModalRoot,
  indexOf,
  MODAL_ROOT_ID,
  pop,
  push,
  size,
  Z_BACKDROP_BASE,
  Z_DIALOG_BASE,
  Z_STEP,
  zIndexFor,
} from '../utils/modalManager';

afterEach(() => {
  __resetForTests();
  // Nettoyage portail créé à la volée pour ne pas polluer les autres tests.
  document.getElementById(MODAL_ROOT_ID)?.remove();
  document.body.style.overflow = '';
});

describe('modalManager', () => {
  it('crée le portail #emag-modal-root à la demande', () => {
    expect(document.getElementById(MODAL_ROOT_ID)).toBeNull();
    const root = getModalRoot();
    expect(root).not.toBeNull();
    expect(root.id).toBe(MODAL_ROOT_ID);
    expect(document.getElementById(MODAL_ROOT_ID)).toBe(root);
  });

  it('réutilise le portail existant', () => {
    const a = getModalRoot();
    const b = getModalRoot();
    expect(a).toBe(b);
  });

  it('verrouille le scroll body uniquement quand la pile est non vide', () => {
    expect(document.body.style.overflow).toBe('');
    const t1 = push();
    expect(document.body.style.overflow).toBe('hidden');
    const t2 = push();
    expect(document.body.style.overflow).toBe('hidden');
    pop(t1);
    expect(document.body.style.overflow).toBe('hidden');
    pop(t2);
    expect(document.body.style.overflow).toBe('');
  });

  it('attribue les z-index 9000/10000 au premier modal et incrémente par 10', () => {
    const t1 = push();
    const t2 = push();
    const t3 = push();
    expect(zIndexFor(t1)).toEqual({
      overlay: Z_BACKDROP_BASE,
      dialog: Z_DIALOG_BASE,
    });
    expect(zIndexFor(t2)).toEqual({
      overlay: Z_BACKDROP_BASE + Z_STEP,
      dialog: Z_DIALOG_BASE + Z_STEP,
    });
    expect(zIndexFor(t3)).toEqual({
      overlay: Z_BACKDROP_BASE + 2 * Z_STEP,
      dialog: Z_DIALOG_BASE + 2 * Z_STEP,
    });
  });

  it('met à jour les index quand un modal du milieu est fermé', () => {
    const t1 = push();
    const t2 = push();
    const t3 = push();
    pop(t2);
    expect(indexOf(t1)).toBe(0);
    expect(indexOf(t3)).toBe(1);
    expect(size()).toBe(2);
  });

  it('pop est idempotent (token absent ignoré)', () => {
    const t = push();
    pop(t);
    expect(() => pop(t)).not.toThrow();
    expect(size()).toBe(0);
  });

  it('restaure la valeur originale de body.style.overflow', () => {
    document.body.style.overflow = 'auto';
    const t = push();
    expect(document.body.style.overflow).toBe('hidden');
    pop(t);
    expect(document.body.style.overflow).toBe('auto');
  });
});
