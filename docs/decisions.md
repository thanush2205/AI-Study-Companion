# Engineering Decisions

## Modular monolith

The prototype optimizes for a demonstrable learning loop and clear ownership boundaries. A modular monolith keeps local setup and debugging small while preserving seams for later extraction.

## Optional local dependencies

The API starts without MongoDB or Redis credentials and reports those dependencies through `/api/ready`. This makes the foundation testable before infrastructure is available; the real integration is enabled by `.env` values.
