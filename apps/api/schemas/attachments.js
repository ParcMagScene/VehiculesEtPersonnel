import { z } from 'zod';

// ── Create Folder ──
export const createFolderSchema = z.object({
  path: z.string().min(1, 'Chemin du dossier manquant').max(500),
});
