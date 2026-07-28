import { z } from "zod";

export const customerSchema = z.object({
  fullName: z.string().trim().min(1, "Customer name is required."),
  phone: z.string().trim().min(6, "Customer phone is required."),
  email: z.string().trim().email().optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const motorcycleSchema = z.object({
  brand: z.string().trim().min(1, "Motorcycle brand is required."),
  model: z.string().trim().min(1, "Motorcycle model is required."),
  licensePlate: z.string().trim().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
});

export type MotorcycleInput = z.infer<typeof motorcycleSchema>;
