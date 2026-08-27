<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useDashboardStore } from '@/stores/dashboard';
import { useTasksStore } from '@/stores/tasks';
import { TICKET_SCOPES, type TicketScope } from '@/api/dashboard';
import type { DashboardBucket } from '@/api/dashboard';
import AppCard from '@/components/AppCard.vue';
import AppBadge from '@/components/AppBadge.vue';
import AppButton from '@/components/AppButton.vue';
import AppStateBlock from '@/components/AppStateBlock.vue';
import StatTile from '@/components/StatTile.vue';

const auth = useAuthStore();
const dashboard = useDashboardStore();
const tasks = useTasksStore();
const { t, d } = useI18n();

onMounted(() => {
  void dashboard.load();
});

function onScopeChange(event: Event): void {
  dashboard.setScope((event.target as HTMLSelectElement).value as TicketScope);
}

function refresh(): void {
  void dashboard.load();
}

async function completeTask(id: string): Promise<void> {
  await tasks.setStatus(id, 'DONE');
  await dashboard.load();
}

const STATUS_COLOR_VAR: Record<string, string> = {
  OPEN: '--color-status-open',
  IN_PROGRESS: '--color-status-in-progress',
  ON_HOLD: '--color-status-on-hold',
  RESOLVED: '--color-status-resolved',
  CLOSED: '--color-status-closed',
};

const PRIORITY_COLOR_VAR: Record<string, string> = {
  LOW: '--color-priority-low',
  MEDIUM: '--color-priority-medium',
  HIGH: '--color-priority-high',
  URGENT: '--color-priority-urgent',
};

function barStyle(bucket: DashboardBucket, buckets: DashboardBucket[], colorVar?: string): Record<string, string> {
  const total = buckets.reduce((sum, item) => sum + item.count, 0);
  const percent = (bucket.count / Math.max(1, total)) * 100;

  return {
    'inline-size': `${percent}%`,
    background: colorVar ? `var(${colorVar}, var(--color-accent))` : 'var(--color-accent)',
  };
}

function statusLabel(key: string): string {
  return t(`ticket.status.${key}`);
}

function priorityLabel(key: string): string {
  return t(`ticket.priority.${key}`);
}

function categoryLabel(key: string): string {
  return t(`ticket.category.${key}`);
}

const categoryOpacity = computed(() => {
  const total = dashboard.dashboard?.byCategory.reduce((sum, item) => sum + item.count, 0) ?? 0;

  return (bucket: DashboardBucket) => 0.25 + 0.75 * (bucket.count / Math.max(1, total));
});
</script>

