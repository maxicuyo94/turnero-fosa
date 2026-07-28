import type { ServiceInput } from "@/src/modules/catalog/schemas";
import type { ScheduleBreak, WeeklySchedule, WorkshopSettings } from "@/src/modules/settings/schemas";

export const workshopSeedConfig: {
  settings: WorkshopSettings;
  schedules: WeeklySchedule[];
  breaks: ScheduleBreak[];
  services: ServiceInput[];
} = {
  settings: {
    workshopName: "Taller de motos Express",
    capacity: 2,
    slotStepMinutes: 30,
    minimumNoticeMinutes: 120,
    maximumBookingWindowDays: 30,
    confirmationMode: "AUTOMATIC",
    cancellationEnabled: false,
    reschedulingEnabled: false,
  },
  schedules: [
    { dayOfWeek: "MONDAY", opensAt: "09:00", closesAt: "19:00", isOpen: true },
    { dayOfWeek: "TUESDAY", opensAt: "09:00", closesAt: "19:00", isOpen: true },
    { dayOfWeek: "WEDNESDAY", opensAt: "09:00", closesAt: "19:00", isOpen: true },
    { dayOfWeek: "THURSDAY", opensAt: "09:00", closesAt: "19:00", isOpen: true },
    { dayOfWeek: "FRIDAY", opensAt: "09:00", closesAt: "19:00", isOpen: true },
    { dayOfWeek: "SATURDAY", opensAt: "09:00", closesAt: "13:00", isOpen: true },
    { dayOfWeek: "SUNDAY", opensAt: "09:00", closesAt: "13:00", isOpen: false },
  ],
  breaks: [
    { dayOfWeek: "MONDAY", startsAt: "13:00", endsAt: "15:00" },
    { dayOfWeek: "TUESDAY", startsAt: "13:00", endsAt: "15:00" },
    { dayOfWeek: "WEDNESDAY", startsAt: "13:00", endsAt: "15:00" },
    { dayOfWeek: "THURSDAY", startsAt: "13:00", endsAt: "15:00" },
    { dayOfWeek: "FRIDAY", startsAt: "13:00", endsAt: "15:00" },
  ],
  services: [
    { name: "Service Esencial", durationMinutes: 60, isActive: true, displayOrder: 1 },
    { name: "Service Deluxe", durationMinutes: 240, isActive: true, displayOrder: 2 },
    { name: "Reparaciones generales", durationMinutes: 120, isActive: true, displayOrder: 3 },
    { name: "Reparacion de motor", durationMinutes: 240, isActive: true, displayOrder: 4 },
    { name: "Enderezado de chasis", durationMinutes: 120, isActive: true, displayOrder: 5 },
    { name: "Enderezado de barrales", durationMinutes: 120, isActive: true, displayOrder: 6 },
  ],
};
