/**
 * Favicon dynamique avec badge numérique.
 *
 * Dessine sur un <canvas> le favicon de base + une pastille rouge en haut
 * à droite avec le compteur (1..99+). Remplace le <link rel="icon"> par
 * un dataURL régénéré à chaque appel.
 *
 * Usage :
 *   setFaviconBadge(3);  // affiche "3" sur le favicon
 *   setFaviconBadge(0);  // restaure le favicon d'origine
 */

const ORIGINAL_HREF = '/Logos/logo-emag-192.png';
const SIZE = 64;

let cachedBaseImage = null;
let originalLink = null;

const ensureLink = () => {
  if (originalLink) return originalLink;
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  originalLink = link;
  return link;
};

const loadBase = () =>
  new Promise((resolve) => {
    if (cachedBaseImage) {
      resolve(cachedBaseImage);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedBaseImage = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = ORIGINAL_HREF;
  });

let pendingCount = -1;
let drawing = false;

const draw = async (count) => {
  if (drawing) {
    pendingCount = count;
    return;
  }
  drawing = true;
  try {
    const link = ensureLink();
    if (count <= 0) {
      link.href = ORIGINAL_HREF;
      return;
    }
    const base = await loadBase();
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (base) ctx.drawImage(base, 0, 0, SIZE, SIZE);

    // Pastille rouge
    const r = SIZE * 0.32;
    const cx = SIZE - r - 2;
    const cy = r + 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Texte
    const label = count > 99 ? '99+' : String(count);
    const fontSize = label.length >= 3 ? r * 0.85 : label.length === 2 ? r * 1.05 : r * 1.25;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);

    link.href = canvas.toDataURL('image/png');
  } catch {
    /* silencieux */
  } finally {
    drawing = false;
    if (pendingCount !== -1 && pendingCount !== count) {
      const next = pendingCount;
      pendingCount = -1;
      draw(next);
    }
  }
};

/**
 * Affiche un badge numérique sur le favicon. count <= 0 restaure l'icône.
 * @param {number} count
 */
export const setFaviconBadge = (count) => {
  draw(Math.max(0, Math.floor(count || 0)));
};
