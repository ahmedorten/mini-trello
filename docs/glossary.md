# Project Glossary - Generic Template

| Metadata | Value |
| :--- | :--- |
| **Owner** | Project Manager |
| **Reviewer** | Principal Software Architect |
| **Status** | Approved |
| **Version** | v1.0.0 |
| **Last Updated** | 2026-07-09 |
| **Review Date** | 2026-07-09 |
| **Dependencies** | None |
| **Referenced By** | [Canonical Document Index](index.md) |
| **Document Type** | Glossary Reference |
| **Audience** | Development Team, QA Team, AI Agents |

---

## 1. Generic Model Domain Entities

### Parent Resource
The top-level container entity (e.g. Board, Project, Workspace, Tenant) representing a partitioned workspace owned by a user.

### Group Column (Column)
An intermediate grouping structure (e.g. List, Category, Status, Phase) representing a stage in a sequence workflow.

### Resource Item (Item)
The child transactional item (e.g. Card, Task, Product, Ticket) representing a unit of work or record sitting inside a column.

---

## 2. Technical Terms & Architecture

### Swappability
The ability to replace the backend engine or the frontend framework without modifying the relational database structures or API client contracts.

### Clean Architecture
A software design pattern that segregates components into independent layers (Presentation, Business Logic, and Data Access) to ensure database and framework independence.

### JWT (JSON Web Token)
A compact, URL-safe means of representing claims to be transferred between two parties. Used for stateless API authentication.

### Database ORM (Object-Relational Mapping)
A technique that lets you query and manipulate data from a database using an object-oriented paradigm.

### Cascade Delete
A relational database constraint that automatically triggers the deletion of child records when their parent record is deleted.
