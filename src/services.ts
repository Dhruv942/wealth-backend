import bcrypt from "bcryptjs";
import type { AuthUser, AuditLog, CrmDraft, SlaStatus, Task, TaskPriority, TaskStatus } from "./domain.js";
import type { Repository } from "./repository.js";
import {
  canCreateCallNote,
  canExportAudit,
  canManageUsers,
  canSeeClient,
  canSeeTask,
  filterVisibleClients,
  filterVisibleTasks,
  permissionsFor,
  publicUser,
  visibleRmIds,
} from "./authz.js";

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

export async function appendAuditLog(repo: Repository, user: AuthUser, input: Omit<AuditLog, "id" | "tenantId" | "actorUserId" | "createdAt">) {
  return repo.appendAuditLog({
    id: id("audit"),
    tenantId: user.tenantId,
    actorUserId: user.id,
    createdAt: now(),
    ...input,
  });
}

export async function getMe(repo: Repository, user: AuthUser) {
  const tenant = await repo.getTenant(user.tenantId);
  const teamMemberships = await repo.listTeamMemberships(user.tenantId);
  return {
    user,
    tenant,
    teamMemberships: teamMemberships.filter((item) => item.managerUserId === user.id || item.memberUserId === user.id),
    permissions: permissionsFor(user.role),
  };
}

export async function listTeamUsers(repo: Repository, user: AuthUser) {
  const users = await repo.listUsers(user.tenantId);
  if (user.role === "ADMIN") return users.map(publicUser);
  if (user.role === "RM") return users.filter((item) => item.id === user.id).map(publicUser);
  if (user.role === "MANAGER") {
    const rmIds = await visibleRmIds(repo, user);
    return users.filter((item) => item.id === user.id || rmIds.includes(item.id)).map(publicUser);
  }
  return users.filter((item) => item.role === "OPS" || item.role === "RM").map(publicUser);
}

export async function createUser(repo: Repository, actor: AuthUser, input: { name: string; email: string; phone?: string; role: AuthUser["role"]; password?: string }) {
  if (!canManageUsers(actor)) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  const user = await repo.createUser({
    id: id("usr"),
    tenantId: actor.tenantId,
    name: input.name,
    email: input.email.toLowerCase(),
    phone: input.phone ?? null,
    role: input.role,
    status: "ACTIVE",
    passwordHash: await bcrypt.hash(input.password ?? "password", 10),
    createdAt: now(),
  });
  await appendAuditLog(repo, actor, {
    event: "user.created",
    clientId: null,
    taskId: null,
    crmDraftId: null,
    detail: `Created user ${user.email}`,
    complianceStatus: "ok",
    metadataJson: { role: user.role },
  });
  return publicUser(user);
}

export async function updateUserRole(repo: Repository, actor: AuthUser, userId: string, role: AuthUser["role"]) {
  if (!canManageUsers(actor)) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  const user = await repo.updateUserRole(actor.tenantId, userId, role);
  if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });
  await appendAuditLog(repo, actor, {
    event: "user.role_changed",
    clientId: null,
    taskId: null,
    crmDraftId: null,
    detail: `Changed role for ${user.email}`,
    complianceStatus: "ok",
    metadataJson: { role },
  });
  return publicUser(user);
}

export async function listClients(repo: Repository, user: AuthUser, query: Record<string, string | undefined>) {
  let clients = await filterVisibleClients(repo, user, await repo.listClients(user.tenantId));
  if (query.search) {
    const needle = query.search.toLowerCase();
    clients = clients.filter((client) => client.name.toLowerCase().includes(needle) || client.city.toLowerCase().includes(needle));
  }
  if (query.assignedRmId) clients = clients.filter((client) => client.assignedRmId === query.assignedRmId);
  if (query.kycStatus) clients = clients.filter((client) => client.kycStatus === query.kycStatus);
  if (query.tier) clients = clients.filter((client) => client.tier === query.tier);
  return clients;
}

