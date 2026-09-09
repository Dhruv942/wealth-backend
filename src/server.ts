import { buildApp } from "./app";
import { InMemoryRepository } from "./in-memory-repository";
import { PrismaRepository } from "./prisma-repository";

const app = await buildApp({
  repository: process.env.DATABASE_URL ? new PrismaRepository() : new InMemoryRepository(),
});

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
