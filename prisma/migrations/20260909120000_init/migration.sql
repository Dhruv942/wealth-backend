-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RM', 'MANAGER', 'OPS', 'ADMIN');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AllocationType" AS ENUM ('TARGET', 'CURRENT');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('Critical', 'Urgent', 'Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending_rm', 'in_progress', 'pending_ops', 'completed', 'blocked');

-- CreateEnum
CREATE TYPE "SlaStatus" AS ENUM ('on_track', 'near_breach', 'urgent', 'breached', 'completed');

-- CreateEnum
CREATE TYPE "CallNoteStatus" AS ENUM ('raw', 'synthesized', 'transcribed');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('draft', 'confirmed');

-- CreateEnum
CREATE TYPE "GeneratedTaskStatus" AS ENUM ('suggested', 'dispatched');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('pending', 'success', 'failed');

-- CreateEnum
CREATE TYPE "HouseViewStatus" AS ENUM ('draft', 'approved', 'archived');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_memberships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "manager_user_id" TEXT NOT NULL,
    "member_user_id" TEXT NOT NULL,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firm_or_family" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "assigned_rm_id" TEXT NOT NULL,
    "risk_category" TEXT NOT NULL,
    "kyc_status" TEXT NOT NULL,
    "aum_numeric" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_context_notes" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_context_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_relationship_moments" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "client_relationship_moments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_allocations" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "equity_pct" DOUBLE PRECISION NOT NULL,
    "debt_pct" DOUBLE PRECISION NOT NULL,
    "alternates_pct" DOUBLE PRECISION NOT NULL,
    "allocation_type" "AllocationType" NOT NULL,

    CONSTRAINT "portfolio_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_holdings" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL,
    "value_numeric" DOUBLE PRECISION NOT NULL,
    "value_display" TEXT NOT NULL,
    "return_display" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,

    CONSTRAINT "portfolio_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_opportunities" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "amount_numeric" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "client_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "assigned_to_user_id" TEXT NOT NULL,
    "assigned_to_name" TEXT NOT NULL,
    "sla_due_at" TIMESTAMP(3) NOT NULL,
    "sla_status" "SlaStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_status_history" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "old_status" "TaskStatus" NOT NULL,
    "new_status" "TaskStatus" NOT NULL,
    "changed_by_user_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignments_history" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "old_assignee_id" TEXT NOT NULL,
    "new_assignee_id" TEXT NOT NULL,
    "changed_by_user_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_assignments_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_notes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "rm_user_id" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "audio_file_id" TEXT,
    "status" "CallNoteStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_drafts" (
    "id" TEXT NOT NULL,
    "call_note_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "suitability_guardrail" TEXT NOT NULL,
    "crm_stage_update" TEXT NOT NULL,
    "review_status" "ReviewStatus" NOT NULL,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "crm_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_liquidity_signals" (
    "id" TEXT NOT NULL,
    "crm_draft_id" TEXT NOT NULL,
    "amount_numeric" DOUBLE PRECISION,
    "amount_display" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expected_date" TIMESTAMP(3),

    CONSTRAINT "crm_liquidity_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_generated_tasks" (
    "id" TEXT NOT NULL,
    "crm_draft_id" TEXT NOT NULL,
    "task_id" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL,
    "assigned_to_user_id" TEXT NOT NULL,
    "status" "GeneratedTaskStatus" NOT NULL,
    "idempotency_key" TEXT,

    CONSTRAINT "crm_generated_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_sync_records" (
    "id" TEXT NOT NULL,
    "crm_draft_id" TEXT NOT NULL,
    "external_crm" TEXT NOT NULL,
    "external_record_id" TEXT,
    "sync_status" "SyncStatus" NOT NULL,
    "error_message" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_sync_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_comm_drafts" (
    "id" TEXT NOT NULL,
    "crm_draft_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "copy_count" INTEGER NOT NULL DEFAULT 0,
    "opened_external_at" TIMESTAMP(3),

    CONSTRAINT "client_comm_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "client_id" TEXT,
    "task_id" TEXT,
    "crm_draft_id" TEXT,
    "detail" TEXT NOT NULL,
    "compliance_status" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suitability_checks" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "crm_draft_id" TEXT NOT NULL,
    "risk_category" TEXT NOT NULL,
    "recommendation_summary" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "flags_json" JSONB NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suitability_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "house_views" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "tags" TEXT[],
    "approved_by" TEXT,
    "last_reviewed_at" TIMESTAMP(3),
    "status" "HouseViewStatus" NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "house_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "house_view_versions" (
    "id" TEXT NOT NULL,
    "house_view_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "house_view_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "team_memberships_tenant_id_manager_user_id_member_user_id_key" ON "team_memberships"("tenant_id", "manager_user_id", "member_user_id");

-- CreateIndex
CREATE INDEX "clients_tenant_id_assigned_rm_id_idx" ON "clients"("tenant_id", "assigned_rm_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_allocations_client_id_allocation_type_key" ON "portfolio_allocations"("client_id", "allocation_type");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_client_id_idx" ON "tasks"("tenant_id", "client_id");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_assigned_to_user_id_idx" ON "tasks"("tenant_id", "assigned_to_user_id");

-- CreateIndex
CREATE INDEX "crm_drafts_tenant_id_client_id_idx" ON "crm_drafts"("tenant_id", "client_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_notes" ADD CONSTRAINT "call_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_views" ADD CONSTRAINT "house_views_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

