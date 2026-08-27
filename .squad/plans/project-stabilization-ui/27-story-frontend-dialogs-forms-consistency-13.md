# Story 27 — Frontend: confirmation dialogs, form-control consistency, and the accessibility sweep (Story: 13)

## Prerequisites

- [Story 26 completed](26-story-frontend-table-shell-sorting-page-size-13.md): `.data-table`, `.filter-bar`, `AppSortHeader`, and the page-size select are in place. This story styles the **controls inside** those screens, so it must land after the shell.
- [Story 25 completed](25-story-backend-list-sorting-indexes-dev-seed-13.md), for the dev accounts used in manual verification.
- Both dev servers running.
- **No backend change is permitted in this story.** `apps/api/` is untouched — a checkable claim.
- **No new npm dependency.** `AppModal.vue` already implements focus trapping, `Escape`, and focus restoration; this story consumes it rather than reaching for a dialog library.

---

## Story Goal

The three remaining UI-consistency gaps the review found, all of which the acceptance criteria name explicitly:

1. **Form controls are almost entirely unstyled.** A grep for input, select, and textarea styling across `apps/web/src/**/*.vue` returns exactly **two** hits: `LoginView.vue:117` and `ReassignControl.vue:127`. Every other text field, dropdown, checkbox, and textarea in the application — the customer form, the ticket form, all four user panels, every filter bar, the interaction composer — renders at browser default, next to fully tokenised buttons and cards. This is the single largest visual inconsistency in the app and the cheapest to fix: one global rule set.
2. **`window.confirm` in nine places.** `CommunicationTimeline.vue:288`, `AgentWorkspaceView.vue:155` and `192`, `CustomerDetailView.vue:102` and `133`, `TasksView.vue:53`, `TicketDetailView.vue:87` and `122`, `UsersView.vue:191`. Story 20 Product rule 16 deliberately kept them; work item 13 explicitly asks for improved confirmation dialogs, so that decision is now reversed with a real dialog built on the existing `AppModal`.
3. **`UsersView.vue`'s four inline panels, and a real bug inside them.** `openEdit` (109), `openRoles` (141), and `openReset` (167) each set only their own ref and clear nothing else. Two panels can therefore be open at once, and all four bind the same `users.error` — so a failed create leaves its error message visible inside the edit panel of a different user. They also render below the table with no focus management, unlike `TaskFormModal.vue`, which does it correctly through `AppModal`.

Alongside these: the **48 bare `<button>` elements** across ten files (13 in `UsersView.vue`, 8 each in `AgentWorkspaceView.vue`, `CustomerDetailView.vue`, `TicketDetailView.vue`) become `AppButton`, so row actions and form actions look the same everywhere.

**Not in scope:** the login page ([Story 28](28-story-login-test-user-picker-13.md)); documentation ([Story 29](29-story-documentation-handover-verification-13.md)); tables, sorting, and pagination (Story 26 — done); any new route, screen, store, or API call; client-side field-level validation (the API remains the authority — see Product rule 7); a form library; toast notifications; dark mode.

---

## Context — Read These Files First

