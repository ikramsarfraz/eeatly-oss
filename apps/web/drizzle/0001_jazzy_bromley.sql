CREATE INDEX "meal_logs_user_meal_cooked_at_idx" ON "meal_logs" USING btree ("user_id","meal_id","cooked_at");--> statement-breakpoint
CREATE INDEX "meal_logs_user_effort_idx" ON "meal_logs" USING btree ("user_id","effort_level");--> statement-breakpoint
CREATE INDEX "meals_user_updated_at_idx" ON "meals" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "meals_user_archived_at_idx" ON "meals" USING btree ("user_id","archived_at");