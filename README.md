# AI Study Companion

A modular-monolith prototype for grounded studying: source material becomes tutor conversations, practice, assessment, and measurable mastery.

## Foundation

- `client`: React 19 + Vite + Tailwind CSS
- `server`: Node.js + Express REST API
- MongoDB Atlas: remote document database configured through `MONGODB_URI`
- Redis: local service defined in `docker-compose.yml`
- `.env.example`: local environment contract
- `docs`: architecture, decisions, AI prompt contracts, and evaluation path

## Run locally

```powershell
Copy-Item .env.example .env
# Edit .env and paste your MongoDB Atlas connection string into MONGODB_URI
docker compose up -d

cd server
npm install
npm run dev
```

In another terminal:

```powershell
cd client
npm run dev
```

Run the PDF worker in a third terminal:

```powershell
cd server
npm run worker
```

Uploads return immediately with a `QUEUED` material and processing job. The worker extracts PDF text, creates overlapping searchable chunks, and records progress, attempts, timestamps, and failure details in MongoDB.

The client runs at `http://localhost:5173`. The API health check is `http://localhost:4000/api/health`; readiness is `http://localhost:4000/api/ready`.

Authentication is available at `/api/auth/register`, `/api/auth/login`, and `/api/auth/me`. Send the returned token as `Authorization: Bearer <token>` for protected routes.

MongoDB Atlas and Redis are checked by `/api/ready`. The Atlas URI must remain in your local `.env` and must never be committed. URL-encode special characters in the Atlas database password.