1. `apps/web/src/components/AppModal.vue` — read the **whole file.** Props `open` and `titleKey` at 6–9; `emit('update:open')` at 11; `titleId` from `useId()` at 15; `FOCUSABLE_SELECTOR` at 19–20; `focusableElements()` 22–28; `close()` 30–32; the `onKeydown` handler 34–62, which stops `Escape` propagation and implements the Tab/Shift-Tab wrap. Read the rest for the `previouslyFocused` restore and the overlay markup. **This component already satisfies the accessibility requirements for a dialog** — the new confirm dialog wraps it and adds nothing of its own.
2. `apps/web/src/components/AppModal.spec.ts` — 7 tests. Read them before writing the confirm dialog's spec; the mounting pattern and the `Escape` assertion are the model to follow.
3. `apps/web/src/components/TaskFormModal.vue` — the **whole file.** The one correct dialog in the app: `AppModal` at **116** with `:title-key` chosen by `isEdit`, the `role="alert"` error at **118**, the form body, and the action row before `</AppModal>` at 164. `v-model:open` is how `TasksView.vue:213` drives it. Every panel converted in task 5 ends up looking like this.
4. `apps/web/src/components/AppButton.vue` — props at **6–28**: `variant` (`primary` | `secondary` | `ghost` | `danger`), `size` (`sm` | `md`), `icon`, `iconOnly`, `loading`, `disabled`, `type` (**defaults to `'button'`** — read the comment at 13–14 explaining why), `ariaLabel`. The DEV-only warning at 30–34 fires when `iconOnly` is set without an `ariaLabel`; every icon-only conversion must supply one or it will log on every render.
5. `apps/web/src/views/UsersView.vue` — the **whole file, 514 lines.** `roleNames` 22, `isOwnRow` 28, the filter handlers 53–60, `onPageChange` 62. Then the four panel state machines: create (`showCreateForm` **68**, `openCreate` **77**, `cancelCreate` **86**, `submitCreate` **90–102**), edit (`editingUser` **106**, `openEdit` **109–114**, `cancelEdit` **116**, `submitEdit` **120–136**), roles (`rolesEditingUser` **138**, `openRoles` **141–144**, `cancelRoles` **146**, `submitRoles` **150–162**), reset (`resettingUser` **164**, `openReset` **167–170**, `cancelReset` **172**, `submitReset` **176–188**), then `deactivate` **190** and `reactivate` **196**. The four panel templates are at **241–279** (create), **357–384** (edit), **387–402** (roles), **404–424** (reset). Note all four render `<div v-if="…" role="alert" class="users__error">{{ users.error }}</div>` — at lines **244**, **360**, **390**, **408** — bound to the same store ref. That is the bug in Story Goal 3.
6. `apps/web/src/views/TasksView.vue` — 215 lines. `remove()` at **52–56** holds the `window.confirm(t('task.confirmDelete'))` at **53**; the three bare row-action buttons are at **139–144**. `toggleComplete` at 47. `TaskFormModal` is already wired at 213 — this view is the reference for how a converted `UsersView` should look.
7. `apps/web/src/views/CustomerDetailView.vue` — 433 lines. `window.confirm` at **102** (delete note) and **133** (delete attachment, with a `{ fileName }` interpolation). Eight bare buttons.
8. `apps/web/src/views/TicketDetailView.vue` — 464 lines. `window.confirm` at **87** (delete comment) and **122** (delete attachment). Eight bare buttons.
9. `apps/web/src/views/AgentWorkspaceView.vue` — 658 lines, the largest file in the repo. `window.confirm` at **155** and **192**, both guarded by `ticketId.value &&` — **preserve that guard exactly**; it is not redundant.
10. `apps/web/src/components/CommunicationTimeline.vue` — `window.confirm(t('customer.detail.deleteInteractionConfirm'))` at **288**. This is a shared component used by three screens (ticket-scoped, customer-scoped, unscoped — see Story 24), so a change here shows up in all three. Its spec has **33 tests**.
11. `apps/web/src/views/CustomerFormView.vue` (246 lines, `role="alert"` at **126**, 2 bare buttons) and `apps/web/src/views/TicketFormView.vue` (210 lines, `role="alert"` at **99**, 2 bare buttons) — the two dedicated form screens. Their inputs are entirely unstyled today; task 1 fixes them without either file being edited, which is the point of doing it globally.
12. `apps/web/src/assets/main.css` — the **whole file** as Story 26 left it. `:root` 1–95; `*:focus-visible` 115–118 (a focus ring already applies to every control, including the unstyled ones); `.sr-only` 120–130; Story 26's `.data-table`/`.filter-bar` block; the `prefers-reduced-motion` block last. Task 1's rules go beside Story 26's. Tokens available: `--color-surface`, `--color-border`, `--color-border-strong`, `--color-text`, `--color-text-muted`, `--color-error`, `--color-error-soft`, `--radius`, `--radius-sm`, `--space-*`, `--font-size-sm`.
13. `apps/web/src/i18n/locales/en.json` / `ar.json` — the `common` block already has `confirm`, `cancel`, `delete`, `save`, `close`, `yes`, `no`, `dismiss`. The nine confirmation message keys **already exist** (`customer.detail.deleteNoteConfirm`, `customer.detail.deleteAttachmentConfirm`, `customer.detail.deleteInteractionConfirm`, `ticket.detail.deleteCommentConfirm`, `ticket.detail.deleteAttachmentConfirm`, `task.confirmDelete`, `user.action.deactivateConfirm`) — **reuse them, do not write new message text.** Only the dialog's title and button labels need new keys.
14. `apps/web/src/views/UsersView.spec.ts` (11 tests), `CustomerDetailView.spec.ts` (14), `TicketDetailView.spec.ts` (15), `TasksView.spec.ts` (8), `AgentWorkspaceView.spec.ts` (11), `CommunicationTimeline.spec.ts` (33) — **92 tests across the six files this story edits.** Read how each currently asserts the confirm path; several stub `window.confirm`. Those stubs become interactions with the new dialog, and the assertions are **rewritten to be equivalent, never weakened**.

