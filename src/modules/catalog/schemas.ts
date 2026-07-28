import { z } from "zod";

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required."),
  description: z.string().trim().optional(),
  durationMinutes: z.number().int().positive("Service duration must be positive."),
  isActive: z.boolean(),
  displayOrder: z.number().int().nonnegative(),
});

export type ServiceInput = z.infer<typeof serviceSchema>;
