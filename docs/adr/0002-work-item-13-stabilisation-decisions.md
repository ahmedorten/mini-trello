# ADR 0002 — Work item 13 stabilisation decisions

**Status:** accepted
**Context:** Work item 13 (project stabilisation): deterministic list sorting,
a shared table shell, form-control consistency, an in-app confirmation
dialog, a development login picker, and repository handover documentation.

## Decisions

1. **Sorting is opt-in with a per-resource whitelist enum; no sort parameter
   reproduces the pre-existing ordering.** An open `sort` string field would
   let a caller order by an unindexed or sensitive column; a closed enum
   keeps every sortable field a deliberate, indexed choice.
2. **Every list ordering ends in `{ id: 'asc' }`**, fixing non-deterministic
   pagination on the ticket list. Without a stable final tiebreaker, rows
   with an equal sort key can shift between pages as the underlying table
   changes between requests.
3. **Indexes were added to back the default and sortable orderings; no other
   schema change was made.** The migration is additive and narrowly scoped
   to what the new sort options actually need.
4. **One global `.data-table` class rather than a generic table component**,
   because four list screens share a shell (header, row hover, sticky
   header, responsive padding) but not their cells — a component would need
   as much slot/prop surface as the plain CSS class already provides for
   free.
5. **`window.confirm` was replaced everywhere at once**, reversing an earlier
   decision to keep it, because two confirmation mechanisms is worse than
   one plain one: a user who learns that Delete opens a dialog will click
   through a native `confirm()` without reading it.
6. **Form controls are styled by element selector in `main.css`**, not a
   utility class or a wrapper component, because only two of roughly a dozen
   files styled their controls before this work item — a class-based fix
   stays broken for the next file that adds an input.
7. **The login test-user picker is gated on `import.meta.env.DEV` only, with
   no runtime flag**, so it is *excluded from* rather than merely *disabled
   in* a production build. Its persona data and UI strings are also merged
   into `vue-i18n` at runtime rather than stored in `en.json`/`ar.json`,
   because `createI18n` loads those catalogues whole and eagerly — a string
   placed there ships in the production bundle even while the component that
   renders it is dead-code-eliminated.
8. **Dev test-user seeding is opt-in (`SEED_DEV_USERS=true`) and refuses to
   run with `NODE_ENV=production`.** An account with a known, shared
   password is a standing risk; the seed treats the combination of "seed
   dev accounts" and "this is production" as a contradiction and throws
   rather than guessing which one is wrong.
9. **US07–US12 are documented but not designed.** Writing a design for
   unbuilt scope makes it look decided; the next person to pick it up should
   find a title and a purpose to plan against, not someone else's
   unrequested design.

## Consequences

- A fifth sortable field on any resource cannot be added without also adding
  the corresponding enum member and considering whether it needs a new
  index.
- The shared table and form-control classes in `main.css` are now global —
  a change to `.data-table` or the element-selector form rules affects every
  screen that uses them at once, not just one.
- Reversing decision 5 (bringing back `window.confirm` for any destructive
  action) means revisiting all nine call sites `AppConfirmDialog` replaced.
