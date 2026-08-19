# long-play

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines SvelteKit, Elysia, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **SvelteKit** - Web framework for building Svelte apps
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Elysia** - Type-safe, high-performance framework
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Node.js** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **SQLite/Turso** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system
- **Biome** - Linting and formatting
- **Electrobun** - Lightweight desktop shell for web frontends

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Database Setup

This project uses SQLite with Drizzle ORM.

1. Start the local SQLite database (optional):

```bash
pnpm run db:local
```

2. Update your `.env` file in the `apps/server` directory with the appropriate connection details if needed.

3. Apply the schema to your database:

```bash
pnpm run db:push
```

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## Deployment

### Alchemy

- Target: web on Cloudflare
- Configure provider login: `cd packages/infra && pnpm exec alchemy login --configure`
- Dev: pnpm run dev
- Deploy: pnpm run deploy
- Destroy: pnpm run destroy

`alchemy login --configure` stores the selected Cloudflare, Neon, PlanetScale, and/or Prisma provider profiles under `~/.alchemy`; no provider-specific setup command is required by this scaffold.

Deploys are staged and default to a personal `dev_<username>` stage. For production, run the deploy with an explicit stage from `packages/infra`:

```bash
cd packages/infra && pnpm exec alchemy deploy --stage production
```

## Git Hooks and Formatting

- Run checks: `pnpm run check`

## Project Structure

```
long-play/
├── apps/
│   ├── web/         # Frontend application (SvelteKit)
│   └── server/      # Backend API (Elysia, ORPC)
├── packages/
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:server`: Start only the server
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run db:push`: Push schema changes to database
- `pnpm run db:generate`: Generate database client/types
- `pnpm run db:migrate`: Run database migrations
- `pnpm run db:studio`: Open database studio UI
- `pnpm run db:local`: Start the local SQLite database
- `pnpm run check`: Run Biome formatting and linting
- `pnpm run dev:desktop`: Start the Electrobun desktop app with HMR
- `pnpm run build:desktop`: Build the stable Electrobun desktop app
- `pnpm run build:desktop:canary`: Build the canary Electrobun desktop app
- Note: Desktop builds package static web assets. SvelteKit needs a static/export build configuration before desktop packaging will work.