---

## Product rules (from story)

| # | Rule | Rationale |
|---|------|-----------|
| 1 | **Form controls are styled globally in `main.css`, by element selector, not by a utility class or a wrapper component.** | Two files style controls today and roughly a dozen do not. A class-based fix requires touching every one of those files and stays broken the moment somebody adds the thirteenth. An element-level rule set fixes every existing control and every future one in one edit, which is why this is worth doing globally even though the repo otherwise prefers scoped styles. |
| 2 | **`LoginView.vue:117` and `ReassignControl.vue:127` keep their local rules**, which now sit on top of the global base. | Story 28 rewrites the login card and needs its own field styling; `ReassignControl`'s select is inline in a table cell and is deliberately narrower. Deleting the two local rules to prove a point would regress both. |
| 3 | **`window.confirm` is replaced everywhere, in one story, or not at all.** Nine sites, one component. | Two confirmation mechanisms is worse than one bad one: a user who has learned that Delete opens a dialog will click through the native one without reading it. Story 20 Product rule 16 kept `window.confirm` precisely to avoid a partial migration; the way to reverse that decision is completely. |
| 4 | **The confirm dialog is a single always-mounted instance per view, driven by a `pending` ref — not a component instantiated per destructive control.** | `UsersView` has up to five destructive controls per row across an unbounded number of rows. One dialog whose state is `{ messageKey, params, onConfirm }` is O(1) markup; one per button is O(rows × buttons). |
| 5 | **The confirm dialog reuses the nine existing message keys unchanged.** Only `common.confirmDialog.title` and the two button labels are new. | The nine strings are already translated in both catalogues and already carry their `{ fileName }` / `{ name }` interpolations. Rewriting them would double the review surface and risk an `en`/`ar` drift for no user-visible gain. |
| 6 | **The destructive action's button is `variant="danger"`, and so is the dialog's confirm button.** Cancel is `variant="secondary"` and is the **initially focused** control. | `AppModal` focuses the first focusable element; ordering Cancel before Confirm in the DOM means an accidental Enter cancels rather than deletes. That is the one design decision in a confirm dialog that actually prevents data loss. |
| 7 | **No client-side field-level validation is added.** The API stays the authority; the existing `role="alert"` blocks bound to `store.error` remain the error surface. What changes is only that they are **styled consistently** and that a stale one cannot leak between dialogs (rule 8). | `main.ts:27–34` validates every payload with `whitelist` + `forbidNonWhitelisted`, and `toErrorMessage` already surfaces the message. Duplicating those rules in the browser creates two sources of truth that drift. Recorded so a reviewer does not read the absence as an oversight. Native `required` and `type="email"` attributes already present are kept. |
| 8 | **Opening any dialog clears `store.error` first, and only one dialog per view can be open at a time.** | This is the fix for the real bug at `UsersView.vue:244/360/390/408`: four panels bind one `users.error`, and `openEdit`/`openRoles`/`openReset` clear neither the other panels nor the error. Today a failed create shows its message inside a different user's edit form. |
| 9 | **Every bare `<button>` becomes `AppButton`; every icon-only one gets an `ariaLabel`.** | `AppButton.vue:30–34` logs a DEV warning for `iconOnly` without a label, so this is enforced at runtime already. 48 bare buttons is why row actions look different on every screen. |
| 10 | **Behaviour is preserved exactly, including guards that look redundant.** `AgentWorkspaceView.vue:155` and `192` keep their `ticketId.value &&` check; `TasksView.vue`'s `remove` keeps its early return; every permission `v-if` stays. | The acceptance criteria demand no regression across US01–06. The 92 tests in the six edited spec files are the enforcement, and none of their assertions may be weakened — a confirm-path test becomes "open the dialog, click Confirm, assert the same store call", not a deleted test. |
| 11 | **`CommunicationTimeline.vue` is shared by three screens; its conversion is verified on all three.** | Story 24 made it ticket-scoped, customer-scoped, or unscoped. A dialog that works in the ticket panel and traps focus wrongly in the unscoped feed is one screen's bug reported as another's. |
| 12 | **No new browser-storage key.** `crm.locale` remains the only one. | Carried forward from Stories 20 and 22. A "don't ask me again" checkbox on a delete confirmation is exactly the feature that would break this, and it is not requested. |

