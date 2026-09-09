export type Role = "RM" | "MANAGER" | "OPS" | "ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE";
export type TenantStatus = "ACTIVE" | "SUSPENDED";
export type AllocationType = "TARGET" | "CURRENT";
export type TaskPriority = "Critical" | "Urgent" | "High" | "Medium" | "Low";
export type TaskStatus = "pending_rm" | "in_progress" | "pending_ops" | "completed" | "blocked";
export type SlaStatus = "on_track" | "near_breach" | "urgent" | "breached" | "completed";
export type CallNoteStatus = "raw" | "synthesized" | "transcribed";
export type ReviewStatus = "draft" | "confirmed";
export type SyncStatus = "pending" | "success" | "failed";
export type HouseViewStatus = "draft" | "approved" | "archived";
export type GeneratedTaskStatus = "suggested" | "dispatched";

export interface Tenant {
  id: string;
  name: string;
  status: TenantStatus;
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  passwordHash: string;
  createdAt: string;
}

export interface TeamMembership {
  id: string;
  tenantId: string;
  managerUserId: string;
  memberUserId: string;
}

export interface Client {
  id: string;
  tenantId: string;
  name: string;
  firmOrFamily: string;
  tier: string;
  city: string;
  phone: string;
  assignedRmId: string;
  riskCategory: string;
  kycStatus: string;
  aumNumeric: number;
  createdAt: string;
}

export interface ClientContextNote {
  id: string;
  clientId: string;
  note: string;
  source: string;
  updatedAt: string;
}

export interface ClientRelationshipMoment {
  id: string;
  clientId: string;
  date: string;
  label: string;
}

export interface PortfolioAllocation {
  id: string;
  clientId: string;
  equityPct: number;
  debtPct: number;
  alternatesPct: number;
  allocationType: AllocationType;
}

export interface PortfolioHolding {
  id: string;
  clientId: string;
  name: string;
  assetType: string;
  valueNumeric: number;
  valueDisplay: string;
  returnDisplay: string;
  sourceSystem: string;
}

export interface ClientOpportunity {
  id: string;
  clientId: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  amountNumeric: number;
  status: string;
}

export interface Task {
  id: string;
  tenantId: string;
  clientId: string;
  title: string;
  details: string;
  category: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedToUserId: string;
  assignedToName: string;
  slaDueAt: string;
  slaStatus: SlaStatus;
  source: string;
  createdByUserId: string;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskStatusHistory {
  id: string;
  taskId: string;
  oldStatus: TaskStatus;
  newStatus: TaskStatus;
  changedByUserId: string;
  changedAt: string;
}

export interface TaskAssignmentHistory {
  id: string;
  taskId: string;
  oldAssigneeId: string;
  newAssigneeId: string;
  changedByUserId: string;
  changedAt: string;
}

export interface CallNote {
  id: string;
  tenantId: string;
  clientId: string;
  rmUserId: string;
  rawText: string;
  audioFileId: string | null;
  status: CallNoteStatus;
  createdAt: string;
}

export interface CrmDraft {
  id: string;
  callNoteId: string;
  tenantId: string;
  clientId: string;
  summary: string;
  sentiment: string;
  suitabilityGuardrail: string;
  crmStageUpdate: string;
  reviewStatus: ReviewStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
}

export interface CrmLiquiditySignal {
  id: string;
  crmDraftId: string;
  amountNumeric: number | null;
  amountDisplay: string;
  asset: string;
  status: string;
  expectedDate: string | null;
}

export interface CrmGeneratedTask {
  id: string;
  crmDraftId: string;
  taskId: string | null;
  title: string;
  details: string;
  category: string;
  priority: TaskPriority;
  assignedToUserId: string;
  status: GeneratedTaskStatus;
  idempotencyKey: string | null;
}

export interface CrmSyncRecord {
  id: string;
  crmDraftId: string;
  externalCrm: string;
  externalRecordId: string | null;
  syncStatus: SyncStatus;
  errorMessage: string | null;
  syncedAt: string;
}

export interface ClientCommDraft {
  id: string;
  crmDraftId: string;
  channel: "whatsapp" | "email";
  subject: string | null;
  body: string;
  copyCount: number;
  openedExternalAt: string | null;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  actorUserId: string;
  event: string;
  clientId: string | null;
  taskId: string | null;
  crmDraftId: string | null;
  detail: string;
  complianceStatus: string;
  metadataJson: Record<string, unknown>;
  createdAt: string;
}

export interface SuitabilityCheck {
  id: string;
  clientId: string;
  crmDraftId: string;
  riskCategory: string;
  recommendationSummary: string;
  result: string;
  flagsJson: Record<string, unknown>;
  checkedAt: string;
}

export interface HouseView {
  id: string;
  tenantId: string;
  title: string;
  summary: string;
  tags: string[];
  approvedBy: string | null;
  lastReviewedAt: string | null;
  status: HouseViewStatus;
  version: number;
  createdAt: string;
}

export interface HouseViewVersion {
  id: string;
  houseViewId: string;
  summary: string;
  approvedBy: string;
  version: number;
  effectiveAt: string;
}

export interface AuthUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
}

export interface DataStore {
  tenants: Tenant[];
  users: User[];
  teamMemberships: TeamMembership[];
  clients: Client[];
  clientContextNotes: ClientContextNote[];
  clientRelationshipMoments: ClientRelationshipMoment[];
  portfolioAllocations: PortfolioAllocation[];
  portfolioHoldings: PortfolioHolding[];
  clientOpportunities: ClientOpportunity[];
  tasks: Task[];
  taskStatusHistory: TaskStatusHistory[];
  taskAssignmentsHistory: TaskAssignmentHistory[];
  callNotes: CallNote[];
  crmDrafts: CrmDraft[];
  crmLiquiditySignals: CrmLiquiditySignal[];
  crmGeneratedTasks: CrmGeneratedTask[];
  crmSyncRecords: CrmSyncRecord[];
  clientCommDrafts: ClientCommDraft[];
  auditLogs: AuditLog[];
  suitabilityChecks: SuitabilityCheck[];
  houseViews: HouseView[];
  houseViewVersions: HouseViewVersion[];
}
