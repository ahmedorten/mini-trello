# Mini Trello — Full-Stack Kanban Task Management Application

Mini Trello is a modern, feature-rich Kanban project management application built with **Vue 3**, **TypeScript**, **Pinia**, **Tailwind CSS**, **Node.js (Express 5)**, **Prisma ORM**, and **PostgreSQL**.

---

## 1. Overview

Mini Trello provides a seamless, responsive workspace for organizing tasks into visual boards, columns, and cards. It features real-time interactive drag-and-drop card movement across columns, automated position reordering, priority tags, due dates, task checklists, comments, file attachments, global search, and project statistics dashboards.

---

## 2. Main Features

- 📋 **Kanban Boards & Columns**: Create, edit, and reorder boards and columns.
- 🗂️ **Interactive Drag & Drop**: Move cards smoothly between columns with automatic position reordering.
- 🏷️ **Card Metadata**: Priority levels (`LOW`, `MEDIUM`, `HIGH`), color-coded labels, due date tracking, and progress indicators.
- ✅ **Checklists & Progress**: Subtask checklists with automatic completion percentage tracking.
- 💬 **Comments & Attachments**: Discuss tasks and attach files directly to cards.
- 🔍 **Search & Filters**: Global card and board search with keyword and priority filtering.
- 📊 **Dashboard & Metrics**: Project overview, recent boards, activity audit log, and label statistics.
- 🔒 **Security & Authentication**: Password hashing (`bcrypt`), JWT Bearer token authentication, input validation (`Zod`), and Helmet security headers.
- 🔔 **Interactive UI/UX**: Non-blocking toast notifications and modal confirmation dialogs for destructive operations.

---

## 3. Tech Stack

### Frontend
- **Framework**: Vue 3 (Composition API `<script setup>`)
- **Language**: TypeScript (strict mode)
- **State Management**: Pinia
- **Routing**: Vue Router 4 (with route auth guards)
- **Styling**: Tailwind CSS
- **Form Validation**: VeeValidate + Zod
- **Drag & Drop**: `vue-draggable-plus`
- **Testing**: Vitest + `@vue/test-utils` + JSDOM

### Backend
- **Framework**: Express 5 (Node.js 22 LTS)
- **Language**: TypeScript
- **Database & ORM**: PostgreSQL via Prisma ORM
- **Validation**: Zod middleware
- **Authentication**: JWT (`jsonwebtoken`) + Password Hashing (`bcrypt`)
- **Logging**: Pino Logger
- **Security**: Helmet, CORS, Rate Limiting
- **Testing**: Vitest

---

## 4. Architecture & Directory Structure

The application follows a **Domain Feature-Based Architecture** on both frontend and backend for strong encapsulation and separation of concerns.

```
mini-trello/
├── backend/                       # Express 5 Node.js API
│   ├── src/
│   │   ├── app.ts                 # Express application pipeline
│   │   ├── server.ts              # HTTP entrypoint
│   │   ├── modules/               # Domain modules (auth, board, column, card, activity, etc.)
│   │   ├── middlewares/           # Logger, Zod validation, Error & Not Found middleware
│   │   └── shared/                # Prisma singleton, AppError, logger, types
│   ├── prisma/
│   │   ├── schema.prisma          # PostgreSQL relational schema
│   │   └── seed.ts                # Database seeder script
│   └── tests/                     # Backend unit & validation tests
│
├── frontend/                      # Vue 3 Vite application
│   ├── src/
│   │   ├── main.ts                # Vue app initialization & plugins
│   │   ├── App.vue                # Root component & overlay containers
│   │   ├── core/                  # ApiClient (Axios), Session Manager, App Config
│   │   ├── features/              # Feature modules (auth, boards, columns, cards, dashboard, etc.)
│   │   ├── router/                # Router config & auth guards
│   │   └── shared/                # Base UI components, Toast store, Dialog service
│   └── tests/                     # Frontend store & validation tests
│
├── package.json                   # Root scripts & concurrent launcher
└── README.md
```

---

## 5. Prerequisites

Before running the application, ensure you have the following installed:

- **Node.js**: `^22.0.0` LTS or higher
- **npm**: `^10.0.0` or higher
- **PostgreSQL**: Local or cloud PostgreSQL instance

---

## 6. Installation & Setup

### Step 1: Clone Repository & Install Dependencies

```bash
git clone https://github.com/your-username/mini-trello.git
cd mini-trello

# Install all root, backend, and frontend dependencies
npm run install:all
```

### Step 2: Configure Environment Variables

1. Create a `backend/.env` file:
```bash
cp backend/.env.example backend/.env
```