export async function getClientDossier(repo: Repository, user: AuthUser, clientId: string) {
  const client = await repo.getClient(user.tenantId, clientId);
  if (!client || !(await canSeeClient(repo, user, client))) throw Object.assign(new Error("Client not found"), { statusCode: 404 });
  return {
    ...client,
    contextNotes: await repo.listClientContextNotes(client.id),
    relationshipMoments: await repo.listClientRelationshipMoments(client.id),
  };
}

export async function getClientPortfolio(repo: Repository, user: AuthUser, clientId: string) {
  const client = await repo.getClient(user.tenantId, clientId);
  if (!client || !(await canSeeClient(repo, user, client))) throw Object.assign(new Error("Client not found"), { statusCode: 404 });
  const allocations = await repo.listPortfolioAllocations(clientId);
  const opportunities = await repo.listClientOpportunities(clientId);
  return {
    targetAllocation: allocations.find((item) => item.allocationType === "TARGET") ?? null,
    currentAllocation: allocations.find((item) => item.allocationType === "CURRENT") ?? null,
    holdings: await repo.listPortfolioHoldings(clientId),
    idleCash: opportunities.find((item) => item.type === "idle_cash") ?? null,
    taxHarvestingOpportunity: opportunities.find((item) => item.type === "tax_harvesting") ?? null,
  };
}

export async function getCopilotAlerts(repo: Repository, user: AuthUser, clientId: string) {
  const portfolio = await getClientPortfolio(repo, user, clientId);
  return [
    ...portfolio.holdings.filter((holding) => holding.assetType === "Debt").map((holding) => ({
      id: `alert_${holding.id}`,
      severity: "Info",
      title: `${holding.name} available for deployment review`,
      detail: `${holding.valueDisplay} currently tracked from ${holding.sourceSystem}.`,
    })),
    ...(portfolio.idleCash ? [{ id: `alert_${portfolio.idleCash.id}`, severity: portfolio.idleCash.severity, title: portfolio.idleCash.title, detail: portfolio.idleCash.description }] : []),
  ];
}

export async function reassignClient(repo: Repository, user: AuthUser, clientId: string, assignedRmId: string) {
  if (!["MANAGER", "ADMIN"].includes(user.role)) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  const client = await repo.getClient(user.tenantId, clientId);
  if (!client || !(await canSeeClient(repo, user, client))) throw Object.assign(new Error("Client not found"), { statusCode: 404 });
  const updated = await repo.updateClientAssignedRm(user.tenantId, clientId, assignedRmId);
  await appendAuditLog(repo, user, {
    event: "client.assigned_rm_changed",
    clientId,
    taskId: null,
    crmDraftId: null,
    detail: `Client RM changed from ${client.assignedRmId} to ${assignedRmId}`,
    complianceStatus: "ok",
    metadataJson: { oldAssigneeId: client.assignedRmId, newAssigneeId: assignedRmId },
  });
  return updated;
}

export async function listTasks(repo: Repository, user: AuthUser, query: Record<string, string | undefined>) {
  let tasks = await filterVisibleTasks(repo, user, await repo.listTasks(user.tenantId));
  if (query.status) tasks = tasks.filter((task) => task.status === query.status);
  if (query.priority) tasks = tasks.filter((task) => task.priority === query.priority);
  if (query.category) tasks = tasks.filter((task) => task.category === query.category);
  if (query.assignedTo) tasks = tasks.filter((task) => task.assignedToUserId === query.assignedTo);
  if (query.clientId) tasks = tasks.filter((task) => task.clientId === query.clientId);
  if (query.slaStatus) tasks = tasks.filter((task) => task.slaStatus === query.slaStatus);
  return tasks;
}

function calculateSlaStatus(status: TaskStatus, slaDueAt: string): SlaStatus {
  if (status === "completed") return "completed";
  const due = new Date(slaDueAt).getTime();
  const remaining = due - Date.now();
  if (remaining < 0) return "breached";
  if (remaining <= 3 * 60 * 60 * 1000) return "near_breach";
  return "on_track";
}

