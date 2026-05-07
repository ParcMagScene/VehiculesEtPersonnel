/**
 * Debug snippet — coller dans la console du navigateur pendant qu'un modal "cassé" est visible.
 * Affiche dimensions et styles calculés des modaux + leurs body/footer.
 */
(() => {
  const overlays = document.querySelectorAll('.ui-modal-overlay');
  console.log(`[modal-debug] ${overlays.length} overlay(s) trouvé(s)`);
  overlays.forEach((ov, i) => {
    const rect = ov.getBoundingClientRect();
    const cs = getComputedStyle(ov);
    console.log(
      `\n=== OVERLAY #${i} ===`,
      { class: ov.className, width: rect.width, height: rect.height, left: rect.left, top: rect.top, position: cs.position, display: cs.display, zIndex: cs.zIndex, alignItems: cs.alignItems },
    );
    const modal = ov.querySelector('[role="dialog"]') || ov.firstElementChild;
    if (!modal) return;
    const mr = modal.getBoundingClientRect();
    const ms = getComputedStyle(modal);
    console.log('  MODAL', {
      class: modal.className,
      enhanced: modal.dataset.draggableEnhanced || null,
      width: mr.width, height: mr.height, left: mr.left, top: mr.top,
      display: ms.display, flexDirection: ms.flexDirection, alignItems: ms.alignItems,
      width_css: ms.width, maxWidth: ms.maxWidth, maxHeight: ms.maxHeight,
      overflow: ms.overflow, position: ms.position,
    });
    [...modal.children].forEach((c, j) => {
      const cr = c.getBoundingClientRect();
      const ccs = getComputedStyle(c);
      console.log(`    child[${j}]`, {
        class: c.className,
        width: cr.width, height: cr.height,
        offsetLeft: cr.left - mr.left, offsetTop: cr.top - mr.top,
        display: ccs.display, flex: ccs.flex, position: ccs.position,
        overflow: ccs.overflow,
      });
    });
  });
})();
