# TaskFlow

A friendly role-based task planner for students and working professionals, with customizable starter templates and private, user-owned task data.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/taskflow` — responsive React app, onboarding, dashboard, tasks, and settings
- `artifacts/api-server/src/routes/taskflow.ts` — authenticated task, list, profile, dashboard, and deletion endpoints
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/taskflow.ts` — PostgreSQL schema
- Role templates live in the frontend data layer and should remain structured data, not UI markup

## Architecture decisions

- Guests can use the core planner without an account; guest data stays in the browser.
- Signed-in users store their planner data in PostgreSQL under their Clerk user ID.
- Keep list reads bounded and task reads paginated; cap each task page at 100.

## Product

- TaskFlow is free for everyone. Do not add ads, pricing pages, paywalls, upgrades, subscriptions, or payment integrations.
- Every feature is available to every user. Prefer lightweight, free-tier services and efficient data access.
- Users must be able to export their data and permanently delete their account data from Settings.
- Include a simple footer with Privacy Policy, Terms, and Send feedback links. Keep data collection minimal and explain it plainly.
- Role-based templates cover school, college, work, freelancing, development, teaching, personal life, and custom roles.

## User preferences

Keep the experience warm, approachable, professional, responsive, and accessible; support light, dark, and system themes.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