2. Update database connection settings inside `backend/.env`:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:password@localhost:5432/mini_trello?schema=public"
JWT_SECRET="super-secret-jwt-key"
JWT_EXPIRES_IN="24h"
LOG_LEVEL="info"
```

3. Configure frontend environment variables in `frontend/.env.local`:
```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_APP_ENV=local
```

### Step 3: Database Migration & Seeding

Run Prisma migrations and seed sample demo data (boards, columns, cards, users):

```bash
npm run db:setup
```

---

## 7. Running the Application

### Option A: Concurrent Full-Stack Mode (Recommended)

Start both frontend and backend development servers concurrently with a single command:

```bash
npm run dev
```

- **Frontend URL**: `http://localhost:5173`
- **Backend API URL**: `http://localhost:3000/api/v1`
- **Health Check**: `http://localhost:3000/health`

### Option B: Run Services Individually

```bash
# Terminal 1: Start Backend API
cd backend
npm run dev

# Terminal 2: Start Frontend UI
cd frontend
npm run dev
```

---

## 8. Root NPM Command Reference

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts frontend and backend concurrently in hot-reload mode |
| `npm run build` | Compiles backend TypeScript and builds frontend Vite bundle |
| `npm run test` | Executes unit test suites for both backend and frontend |
| `npm run typecheck` | Validates TypeScript compilation across backend and frontend |
| `npm run install:all` | Installs dependencies for root, backend, and frontend |
| `npm run db:setup` | Executes database migrations and populates seed demo data |
| `npm run db:seed` | Populates database with sample seed data |

---

## 9. Testing

The application includes automated unit and integration tests written with **Vitest**.

To run the complete test suite:

```bash
npm run test
```

### Test Suite Summary
- **Backend Tests** (`backend/tests/`):
  - Password hashing & bcrypt verification
  - JWT token generation & payload verification
  - User registration & login Zod validation schemas
  - Card reordering algorithm & position midpoint calculations
  - Card, Board, and Column input validation schemas
  - Custom `AppError` handling

- **Frontend Tests** (`frontend/tests/`):
  - Pinia Card Store state management & cross-column drag & drop state updates
  - Vue Router authentication guards (`requiresAuth`, `guestOnly`)
  - Form input validation & whitespace sanitization
  - Toast Notification Service & Store

---

## 10. API & Authentication Overview

- **Authentication**: JWT Bearer token format (`Authorization: Bearer <token>`).
- **Correlation ID**: Every HTTP request includes `X-Correlation-ID` header for tracing.
- **API Documentation**:
  - Bruno API collection located in `backend/http/`.
  - Swagger OpenAPI schema endpoints available when running the backend.

### Key API Endpoints

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Public | Register new user |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user & return JWT |
| `GET` | `/api/v1/auth/me` | Bearer | Get current user profile |
| `GET` | `/api/v1/boards` | Bearer | Get all user boards |
| `POST` | `/api/v1/boards` | Bearer | Create a new board |
| `GET` | `/api/v1/boards/:id` | Bearer | Get board details with columns & cards |
| `POST` | `/api/v1/columns` | Bearer | Add column to board |
| `POST` | `/api/v1/cards` | Bearer | Create new card in column |
| `PUT` | `/api/v1/cards/:id/move` | Bearer | Move card across columns or reorder |
| `DELETE`| `/api/v1/cards/:id` | Bearer | Soft delete card |
| `GET` | `/api/v1/cards/search` | Bearer | Search cards across boards |
| `GET` | `/api/v1/dashboard/stats` | Bearer | Get user board metrics & stats |

---

## 11. Recommended Demo Flow (3–5 Minutes)

1. **Authentication (30s)**: Access `/login`, sign in with sample user credentials or register a new account.
2. **Dashboard Overview (30s)**: View overall project statistics, recent boards, label breakdown, and activity audit timeline at `/dashboard`.
3. **Board View (30s)**: Navigate to a Kanban board (e.g. "Sprint Planning").
4. **Card Operations & Drag-and-Drop (60s)**:
   - Click **+ Add Card** to create a card in the "To Do" column.
   - Drag the card to "In Progress" to demonstrate live reordering and cross-column state updates.
   - Click the card to open the Card Details Drawer, set a due date, assign a priority (`HIGH`), add labels, and create checklist items.
5. **Confirmation & Feedback (30s)**: Delete a card from the drawer to demonstrate the non-blocking modal confirmation dialog and success toast alert.
6. **Search & Filter (30s)**: Use the top bar search or navigate to `/search` to filter tasks by title and priority.

---

## 12. Known Limitations & Future Improvements

- **Real-Time WebSockets**: Currently uses HTTP polling for card status synchronization across active sessions. Real-time updates via Socket.io can be integrated in future releases.
- **Dark Mode Persistence**: Frontend supports dark mode CSS variables, with user preference stored in localStorage.