---

## Frontend Tasks

### 1 — Global form-control styling

**File: `apps/web/src/assets/main.css`** — add after Story 26's `.filter-bar` rules, before the `prefers-reduced-motion` block.

```css
/* --- Form controls -----------------------------------------------------------
 * Element selectors, not a utility class (Product rule 1): before this rule set
 * exactly two files in the app styled a control — LoginView and
 * ReassignControl — and every other input, select, and textarea rendered at
 * browser default next to fully tokenised buttons and cards. */
input[type='text'],
input[type='email'],
input[type='password'],
input[type='search'],
input[type='tel'],
input[type='url'],
input[type='number'],
input[type='date'],
input[type='datetime-local'],
select,
textarea {
  inline-size: 100%;
  min-block-size: 2.25rem;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
}

textarea {
  min-block-size: 5rem;
  resize: vertical;
}

input:hover:not(:disabled),
select:hover:not(:disabled),
textarea:hover:not(:disabled) {
  border-color: var(--color-accent);
}

input:disabled,
select:disabled,
textarea:disabled {
  background: var(--color-surface-sunken);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

/* The browser's default invalid styling is a red glow in one engine and nothing
 * in another. :user-invalid (not :invalid) fires only after the user has
 * actually interacted, so an untouched required field is not painted as an
 * error the moment the form renders. */
input:user-invalid,
textarea:user-invalid {
  border-color: var(--color-error);
}

input[type='checkbox'],
input[type='radio'] {
  inline-size: auto;
  min-block-size: auto;
  accent-color: var(--color-accent);
}

fieldset {
  margin: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

legend {
  padding-inline: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
}

/* One error surface, shared by every store-error block in the app. Replaces
 * seven near-identical scoped rules. */
.form-error {
  padding: var(--space-3);
  border: 1px solid var(--color-error);
  border-radius: var(--radius);
  background: var(--color-error-soft);
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

.form-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-block-start: var(--space-2);
}
```

`inline-size: 100%` on the base rule is why `input[type='checkbox']` needs the explicit `auto` override — a full-width checkbox is the most common way this rule set goes wrong. Verify every checkbox in `UsersView.vue`'s role fieldsets after this change.

The existing `*:focus-visible` rule at `main.css:115–118` already gives every one of these controls a focus ring; do not add a second one.

### 2 — `AppConfirmDialog.vue`

**Create file: `apps/web/src/components/AppConfirmDialog.vue`**

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AppModal from './AppModal.vue';
import AppButton from './AppButton.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** An existing i18n key — the nine confirmation strings are already
     *  translated in both catalogues (Product rule 5). */
    messageKey: string;
    messageParams?: Record<string, unknown>;
    confirmLabelKey?: string;
    busy?: boolean;
  }>(),
  { messageParams: undefined, confirmLabelKey: 'common.delete', busy: false },
);

const emit = defineEmits<{ 'update:open': [boolean]; confirm: [] }>();

const { t } = useI18n();
</script>

<template>
  <AppModal :open="open" title-key="common.confirmDialog.title" @update:open="emit('update:open', $event)">
    <p class="app-confirm__message">{{ t(messageKey, messageParams ?? {}) }}</p>

    <div class="form-actions">
      <!-- Cancel FIRST in the DOM: AppModal focuses the first focusable
           element, so an accidental Enter cancels rather than deletes
           (Product rule 6). -->
      <AppButton variant="secondary" @click="emit('update:open', false)">
        {{ t('common.cancel') }}
      </AppButton>
      <AppButton variant="danger" :loading="busy" @click="emit('confirm')">
        {{ t(confirmLabelKey) }}
      </AppButton>
    </div>
  </AppModal>
</template>

<style scoped>
.app-confirm__message {
  margin: 0 0 var(--space-4);
  line-height: var(--line-height-body);
}
</style>
```

The component holds **no** state and performs **no** action. It emits `confirm`; the view decides what that means and closes the dialog. That is what keeps one instance reusable across five different destructive actions in `UsersView`.

### 3 — Translation keys

**Files: `apps/web/src/i18n/locales/en.json` and `ar.json`** — add to the `common` block in **both**. `i18n.spec.ts:39–47` fails on any asymmetry.

`en.json`:

```json
    "confirmDialog": { "title": "Please confirm" },
