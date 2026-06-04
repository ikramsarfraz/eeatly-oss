ALTER TABLE "meal_logs" DROP CONSTRAINT "meal_logs_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "meals" DROP CONSTRAINT "meals_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "tenant_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenants" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "tenant_members" CASCADE;--> statement-breakpoint
DROP TABLE "tenants" CASCADE;--> statement-breakpoint
DROP INDEX "meal_logs_tenant_idx";--> statement-breakpoint
DROP INDEX "meals_tenant_idx";--> statement-breakpoint
ALTER TABLE "meal_logs" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "meals" DROP COLUMN "tenant_id";--> statement-breakpoint
DROP TYPE "public"."tenant_role";
