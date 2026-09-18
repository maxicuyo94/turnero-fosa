// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createPasswordHash, verifyPassword } from "@/src/lib/password";
import { changeInternalPassword } from "@/src/modules/internal/account-service";

type StoredUser = { id: string; passwordHash: string | null };

function fakeUsers(users: StoredUser[]) {
  return {
    users,
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users.find((user) => user.id === where.id) ?? null,
      updateMany: async ({ where, data }: { where: { id: string; passwordHash: string }; data: { passwordHash: string } }) => {
        const user = users.find((candidate) => candidate.id === where.id && candidate.passwordHash === where.passwordHash);
        if (user) user.passwordHash = data.passwordHash;
        return { count: user ? 1 : 0 };
      },
    },
  };
}

let prisma: ReturnType<typeof fakeUsers>;

beforeEach(async () => {
  prisma = fakeUsers([{ id: "admin", passwordHash: await createPasswordHash("actual-1234") }]);
});

const change = (input: Record<string, string>) =>
  changeInternalPassword(prisma as never, "admin", { currentPassword: "actual-1234", newPassword: "nueva-5678", confirmPassword: "nueva-5678", ...input });

describe("changeInternalPassword", () => {
  it("guarda la nueva contraseña y deja de aceptar la anterior", async () => {
    await change({});

    const stored = prisma.users[0].passwordHash!;
    expect(await verifyPassword("nueva-5678", stored)).toBe(true);
    expect(await verifyPassword("actual-1234", stored)).toBe(false);
  });

  it("rechaza una contraseña actual incorrecta sin cambiar nada", async () => {
    const before = prisma.users[0].passwordHash;

    await expect(change({ currentPassword: "otra-cosa" })).rejects.toMatchObject({ message: "La contraseña actual no es correcta.", field: "currentPassword" });
    expect(prisma.users[0].passwordHash).toBe(before);
  });

  it("valida largo, confirmación y que la nueva sea distinta", async () => {
    await expect(change({ newPassword: "corta", confirmPassword: "corta" })).rejects.toMatchObject({ field: "newPassword" });
    await expect(change({ confirmPassword: "nueva-9999" })).rejects.toMatchObject({ field: "confirmPassword" });
    await expect(change({ newPassword: "actual-1234", confirmPassword: "actual-1234" })).rejects.toMatchObject({ field: "newPassword" });
    await expect(change({ currentPassword: "" })).rejects.toMatchObject({ field: "currentPassword" });
  });

  it("no pisa un cambio hecho desde otra sesión en el medio", async () => {
    const original = prisma.users[0].passwordHash;
    const findUnique = prisma.user.findUnique;
    prisma.user.findUnique = async (args) => {
      const snapshot = { ...(await findUnique(args))! };
      prisma.users[0].passwordHash = await createPasswordHash("otra-sesion-000");
      return snapshot;
    };

    await expect(change({})).rejects.toThrow("se cambió desde otra sesión");
    expect(prisma.users[0].passwordHash).not.toBe(original);
    expect(await verifyPassword("otra-sesion-000", prisma.users[0].passwordHash!)).toBe(true);
  });

  it("rechaza usuarios sin contraseña cargada", async () => {
    prisma.users[0].passwordHash = null;

    await expect(change({})).rejects.toThrow("La contraseña actual no es correcta.");
  });
});