<template>
  <section>
    <AppStateBlock v-if="dashboard.isLoading && !dashboard.dashboard" variant="loading" :message="t('common.loading')" />

    <AppStateBlock
      v-else-if="dashboard.error && !dashboard.dashboard"
      variant="error"
      :message="dashboard.error"
    />

    <template v-else-if="dashboard.dashboard">
      <header class="agent-dashboard__header">
        <div>
          <h1>{{ t('dashboard.greeting', { name: auth.user?.fullName }) }}</h1>
          <p class="agent-dashboard__generated">
            {{ t('dashboard.generatedAt', { time: d(new Date(dashboard.dashboard.generatedAt), 'long') }) }}
          </p>
        </div>

        <div class="agent-dashboard__controls">
          <label>
            {{ t('dashboard.scopeLabel') }}
            <select :value="dashboard.scope" @change="onScopeChange">
              <option v-for="scope in TICKET_SCOPES" :key="scope" :value="scope">
                {{ t(`dashboard.scope.${scope}`) }}
              </option>
            </select>
          </label>

          <AppButton variant="secondary" icon="clock" @click="refresh">{{ t('dashboard.refresh') }}</AppButton>
        </div>
      </header>

      <div class="agent-dashboard__tiles">
        <StatTile
          :label-key="'dashboard.stat.assigned'"
          :value="dashboard.dashboard.counts.assigned"
          icon="tickets"
          tone="accent"
          to="/workspace"
        />
        <StatTile
          :label-key="'dashboard.stat.open'"
          :value="dashboard.dashboard.counts.open"
          icon="status"
          tone="info"
          to="/tickets?status=OPEN"
        />
        <StatTile
          :label-key="'dashboard.stat.pending'"
          :value="dashboard.dashboard.counts.pending"
          icon="clock"
          tone="warn"
          to="/tickets?status=ON_HOLD"
        />
        <StatTile
          :label-key="'dashboard.stat.overdue'"
          :value="dashboard.dashboard.counts.overdue"
          icon="alert-triangle"
          :tone="dashboard.dashboard.counts.overdue > 0 ? 'error' : 'neutral'"
          to="/workspace"
        />
        <StatTile
          :label-key="'dashboard.stat.unassigned'"
          :value="dashboard.dashboard.counts.unassigned"
          icon="user-check"
          tone="neutral"
          to="/workspace"
        />
        <StatTile
          :label-key="'dashboard.stat.resolvedLast7Days'"
          :value="dashboard.dashboard.counts.resolvedLast7Days"
          icon="check"
          tone="ok"
        />
      </div>

      <div class="agent-dashboard__insights">
        <AppCard :title="t('dashboard.insight.status')">
          <dl class="agent-dashboard__bars">
            <div v-for="bucket in dashboard.dashboard.byStatus" :key="bucket.key" class="agent-dashboard__bar-row">
              <dt>{{ statusLabel(bucket.key) }}</dt>
              <dd>
                <span class="agent-dashboard__bar-track">
                  <span
                    class="agent-dashboard__bar-fill"
                    aria-hidden="true"
                    :style="barStyle(bucket, dashboard.dashboard.byStatus, STATUS_COLOR_VAR[bucket.key])"
                  />
                </span>
                <span class="agent-dashboard__bar-count">{{ bucket.count }}</span>
              </dd>
            </div>
          </dl>
        </AppCard>

        <AppCard :title="t('dashboard.insight.priority')">
          <dl class="agent-dashboard__bars">
            <div v-for="bucket in dashboard.dashboard.byPriority" :key="bucket.key" class="agent-dashboard__bar-row">
              <dt>{{ priorityLabel(bucket.key) }}</dt>
              <dd>
                <span class="agent-dashboard__bar-track">
                  <span
                    class="agent-dashboard__bar-fill"
                    aria-hidden="true"
                    :style="barStyle(bucket, dashboard.dashboard.byPriority, PRIORITY_COLOR_VAR[bucket.key])"
                  />
                </span>
                <span class="agent-dashboard__bar-count">{{ bucket.count }}</span>
              </dd>
            </div>
          </dl>
        </AppCard>

        <AppCard :title="t('dashboard.insight.category')">
          <dl class="agent-dashboard__bars">
            <div v-for="bucket in dashboard.dashboard.byCategory" :key="bucket.key" class="agent-dashboard__bar-row">
              <dt>{{ categoryLabel(bucket.key) }}</dt>
              <dd>
                <span class="agent-dashboard__bar-track">
                  <span
                    class="agent-dashboard__bar-fill"
                    aria-hidden="true"
                    :style="{
                      'inline-size': `${(bucket.count / Math.max(1, dashboard.dashboard.byCategory.reduce((sum, item) => sum + item.count, 0))) * 100}%`,
                      background: 'var(--color-accent)',
                      opacity: categoryOpacity(bucket),
                    }"
                  />
                </span>
                <span class="agent-dashboard__bar-count">{{ bucket.count }}</span>
              </dd>
            </div>
          </dl>
        </AppCard>
      </div>

      <div class="agent-dashboard__lists">
        <AppCard :title="t('dashboard.list.focus')">
          <AppStateBlock v-if="!dashboard.dashboard.focusTickets.length" variant="empty" :message="t('dashboard.empty.focus')" />
          <ul v-else class="agent-dashboard__ticket-list">
            <li v-for="ticket in dashboard.dashboard.focusTickets" :key="ticket.id">
              <RouterLink :to="`/workspace/${ticket.id}`">{{ ticket.subject }}</RouterLink>
              <RouterLink :to="`/customers/${ticket.customer.id}`" class="agent-dashboard__customer">
                {{ ticket.customer.name }}
              </RouterLink>
              <AppBadge :status="ticket.status" />
              <AppBadge :priority="ticket.priority" />
              <span class="agent-dashboard__updated">{{ d(new Date(ticket.updatedAt), 'long') }}</span>
            </li>
          </ul>
          <template #footer>
            {{ t('common.showingOfTotal', { shown: dashboard.dashboard.focusTickets.length, total: dashboard.dashboard.counts.assigned }) }}
          </template>
        </AppCard>

        <AppCard :title="t('dashboard.list.overdue')">
          <AppStateBlock v-if="!dashboard.dashboard.overdueTickets.length" variant="empty" :message="t('dashboard.empty.overdue')" />
          <ul v-else class="agent-dashboard__ticket-list">
            <li v-for="ticket in dashboard.dashboard.overdueTickets" :key="ticket.id">
              <RouterLink :to="`/workspace/${ticket.id}`">{{ ticket.subject }}</RouterLink>
              <RouterLink :to="`/customers/${ticket.customer.id}`" class="agent-dashboard__customer">
                {{ ticket.customer.name }}
              </RouterLink>
              <AppBadge :status="ticket.status" />
              <AppBadge :priority="ticket.priority" />
              <span class="agent-dashboard__updated">{{ d(new Date(ticket.updatedAt), 'long') }}</span>
            </li>
          </ul>
          <template #footer>
            {{ t('common.showingOfTotal', { shown: dashboard.dashboard.overdueTickets.length, total: dashboard.dashboard.counts.overdue }) }}
          </template>
        </AppCard>

        <AppCard :title="t('dashboard.list.unassigned')">
          <AppStateBlock v-if="!dashboard.dashboard.unassignedTickets.length" variant="empty" :message="t('dashboard.empty.unassigned')" />
          <ul v-else class="agent-dashboard__ticket-list">
            <li v-for="ticket in dashboard.dashboard.unassignedTickets" :key="ticket.id">
              <RouterLink :to="`/workspace/${ticket.id}`">{{ ticket.subject }}</RouterLink>
              <RouterLink :to="`/customers/${ticket.customer.id}`" class="agent-dashboard__customer">
                {{ ticket.customer.name }}
              </RouterLink>
              <AppBadge :status="ticket.status" />
              <AppBadge :priority="ticket.priority" />
              <span class="agent-dashboard__updated">{{ d(new Date(ticket.updatedAt), 'long') }}</span>
            </li>
          </ul>
          <template #footer>
            {{ t('common.showingOfTotal', { shown: dashboard.dashboard.unassignedTickets.length, total: dashboard.dashboard.counts.unassigned }) }}
          </template>
        </AppCard>
      </div>

      <AppCard v-if="auth.can('tasks:read')" :title="t('dashboard.list.tasksDue')" class="agent-dashboard__tasks">
        <AppStateBlock v-if="!dashboard.dashboard.tasksDueSoon.length" variant="empty" :message="t('dashboard.empty.tasksDue')" />
        <ul v-else class="agent-dashboard__task-list">
          <li v-for="task in dashboard.dashboard.tasksDueSoon" :key="task.id">
            <span>{{ task.title }}</span>
            <AppBadge v-if="task.isOverdue" tone="error">{{ t('task.overdue') }}</AppBadge>
            <RouterLink v-if="task.ticketId" :to="`/workspace/${task.ticketId}`">{{ t('task.linkedTicket') }}</RouterLink>
            <AppButton variant="ghost" size="sm" icon="check" @click="completeTask(task.id)">{{ t('task.complete') }}</AppButton>
          </li>
        </ul>
      </AppCard>
    </template>
  </section>
