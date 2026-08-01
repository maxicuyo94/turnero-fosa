export const testDataProfiles = ["development"] as const;

export type TestDataProfile = (typeof testDataProfiles)[number];

export type TestDataTargetRejectionReason =
  | "UNKNOWN_PROFILE"
  | "PRODUCTION_ENVIRONMENT"
  | "PRODUCTION_TARGET"
  | "TARGET_NOT_ALLOWED"
  | "INVALID_DATABASE_URL";

export type TestDataTarget =
  | { allowed: true; profile: TestDataProfile; host: string; database: string }
  | { allowed: false; reason: TestDataTargetRejectionReason; message: string };

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);
const productionMarker = /prod/iu;

/**
 * Test data is only ever loaded when two independent markers agree: the process is not running in a
 * production environment, and the database host is either local or explicitly allowlisted by the
 * operator. Reports carry the host and database name only, never the connection string.
 */
export function resolveTestDataTarget(input: {
  profile?: string;
  env?: Record<string, string | undefined>;
}): TestDataTarget {
  const env = input.env ?? process.env;

  if (!isKnownProfile(input.profile)) {
    return rejection(
      "UNKNOWN_PROFILE",
      `Elegi un perfil valido de datos de prueba: ${testDataProfiles.join(", ")}.`,
    );
  }

  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    return rejection("PRODUCTION_ENVIRONMENT", "Los datos de prueba estan prohibidos en produccion.");
  }

  const target = parseDatabaseUrl(env.DATABASE_URL);
  if (!target) {
    return rejection("INVALID_DATABASE_URL", "DATABASE_URL no es una cadena de conexion PostgreSQL valida.");
  }

  if (productionMarker.test(target.host) || productionMarker.test(target.database)) {
    return rejection(
      "PRODUCTION_TARGET",
      `El destino ${target.host}/${target.database} parece productivo. Los datos de prueba estan prohibidos en produccion.`,
    );
  }

  if (!localHosts.has(target.host) && !allowedHosts(env.TEST_DATA_ALLOWED_HOSTS).includes(target.host)) {
    return rejection(
      "TARGET_NOT_ALLOWED",
      `El host ${target.host} no esta habilitado. Agregalo a TEST_DATA_ALLOWED_HOSTS solo si es una base no productiva.`,
    );
  }

  return { allowed: true, profile: input.profile, host: target.host, database: target.database };
}

function isKnownProfile(profile: string | undefined): profile is TestDataProfile {
  return testDataProfiles.some((known) => known === profile);
}

function parseDatabaseUrl(databaseUrl: string | undefined): { host: string; database: string } | null {
  if (!databaseUrl) return null;

  try {
    const url = new URL(databaseUrl);
    if (!url.protocol.startsWith("postgres") || !url.hostname) return null;
    return { host: decodeURIComponent(url.hostname), database: decodeURIComponent(url.pathname.replace(/^\//u, "")) };
  } catch {
    return null;
  }
}

function allowedHosts(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

function rejection(reason: TestDataTargetRejectionReason, message: string): TestDataTarget {
  return { allowed: false, reason, message };
}
