import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app.js";
import { InMemoryRepository } from "../src/in-memory-repository.js";
import { PrismaRepository } from "../src/prisma-repository.js";

let appReady: ReturnType<typeof buildApp> | null = null;

function getApp() {
  if (!appReady) {
    appReady = buildApp({
      repository: process.env.DATABASE_URL ? new PrismaRepository() : new InMemoryRepository(),
    }).then(async (app) => {
      await app.ready();
      return app;
    });
  }
  return appReady;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit("request", req, res);
}
