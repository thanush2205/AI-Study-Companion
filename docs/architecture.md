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

The first proof route is `GET /api/projects/:projectId/materials` with the user's ID in the `x-user-id` header. This header is a temporary authentication boundary for the prototype and will be replaced by JWT middleware.

## Critical demo path

Space -> Project -> Material -> Processing -> Tutor -> grounded answer -> citation -> refusal -> quiz -> assessment -> mastery -> growth -> analytics -> recommendation -> admin.
