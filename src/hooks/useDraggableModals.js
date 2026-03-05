/**
 * useDraggableModals — Hook global pour rendre TOUS les modals/dialogs
 * de l'application déplaçables (drag via header) et redimensionnables.
 *
 * Fonctionne par détection automatique via MutationObserver + event delegation.
 * Aucune modification des composants individuels n'est nécessaire.
 */
import { useEffect } from 'react';

/* ------------------------------------------------------------------ */
/*  Sélecteurs CSS pour détecter overlay / container / header          */
/* ------------------------------------------------------------------ */

// Tous les sélecteurs d'overlay connus (issus de l'inventaire 75 modals)
const OVERLAY_SELECTORS = [
  '[class*="-overlay"]',
  '[class*="dialog-overlay"]',
  '.modal-overlay',
  '.login-overlay',
  '.orders-overlay',
].join(',');

// Sélecteurs pour le container modal (enfant direct de l'overlay)
const MODAL_SELECTORS = [
  '[class*="-modal"]',
  '[class*="-dialog"]',
  '.modal-content',
  '.modal-container',
  '.confirm-dialog',
  '.access-request-modal',
].join(',');

// Sélecteurs pour le header (drag handle)
const HEADER_SELECTORS = [
  '[class*="-header"]',
  '.modal-header',
  '.dialog-header',
].join(',');

// Classes à NE PAS traiter (ex: notification toasts, tooltips, etc.)
const IGNORE_CLASSES = ['toast', 'tooltip', 'popover', 'dropdown', 'snackbar'];

/* ------------------------------------------------------------------ */
/*  Logique de drag                                                    */
/* ------------------------------------------------------------------ */

/** State partagé pour le drag en cours */
const dragState = {
  active: false,
  modal: null,
  startX: 0,
  startY: 0,
  origLeft: 0,
  origTop: 0,
};

function onDragStart(e) {
  // Ignorer si on clique sur un bouton, input, select, textarea, svg, a
  const tag = e.target.tagName.toLowerCase();
  if (['button', 'input', 'select', 'textarea', 'a', 'svg', 'path', 'label'].includes(tag)) return;
  if (e.target.closest('button, input, select, textarea, a, svg, .no-drag')) return;

  // Ignorer les resize handles
  if (e.target.closest('.modal-resize-handle')) return;

  let modal = null;

  // 1) Chercher un header (drag handle préféré)
  const header = e.target.closest(HEADER_SELECTORS);
  if (header) {
    // Le header doit être dans un vrai modal (enhanced ou matchant MODAL_SELECTORS)
    const parentModal = header.closest(MODAL_SELECTORS);
    if (parentModal) {
      modal = parentModal;
    }
    // Fallback : header.parentElement uniquement s'il a été enhanced
    if (!modal && header.parentElement && header.parentElement.dataset.draggableEnhanced) {
      modal = header.parentElement;
    }
  }

  // 2) Fallback : si pas de header, permettre le drag depuis le container modal
  //    mais seulement si le click est directement sur le modal ou un wrapper haut-niveau
  if (!modal) {
    const directModal = e.target.closest(MODAL_SELECTORS);
    if (directModal && directModal.dataset.draggableEnhanced) {
      // Seulement si le click n'est pas dans le body/content du modal
      const body = directModal.querySelector('[class*="body"], [class*="content"], [class*="actions"], [class*="footer"], form, table, ul, ol');
      if (body && body.contains(e.target)) return;
      modal = directModal;
    }
  }

  if (!modal) return;

  // Vérifier que ce modal est bien dans un overlay (ou est positionné fixed/absolute)
  const overlay = modal.closest(OVERLAY_SELECTORS) || modal.parentElement;
  if (!overlay) return;

  // Ignorer les éléments à ne pas traiter
  const classes = modal.className.toLowerCase();
  if (IGNORE_CLASSES.some(c => classes.includes(c))) return;

  e.preventDefault();

  // Initialiser le positionnement si pas encore fait
  const rect = modal.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(modal);

  if (!modal.dataset.dragInitialized) {
    // Première fois : fixer la position pour permettre le déplacement
    // Sauvegarder les dimensions originales
    modal.dataset.dragOrigWidth = rect.width + 'px';
    modal.dataset.dragOrigHeight = rect.height + 'px';
    modal.dataset.dragInitialized = '1';
  }

  // Calculer la position actuelle effective
  let currentLeft, currentTop;
  if (computedStyle.position === 'fixed' || computedStyle.position === 'absolute') {
    currentLeft = rect.left;
    currentTop = rect.top;
  } else {
    currentLeft = rect.left;
    currentTop = rect.top;
  }

  // Appliquer position fixed pour le drag
  if (computedStyle.position !== 'fixed' && computedStyle.position !== 'absolute') {
    modal.style.position = 'fixed';
  }
  // Forcer position fixe
  modal.style.position = 'fixed';
  modal.style.left = currentLeft + 'px';
  modal.style.top = currentTop + 'px';
  modal.style.margin = '0';
  modal.style.transform = 'none';
  // Conserver les dimensions si le modal utilisait des largeurs relatives
  if (!modal.style.width || modal.style.width === 'auto') {
    modal.style.width = rect.width + 'px';
  }
  if (!modal.style.height || modal.style.height === 'auto') {
    modal.style.height = rect.height + 'px';
  }

  dragState.active = true;
  dragState.modal = modal;
  dragState.startX = e.clientX;
  dragState.startY = e.clientY;
  dragState.origLeft = currentLeft;
  dragState.origTop = currentTop;

  modal.classList.add('modal-dragging');
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'grabbing';
}

