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
  check(/^[a-f0-9]{64}$/iu.test(process.env.DATA_ENCRYPTION_KEY ?? ""), "Clave de cifrado de datos configurada.");
  check(Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY), "Protección contra bots configurada.");
  check((process.env.CRON_SECRET?.length ?? 0) >= 32, "Tareas automáticas protegidas por un secreto fuerte.");
  const [privileges] = await prisma.$queryRaw<Array<{ superuser: boolean; bypass: boolean; owns_tables: boolean; backend: boolean }>>`
    SELECT r.rolsuper AS superuser, r.rolbypassrls AS bypass,
      EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND pg_has_role(current_user, c.relowner, 'USAGE')) AS owns_tables,
      EXISTS (SELECT 1 FROM pg_roles b WHERE b.rolname = 'fosa_backend' AND pg_has_role(current_user, b.oid, 'USAGE')) AS backend
    FROM pg_roles r WHERE r.rolname = current_user`;
  check(Boolean(privileges && !privileges.superuser && !privileges.bypass && !privileges.owns_tables && privileges.backend), "Conexión de aplicación sin privilegios de propietario ni bypass de RLS.");
  const [{ unprotected }] = await prisma.$queryRaw<Array<{ unprotected: bigint }>>`
    SELECT count(*) AS unprotected FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations' AND NOT c.relrowsecurity`;
  check(unprotected === BigInt(0), "RLS habilitado en todas las tablas de aplicación.");
  const [{ plaintextEmails }] = await prisma.$queryRaw<Array<{ plaintextEmails: bigint }>>`
    SELECT count(*) AS "plaintextEmails" FROM "EmailLog" WHERE recipient NOT LIKE 'enc:v1:%'
      OR (subject IS NOT NULL AND subject NOT LIKE 'enc:v1:%') OR (body IS NOT NULL AND body NOT LIKE 'enc:v1:%')
      OR ("errorMessage" IS NOT NULL AND "errorMessage" NOT LIKE 'enc:v1:%')`;
  check(plaintextEmails === BigInt(0), "Correos históricos convertidos al almacenamiento cifrado.");
  const [{ plaintextOrders }] = await prisma.$queryRaw<Array<{ plaintextOrders: bigint }>>`
    SELECT count(*) AS "plaintextOrders" FROM "ShopOrder" WHERE "fullName" NOT LIKE 'enc:v1:%'
      OR email NOT LIKE 'enc:v1:%' OR phone NOT LIKE 'enc:v1:%'
      OR ("workshopName" IS NOT NULL AND "workshopName" NOT LIKE 'enc:v1:%')
      OR (address IS NOT NULL AND address NOT LIKE 'enc:v1:%') OR (city IS NOT NULL AND city NOT LIKE 'enc:v1:%')
      OR (province IS NOT NULL AND province NOT LIKE 'enc:v1:%') OR ("postalCode" IS NOT NULL AND "postalCode" NOT LIKE 'enc:v1:%')`;
  check(plaintextOrders === BigInt(0), "Contactos de pedidos históricos convertidos al almacenamiento cifrado.");
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
