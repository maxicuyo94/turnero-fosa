import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { SerializedPrismaPg } from "@/src/lib/prisma-adapter";
import { getDatabaseUrl } from "@/src/lib/env";
import { verifyPassword } from "@/src/lib/password";
import { getWorkshopNotificationEnv, getWorkshopPaymentEnv, getWorkshopPublicOrigin } from "@/src/modules/settings/runtime-settings";
import { isDepositActive } from "@/src/modules/settings/business-settings";

// Explicit file selection keeps production and preview checks separate. Never prints environment values.
const envFile = process.argv.find((arg) => arg.startsWith("--env="))?.slice(6) ?? ".env";
const loaded = config({ path: envFile, override: true, quiet: true });
if (loaded.error) throw new Error("No se pudo leer el archivo de configuración seleccionado.");
const local = process.argv.includes("--local");
const prisma = new PrismaClient({ adapter: new SerializedPrismaPg({ connectionString: getDatabaseUrl() }) });
let failures = 0;
function check(ok: boolean, message: string) { console.log(`${ok ? "OK" : "PENDIENTE"} · ${message}`); if (!ok) failures++; }

async function main() {
  console.log(local ? "Revisión local (no acredita producción)" : "Comprobación previa a publicación");
  check((process.env.AUTH_SECRET?.length ?? 0) >= 32, "Secreto de sesiones configurado.");
  const settings = await prisma.workshopSettings.findFirst({ orderBy: { createdAt: "asc" }, include: { weeklySchedules: true, services: true } });
  check(Boolean(settings), "Configuración del taller cargada.");
  if (!settings) return;
  check(new Set(settings.weeklySchedules.map((day) => day.dayOfWeek)).size === 7 && settings.weeklySchedules.some((day) => day.isOpen), "Semana completa y al menos un día abierto.");
  check(settings.services.some((service) => service.isActive), "Servicios disponibles para reservar.");
  check(await prisma.vehicleType.count({ where: { isActive: true } }) > 0, "Tipos de vehículo activos.");
  const origin = await getWorkshopPublicOrigin(prisma);
  const host = origin ? new URL(origin).hostname : "";
  check(Boolean(origin && (local || (new URL(origin).protocol === "https:" && !["localhost", "127.0.0.1", "[::1]", "example.com", "example.org"].includes(host) && !/\.(example|invalid|test)$/u.test(host)))), "Dominio público adecuado al entorno.");
  const notification = await getWorkshopNotificationEnv(prisma);
  check(Boolean(notification && (local || (!notification.EMAIL_FROM.includes("resend.dev") && !/example\.(com|org)|localhost/iu.test(notification.EMAIL_FROM)))), "Email configurado con remitente propio (confirmación y recuperación).");
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { passwordHash: true } });
  check(admins.some((admin) => admin.passwordHash), "Al menos un administrador con contraseña.");
  const defaultPassword = await Promise.all(admins.filter((admin) => admin.passwordHash).map((admin) => verifyPassword("admin123456", admin.passwordHash!)));
  if (local) console.log("REVISAR · La contraseña local de desarrollo debe reemplazarse en el entorno publicado.");
  else check(!defaultPassword.some(Boolean), "El acceso publicado no utiliza la contraseña de desarrollo.");
  if (isDepositActive(settings)) {
    const payment = await getWorkshopPaymentEnv(prisma);
    check(Boolean(payment && (local || payment.MERCADO_PAGO_ENVIRONMENT === "production")), "Proveedor de seña configurado para el entorno.");
    check(Boolean(settings.depositRefundPolicy?.trim()), "Política de devolución publicada.");
  }
  if (!settings.publicPhone && !settings.whatsappNumber) console.log("REVISAR · Agregar un contacto del taller para reservas sin email y consultas sobre señas.");
  console.log("REVISAR · Confirmar dominio de correo con el proveedor y entrega real a una cuenta propia antes de publicar.");
  console.log("REVISAR · Ejecutar prisma migrate status sobre el mismo entorno y programar las tareas de emails y señas.");
}

main().catch(() => { failures++; console.error("PENDIENTE · La configuración o conexión no permitió completar la revisión. No se mostraron credenciales."); })
  .finally(async () => { await prisma.$disconnect(); process.exitCode = failures ? 1 : 0; });
