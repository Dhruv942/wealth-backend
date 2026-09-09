import type {
  AuditLog,
  CallNote,
  Client,
  ClientCommDraft,
  ClientContextNote,
  ClientOpportunity,
  ClientRelationshipMoment,
  CrmDraft,
  CrmGeneratedTask,
  CrmLiquiditySignal,
  CrmSyncRecord,
  HouseView,
  HouseViewVersion,
  PortfolioAllocation,
  PortfolioHolding,
  Role,
  Task,
  TaskAssignmentHistory,
  TaskStatusHistory,
  TeamMembership,
  Tenant,
  User,
} from "./domain.js";

export interface Repository {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  listUsers(tenantId: string): Promise<User[]>;
  createUser(user: User): Promise<User>;
  updateUserRole(tenantId: string, userId: string, role: Role): Promise<User | null>;
  listTenants(): Promise<Tenant[]>;
  getTenant(id: string): Promise<Tenant | null>;
  listTeamMemberships(tenantId: string): Promise<TeamMembership[]>;
  listClients(tenantId: string): Promise<Client[]>;
  getClient(tenantId: string, clientId: string): Promise<Client | null>;
  updateClientAssignedRm(tenantId: string, clientId: string, assignedRmId: string): Promise<Client | null>;
  listClientContextNotes(clientId: string): Promise<ClientContextNote[]>;
  listClientRelationshipMoments(clientId: string): Promise<ClientRelationshipMoment[]>;
  listPortfolioAllocations(clientId: string): Promise<PortfolioAllocation[]>;
  listPortfolioHoldings(clientId: string): Promise<PortfolioHolding[]>;
  listClientOpportunities(clientId: string): Promise<ClientOpportunity[]>;
  listTasks(tenantId: string): Promise<Task[]>;
  getTask(tenantId: string, taskId: string): Promise<Task | null>;
  createTask(task: Task): Promise<Task>;
  updateTaskStatus(tenantId: string, taskId: string, status: Task["status"], slaStatus: Task["slaStatus"]): Promise<Task | null>;
  updateTaskAssignee(tenantId: string, taskId: string, assignedToUserId: string, assignedToName: string): Promise<Task | null>;
  addTaskStatusHistory(row: TaskStatusHistory): Promise<TaskStatusHistory>;
  addTaskAssignmentHistory(row: TaskAssignmentHistory): Promise<TaskAssignmentHistory>;
  createCallNote(callNote: CallNote): Promise<CallNote>;
  getCallNote(tenantId: string, id: string): Promise<CallNote | null>;
  updateCallNoteStatus(tenantId: string, id: string, status: CallNote["status"]): Promise<CallNote | null>;
  createCrmDraft(draft: CrmDraft): Promise<CrmDraft>;
  getCrmDraft(tenantId: string, id: string): Promise<CrmDraft | null>;
  updateCrmDraft(tenantId: string, id: string, patch: Partial<Pick<CrmDraft, "summary" | "sentiment" | "suitabilityGuardrail" | "crmStageUpdate" | "reviewStatus" | "reviewedByUserId" | "reviewedAt">>): Promise<CrmDraft | null>;
  listCrmLiquiditySignals(crmDraftId: string): Promise<CrmLiquiditySignal[]>;
  createCrmLiquiditySignal(signal: CrmLiquiditySignal): Promise<CrmLiquiditySignal>;
  listCrmGeneratedTasks(crmDraftId: string): Promise<CrmGeneratedTask[]>;
  createCrmGeneratedTask(task: CrmGeneratedTask): Promise<CrmGeneratedTask>;
  updateCrmGeneratedTask(id: string, patch: Partial<CrmGeneratedTask>): Promise<CrmGeneratedTask | null>;
  createCrmSyncRecord(record: CrmSyncRecord): Promise<CrmSyncRecord>;
  listCrmSyncRecords(crmDraftId: string): Promise<CrmSyncRecord[]>;
  listClientCommDrafts(crmDraftId: string): Promise<ClientCommDraft[]>;
  createClientCommDraft(draft: ClientCommDraft): Promise<ClientCommDraft>;
  updateClientCommDraft(id: string, patch: Partial<ClientCommDraft>): Promise<ClientCommDraft | null>;
  appendAuditLog(log: AuditLog): Promise<AuditLog>;
  listAuditLogs(tenantId: string): Promise<AuditLog[]>;
  listHouseViews(tenantId: string): Promise<HouseView[]>;
  getHouseView(tenantId: string, id: string): Promise<HouseView | null>;
  listHouseViewVersions(houseViewId: string): Promise<HouseViewVersion[]>;
}
