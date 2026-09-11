# Architecture

AI Study Companion is a modular monolith: one React client, one Express API, one MongoDB knowledge store, and Redis for background work. Domain boundaries remain explicit inside the server so the prototype can move quickly without prematurely distributing deployment and data ownership.

## Runtime boundaries

- `client`: user-facing workflows and API clients.
- `server/src/routes`: HTTP contracts.
- `server/src/services`: domain and provider orchestration.
- `server/src/models`: MongoDB persistence.
- `server/src/workers`: asynchronous material processing and AI jobs.
- MongoDB: users, spaces, projects, materials, chunks, conversations, assessments, mastery, activity, and usage.
- Redis: queues, job state, and short-lived cache.

## Project isolation

Every project-dependent document carries a required, indexed `projectId`. Requests to project-scoped routes must provide the authenticated user's ID and pass the ownership chain in `requireProjectScope`: `User -> Space(userId) -> Project(userId, spaceId)`. Controllers then query using the verified `request.scope.projectId`, never an untrusted route value alone.

Authentication uses `Authorization: Bearer <jwt>`. `authenticate` resolves the token subject to `req.user`; `requireAdmin` gates admin-only routes; and `requireProjectAccess` validates `req.user -> Space -> Project` before any project resource query. The project, materials, conversations, quizzes, and analytics routes all use this same guard, so User A cannot access User B's project data.

Authentication endpoints are `POST /api/auth/register`, `POST /api/auth/login`, and `GET /api/auth/me`. The admin proof endpoint is `GET /api/admin/status`.

## Critical demo path

Space -> Project -> Material -> Processing -> Tutor -> grounded answer -> citation -> refusal -> quiz -> assessment -> mastery -> growth -> analytics -> recommendation -> admin.
