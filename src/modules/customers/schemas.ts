import { z } from "zod";

/**
 * Public input, so every field is bounded. The limits match what staff can type when correcting the
 * same record, and the phone must carry the digits its identity key is built from.
 */
export const customerSchema = z.object({
  fullName: z.string().trim().min(1, "Customer name is required.").max(120),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((phone) => {
      const digits = phone.replace(/\D/gu, "").length;
      return digits >= 6 && digits <= 20;
    }, "Customer phone needs between 6 and 20 digits."),
  email: z.string().trim().max(254).email().optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

/**
 * What public booking captures about a unit. Chassis number, engine number, colour and notes are
 * deliberately absent: they are internal data, filled from the vehicle record by staff who have the
 * unit in front of them, not by whoever is booking.
 *
 * `vehicleTypeId` is optional so a submission that predates the selector still books; the repository
 * falls back to the first active type of the catalog.
 */
export const vehicleSchema = z.object({
  vehicleTypeId: z.string().trim().min(1).max(128).optional(),
  brand: z.string().trim().min(1, "Vehicle brand is required.").max(60),
  model: z.string().trim().min(1, "Vehicle model is required.").max(60),
  licensePlate: z.string().trim().max(20).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;