export async function createTask(repo: Repository, user: AuthUser, input: { clientId: string; title: string; details: string; category: string; priority: TaskPriority; assignedToUserId: string; slaDueAt: string; source: string; idempotencyKey?: string }) {
  const client = await repo.getClient(user.tenantId, input.clientId);
  if (!client || !(await canSeeClient(repo, user, client))) throw Object.assign(new Error("Client not found"), { statusCode: 404 });
  const assignee = await repo.findUserById(input.assignedToUserId);
  if (!assignee || assignee.tenantId !== user.tenantId) throw Object.assign(new Error("Assignee not found"), { statusCode: 404 });
  const task: Task = {
    id: id("task"),
    tenantId: user.tenantId,
    clientId: input.clientId,
    title: input.title,
    details: input.details,
    category: input.category,
    priority: input.priority,
    status: input.category.toLowerCase().includes("operations") || input.category.toLowerCase().includes("compliance") ? "pending_ops" : "pending_rm",
    assignedToUserId: assignee.id,
    assignedToName: assignee.name,
    slaDueAt: input.slaDueAt,
    slaStatus: calculateSlaStatus(input.category.toLowerCase().includes("operations") || input.category.toLowerCase().includes("compliance") ? "pending_ops" : "pending_rm", input.slaDueAt),
    source: input.source,
    createdByUserId: user.id,
    idempotencyKey: input.idempotencyKey ?? null,
    createdAt: now(),
    updatedAt: now(),
  };
  const created = await repo.createTask(task);
  await appendAuditLog(repo, user, {
    event: "task.created",
    clientId: created.clientId,
    taskId: created.id,
    crmDraftId: null,
    detail: `Created task ${created.title}`,
    complianceStatus: "ok",
    metadataJson: { source: created.source },
  });
  return created;
}

