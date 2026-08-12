# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-07-09

### Added
- Created Maturity Model (`docs/maturity-model.md`) defining development stages.
- Added Requirements Traceability model inside `docs/requirements.md`.
- Created Agent Capability Matrix folders under `.ai/capabilities/` detailing allowed tools and escalation paths.
- Setup AI Workspace Bootstrapping files under `.ai/bootstrap/` (`START_HERE.md`, `BOOTSTRAP.md`, `CHECKLIST.md`, `AI_PROTOCOL.md`, `TASK_WORKFLOW.md`).
- Added index maps inside `docs/index.md` listing all canonical references.
- Added workspace metadata templates on all documentation.

### Changed
- Replaced all local absolute paths with repository-relative Markdown links.
- Refactored `.ai/context/` files to summarize and link to canonical documents inside `docs/`.
- Consolidated template files inside root `templates/` folder and removed duplicates from `.ai/templates/`.

### Removed
- Deleted redundant templates folder `.ai/templates/`.

---

## [1.0.0] - 2026-07-08

### Added
- Completed initial workspace structure setup.
- Initialized system specs under `docs/`.
- Created AI Agent Personas and Prompt templates.
