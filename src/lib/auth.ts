import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { createSession, type SessionUser } from "./session";

export async function login(
  email: string,
  password: string,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return { ok: false, error: "Неверный email или пароль" };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { ok: false, error: "Неверный email или пароль" };

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  await createSession(sessionUser);
  return { ok: true, user: sessionUser };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