export async function updateTaskStatus(repo: Repository, user: AuthUser, taskId: string, status: TaskStatus) {
  const task = await repo.getTask(user.tenantId, taskId);
  if (!task || !(await canSeeTask(repo, user, task))) throw Object.assign(new Error("Task not found"), { statusCode: 404 });
  if (user.role === "RM" && task.assignedToUserId !== user.id) {
    const client = await repo.getClient(user.tenantId, task.clientId);
    if (!client || client.assignedRmId !== user.id) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  const updated = await repo.updateTaskStatus(user.tenantId, taskId, status, calculateSlaStatus(status, task.slaDueAt));
  if (!updated) throw Object.assign(new Error("Task not found"), { statusCode: 404 });
  await repo.addTaskStatusHistory({ id: id("tsh"), taskId, oldStatus: task.status, newStatus: status, changedByUserId: user.id, changedAt: now() });
  await appendAuditLog(repo, user, {
    event: "task.status_changed",
    clientId: task.clientId,
    taskId,
    crmDraftId: null,
    detail: `Task status changed from ${task.status} to ${status}`,
    complianceStatus: "ok",
    metadataJson: { oldStatus: task.status, newStatus: status },
  });
  return updated;
}

export async function assignTask(repo: Repository, user: AuthUser, taskId: string, assignedToUserId: string) {
  const task = await repo.getTask(user.tenantId, taskId);
  if (!task || !(await canSeeTask(repo, user, task))) throw Object.assign(new Error("Task not found"), { statusCode: 404 });
  const assignee = await repo.findUserById(assignedToUserId);
  if (!assignee || assignee.tenantId !== user.tenantId) throw Object.assign(new Error("Assignee not found"), { statusCode: 404 });
  if (user.role === "RM" && assignee.role !== "OPS") throw Object.assign(new Error("RM can only hand off to Ops"), { statusCode: 403 });
  if (user.role === "OPS" && assignee.role !== "OPS") throw Object.assign(new Error("Ops can only reassign within Ops"), { statusCode: 403 });
  if (user.role === "MANAGER") {
    const rmIds = await visibleRmIds(repo, user);
    if (!["OPS", "ADMIN"].includes(assignee.role) && !rmIds.includes(assignee.id)) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  const updated = await repo.updateTaskAssignee(user.tenantId, taskId, assignee.id, assignee.name);
  if (!updated) throw Object.assign(new Error("Task not found"), { statusCode: 404 });
  await repo.addTaskAssignmentHistory({ id: id("tah"), taskId, oldAssigneeId: task.assignedToUserId, newAssigneeId: assignee.id, changedByUserId: user.id, changedAt: now() });
  await appendAuditLog(repo, user, {
    event: "task.assigned",
    clientId: task.clientId,
    taskId,
    crmDraftId: null,
    detail: `Task reassigned from ${task.assignedToName} to ${assignee.name}`,
    complianceStatus: "ok",
    metadataJson: { oldAssigneeId: task.assignedToUserId, newAssigneeId: assignee.id },
  });
  return updated;
}

export async function createCallNote(repo: Repository, user: AuthUser, input: { clientId: string; rawText: string }) {
  if (!canCreateCallNote(user)) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  const client = await repo.getClient(user.tenantId, input.clientId);
  if (!client || !(await canSeeClient(repo, user, client))) throw Object.assign(new Error("Client not found"), { statusCode: 404 });
  const note = await repo.createCallNote({ id: id("call"), tenantId: user.tenantId, clientId: input.clientId, rmUserId: user.id, rawText: input.rawText, audioFileId: null, status: "raw", createdAt: now() });
  await appendAuditLog(repo, user, { event: "call_note.created", clientId: input.clientId, taskId: null, crmDraftId: null, detail: "Created call note", complianceStatus: "ok", metadataJson: { source: "typed_notes" } });
  return note;
}

export async function synthesizeCallNote(repo: Repository, user: AuthUser, callNoteId: string) {
  const callNote = await repo.getCallNote(user.tenantId, callNoteId);
  if (!callNote) throw Object.assign(new Error("Call note not found"), { statusCode: 404 });
  const client = await repo.getClient(user.tenantId, callNote.clientId);
  if (!client || !(await canSeeClient(repo, user, client))) throw Object.assign(new Error("Call note not found"), { statusCode: 404 });
  const amountMatch = callNote.rawText.match(/₹?\s?(\d+(?:\.\d+)?)\s?(lakh|lakhs|cr|crore)?/i);
  const amountNumeric = amountMatch ? Number(amountMatch[1]) * (amountMatch[2]?.toLowerCase().startsWith("cr") ? 10000000 : 100000) : 2500000;
  const draft: CrmDraft = {
    id: id("draft"),
    tenantId: user.tenantId,
    clientId: callNote.clientId,
    callNoteId,
    summary: `Client discussion captured for ${client.name}. ${callNote.rawText.slice(0, 180)}`,
    sentiment: callNote.rawText.toLowerCase().includes("cautious") ? "Tactically cautious" : "Constructive",
    suitabilityGuardrail: `${client.riskCategory} mandate suitability review required before execution.`,
    crmStageUpdate: "Stage: Liquidity Deployment",
    reviewStatus: "draft",
    reviewedByUserId: null,
    reviewedAt: null,
  };
  await repo.createCrmDraft(draft);
  const signal = await repo.createCrmLiquiditySignal({ id: id("liq"), crmDraftId: draft.id, amountNumeric, amountDisplay: amountMatch?.[0] ?? "₹25 Lakhs", asset: "Commercial Property Advance", status: "Received / discussed", expectedDate: null });
  const opsUser = (await repo.listUsers(user.tenantId)).find((item) => item.role === "OPS");
  const generated = await repo.createCrmGeneratedTask({ id: id("gentask"), crmDraftId: draft.id, taskId: null, title: "Execute staged deployment", details: "Create execution workflow after RM confirmation.", category: "Operations / Execution", priority: "High", assignedToUserId: opsUser?.id ?? user.id, status: "suggested", idempotencyKey: null });
  const whatsapp = await repo.createClientCommDraft({ id: id("comm"), crmDraftId: draft.id, channel: "whatsapp", subject: null, body: `Hi ${client.name}, sharing the agreed next steps from our call.`, copyCount: 0, openedExternalAt: null });
  const email = await repo.createClientCommDraft({ id: id("comm"), crmDraftId: draft.id, channel: "email", subject: "Next steps from our portfolio discussion", body: `Dear ${client.name},\n\nAs discussed, we will proceed only after your confirmation and suitability checks.`, copyCount: 0, openedExternalAt: null });
  await repo.updateCallNoteStatus(user.tenantId, callNoteId, "synthesized");
  await appendAuditLog(repo, user, { event: "callnote.synthesized", clientId: callNote.clientId, taskId: null, crmDraftId: draft.id, detail: "Synthesized CRM draft from call note", complianceStatus: "review_required", metadataJson: { generatedTaskCount: 1 } });
  return {
    crmDraftId: draft.id,
    summary: draft.summary,
    sentiment: draft.sentiment,
    liquiditySignals: [signal],
    suitabilityGuardrail: draft.suitabilityGuardrail,
    generatedOpsTasks: [generated],
    whatsappDraft: whatsapp.body,
    emailSubject: email.subject,
    emailBody: email.body,
    crmStageUpdate: draft.crmStageUpdate,
  };
}

export async function updateCrmDraft(repo: Repository, user: AuthUser, draftId: string, patch: Partial<Pick<CrmDraft, "summary" | "sentiment" | "suitabilityGuardrail" | "crmStageUpdate">>) {
  const draft = await visibleCrmDraft(repo, user, draftId);
  if (draft.reviewStatus === "confirmed") throw Object.assign(new Error("Confirmed draft is locked"), { statusCode: 409 });
  const updated = await repo.updateCrmDraft(user.tenantId, draftId, patch);
  await appendAuditLog(repo, user, { event: "crm_draft.updated", clientId: draft.clientId, taskId: null, crmDraftId: draftId, detail: "Updated CRM draft", complianceStatus: "review_required", metadataJson: {} });
  return updated;
}

export async function confirmCrmDraft(repo: Repository, user: AuthUser, draftId: string) {
  const draft = await visibleCrmDraft(repo, user, draftId);
  const updated = await repo.updateCrmDraft(user.tenantId, draftId, { reviewStatus: "confirmed", reviewedByUserId: user.id, reviewedAt: now() });
  await appendAuditLog(repo, user, { event: "crm_draft.confirmed", clientId: draft.clientId, taskId: null, crmDraftId: draftId, detail: "Confirmed CRM draft", complianceStatus: "ok", metadataJson: {} });
  return updated;
}

export async function syncCrmDraft(repo: Repository, user: AuthUser, draftId: string, crmProvider: string) {
  const draft = await visibleCrmDraft(repo, user, draftId);
  if (draft.reviewStatus !== "confirmed") throw Object.assign(new Error("CRM draft must be confirmed before sync"), { statusCode: 409 });
  const record = await repo.createCrmSyncRecord({ id: id("sync"), crmDraftId: draftId, externalCrm: crmProvider, externalRecordId: `mock_${crypto.randomUUID()}`, syncStatus: "success", errorMessage: null, syncedAt: now() });
  await appendAuditLog(repo, user, { event: "crm.synced", clientId: draft.clientId, taskId: null, crmDraftId: draftId, detail: `Synced CRM draft to ${crmProvider}`, complianceStatus: "ok", metadataJson: { externalCrm: crmProvider } });
  return { syncStatus: record.syncStatus, externalRecordId: record.externalRecordId };
}

export async function dispatchCrmTasks(repo: Repository, user: AuthUser, draftId: string, idempotencyKey: string) {
  const draft = await visibleCrmDraft(repo, user, draftId);
  if (draft.reviewStatus !== "confirmed") throw Object.assign(new Error("CRM draft must be confirmed before dispatch"), { statusCode: 409 });
  const generated = await repo.listCrmGeneratedTasks(draftId);
  const createdTaskIds: string[] = [];
  const skippedDuplicateTaskIds: string[] = [];
  for (const item of generated) {
    if (item.idempotencyKey === idempotencyKey && item.taskId) {
      skippedDuplicateTaskIds.push(item.taskId);
      continue;
    }
    const task = await createTask(repo, user, { clientId: draft.clientId, title: item.title, details: item.details, category: item.category, priority: item.priority, assignedToUserId: item.assignedToUserId, slaDueAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), source: "Auto-CRM Synthesizer", idempotencyKey });
    await repo.updateCrmGeneratedTask(item.id, { taskId: task.id, status: "dispatched", idempotencyKey });
    createdTaskIds.push(task.id);
  }
  await appendAuditLog(repo, user, { event: "crm_tasks.dispatched", clientId: draft.clientId, taskId: null, crmDraftId: draftId, detail: "Dispatched generated CRM tasks", complianceStatus: "ok", metadataJson: { idempotencyKey, createdTaskIds, skippedDuplicateTaskIds } });
  return { createdTaskIds, skippedDuplicateTaskIds };
}

async function visibleCrmDraft(repo: Repository, user: AuthUser, draftId: string) {
  const draft = await repo.getCrmDraft(user.tenantId, draftId);
  if (!draft) throw Object.assign(new Error("CRM draft not found"), { statusCode: 404 });
  const client = await repo.getClient(user.tenantId, draft.clientId);
  if (!client || !(await canSeeClient(repo, user, client))) throw Object.assign(new Error("CRM draft not found"), { statusCode: 404 });
  return draft;
}

export async function listAuditLogs(repo: Repository, user: AuthUser, query: Record<string, string | undefined>) {
  let logs = await repo.listAuditLogs(user.tenantId);
  if (user.role !== "ADMIN") {
    const clients = await listClients(repo, user, {});
    const clientIds = new Set(clients.map((client) => client.id));
    logs = logs.filter((log) => !log.clientId || clientIds.has(log.clientId));
  }
  if (query.clientId) logs = logs.filter((log) => log.clientId === query.clientId);
  if (query.actorUserId) logs = logs.filter((log) => log.actorUserId === query.actorUserId);
  if (query.event) logs = logs.filter((log) => log.event === query.event);
  if (query.from) logs = logs.filter((log) => log.createdAt >= query.from!);
  if (query.to) logs = logs.filter((log) => log.createdAt <= query.to!);
  return logs;
}

export async function exportAuditCsv(repo: Repository, user: AuthUser, query: Record<string, string | undefined>) {
  if (!canExportAudit(user)) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  const logs = await listAuditLogs(repo, user, query);
  return ["id,createdAt,actorUserId,event,clientId,taskId,crmDraftId,complianceStatus,detail", ...logs.map((log) => [log.id, log.createdAt, log.actorUserId, log.event, log.clientId ?? "", log.taskId ?? "", log.crmDraftId ?? "", log.complianceStatus, JSON.stringify(log.detail)].join(","))].join("\n");
}

export async function branchSummary(repo: Repository, user: AuthUser) {
  if (!["MANAGER", "OPS", "ADMIN"].includes(user.role)) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  const clients = await listClients(repo, user, {});
  const tasks = await listTasks(repo, user, {});
  return {
    totalManagedAum: clients.reduce((sum, client) => sum + client.aumNumeric, 0),
    unallocatedCash: 7500000,
    crmHygieneScore: 86,
    taxLossHarvestingWindow: "Open",
    nearBreachSlaCount: tasks.filter((task) => task.slaStatus === "near_breach").length,
    branchStatus: tasks.some((task) => task.slaStatus === "breached") ? "Attention Required" : "Healthy",
  };
}

export async function capacityMatrix(repo: Repository, user: AuthUser) {
  if (!["MANAGER", "OPS", "ADMIN"].includes(user.role)) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  const users = await listTeamUsers(repo, user);
  const tasks = await listTasks(repo, user, {});
  return users.filter((item) => item.role === "RM" || item.role === "OPS").map((item) => {
    const activeTasks = tasks.filter((task) => task.assignedToUserId === item.id && task.status !== "completed");
    return {
      userId: item.id,
      name: item.name,
      role: item.role,
      activeTasks: activeTasks.length,
      slaScore: activeTasks.some((task) => task.slaStatus === "breached") ? 68 : 92,
      workloadStatus: activeTasks.length > 8 ? "overloaded" : "normal",
    };
  });
}

export async function listHouseViews(repo: Repository, user: AuthUser, query: Record<string, string | undefined>) {
  let views = (await repo.listHouseViews(user.tenantId)).filter((view) => view.status === "approved" || user.role === "ADMIN");
  if (query.search) views = views.filter((view) => view.title.toLowerCase().includes(query.search!.toLowerCase()) || view.summary.toLowerCase().includes(query.search!.toLowerCase()));
  if (query.tag) views = views.filter((view) => view.tags.includes(query.tag!));
  return views;
}
