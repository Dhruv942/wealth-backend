import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { z } from "zod";
import { authenticate, buildTokenResponse, loginUser } from "./auth";
import { demoCallScenarios, firmMetrics, playbookLibrary } from "./bootstrap-data";
import { InMemoryRepository } from "./in-memory-repository";
import type { Repository } from "./repository";
import {
  assignTask,
  branchSummary,
  capacityMatrix,
  confirmCrmDraft,
  createCallNote,
  createTask,
  createUser,
  dispatchCrmTasks,
  exportAuditCsv,
  getClientDossier,
  getClientPortfolio,
  getCopilotAlerts,
  getMe,
  listAuditLogs,
  listClients,
  listHouseViews,
  listTasks,
  listTeamUsers,
  reassignClient,
  syncCrmDraft,
  synthesizeCallNote,
  updateCrmDraft,
  updateTaskStatus,
  updateUserRole,
  appendAuditLog,
} from "./services";

export interface BuildAppOptions {
  repository?: Repository;
  jwtSecret?: string;
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["RM", "MANAGER", "OPS", "ADMIN"]),
  password: z.string().min(6).optional(),
});
const rolePatchSchema = z.object({ role: z.enum(["RM", "MANAGER", "OPS", "ADMIN"]) });
const taskSchema = z.object({
  clientId: z.string(),
  title: z.string().min(1),
  details: z.string().min(1),
  category: z.string().min(1),
  priority: z.enum(["Low", "Medium", "High"]),
  assignedToUserId: z.string(),
  slaDueAt: z.string().datetime(),
  source: z.string().min(1),
});
const statusSchema = z.object({ status: z.enum(["pending_rm", "in_progress", "pending_ops", "completed", "blocked"]) });
const assignSchema = z.object({ assignedToUserId: z.string() });
const callNoteSchema = z.object({ clientId: z.string(), rawText: z.string().min(1), source: z.string().optional() });
const crmDraftPatchSchema = z.object({
  summary: z.string().optional(),
  sentiment: z.string().optional(),
  suitabilityGuardrail: z.string().optional(),
  crmStageUpdate: z.string().optional(),
});
const crmSyncSchema = z.object({ crmProvider: z.string().min(1) });
const dispatchSchema = z.object({ idempotencyKey: z.string().min(1) });

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: true });
  const repo = options.repository ?? new InMemoryRepository();

  await app.register(cors, { origin: true });
  await app.register(sensible);
  await app.register(jwt, { secret: options.jwtSecret ?? process.env.JWT_SECRET ?? "dev-secret-change-me" });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  app.setErrorHandler((error: unknown, _request, reply) => {
    const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500;
    reply.code(statusCode).send({
      error: statusCode === 500 ? "Internal server error" : (error as Error).message,
    });
  });

  app.get("/health", async () => ({ status: "ok", service: "k2-wealthdesk-backend" }));

  app.post("/api/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await loginUser(repo, input.email, input.password);
    if (!user) return reply.code(401).send({ error: "Invalid credentials" });
    return buildTokenResponse(app, user);
  });

  app.post("/api/v1/auth/refresh", async (request, reply) => {
    const body = z.object({ refreshToken: z.string() }).parse(request.body);
    try {
      const decoded = app.jwt.verify<{ id: string; tokenType?: string }>(body.refreshToken);
      if (decoded.tokenType !== "refresh") return reply.code(401).send({ error: "Invalid refresh token" });
      const user = await repo.findUserById(decoded.id);
      if (!user) return reply.code(401).send({ error: "Invalid refresh token" });
      return buildTokenResponse(app, user);
    } catch {
      return reply.code(401).send({ error: "Invalid refresh token" });
    }
  });

  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/health" || request.url.startsWith("/api/v1/auth/")) return;
    await authenticate(request, reply);
  });

  app.get("/api/v1/me", async (request) => getMe(repo, request.authUser));
  app.get("/api/v1/users/team", async (request) => listTeamUsers(repo, request.authUser));
  app.get("/api/v1/team-members", async (request) => listTeamUsers(repo, request.authUser));
  app.get("/api/v1/bootstrap", async (request) => {
    const [teamMembers, clients, tasks, houseViews, auditLogs] = await Promise.all([
      listTeamUsers(repo, request.authUser),
      listClients(repo, request.authUser, {}),
      listTasks(repo, request.authUser, {}),
      listHouseViews(repo, request.authUser, {}),
      listAuditLogs(repo, request.authUser, {}),
    ]);
    return {
      teamMembers: teamMembers.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role === "RM" ? "Relationship Manager" : member.role === "MANAGER" ? "Cluster Head & Managing Director" : member.role === "OPS" ? "Back-Office Processing Desk" : "Admin",
        level: member.role === "MANAGER" ? "Manager" : member.role === "OPS" ? "Operations" : member.role,
        clientsCount: clients.filter((client) => client.assignedRmId === member.id).length,
        totalAUM: `₹${(clients.filter((client) => client.assignedRmId === member.id).reduce((sum, client) => sum + client.aumNumeric, 0) / 10000000).toFixed(1)} Cr`,
        openTasksCount: tasks.filter((task) => task.assignedToUserId === member.id && task.status !== "completed").length,
        slaScore: "92%",
        avatar: member.name.split(" ").map((part) => part[0]).join("").slice(0, 3).toUpperCase(),
      })),
      clientProfiles: clients.map((client) => ({
        ...client,
        assignedRMId: client.assignedRmId,
        aumDisplay: `₹${(client.aumNumeric / 10000000).toFixed(2)} Cr`,
      })),
      tasks: tasks.map((task) => ({
        ...task,
        assignedTo: task.assignedToUserId,
        dueDate: task.slaDueAt,
        slaCountdown: task.slaStatus === "urgent" ? "urgent" : "",
      })),
      demoCallScenarios,
      firmMetrics,
      houseViews: houseViews.map((view) => ({ ...view, lastReviewed: view.lastReviewedAt })),
      playbookLibrary,
      auditLogs,
    };
  });
  app.post("/api/v1/users", async (request) => createUser(repo, request.authUser, createUserSchema.parse(request.body)));
  app.patch("/api/v1/users/:userId/role", async (request) => {
    const params = z.object({ userId: z.string() }).parse(request.params);
    const body = rolePatchSchema.parse(request.body);
    return updateUserRole(repo, request.authUser, params.userId, body.role);
  });

  app.get("/api/v1/clients", async (request) => listClients(repo, request.authUser, request.query as Record<string, string | undefined>));
  app.get("/api/v1/clients/:clientId", async (request) => {
    const params = z.object({ clientId: z.string() }).parse(request.params);
    return getClientDossier(repo, request.authUser, params.clientId);
  });
  app.get("/api/v1/clients/:clientId/portfolio", async (request) => {
    const params = z.object({ clientId: z.string() }).parse(request.params);
    return getClientPortfolio(repo, request.authUser, params.clientId);
  });
  app.get("/api/v1/clients/:clientId/copilot-alerts", async (request) => {
    const params = z.object({ clientId: z.string() }).parse(request.params);
    return getCopilotAlerts(repo, request.authUser, params.clientId);
  });
  app.patch("/api/v1/clients/:clientId/assigned-rm", async (request) => {
    const params = z.object({ clientId: z.string() }).parse(request.params);
    const body = z.object({ assignedRmId: z.string() }).parse(request.body);
    return reassignClient(repo, request.authUser, params.clientId, body.assignedRmId);
  });

  app.get("/api/v1/tasks", async (request) => listTasks(repo, request.authUser, request.query as Record<string, string | undefined>));
  app.post("/api/v1/tasks", async (request) => createTask(repo, request.authUser, taskSchema.parse(request.body)));
  app.post("/api/v1/tasks/bulk", async (request) => {
    const body = z.object({ tasks: z.array(taskSchema), idempotencyKey: z.string().min(1) }).parse(request.body);
    const existing = (await listTasks(repo, request.authUser, {})).filter((task) => task.idempotencyKey === body.idempotencyKey);
    if (existing.length > 0) {
      return { createdTaskIds: [], skippedDuplicateTaskIds: existing.map((task) => task.id) };
    }
    const created = [];
    for (const task of body.tasks) {
      created.push(await createTask(repo, request.authUser, { ...task, idempotencyKey: body.idempotencyKey }));
    }
    return { createdTaskIds: created.map((task) => task.id), skippedDuplicateTaskIds: [] };
  });
  app.patch("/api/v1/tasks/:taskId/status", async (request) => {
    const params = z.object({ taskId: z.string() }).parse(request.params);
    const body = statusSchema.parse(request.body);
    return updateTaskStatus(repo, request.authUser, params.taskId, body.status);
  });
  app.patch("/api/v1/tasks/:taskId/assign", async (request) => {
    const params = z.object({ taskId: z.string() }).parse(request.params);
    const body = assignSchema.parse(request.body);
    return assignTask(repo, request.authUser, params.taskId, body.assignedToUserId);
  });

  app.post("/api/v1/call-notes", async (request) => createCallNote(repo, request.authUser, callNoteSchema.parse(request.body)));
  app.post("/api/v1/call-notes/:callNoteId/synthesize", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request) => {
    const params = z.object({ callNoteId: z.string() }).parse(request.params);
    return synthesizeCallNote(repo, request.authUser, params.callNoteId);
  });

  app.patch("/api/v1/crm-drafts/:draftId", async (request) => {
    const params = z.object({ draftId: z.string() }).parse(request.params);
    return updateCrmDraft(repo, request.authUser, params.draftId, crmDraftPatchSchema.parse(request.body));
  });
  app.post("/api/v1/crm-drafts/:draftId/confirm", async (request) => {
    const params = z.object({ draftId: z.string() }).parse(request.params);
    return confirmCrmDraft(repo, request.authUser, params.draftId);
  });
  app.post("/api/v1/crm-drafts/:draftId/sync", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request) => {
    const params = z.object({ draftId: z.string() }).parse(request.params);
    const body = crmSyncSchema.parse(request.body);
    return syncCrmDraft(repo, request.authUser, params.draftId, body.crmProvider);
  });
  app.post("/api/v1/crm-drafts/:draftId/dispatch-tasks", async (request) => {
    const params = z.object({ draftId: z.string() }).parse(request.params);
    const body = dispatchSchema.parse(request.body);
    return dispatchCrmTasks(repo, request.authUser, params.draftId, body.idempotencyKey);
  });

  app.get("/api/v1/audit-logs", async (request) => listAuditLogs(repo, request.authUser, request.query as Record<string, string | undefined>));
  app.get("/api/v1/audit-logs/export", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const csv = await exportAuditCsv(repo, request.authUser, request.query as Record<string, string | undefined>);
    reply.header("content-type", "text/csv");
    return csv;
  });

  app.get("/api/v1/governance/branch-summary", async (request) => branchSummary(repo, request.authUser));
  app.get("/api/v1/governance/capacity-matrix", async (request) => capacityMatrix(repo, request.authUser));
  app.get("/api/v1/governance/risk-heatmap", async (request) => {
    const clients = await listClients(repo, request.authUser, {});
    return clients.map((client) => ({ clientId: client.id, name: client.name, riskCategory: client.riskCategory, kycStatus: client.kycStatus, allocationDrift: "moderate", idleCashDrag: client.id === "cli_1" ? "high" : "low" }));
  });
  app.get("/api/v1/governance/call-quality", async () => ({ status: "pending_ai_scoring", scores: [] }));

  app.get("/api/v1/house-views", async (request) => listHouseViews(repo, request.authUser, request.query as Record<string, string | undefined>));
  app.get("/api/v1/house-views/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const view = (await listHouseViews(repo, request.authUser, {})).find((item) => item.id === params.id);
    if (!view) return reply.code(404).send({ error: "House view not found" });
    return { ...view, versions: await repo.listHouseViewVersions(view.id) };
  });

  app.post("/api/v1/comm-drafts/:draftId/copy-event", async (request) => {
    const params = z.object({ draftId: z.string() }).parse(request.params);
    const crmDraft = await repo.getCrmDraft(request.authUser.tenantId, params.draftId);
    if (!crmDraft) throw Object.assign(new Error("Communication draft not found"), { statusCode: 404 });
    const drafts = await repo.listClientCommDrafts(params.draftId);
    const draft = drafts[0];
    if (!draft) throw Object.assign(new Error("Communication draft not found"), { statusCode: 404 });
    const updated = await repo.updateClientCommDraft(draft.id, { copyCount: draft.copyCount + 1 });
    await appendAuditLog(repo, request.authUser, {
      event: "comm_draft.copied",
      clientId: crmDraft.clientId,
      taskId: null,
      crmDraftId: crmDraft.id,
      detail: `Copied ${draft.channel} communication draft`,
      complianceStatus: "ok",
      metadataJson: { channel: draft.channel },
    });
    return updated;
  });
  app.post("/api/v1/comm-drafts/:draftId/open-whatsapp", async (request) => {
    const params = z.object({ draftId: z.string() }).parse(request.params);
    const crmDraft = await repo.getCrmDraft(request.authUser.tenantId, params.draftId);
    if (!crmDraft) throw Object.assign(new Error("WhatsApp draft not found"), { statusCode: 404 });
    const drafts = await repo.listClientCommDrafts(params.draftId);
    const draft = drafts.find((item) => item.channel === "whatsapp");
    if (!draft) throw Object.assign(new Error("WhatsApp draft not found"), { statusCode: 404 });
    const updated = await repo.updateClientCommDraft(draft.id, { openedExternalAt: new Date().toISOString() });
    await appendAuditLog(repo, request.authUser, {
      event: "comm_draft.whatsapp_opened",
      clientId: crmDraft.clientId,
      taskId: null,
      crmDraftId: crmDraft.id,
      detail: "Opened WhatsApp prefill link",
      complianceStatus: "ok",
      metadataJson: { channel: "whatsapp" },
    });
    return updated;
  });

  return app;
}
