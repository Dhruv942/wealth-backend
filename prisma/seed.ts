import { Prisma, PrismaClient } from "@prisma/client";
import { buildSeedData } from "../src/seed-data";

const prisma = new PrismaClient();
const data = buildSeedData();

async function main() {
  for (const tenant of data.tenants) {
    await prisma.tenant.upsert({
      where: { id: tenant.id },
      update: { name: tenant.name, status: tenant.status },
      create: { ...tenant, createdAt: new Date(tenant.createdAt) },
    });
  }

  for (const user of data.users) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: user.tenantId, email: user.email } },
      update: { name: user.name, phone: user.phone, role: user.role, status: user.status, passwordHash: user.passwordHash },
      create: { ...user, createdAt: new Date(user.createdAt) },
    });
  }

  for (const membership of data.teamMemberships) {
    await prisma.teamMembership.upsert({
      where: {
        tenantId_managerUserId_memberUserId: {
          tenantId: membership.tenantId,
          managerUserId: membership.managerUserId,
          memberUserId: membership.memberUserId,
        },
      },
      update: {},
      create: membership,
    });
  }

  for (const client of data.clients) {
    await prisma.client.upsert({
      where: { id: client.id },
      update: {
        name: client.name,
        firmOrFamily: client.firmOrFamily,
        tier: client.tier,
        city: client.city,
        phone: client.phone,
        assignedRmId: client.assignedRmId,
        riskCategory: client.riskCategory,
        kycStatus: client.kycStatus,
        aumNumeric: client.aumNumeric,
      },
      create: { ...client, createdAt: new Date(client.createdAt) },
    });
  }

  for (const note of data.clientContextNotes) {
    await prisma.clientContextNote.upsert({
      where: { id: note.id },
      update: { note: note.note, source: note.source, updatedAt: new Date(note.updatedAt) },
      create: { ...note, updatedAt: new Date(note.updatedAt) },
    });
  }

  for (const moment of data.clientRelationshipMoments) {
    await prisma.clientRelationshipMoment.upsert({
      where: { id: moment.id },
      update: { date: new Date(moment.date), label: moment.label },
      create: { ...moment, date: new Date(moment.date) },
    });
  }

  for (const allocation of data.portfolioAllocations) {
    await prisma.portfolioAllocation.upsert({
      where: { clientId_allocationType: { clientId: allocation.clientId, allocationType: allocation.allocationType } },
      update: allocation,
      create: allocation,
    });
  }

  for (const holding of data.portfolioHoldings) {
    await prisma.portfolioHolding.upsert({ where: { id: holding.id }, update: holding, create: holding });
  }

  for (const opportunity of data.clientOpportunities) {
    await prisma.clientOpportunity.upsert({ where: { id: opportunity.id }, update: opportunity, create: opportunity });
  }

  for (const task of data.tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        title: task.title,
        details: task.details,
        category: task.category,
        priority: task.priority,
        status: task.status,
        assignedToUserId: task.assignedToUserId,
        assignedToName: task.assignedToName,
        slaDueAt: new Date(task.slaDueAt),
        slaStatus: task.slaStatus,
        source: task.source,
      },
      create: { ...task, slaDueAt: new Date(task.slaDueAt), createdAt: new Date(task.createdAt), updatedAt: new Date(task.updatedAt) },
    });
  }

  for (const log of data.auditLogs) {
    await prisma.auditLog.upsert({
      where: { id: log.id },
      update: {},
      create: { ...log, metadataJson: log.metadataJson as Prisma.InputJsonValue, createdAt: new Date(log.createdAt) },
    });
  }

  for (const houseView of data.houseViews) {
    await prisma.houseView.upsert({
      where: { id: houseView.id },
      update: {
        title: houseView.title,
        summary: houseView.summary,
        tags: houseView.tags,
        approvedBy: houseView.approvedBy,
        lastReviewedAt: houseView.lastReviewedAt ? new Date(houseView.lastReviewedAt) : null,
        status: houseView.status,
        version: houseView.version,
      },
      create: {
        ...houseView,
        lastReviewedAt: houseView.lastReviewedAt ? new Date(houseView.lastReviewedAt) : null,
        createdAt: new Date(houseView.createdAt),
      },
    });
  }

  for (const version of data.houseViewVersions) {
    await prisma.houseViewVersion.upsert({
      where: { id: version.id },
      update: { summary: version.summary, approvedBy: version.approvedBy, version: version.version, effectiveAt: new Date(version.effectiveAt) },
      create: { ...version, effectiveAt: new Date(version.effectiveAt) },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seeded K2 WealthDesk demo data");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