</template>

<style scoped>
.agent-dashboard__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-block-end: var(--space-5);
  flex-wrap: wrap;
}

.agent-dashboard__generated {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.agent-dashboard__controls {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
}

.agent-dashboard__controls label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.agent-dashboard__tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: var(--space-4);
  margin-block-end: var(--space-5);
}

.agent-dashboard__insights,
.agent-dashboard__lists {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: var(--space-4);
  margin-block-end: var(--space-5);
}

.agent-dashboard__bars {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.agent-dashboard__bar-row dt {
  font-size: var(--font-size-sm);
  margin-block-end: var(--space-1);
}

.agent-dashboard__bar-row dd {
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.agent-dashboard__bar-track {
  flex: 1;
  block-size: 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--color-surface-sunken);
  overflow: hidden;
}

.agent-dashboard__bar-fill {
  display: block;
  block-size: 100%;
  border-radius: var(--radius-pill);
}

.agent-dashboard__bar-count {
  min-inline-size: 2ch;
  text-align: end;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.agent-dashboard__ticket-list,
.agent-dashboard__task-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.agent-dashboard__ticket-list li,
.agent-dashboard__task-list li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding-block-end: var(--space-2);
  border-block-end: 1px solid var(--color-border);
}

.agent-dashboard__customer,
.agent-dashboard__updated {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.agent-dashboard__tasks {
  margin-block-end: var(--space-5);
}
</style>