```

`ar.json`:

```json
    "confirmDialog": { "title": "يرجى التأكيد" },
```

That is the **only** new string. The nine message keys and `common.cancel` / `common.delete` all already exist.

### 4 — Replace the nine `window.confirm` calls

The same pattern in each file. Using `TasksView.vue` as the worked example — `remove()` at **52–56**:

```ts
// --- destructive confirmation -------------------------------------------

const pendingDelete = ref<AgentTask | null>(null);

function requestDelete(task: AgentTask): void {
  // Product rule 8: never open a dialog on top of a stale error.
  tasks.error = null;
  pendingDelete.value = task;
}

async function confirmDelete(): Promise<void> {
  const task = pendingDelete.value;

  if (!task) {
    return;
  }

  pendingDelete.value = null;
  await tasks.remove(task.id);
}
```

The row button at **141** changes from `@click="remove(task)"` to `@click="requestDelete(task)"`, and one dialog is added at the end of the template, beside the existing `TaskFormModal` at 213:

```vue
    <AppConfirmDialog
      :open="pendingDelete !== null"
      message-key="task.confirmDelete"
      @update:open="pendingDelete = null"
      @confirm="confirmDelete"
    />
```

Apply the same shape to the other eight, reusing each site's existing message key and interpolation:

| File | Line | Message key | Params |
|---|---|---|---|
| `TasksView.vue` | 53 | `task.confirmDelete` | — |
| `UsersView.vue` | 191 | `user.action.deactivateConfirm` | `{ name: user.fullName }` |
| `CustomerDetailView.vue` | 102 | `customer.detail.deleteNoteConfirm` | — |
| `CustomerDetailView.vue` | 133 | `customer.detail.deleteAttachmentConfirm` | `{ fileName: attachment.fileName }` |
| `TicketDetailView.vue` | 87 | `ticket.detail.deleteCommentConfirm` | — |
| `TicketDetailView.vue` | 122 | `ticket.detail.deleteAttachmentConfirm` | `{ fileName: attachment.fileName }` |
| `AgentWorkspaceView.vue` | 155 | `ticket.detail.deleteCommentConfirm` | — |
| `AgentWorkspaceView.vue` | 192 | `ticket.detail.deleteAttachmentConfirm` | `{ fileName: attachment.fileName }` |
| `CommunicationTimeline.vue` | 288 | `customer.detail.deleteInteractionConfirm` | — |

Two files hold **two** destructive actions each (`CustomerDetailView`, `TicketDetailView`, `AgentWorkspaceView`). Use **one** dialog instance per view with a discriminated pending ref rather than two dialogs:

```ts
type PendingDelete =
  | { kind: 'comment'; id: string }
  | { kind: 'attachment'; id: string; fileName: string };

const pendingDelete = ref<PendingDelete | null>(null);
```

…and derive `messageKey` and `messageParams` from `pendingDelete.value.kind` with a `computed`. Product rule 4.

**`AgentWorkspaceView.vue` 155 and 192 keep their `ticketId.value &&` guard** — move it into the `request…` function, do not drop it (Product rule 10).

After this task, `grep -rn "window.confirm" apps/web/src` must return **zero** hits outside spec files.

### 5 — `UsersView.vue`: four panels become modals, and the shared-error bug is fixed

**File: `apps/web/src/views/UsersView.vue`**

Convert each of the four `users__panel` blocks — **241–279** (create), **357–384** (edit), **387–402** (roles), **404–424** (reset) — into an `AppModal`, matching `TaskFormModal.vue`'s shape:

```vue
    <AppModal :open="showCreateForm" title-key="user.form.createTitle" @update:open="cancelCreate">
      <form @submit.prevent="submitCreate">
        <div v-if="users.error" role="alert" class="form-error">{{ users.error }}</div>
        <!-- the existing labels, selects, and fieldset, unchanged -->
        <div class="form-actions">
          <AppButton type="submit" variant="primary" :disabled="createForm.roleKeys.length === 0">
            {{ t('common.save') }}
          </AppButton>
          <AppButton variant="secondary" @click="cancelCreate">{{ t('common.cancel') }}</AppButton>
        </div>
      </form>
    </AppModal>