function onDragMove(e) {
  if (!dragState.active || !dragState.modal) return;

  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;

  let newLeft = dragState.origLeft + dx;
  let newTop = dragState.origTop + dy;

  // Garder dans les limites du viewport (au moins 40px visible)
  const modal = dragState.modal;
  const rect = modal.getBoundingClientRect();
  const minVisible = 40;

  newLeft = Math.max(-rect.width + minVisible, Math.min(window.innerWidth - minVisible, newLeft));
  newTop = Math.max(0, Math.min(window.innerHeight - minVisible, newTop));

  modal.style.left = newLeft + 'px';
  modal.style.top = newTop + 'px';
}

function onDragEnd() {
  if (!dragState.active) return;

  if (dragState.modal) {
    dragState.modal.classList.remove('modal-dragging');
  }

  dragState.active = false;
  dragState.modal = null;
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
}

/* ------------------------------------------------------------------ */
/*  Logique de resize                                                  */
/* ------------------------------------------------------------------ */

const resizeState = {
  active: false,
  modal: null,
  handle: '',
  startX: 0,
  startY: 0,
  origW: 0,
  origH: 0,
  origLeft: 0,
  origTop: 0,
};

function createResizeHandles(modal) {
  if (modal.querySelector('.modal-resize-handle')) return; // Déjà ajouté

  const handles = ['se', 'sw', 'ne', 'nw', 'n', 's', 'e', 'w'];
  handles.forEach(dir => {
    const handle = document.createElement('div');
    handle.className = `modal-resize-handle modal-resize-${dir}`;
    handle.dataset.resizeDir = dir;
    modal.appendChild(handle);
  });
}

function onResizeStart(e) {
  const handle = e.target.closest('.modal-resize-handle');
  if (!handle) return;

  const modal = handle.parentElement;
  if (!modal) return;

  e.preventDefault();
  e.stopPropagation();

  const rect = modal.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(modal);

  // Assurer position fixed
  if (computedStyle.position !== 'fixed' && computedStyle.position !== 'absolute') {
    modal.style.position = 'fixed';
    modal.style.left = rect.left + 'px';
    modal.style.top = rect.top + 'px';
    modal.style.margin = '0';
    modal.style.transform = 'none';
  }
  if (modal.style.position !== 'fixed') {
    modal.style.position = 'fixed';
    modal.style.left = rect.left + 'px';
    modal.style.top = rect.top + 'px';
    modal.style.margin = '0';
    modal.style.transform = 'none';
  }

  resizeState.active = true;
  resizeState.modal = modal;
  resizeState.handle = handle.dataset.resizeDir;
  resizeState.startX = e.clientX;
  resizeState.startY = e.clientY;
  resizeState.origW = rect.width;
  resizeState.origH = rect.height;
  resizeState.origLeft = rect.left;
  resizeState.origTop = rect.top;

  modal.classList.add('modal-resizing');
  document.body.style.userSelect = 'none';
}

function onResizeMove(e) {
  if (!resizeState.active || !resizeState.modal) return;

  const dx = e.clientX - resizeState.startX;
  const dy = e.clientY - resizeState.startY;
  const modal = resizeState.modal;
  const dir = resizeState.handle;
  const minW = 200;
  const minH = 120;

  let newW = resizeState.origW;
  let newH = resizeState.origH;
  let newLeft = resizeState.origLeft;
  let newTop = resizeState.origTop;

  if (dir.includes('e')) newW = Math.max(minW, resizeState.origW + dx);
  if (dir.includes('w')) {
    newW = Math.max(minW, resizeState.origW - dx);
    newLeft = resizeState.origLeft + (resizeState.origW - newW);
  }
  if (dir.includes('s')) newH = Math.max(minH, resizeState.origH + dy);
  if (dir.includes('n')) {
    newH = Math.max(minH, resizeState.origH - dy);
    newTop = resizeState.origTop + (resizeState.origH - newH);
  }

  modal.style.width = newW + 'px';
  modal.style.height = newH + 'px';
  modal.style.left = newLeft + 'px';
  modal.style.top = newTop + 'px';
  modal.style.maxWidth = 'none';
  modal.style.maxHeight = 'none';
}

function onResizeEnd() {
  if (!resizeState.active) return;

  if (resizeState.modal) {
    resizeState.modal.classList.remove('modal-resizing');
  }

  resizeState.active = false;
  resizeState.modal = null;
  document.body.style.userSelect = '';
}

