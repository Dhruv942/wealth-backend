import type {
  AuditLog,
  CallNote,
  ClientCommDraft,
  CrmDraft,
  CrmGeneratedTask,
  CrmLiquiditySignal,
  CrmSyncRecord,
  DataStore,
  HouseViewVersion,
  Role,
  Task,
  TaskAssignmentHistory,
  TaskStatusHistory,
  User,
} from "./domain";
import type { Repository } from "./repository";
import { buildSeedData } from "./seed-data";

export class InMemoryRepository implements Repository {
  private data: DataStore;

  constructor(data: DataStore = buildSeedData()) {
    this.data = structuredClone(data);
  }

  async findUserByEmail(email: string) {
    return this.data.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async findUserById(id: string) {
    return this.data.users.find((user) => user.id === id) ?? null;
  }

  async listUsers(tenantId: string) {
    return this.data.users.filter((user) => user.tenantId === tenantId);
  }

  async createUser(user: User) {
    this.data.users.push(user);
    return user;
  }

  async updateUserRole(tenantId: string, userId: string, role: Role) {
    const user = this.data.users.find((item) => item.tenantId === tenantId && item.id === userId);
    if (!user) return null;
    user.role = role;
    return user;
  }

  async listTenants() {
    return this.data.tenants;
  }

  async getTenant(id: string) {
    return this.data.tenants.find((tenant) => tenant.id === id) ?? null;
  }

  async listTeamMemberships(tenantId: string) {
    return this.data.teamMemberships.filter((row) => row.tenantId === tenantId);
  }

  async listClients(tenantId: string) {
    return this.data.clients.filter((client) => client.tenantId === tenantId);
  }

  async getClient(tenantId: string, clientId: string) {
    return this.data.clients.find((client) => client.tenantId === tenantId && client.id === clientId) ?? null;
  }

  async updateClientAssignedRm(tenantId: string, clientId: string, assignedRmId: string) {
    const client = this.data.clients.find((item) => item.tenantId === tenantId && item.id === clientId);
    if (!client) return null;
    client.assignedRmId = assignedRmId;
    return client;
  }

  async listClientContextNotes(clientId: string) {
    return this.data.clientContextNotes.filter((item) => item.clientId === clientId);
  }

  async listClientRelationshipMoments(clientId: string) {
    return this.data.clientRelationshipMoments.filter((item) => item.clientId === clientId);
  }

  async listPortfolioAllocations(clientId: string) {
    return this.data.portfolioAllocations.filter((item) => item.clientId === clientId);
  }

  async listPortfolioHoldings(clientId: string) {
    return this.data.portfolioHoldings.filter((item) => item.clientId === clientId);
  }

  async listClientOpportunities(clientId: string) {
    return this.data.clientOpportunities.filter((item) => item.clientId === clientId);
  }

  async listTasks(tenantId: string) {
    return this.data.tasks.filter((task) => task.tenantId === tenantId);
  }

  async getTask(tenantId: string, taskId: string) {
    return this.data.tasks.find((task) => task.tenantId === tenantId && task.id === taskId) ?? null;
  }

  async createTask(task: Task) {
    this.data.tasks.push(task);
    return task;
  }

  async updateTaskStatus(tenantId: string, taskId: string, status: Task["status"], slaStatus: Task["slaStatus"]) {
    const task = this.data.tasks.find((item) => item.tenantId === tenantId && item.id === taskId);
    if (!task) return null;
    task.status = status;
    task.slaStatus = slaStatus;
    task.updatedAt = new Date().toISOString();
    return task;
  }

  async updateTaskAssignee(tenantId: string, taskId: string, assignedToUserId: string, assignedToName: string) {
    const task = this.data.tasks.find((item) => item.tenantId === tenantId && item.id === taskId);
    if (!task) return null;
    task.assignedToUserId = assignedToUserId;
    task.assignedToName = assignedToName;
    task.updatedAt = new Date().toISOString();
    return task;
  }

  async addTaskStatusHistory(row: TaskStatusHistory) {
    this.data.taskStatusHistory.push(row);
    return row;
  }

  async addTaskAssignmentHistory(row: TaskAssignmentHistory) {
    this.data.taskAssignmentsHistory.push(row);
    return row;
  }

  async createCallNote(callNote: CallNote) {
    this.data.callNotes.push(callNote);
    return callNote;
  }

  async getCallNote(tenantId: string, id: string) {
    return this.data.callNotes.find((note) => note.tenantId === tenantId && note.id === id) ?? null;
  }

  async updateCallNoteStatus(tenantId: string, id: string, status: CallNote["status"]) {
    const note = this.data.callNotes.find((item) => item.tenantId === tenantId && item.id === id);
    if (!note) return null;
    note.status = status;
    return note;
  }

  async createCrmDraft(draft: CrmDraft) {
    this.data.crmDrafts.push(draft);
    return draft;
  }

  async getCrmDraft(tenantId: string, id: string) {
    return this.data.crmDrafts.find((draft) => draft.tenantId === tenantId && draft.id === id) ?? null;
  }

  async updateCrmDraft(tenantId: string, id: string, patch: Partial<CrmDraft>) {
    const draft = this.data.crmDrafts.find((item) => item.tenantId === tenantId && item.id === id);
    if (!draft) return null;
    Object.assign(draft, patch);
    return draft;
  }

  async listCrmLiquiditySignals(crmDraftId: string) {
    return this.data.crmLiquiditySignals.filter((item) => item.crmDraftId === crmDraftId);
  }

  async createCrmLiquiditySignal(signal: CrmLiquiditySignal) {
    this.data.crmLiquiditySignals.push(signal);
    return signal;
  }

  async listCrmGeneratedTasks(crmDraftId: string) {
    return this.data.crmGeneratedTasks.filter((item) => item.crmDraftId === crmDraftId);
  }

  async createCrmGeneratedTask(task: CrmGeneratedTask) {
    this.data.crmGeneratedTasks.push(task);
    return task;
  }

  async updateCrmGeneratedTask(id: string, patch: Partial<CrmGeneratedTask>) {
    const task = this.data.crmGeneratedTasks.find((item) => item.id === id);
    if (!task) return null;
    Object.assign(task, patch);
    return task;
  }

  async createCrmSyncRecord(record: CrmSyncRecord) {
    this.data.crmSyncRecords.push(record);
    return record;
  }

  async listCrmSyncRecords(crmDraftId: string) {
    return this.data.crmSyncRecords.filter((item) => item.crmDraftId === crmDraftId);
  }

  async listClientCommDrafts(crmDraftId: string) {
    return this.data.clientCommDrafts.filter((item) => item.crmDraftId === crmDraftId);
  }

  async createClientCommDraft(draft: ClientCommDraft) {
    this.data.clientCommDrafts.push(draft);
    return draft;
  }

  async updateClientCommDraft(id: string, patch: Partial<ClientCommDraft>) {
    const draft = this.data.clientCommDrafts.find((item) => item.id === id);
    if (!draft) return null;
    Object.assign(draft, patch);
    return draft;
  }

  async appendAuditLog(log: AuditLog) {
    this.data.auditLogs.push(log);
    return log;
  }

  async listAuditLogs(tenantId: string) {
    return this.data.auditLogs.filter((log) => log.tenantId === tenantId);
  }

  async listHouseViews(tenantId: string) {
    return this.data.houseViews.filter((view) => view.tenantId === tenantId);
  }

  async getHouseView(tenantId: string, id: string) {
    return this.data.houseViews.find((view) => view.tenantId === tenantId && view.id === id) ?? null;
  }

  async listHouseViewVersions(houseViewId: string): Promise<HouseViewVersion[]> {
    return this.data.houseViewVersions.filter((version) => version.houseViewId === houseViewId);
  }
}