```

Keep every field, every `v-model`, the `:disabled="createForm.roleKeys.length === 0"` guard at 276, the `fieldset`/`legend`, and the `users__checkbox` labels exactly as they are.

`AppModal`'s `titleKey` prop takes a key, not a rendered string, so the three titles that interpolate a name — `user.form.editTitle` (358), `user.form.rolesTitle` (388), `user.form.resetTitle` (405) — cannot pass through it as-is. **Do not** change `AppModal` to accept a params object. Instead render the interpolated heading as the first element of the modal body and pass the generic key as the title:

```vue
    <AppModal :open="editingUser !== null" title-key="user.form.editTitle" @update:open="cancelEdit">
      <p class="users__modal-subject">{{ editingUser?.fullName }}</p>
```

This keeps `AppModal`'s 7 passing tests untouched and keeps the user's name visible.

Then fix the state machine. Add one helper and call it at the top of all four `open…` functions (**77**, **109**, **141**, **167**):

```ts
/** Product rule 8. Two bugs in one line: four panels bound the same
 *  users.error, so a failed create surfaced inside a different user's edit
 *  form; and openEdit/openRoles/openReset cleared none of the others, so two
 *  panels could be open at once. */
function closeAllPanels(): void {
  showCreateForm.value = false;
  editingUser.value = null;
  rolesEditingUser.value = null;
  resettingUser.value = null;
  users.error = null;
}
```

`openCreate` (77) already sets `showCreateForm.value = false` on some path — read it before editing and preserve its form-reset behaviour; the helper runs **first**, then the function sets its own ref.

Finally, convert the **13 bare buttons** in this file to `AppButton`: the five row actions at **321–338** become `size="sm"`, `variant="ghost"`, with `variant="danger"` on Deactivate; the form-action pairs in each modal become `variant="primary"` for submit and `variant="secondary"` for cancel. Wrap the row-action `<td>` in `class="data-table__actions"` (Story 26 already provides it) and delete the now-dead `.users__actions`, `.users__panel`, `.users__panel form`, `.users__panel label`, `.users__panel-actions`, and `.users__error` scoped rules (478–512).

### 6 — Remaining bare buttons and error blocks

Convert to `AppButton`, matching the variants established above:

- `AgentWorkspaceView.vue` — 8 buttons
- `CustomerDetailView.vue` — 8 buttons
- `TicketDetailView.vue` — 8 buttons
- `TasksView.vue` — 3 row-action buttons at **139–144**
- `CustomerFormView.vue` — 2
- `TicketFormView.vue` — 2
- `SystemStatusView.vue` — 1 (the retry control)

Leave the two inside `AppButton.vue` itself and the one inside `AppTabs.vue` alone — those are the primitives.

Replace each view's local error-block class with the shared `.form-error` and delete the scoped rule: `CustomerFormView.vue:126` (`customer-form__error`), `TicketFormView.vue:99` (`ticket-form__error`), `SystemStatusView.vue:25` (`status__error`), `TaskFormModal.vue:118` (`task-form-modal__error`), `ReassignControl.vue:115` (`reassign-control__error`), and the four in `UsersView.vue`. **Leave `LoginView.vue:46`'s `login__error` alone** — Story 28 owns that file.

Keep every `role="alert"` attribute. That is the part a screen reader depends on.

---

## Edge Cases & Failure Modes

- **Enter pressed with the confirm dialog open** → Cancel is first in the DOM and therefore focused by `AppModal`, so Enter cancels. Assert this explicitly; it is the rule most likely to be lost in a later refactor that reorders the buttons for visual reasons.
- **`Escape` with the confirm dialog open** → `AppModal.onKeydown` (34–41) closes it and calls `event.stopPropagation()`. In `AppLayout.vue:80–84` a window-level `Escape` handler closes the nav drawer; `stopPropagation` is what stops one keypress from doing both. Verify on a narrow screen with the drawer open **and** a dialog open.
- **A delete that fails server-side** → the view closes the dialog and the store sets `error`; the message renders in the screen's existing `role="alert"` block, now styled by `.form-error`. The dialog does **not** stay open showing the error — closing on submit and surfacing the failure in the page is the existing behaviour of every mutation in the app, and diverging here would be the inconsistency.
- **A delete confirmed twice by double-clicking Confirm** → `pendingDelete.value = null` runs **before** the `await`, so the second click sees `null` and returns early. Order matters; assert it.
- **Deleting an attachment whose `fileName` contains an interpolation-looking string** (`{name}`) → `vue-i18n` interpolates only from the params object, so a literal `{name}` in a filename renders verbatim. Unchanged from the `window.confirm` behaviour, but worth one test since the string now goes through a template rather than a native dialog.
- **Unicode / RTL filenames in the confirm message** → the message renders inside the app's `dir`, so an Arabic filename in an English UI can display with mixed-direction runs. The existing table cells wrap identifiers in `<span dir="ltr">` (`CustomersView.vue:132–133`); do the same for the filename in the confirm message if it renders ambiguously.
- **`UsersView`: clicking Roles while the Edit modal is open** → `closeAllPanels()` closes Edit, clears `users.error`, then Roles opens. Before this story both were open simultaneously with a shared error. This is the bug fix; give it a test.
- **`UsersView`: a create fails, then the user opens Edit on a different row** → the edit modal opens with **no** error message. Before this story it opened showing the create failure. This is the second half of the same bug; give it its own test.
- **`input[type='checkbox']` under the new global rule** → the base rule sets `inline-size: 100%`, which would stretch a checkbox across its container; the explicit `inline-size: auto` override handles it. Check the role checkboxes in `UsersView`'s create and roles modals and the `overdueOnly` checkbox in `TasksView`.
- **`:user-invalid`** → supported in all current evergreen browsers; where it is not, the rule is simply ignored and the field looks normal. It is chosen over `:invalid` so a required field is not painted red before the user has touched it.
- **`select` inside a narrow table cell** → `ReassignControl.vue:127` keeps its local width rule, which now overrides the global `inline-size: 100%`. Verify the reassign control in a ticket row does not stretch the column.
- **`CommunicationTimeline.vue` in all three scopes** → the dialog is inside the component, so it renders in the ticket panel, the customer profile, and the unscoped feed. Focus must return to the delete button that opened it in each. Product rule 11.
- **`prefers-reduced-motion`** → `AppModal` already respects the global block at `main.css:150–159`; no new animation is introduced.

---

## Test Plan

1. **Unit — new `apps/web/src/components/AppConfirmDialog.spec.ts.`** `'renders the interpolated message from messageKey and messageParams'`; `'renders Cancel before Confirm in the DOM (Product rule 6)'`; `'emits confirm when the danger button is clicked'`; `'emits update:open false when Cancel is clicked'`; `'renders nothing when open is false'`; `'uses common.delete as the default confirm label and honours confirmLabelKey'`; `'shows the confirm button in a loading state when busy'`. Mount with the real catalogue (`test/setup.ts` installs it) so a bad key fails.
2. **Unit — `apps/web/src/components/AppModal.spec.ts`.** All 7 tests pass **unmodified**. Do not edit this file.
3. **Unit — `apps/web/src/views/TasksView.spec.ts`** (8 tests today). Rewrite the confirm-path test as: click Delete → assert the dialog is open and no store call has happened → click Confirm → assert `tasks.remove` called with the id. Add: `'clicking Cancel closes the dialog and never calls remove'`; `'a second Confirm click does not call remove twice'`.
4. **Unit — `apps/web/src/views/UsersView.spec.ts`** (11 tests today). All must pass, updated for the modal markup. Add: `'opening the roles modal closes the edit modal'`; `'opening any modal clears users.error'`; `'a failed create leaves no error inside a subsequently opened edit modal'` (the bug); `'the deactivate confirmation interpolates the user name'`.
5. **Unit — `CustomerDetailView.spec.ts`** (14), `TicketDetailView.spec.ts` (15), `AgentWorkspaceView.spec.ts` (11). All must pass with confirm-path tests converted to dialog interactions. Add one per file asserting the **discriminated** pending state routes to the right message key — note delete and attachment-delete are both in each file, and picking the wrong branch is the likely bug.
6. **Unit — `CommunicationTimeline.spec.ts`** (33 tests, the largest component spec). Convert its confirm-path assertions. Add one case per scope (ticket-scoped, customer-scoped, unscoped) confirming the dialog opens and the delete goes through — Product rule 11.
7. **Unit — `apps/web/src/i18n/i18n.spec.ts`.** No new test; the parity test covers `common.confirmDialog.title` automatically. Confirm it passes.
8. **Grep assertion, run as a verification step rather than a test:** `grep -rn "window.confirm" apps/web/src --include=*.vue --include=*.ts` returns hits only inside `*.spec.ts` files (where a stub may legitimately remain to prove the native dialog is *not* used).
9. **No backend test changes.** All 406 must pass untouched.

---

## Verification Steps

1. **Frontend type checking:** from the repo root, `npm run typecheck`. Must exit 0.
2. **Frontend tests:** `npm run test --workspace @crm/web`. Must report at least the 523 previously passing, all green, plus the new cases.
3. **Frontend lint:** `npm run lint --workspace @crm/web` (`--max-warnings 0`).
4. **Frontend builds:** `npm run build --workspace @crm/web`.
5. **Backend untouched:** `git diff --name-only` lists no `apps/api/` path; `npm run test --workspace @crm/api` reports 406 passing.
6. **No native confirm remains:** the grep from Test Plan item 8 returns no non-spec hit.
7. **Frontend runs:** both dev servers, signed in as the administrator.
8. **All nine confirmations:** delete a task, deactivate a user, delete a customer note, delete a customer attachment, delete a ticket comment, delete a ticket attachment, delete a comment and an attachment from `/workspace/:id`, and delete an interaction from the communication timeline. For each: the dialog opens with the correct message, Cancel does nothing, Confirm performs the action, and focus returns to the control that opened it.
9. **The `UsersView` bug is gone:** open Create, submit something the API rejects (a duplicate email), Cancel, then click Edit on a different row. The edit modal must open with **no** error message. Then, with Edit open, click Roles on another row — Edit must close.
10. **Form controls look consistent:** walk `/customers/new`, `/tickets/new`, `/users` (all four modals), `/tasks`, and the interaction composer on a customer profile. Every text field, select, textarea, and checkbox shares the same border, radius, height, and focus ring. **Compare against the pre-change screens** — this is the change with the largest visual footprint in work item 13.
11. **Checkboxes are not stretched:** the role checkboxes in the `UsersView` create and roles modals, and the overdue-only checkbox in `/tasks`, must be checkbox-sized.
12. **The reassign select is not stretched:** on `/tickets`, confirm the inline `ReassignControl` select still fits its cell.
13. **`Escape` layering:** at under 900px, open the nav drawer, then open a confirm dialog, then press `Escape` once. The dialog must close and the drawer must stay open.
14. **RTL:** in Arabic, open every dialog. The title, message, and button row must align to the right, the button order must read Cancel-then-Confirm in reading order, the focus ring must be visible, and Tab must cycle inside the dialog.
15. **Responsive:** at 320px, every dialog must fit without the page scrolling horizontally, and the `form-actions` row must wrap rather than overflow.
16. **Keyboard-only pass:** with no mouse, reach and operate one destructive action end to end on `/tasks` and one on `/users`.

---

## Done Criteria

- [ ] Global form-control rules exist in `main.css`; every input, select, textarea, checkbox, fieldset, and legend in the app is styled consistently; `LoginView.vue:117` and `ReassignControl.vue:127` are preserved.
- [ ] `.form-error` and `.form-actions` exist and replace the seven local error/action rules named in task 6; every `role="alert"` attribute survives.
- [ ] `AppConfirmDialog.vue` exists, wraps `AppModal`, holds no state, renders Cancel before Confirm, and defaults its confirm label to `common.delete`.
- [ ] All nine `window.confirm` call sites are replaced; a repo-wide grep finds no non-spec hit; each site reuses its **existing** message key and interpolation.
- [ ] Views with two destructive actions use one dialog instance with a discriminated pending ref; `AgentWorkspaceView`'s `ticketId.value &&` guards survive.
- [ ] `UsersView.vue`'s four panels are `AppModal`s; `closeAllPanels()` runs first in all four `open…` functions; a stale `users.error` can no longer appear in a different dialog; two dialogs can no longer be open at once.
- [ ] `AppModal.vue` is **not** modified and its 7 tests pass unmodified.
- [ ] All 48 bare `<button>` elements outside `AppButton.vue` and `AppTabs.vue` are `AppButton`, each icon-only one with an `ariaLabel` (no DEV warning in the console on any screen).
- [ ] `common.confirmDialog.title` is the only new translation key, present in both catalogues; `i18n.spec.ts` passes.
- [ ] No file under `apps/api/` is modified; all 406 backend tests pass untouched.
- [ ] All 523 previously passing web tests still pass, with confirm-path assertions **converted** rather than removed, plus the new cases.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build`, and both test suites pass from the repo root.
- [ ] Every dialog is operable by keyboard alone, traps focus, closes on `Escape`, restores focus on close, and reads correctly in both `en` and `ar`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 28.**
