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

## Critical demo path

Space -> Project -> Material -> Processing -> Tutor -> grounded answer -> citation -> refusal -> quiz -> assessment -> mastery -> growth -> analytics -> recommendation -> admin.
