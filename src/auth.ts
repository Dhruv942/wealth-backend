import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import type { AuthUser, User } from "./domain";
import type { Repository } from "./repository";
import { publicUser } from "./authz";

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser;
  }
}

export async function loginUser(repo: Repository, email: string, password: string) {
  const user = await repo.findUserByEmail(email);
  if (!user || user.status !== "ACTIVE") return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export function buildTokenResponse(app: FastifyInstance, user: User) {
  const authUser = toAuthUser(user);
  return {
    accessToken: app.jwt.sign(authUser, { expiresIn: process.env.ACCESS_TOKEN_TTL ?? "15m" }),
    refreshToken: app.jwt.sign({ ...authUser, tokenType: "refresh" }, { expiresIn: process.env.REFRESH_TOKEN_TTL ?? "7d" }),
    user: publicUser(user),
  };
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = await request.jwtVerify<AuthUser>();
    request.authUser = decoded;
  } catch {
    return reply.code(401).send({ error: "Authentication required" });
  }
}
