import { z } from "zod";

export const customerSchema = z.object({
  fullName: z.string().trim().min(1, "Customer name is required."),
  phone: z.string().trim().min(6, "Customer phone is required."),
  email: z.string().trim().email().optional(),
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
  vehicleTypeId: z.string().trim().min(1).optional(),
  brand: z.string().trim().min(1, "Vehicle brand is required."),
  model: z.string().trim().min(1, "Vehicle model is required."),
  licensePlate: z.string().trim().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;
