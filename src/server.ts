import "dotenv/config";
import { buildApp } from "./app.js";
import { InMemoryRepository } from "./in-memory-repository.js";
import { PrismaRepository } from "./prisma-repository.js";

const app = await buildApp({
  repository: process.env.DATABASE_URL ? new PrismaRepository() : new InMemoryRepository(),
});

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
