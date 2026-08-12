# Mini Trello Backend

This is the backend API for the Mini Trello application. It provides the core application bootstrap configuration, middleware pipeline, and logging services.

## Prerequisites

- **Node.js**: 22.0.0 LTS or higher
- **Package Manager**: npm (comes with Node.js)
- **Database**: PostgreSQL (Prisma configuration included)

## Tech Stack

- **Framework**: Express 5
- **Language**: TypeScript (strict compilation mode)
- **Database ORM**: Prisma ORM (Configuration only)
- **Security & Performance**: Helmet, CORS, Compression
- **Logging**: Pino Logger
- **Input Validation**: Zod

## Installation

1. Clone the repository and navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Environment Variables

Configure environment variables by copying the blueprint file:
```bash
cp .env.example .env
```

| Key | Description | Default |
| :--- | :--- | :--- |
| `PORT` | The port number on which the application server runs | `3000` |
| `NODE_ENV` | Mode of operation (`development` / `production` / `test`) | `development` |
| `DATABASE_URL` | PostgreSQL connection URL string for Prisma | *Required* |
| `LOG_LEVEL` | Pino logging level (`info` / `debug` / `error`) | `info` |

## Folder Structure

The application follows the **Feature-Based Modular Architecture**:

```
backend/
├── http/                     # Bruno HTTP request collection
│   ├── environments/
│   │   └── local.bru         # BASE_URL & JWT_TOKEN variables
│   └── auth/
│       ├── register.bru      # POST /auth/register
│       ├── login.bru         # POST /auth/login
│       └── me.bru            # GET /auth/me
├── prisma/
│   └── schema.prisma         # Prisma Schema Database configuration
├── scripts/                  # Utility deployment/build scripts
├── src/
│   ├── config/               # App configuration & settings
│   ├── middlewares/          # Global middlewares (Logger, Error, Not Found)
│   ├── modules/              # Modular business features folder
│   │   └── health/           # Health Check Module
│   ├── shared/               # Reusable base logic & TypeScript typings
│   │   ├── constants/
│   │   ├── errors/           # Custom error helpers
│   │   ├── interfaces/
│   │   ├── types/
│   │   └── utils/            # Consolidated utility files (e.g. logger)
│   ├── app.ts                # Express application configuration
│   └── server.ts             # Web server entrypoint
├── tests/                    # Integration & unit spec files
├── .editorconfig             # Universal formatting configurations
├── .env.example              # Environment variables template
├── .gitignore                # Git exclusions list
├── eslint.config.js          # ESLint Flat configurations
├── package.json              # NPM package configurations
├── prettier.config.js        # Code formatting rules
└── tsconfig.json             # TypeScript configurations
```

## How to Run Locally

### Run in Development Mode (with hot-reload)
```bash
npm run dev
```

### Run Production Build
1. **Compile TypeScript**:
   ```bash
   npm run build
   ```
2. **Start Production Server**:
   ```bash
   npm run start
   ```

## Available Scripts

- `npm run dev` - Run development server with `tsx watch`
- `npm run build` - Compile TypeScript to standard JavaScript `/dist`
- `npm run start` - Start compiled production server from `/dist`
- `npm run lint` - Run ESLint static check verification
- `npm run lint:fix` - Fix code linting violations automatically
- `npm run format` - Standardize formatting with Prettier
- `npm run format:check` - Check formatting compliance with Prettier
- `npm run typecheck` - Validate TypeScript compilation without outputting files

## Useful Commands

Quick reference for common development tasks:

```bash
# Start development server with hot-reload
npm run dev

# Apply pending database migrations
npx prisma migrate dev

# Regenerate Prisma Client after schema changes
npx prisma generate

# Open visual database browser (development only)
npx prisma studio
```

## API Routes

| Method | Route | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | Health Check Endpoint |
| `POST` | `/api/v1/auth/register` | Public | Register a new user |
| `POST` | `/api/v1/auth/login` | Public | Login and receive JWT token |
| `GET` | `/api/v1/auth/me` | Bearer | Get authenticated user profile |
| `POST` | `/api/v1/boards` | Bearer | Create a new board |
| `GET` | `/api/v1/boards` | Bearer | List all boards owned by current user |
| `GET` | `/api/v1/boards/:id` | Bearer | Get a single board by ID |
| `PUT` | `/api/v1/boards/:id` | Bearer | Update board name / description |
| `DELETE` | `/api/v1/boards/:id` | Bearer | Soft-delete a board |

## API Testing

The project ships with a Bruno HTTP collection for manual API testing.

| Item | Path |
| :--- | :--- |
| Collection | `backend/http/` |
| Environment | `backend/http/environments/local.bru` |
| Variables | `BASE_URL`, `JWT_TOKEN`, `BOARD_ID` |

See [docs/api-testing.md](../docs/api-testing.md) for the full authentication testing workflow and Prisma Studio guide.
