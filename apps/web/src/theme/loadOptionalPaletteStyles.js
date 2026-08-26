const loadedPaletteStyleChunks = new Set();
const loadedDensityStyleChunks = new Set();

function getChunkKeyForPalette(palette) {
  if (!palette) return null;

  if (palette.startsWith('flat-')) return 'flat';
  if (palette.startsWith('vscode-')) return 'vscode';
  if (palette === 'tv-display') return 'tv';

  return null;
}

async function importChunkByKey(chunkKey) {
  if (!chunkKey || loadedPaletteStyleChunks.has(chunkKey)) return;

  if (chunkKey === 'flat') {
    await import('../theme-palettes.css');
  } else if (chunkKey === 'vscode') {
    await import('../theme-vscode.css');
  } else if (chunkKey === 'tv') {
    await import('../theme-tv.css');
  } else {
    return;
  }

  loadedPaletteStyleChunks.add(chunkKey);
}

export async function ensureOptionalPaletteStylesLoaded(palette) {
  const chunkKey = getChunkKeyForPalette(palette);
  await importChunkByKey(chunkKey);
}

async function importDensityChunkByValue(density) {
  if (density !== 'compact' || loadedDensityStyleChunks.has('compact')) return;

  await import('../theme-density.css');
  loadedDensityStyleChunks.add('compact');
}

export async function ensureOptionalDensityStylesLoaded(density) {
  await importDensityChunkByValue(density);
}

export function setupOptionalPaletteStyleLoader() {
  const root = document.documentElement;

  // Load once for initial SSR/rehydrated attribute state.
  void ensureOptionalPaletteStylesLoaded(root.getAttribute('data-palette'));
  void ensureOptionalDensityStylesLoaded(root.getAttribute('data-density'));

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'attributes') continue;

      if (mutation.attributeName === 'data-palette') {
        void ensureOptionalPaletteStylesLoaded(root.getAttribute('data-palette'));
      }

      if (mutation.attributeName === 'data-density') {
        void ensureOptionalDensityStylesLoaded(root.getAttribute('data-density'));
      }
    }
  });

  observer.observe(root, { attributes: true, attributeFilter: ['data-palette', 'data-density'] });
}
