-- CreateIndex
CREATE INDEX "agent_tasks_created_at_idx" ON "agent_tasks"("created_at");

-- CreateIndex
CREATE INDEX "customers_created_at_idx" ON "customers"("created_at");

-- CreateIndex
CREATE INDEX "customers_updated_at_idx" ON "customers"("updated_at");

-- CreateIndex
CREATE INDEX "tickets_created_at_idx" ON "tickets"("created_at");

-- CreateIndex
CREATE INDEX "tickets_updated_at_idx" ON "tickets"("updated_at");

-- CreateIndex
CREATE INDEX "users_full_name_idx" ON "users"("full_name");

-- CreateIndex
CREATE INDEX "users_last_login_at_idx" ON "users"("last_login_at");
