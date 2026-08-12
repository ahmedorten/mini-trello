# Workspace Bootstrapping Guide

This guide details how to bootstrap the local development environment, database services, and client frameworks.

---

## 1. Prerequisites
Ensure you have the following runtime engines installed locally:
- **Runtime Environment**: e.g., Node.js (LTS version) or designated platform compiler.
- **Docker Engine**: Required for spinning up containerized relational database instances locally.
- **Git**: Core version control system.

---

## 2. Environment Initializations

### Step 1: Clone and Set Up Environment Variables
Copy the env template file to configure environment parameters:
```bash
cp .env.example .env
```
*Note: Ensure to update the Database connection strings and cryptographic signature keys inside the `.env` file.*

### Step 2: Spin Up Relational Database Containers
Run Docker Compose to boot the containerized Postgres database instance in the background:
```bash
docker-compose up -d
```
Verify the container status:
```bash
docker ps
```

### Step 3: Run Database Schemas Sync
Synchronize relational schema models and generate client libraries:
```bash
npx prisma db push
```

### Step 4: Launch Development Servers
- **Backend API Server**:
  ```bash
  cd backend && npm run dev
  ```
- **Frontend Client Application**:
  ```bash
  cd frontend && npm run dev
  ```
