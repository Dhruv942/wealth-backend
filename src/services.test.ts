import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "./in-memory-repository.js";
import { assignTask, listAuditLogs, listTeamUsers } from "./services.js";
import type { AuthUser } from "./domain.js";

const tenantId = "tenant_k2";

const manager: AuthUser = {
  id: "rm-3",
  tenantId,
  name: "Vikram Mehta",
  email: "manager@k2wealth.com",
  role: "MANAGER",
};

const rahul: AuthUser = {
  id: "rm-1",
  tenantId,
  name: "Rahul Sharma",
  email: "rahul@firm.com",
  role: "RM",
};

describe("task assignment authorization", () => {
  it("includes Central Ops in Vikram's team list for workload balancing", async () => {
    const repo = new InMemoryRepository();

    const team = await listTeamUsers(repo, manager);

    expect(team.map((member) => member.id)).toEqual(expect.arrayContaining(["rm-1", "rm-2", "ops-1"]));
  });

  it("allows Vikram to reassign a Rahul task to Priya and records a governance audit event", async () => {
    const repo = new InMemoryRepository();

    const updated = await assignTask(repo, manager, "task-104", "rm-2");
    const logs = await listAuditLogs(repo, manager, { taskId: "task-104" });

    expect(updated.assignedToUserId).toBe("rm-2");
    expect(updated.assignedToName).toBe("Priya Nair");
    expect(updated.status).toBe("pending_rm");
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "task.reassigned",
          actorUserId: "rm-3",
          taskId: "task-104",
          detail: "Task reassigned from Rahul Sharma to Priya Nair",
        }),
      ]),
    );
  });

  it("blocks Rahul from reassigning his task to a peer RM", async () => {
    const repo = new InMemoryRepository();

    await expect(assignTask(repo, rahul, "task-104", "rm-2")).rejects.toMatchObject({
      message: "RM can only hand off to Ops",
      statusCode: 403,
    });
  });
});
