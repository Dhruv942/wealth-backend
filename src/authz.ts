import type { AuthUser, Client, Role, Task, User } from "./domain.js";
import type { Repository } from "./repository.js";

export function publicUser(user: User) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

export function permissionsFor(role: Role): string[] {
  const common = ["house_views:read"];
  if (role === "RM") {
    return [...common, "clients:own:read", "tasks:own:write", "crm_drafts:own:write"];
  }
  if (role === "MANAGER") {
    return [...common, "clients:team:read", "tasks:team:write", "audit:team:export", "governance:read"];
  }
  if (role === "OPS") {
    return [...common, "tasks:ops:write", "audit:ops:export", "governance:read"];
  }
  return [...common, "tenant:admin", "users:write", "clients:all:read", "tasks:all:write", "audit:all:export"];
}

export async function visibleRmIds(repo: Repository, user: AuthUser): Promise<string[]> {
  if (user.role === "ADMIN" || user.role === "OPS") {
    const users = await repo.listUsers(user.tenantId);
    return users.filter((item) => item.role === "RM").map((item) => item.id);
  }
  if (user.role === "MANAGER") {
    const memberships = await repo.listTeamMemberships(user.tenantId);
    return memberships.filter((item) => item.managerUserId === user.id).map((item) => item.memberUserId);
  }
  return [user.id];
}

export async function canSeeClient(repo: Repository, user: AuthUser, client: Client): Promise<boolean> {
  if (client.tenantId !== user.tenantId) return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "RM") return client.assignedRmId === user.id;
  if (user.role === "MANAGER") return (await visibleRmIds(repo, user)).includes(client.assignedRmId);
  const tasks = await repo.listTasks(user.tenantId);
  return tasks.some((task) => task.clientId === client.id && isOpsTask(task));
}

export async function filterVisibleClients(repo: Repository, user: AuthUser, clients: Client[]): Promise<Client[]> {
  const result: Client[] = [];
  for (const client of clients) {
    if (await canSeeClient(repo, user, client)) {
      result.push(client);
    }
  }
  return result;
}

export async function canSeeTask(repo: Repository, user: AuthUser, task: Task): Promise<boolean> {
  if (task.tenantId !== user.tenantId) return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "OPS") return isOpsTask(task);
  const client = await repo.getClient(user.tenantId, task.clientId);
  if (!client) return false;
  if (user.role === "RM") return task.assignedToUserId === user.id || client.assignedRmId === user.id;
  return (await visibleRmIds(repo, user)).includes(client.assignedRmId);
}

export async function filterVisibleTasks(repo: Repository, user: AuthUser, tasks: Task[]): Promise<Task[]> {
  const result: Task[] = [];
  for (const task of tasks) {
    if (await canSeeTask(repo, user, task)) {
      result.push(task);
    }
  }
  return result;
}

export function canManageUsers(user: AuthUser): boolean {
  return user.role === "ADMIN";
}

export function canExportAudit(user: AuthUser): boolean {
  return ["MANAGER", "OPS", "ADMIN"].includes(user.role);
}

export function canCreateCallNote(user: AuthUser): boolean {
  return user.role === "RM" || user.role === "MANAGER" || user.role === "ADMIN";
}

export function isOpsTask(task: Task): boolean {
  return task.category.toLowerCase().includes("ops") || task.category.toLowerCase().includes("operations") || task.assignedToName.toLowerCase().includes("ops");
}
