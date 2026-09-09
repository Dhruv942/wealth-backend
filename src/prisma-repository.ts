import { Prisma, PrismaClient } from "@prisma/client";
import type {
  AuditLog,
  CallNote,
  ClientCommDraft,
  CrmDraft,
  CrmGeneratedTask,
  CrmLiquiditySignal,
  CrmSyncRecord,
  HouseViewVersion,
  Role,
  Task,
  TaskAssignmentHistory,
  TaskStatusHistory,
  User,
} from "./domain.js";
import type { Repository } from "./repository.js";

const prisma = new PrismaClient();

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function date(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

export class PrismaRepository implements Repository {
  async findUserByEmail(email: string) {
    const row = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    return row ? ({ ...row, createdAt: iso(row.createdAt) } as User) : null;
  }

  async findUserById(id: string) {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? ({ ...row, createdAt: iso(row.createdAt) } as User) : null;
  }

  async listUsers(tenantId: string) {
    const rows = await prisma.user.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
    return rows.map((row) => ({ ...row, createdAt: iso(row.createdAt) } as User));
  }

  async createUser(user: User) {
    const row = await prisma.user.create({ data: { ...user, createdAt: new Date(user.createdAt) } });
    return { ...row, createdAt: iso(row.createdAt) } as User;
  }

  async updateUserRole(tenantId: string, userId: string, role: Role) {
    const row = await prisma.user.updateMany({ where: { tenantId, id: userId }, data: { role } });
    if (row.count === 0) return null;
    return this.findUserById(userId);
  }

  async listTenants() {
    const rows = await prisma.tenant.findMany();
    return rows.map((row) => ({ ...row, createdAt: iso(row.createdAt) }));
  }

  async getTenant(id: string) {
    const row = await prisma.tenant.findUnique({ where: { id } });
    return row ? { ...row, createdAt: iso(row.createdAt) } : null;
  }

  async listTeamMemberships(tenantId: string) {
    return prisma.teamMembership.findMany({ where: { tenantId } });
  }

  async listClients(tenantId: string) {
    const rows = await prisma.client.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
    return rows.map((row) => ({ ...row, createdAt: iso(row.createdAt) }));
  }

  async getClient(tenantId: string, clientId: string) {
    const row = await prisma.client.findFirst({ where: { tenantId, id: clientId } });
    return row ? { ...row, createdAt: iso(row.createdAt) } : null;
  }

  async updateClientAssignedRm(tenantId: string, clientId: string, assignedRmId: string) {
    const result = await prisma.client.updateMany({ where: { tenantId, id: clientId }, data: { assignedRmId } });
    if (result.count === 0) return null;
    return this.getClient(tenantId, clientId);
  }

  async listClientContextNotes(clientId: string) {
    const rows = await prisma.clientContextNote.findMany({ where: { clientId }, orderBy: { updatedAt: "desc" } });
    return rows.map((row) => ({ ...row, updatedAt: iso(row.updatedAt) }));
  }

  async listClientRelationshipMoments(clientId: string) {
    const rows = await prisma.clientRelationshipMoment.findMany({ where: { clientId }, orderBy: { date: "desc" } });
    return rows.map((row) => ({ ...row, date: iso(row.date).slice(0, 10) }));
  }

  async listPortfolioAllocations(clientId: string) {
    return prisma.portfolioAllocation.findMany({ where: { clientId } });
  }

  async listPortfolioHoldings(clientId: string) {
    return prisma.portfolioHolding.findMany({ where: { clientId } });
  }

  async listClientOpportunities(clientId: string) {
    return prisma.clientOpportunity.findMany({ where: { clientId } });
  }

  async listTasks(tenantId: string) {
    const rows = await prisma.task.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
    return rows.map((row) => ({
      ...row,
      slaDueAt: iso(row.slaDueAt),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    } as Task));
  }

  async getTask(tenantId: string, taskId: string) {
    const row = await prisma.task.findFirst({ where: { tenantId, id: taskId } });
    return row ? ({
      ...row,
      slaDueAt: iso(row.slaDueAt),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    } as Task) : null;
  }

  async createTask(task: Task) {
    const row = await prisma.task.create({
      data: { ...task, slaDueAt: new Date(task.slaDueAt), createdAt: new Date(task.createdAt), updatedAt: new Date(task.updatedAt) },
    });
    return { ...row, slaDueAt: iso(row.slaDueAt), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) } as Task;
  }

  async updateTaskStatus(tenantId: string, taskId: string, status: Task["status"], slaStatus: Task["slaStatus"]) {
    const result = await prisma.task.updateMany({ where: { tenantId, id: taskId }, data: { status, slaStatus } });
    if (result.count === 0) return null;
    return this.getTask(tenantId, taskId);
  }

  async updateTaskAssignee(tenantId: string, taskId: string, assignedToUserId: string, assignedToName: string) {
    const result = await prisma.task.updateMany({ where: { tenantId, id: taskId }, data: { assignedToUserId, assignedToName } });
    if (result.count === 0) return null;
    return this.getTask(tenantId, taskId);
  }

  async addTaskStatusHistory(row: TaskStatusHistory) {
    const saved = await prisma.taskStatusHistory.create({ data: { ...row, changedAt: new Date(row.changedAt) } });
    return { ...saved, changedAt: iso(saved.changedAt) } as TaskStatusHistory;
  }

  async addTaskAssignmentHistory(row: TaskAssignmentHistory) {
    const saved = await prisma.taskAssignmentHistory.create({ data: { ...row, changedAt: new Date(row.changedAt) } });
    return { ...saved, changedAt: iso(saved.changedAt) } as TaskAssignmentHistory;
  }

  async createCallNote(callNote: CallNote) {
    const row = await prisma.callNote.create({ data: { ...callNote, createdAt: new Date(callNote.createdAt) } });
    return { ...row, createdAt: iso(row.createdAt) } as CallNote;
  }

  async getCallNote(tenantId: string, id: string) {
    const row = await prisma.callNote.findFirst({ where: { tenantId, id } });
    return row ? ({ ...row, createdAt: iso(row.createdAt) } as CallNote) : null;
  }

  async updateCallNoteStatus(tenantId: string, id: string, status: CallNote["status"]) {
    const result = await prisma.callNote.updateMany({ where: { tenantId, id }, data: { status } });
    if (result.count === 0) return null;
    return this.getCallNote(tenantId, id);
  }

  async createCrmDraft(draft: CrmDraft) {
    const row = await prisma.crmDraft.create({ data: { ...draft, reviewedAt: date(draft.reviewedAt) } });
    return { ...row, reviewedAt: row.reviewedAt ? iso(row.reviewedAt) : null } as CrmDraft;
  }

  async getCrmDraft(tenantId: string, id: string) {
    const row = await prisma.crmDraft.findFirst({ where: { tenantId, id } });
    return row ? ({ ...row, reviewedAt: row.reviewedAt ? iso(row.reviewedAt) : null } as CrmDraft) : null;
  }

  async updateCrmDraft(tenantId: string, id: string, patch: Partial<CrmDraft>) {
    const result = await prisma.crmDraft.updateMany({
      where: { tenantId, id },
      data: { ...patch, reviewedAt: date(patch.reviewedAt) },
    });
    if (result.count === 0) return null;
    return this.getCrmDraft(tenantId, id);
  }

  async listCrmLiquiditySignals(crmDraftId: string) {
    const rows = await prisma.crmLiquiditySignal.findMany({ where: { crmDraftId } });
    return rows.map((row) => ({ ...row, expectedDate: row.expectedDate ? iso(row.expectedDate) : null } as CrmLiquiditySignal));
  }

  async createCrmLiquiditySignal(signal: CrmLiquiditySignal) {
    const row = await prisma.crmLiquiditySignal.create({ data: { ...signal, expectedDate: date(signal.expectedDate) } });
    return { ...row, expectedDate: row.expectedDate ? iso(row.expectedDate) : null } as CrmLiquiditySignal;
  }

  async listCrmGeneratedTasks(crmDraftId: string) {
    return prisma.crmGeneratedTask.findMany({ where: { crmDraftId } }) as Promise<CrmGeneratedTask[]>;
  }

  async createCrmGeneratedTask(task: CrmGeneratedTask) {
    return prisma.crmGeneratedTask.create({ data: task }) as Promise<CrmGeneratedTask>;
  }

  async updateCrmGeneratedTask(id: string, patch: Partial<CrmGeneratedTask>) {
    const row = await prisma.crmGeneratedTask.update({ where: { id }, data: patch });
    return row as CrmGeneratedTask;
  }

  async createCrmSyncRecord(record: CrmSyncRecord) {
    const row = await prisma.crmSyncRecord.create({ data: { ...record, syncedAt: new Date(record.syncedAt) } });
    return { ...row, syncedAt: iso(row.syncedAt) } as CrmSyncRecord;
  }

  async listCrmSyncRecords(crmDraftId: string) {
    const rows = await prisma.crmSyncRecord.findMany({ where: { crmDraftId } });
    return rows.map((row) => ({ ...row, syncedAt: iso(row.syncedAt) } as CrmSyncRecord));
  }

  async listClientCommDrafts(crmDraftId: string) {
    const rows = await prisma.clientCommDraft.findMany({ where: { crmDraftId } });
    return rows.map((row) => ({ ...row, openedExternalAt: row.openedExternalAt ? iso(row.openedExternalAt) : null } as ClientCommDraft));
  }

  async createClientCommDraft(draft: ClientCommDraft) {
    const row = await prisma.clientCommDraft.create({ data: { ...draft, openedExternalAt: date(draft.openedExternalAt) } });
    return { ...row, openedExternalAt: row.openedExternalAt ? iso(row.openedExternalAt) : null } as ClientCommDraft;
  }

  async updateClientCommDraft(id: string, patch: Partial<ClientCommDraft>) {
    const row = await prisma.clientCommDraft.update({ where: { id }, data: { ...patch, openedExternalAt: date(patch.openedExternalAt) } });
    return { ...row, openedExternalAt: row.openedExternalAt ? iso(row.openedExternalAt) : null } as ClientCommDraft;
  }

  async appendAuditLog(log: AuditLog) {
    const row = await prisma.auditLog.create({ data: { ...log, metadataJson: log.metadataJson as Prisma.InputJsonValue, createdAt: new Date(log.createdAt) } });
    return { ...row, createdAt: iso(row.createdAt), metadataJson: row.metadataJson as Record<string, unknown> } as AuditLog;
  }

  async listAuditLogs(tenantId: string) {
    const rows = await prisma.auditLog.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
    return rows.map((row) => ({ ...row, createdAt: iso(row.createdAt), metadataJson: row.metadataJson as Record<string, unknown> } as AuditLog));
  }

  async listHouseViews(tenantId: string) {
    const rows = await prisma.houseView.findMany({ where: { tenantId }, orderBy: { lastReviewedAt: "desc" } });
    return rows.map((row) => ({
      ...row,
      createdAt: iso(row.createdAt),
      lastReviewedAt: row.lastReviewedAt ? iso(row.lastReviewedAt) : null,
    }));
  }

  async getHouseView(tenantId: string, id: string) {
    const row = await prisma.houseView.findFirst({ where: { tenantId, id } });
    return row ? {
      ...row,
      createdAt: iso(row.createdAt),
      lastReviewedAt: row.lastReviewedAt ? iso(row.lastReviewedAt) : null,
    } : null;
  }

  async listHouseViewVersions(houseViewId: string): Promise<HouseViewVersion[]> {
    const rows = await prisma.houseViewVersion.findMany({ where: { houseViewId }, orderBy: { version: "desc" } });
    return rows.map((row) => ({ ...row, effectiveAt: iso(row.effectiveAt) }));
  }
}
