# Shared UX Services Documentation

This document explains the usage and design of the global UX systems implemented in the shared layer.

---

## 1. Notification Center & Toast System

All business services should dispatch notifications using the **NotificationCenter** helper:

```typescript
import { NotificationCenter } from '@/shared/services/NotificationCenter';

// Trigger simple toast
NotificationCenter.toast('Board deleted successfully', 'success');

// Trigger warning
NotificationCenter.toast('Network connection is unstable', 'warning');
```

### Toast Lifecycle
* **Visible Cap:** Maximum 5 toasts render concurrently. Overflow toasts wait in a queue.
* **Hover Pause:** When users mouse-hover over a toast banner, its countdown progress freezes. It resumes counting down once the cursor leaves.
* **Duplicate Prevention:** Identical messages triggered within 2 seconds are throttled; instead of creating a new banner, the existing toast's active timer is reset to 100%.

---

## 2. Promise-Based Dialog Service

Confirmations should utilize the `DialogService` promise wrapper. This keeps components stateless and handles overlays asynchronously.

```typescript
import { DialogService } from '@/shared/services/DialogService';

const confirmed = await DialogService.confirm({
  title: 'Delete Attachment?',
  message: 'This will permanently remove the file. This action is irreversible.',
  confirmText: 'Delete File',
  severity: 'danger',
});

if (confirmed) {
  await AttachmentService.delete(id);
}
```

### Stack & Nested Dialogs
* The Dialog manager uses a **Stack** pattern.
* Triggering a confirmation modal over an active detail drawer adds it on top of the stack.
* Focus is trapped on the top-most dialog in the stack using the `FocusManager` and returned to the parent element when popped.

---

## 3. Focus Manager

`FocusManager` tracks focus elements in a stack to enable accessibility-compliant restoration:

```typescript
import { FocusManager } from '@/shared/services/FocusManager';

// Save focus element before mounting overlay
FocusManager.stashFocus();

// Close overlay and return focus to stashed element
FocusManager.restoreFocus();
```

---

## 4. Breakpoint & Motion Services

* **BreakpointService:** Provides reactive flags (`isMobile.value`, `isTablet.value`, `isDesktop.value`) to dynamically restructure UI layouts.
* **MotionPreferenceService:** Detects OS prefers-reduced-motion triggers reactively, automatically disabling transitions and animations for users with motion sensitivity.
