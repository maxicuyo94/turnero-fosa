import type { PrismaClient } from "@prisma/client";
import { loadDevelopmentTestData, type TestDataSummary } from "@/src/modules/testing/development-profile";
import { resolveTestDataTarget, type TestDataTargetRejectionReason } from "@/src/modules/testing/test-data-guard";

export type LoadTestDataResult =
  | { accepted: true; host: string; database: string; summary: TestDataSummary }
  | { accepted: false; reason: TestDataTargetRejectionReason; message: string };

/**
 * Single entry point for every test-data profile: the target is resolved first, so a forbidden
 * database is reported before Prisma writes anything.
 */
export async function loadTestDataProfile(input: {
  prisma: PrismaClient;
  profile?: string;
  env?: Record<string, string | undefined>;
  now?: Date;
}): Promise<LoadTestDataResult> {
  const target = resolveTestDataTarget({ profile: input.profile, env: input.env });
  if (!target.allowed) {
    return { accepted: false, reason: target.reason, message: target.message };
  }

  return {
    accepted: true,
    host: target.host,
    database: target.database,
    summary: await loadDevelopmentTestData(input.prisma, { now: input.now, env: input.env }),
  };
}
