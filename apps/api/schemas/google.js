import { z } from 'zod';

// ── Pull Reservations ──
export const pullReservationsSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});