/* ------------------------------------------------------------------ */
/*  Mouse move / up combiné                                            */
/* ------------------------------------------------------------------ */

function onMouseMove(e) {
  if (dragState.active) onDragMove(e);
  if (resizeState.active) onResizeMove(e);
}

function onMouseUp(e) {
  if (dragState.active) onDragEnd(e);
  if (resizeState.active) onResizeEnd(e);
}

/* ------------------------------------------------------------------ */
/*  Enhancer : ajoute les handles de resize à un modal détecté         */
/* ------------------------------------------------------------------ */

function enhanceModal(modal) {
  if (modal.dataset.draggableEnhanced) return;

  // Vérifier qu'il ne faut pas ignorer
  const classes = modal.className ? modal.className.toLowerCase() : '';
  if (IGNORE_CLASSES.some(c => classes.includes(c))) return;

  // Ne pas traiter les éléments trop petits (menus, tooltips)
  // On laisse le check se faire plus tard quand l'élément a ses dimensions
  modal.dataset.draggableEnhanced = '1';

  // Ajouter handles de resize
  createResizeHandles(modal);

  // Ajouter la classe pour le style de base
  modal.classList.add('modal-draggable-enhanced');

  // Ajouter cursor grab sur le header si présent
  const header = modal.querySelector(HEADER_SELECTORS);
  if (header) {
    header.classList.add('modal-drag-handle');
  } else {
    // Pas de header → ajouter une mini grip bar en haut du modal
    const gripBar = document.createElement('div');
    gripBar.className = 'modal-drag-handle modal-grip-bar';
    gripBar.title = 'Glisser pour déplacer';
    // Insérer au tout début du modal
    modal.insertBefore(gripBar, modal.firstChild);
  }
}

/* ------------------------------------------------------------------ */
/*  Observer : détecte l'apparition des modals dans le DOM             */
/* ------------------------------------------------------------------ */

function scanAndEnhance(root = document.body) {
  // Scanner les overlays et chercher les containers modals
  const overlays = root.querySelectorAll(OVERLAY_SELECTORS);
  overlays.forEach(overlay => {
    const modals = overlay.querySelectorAll(MODAL_SELECTORS);
    modals.forEach(modal => enhanceModal(modal));
    // Si l'overlay a un enfant direct qui n'est pas un modal connu mais est le container
    if (modals.length === 0) {
      const firstChild = overlay.firstElementChild;
      if (firstChild && firstChild !== overlay) {
        enhanceModal(firstChild);
      }
    }
  });

  // Scanner aussi les portals (modals hors overlay)
  const directModals = root.querySelectorAll(MODAL_SELECTORS);
  directModals.forEach(modal => {
    // Vérifier que le parent est bien un overlay ou un portal root
    const parent = modal.parentElement;
    if (parent && (
      parent.matches(OVERLAY_SELECTORS) ||
      parent === document.body ||
      parent.id === 'portal-root' ||
      parent.id === 'modal-root'
    )) {
      enhanceModal(modal);
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Double-click header → reset position                               */
/* ------------------------------------------------------------------ */

function onDblClick(e) {
  const header = e.target.closest(HEADER_SELECTORS);
  if (!header) return;

  const modal = header.closest(MODAL_SELECTORS) || header.parentElement;
  if (!modal || !modal.dataset.dragInitialized) return;

  // Reset position et taille
  modal.style.position = '';
  modal.style.left = '';
  modal.style.top = '';
  modal.style.margin = '';
  modal.style.transform = '';
  modal.style.width = '';
  modal.style.height = '';
  modal.style.maxWidth = '';
  modal.style.maxHeight = '';
  delete modal.dataset.dragInitialized;
}

/* ------------------------------------------------------------------ */
/*  Hook React                                                         */
/* ------------------------------------------------------------------ */

export function useDraggableModals() {
  useEffect(() => {
    // Event listeners globaux
    document.addEventListener('mousedown', onDragStart, true);
    document.addEventListener('mousedown', onResizeStart, true);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('dblclick', onDblClick, true);

    // Scan initial
    scanAndEnhance();

    // MutationObserver pour détecter les nouveaux modals
    const observer = new MutationObserver((mutations) => {
      let needsScan = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check si le node ajouté est un overlay ou contient des modals
              if (node.matches?.(OVERLAY_SELECTORS) || node.matches?.(MODAL_SELECTORS) ||
                  node.querySelector?.(OVERLAY_SELECTORS) || node.querySelector?.(MODAL_SELECTORS)) {
                needsScan = true;
                break;
              }
            }
          }
        }
        if (needsScan) break;
      }
      if (needsScan) {
        // Petit délai pour laisser React finir le rendu
        requestAnimationFrame(() => scanAndEnhance());
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('mousedown', onDragStart, true);
      document.removeEventListener('mousedown', onResizeStart, true);
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('mouseup', onMouseUp, true);
      document.removeEventListener('dblclick', onDblClick, true);
      observer.disconnect();
    };
  }, []);
}
