import type { TravelTimeMatrix } from '@global-travel-plans/domain';
import { z } from 'zod';

export const TravelTimeMatrixSchema = z.object({
  version: z.string().min(1),
  entries: z.array(
    z.object({
      fromPoiId: z.string().min(1),
      toPoiId: z.string().min(1),
      mode: z.enum(['walk', 'bike', 'drive', 'taxi', 'transit', 'rail', 'flight', 'ferry', 'mixed']),
      durationMinutes: z.number().nonnegative(),
      distanceMeters: z.number().nonnegative().optional(),
      method: z.enum(['matrix', 'schedule', 'estimate', 'unavailable']),
      confidence: z.enum(['high', 'medium', 'low']),
      sourceRefs: z.array(z.string().min(1)),
    }),
  ),
});

export function parseTravelTimeMatrix(input: unknown): TravelTimeMatrix {
  return TravelTimeMatrixSchema.parse(input) as TravelTimeMatrix;
}
