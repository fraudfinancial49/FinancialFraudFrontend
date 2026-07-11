# PaySim Fraud Intelligence — Admin Console (Phase 5 Frontend)

React + TypeScript + Vite + Tailwind CSS admin dashboard for fraud analysts and security
administrators, wired to the Phase 4 FastAPI backend.

**Deployed backend:** `https://financialfraudbackend.onrender.com`
(configured via `VITE_API_BASE_URL` in `frontend/.env`, consumed in `src/api/client.ts`).

## Local development

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api`, `/auth`, `/vault`,
`/honeypot`, `/admin`, `/health`, `/ready`, and `/model-info` to the deployed backend at
`https://financialfraudbackend.onrender.com` (see `vite.config.ts`). No local backend needs to be running.

## Production build

```bash
npm run build
npm run preview   # sanity-check the production bundle locally
```

Output is written to `dist/`. Since `src/api/client.ts` uses an absolute
`VITE_API_BASE_URL`, the built bundle talks to `https://financialfraudbackend.onrender.com` directly from the
browser — make sure the backend's CORS settings allow the origin you deploy this
frontend to.

## Deployment

### Vercel
1. Push this `frontend/` directory to a Git repository.
2. Import the repo in Vercel, set the framework preset to **Vite**.
3. Build command: `npm run build` — Output directory: `dist`.
4. Set `VITE_API_BASE_URL=https://financialfraudbackend.onrender.com` as an environment variable in the Vercel
   project settings (falls back to the same value baked into `.env` if omitted).

### Netlify
1. Build command: `npm run build` — Publish directory: `dist`.
2. Set `VITE_API_BASE_URL=https://financialfraudbackend.onrender.com` under Site settings → Environment variables.
3. Add a SPA fallback redirect (`/* -> /index.html`) in `netlify.toml`.

### Docker
```bash
docker build -t fraud-admin-frontend --build-arg VITE_API_BASE_URL=https://financialfraudbackend.onrender.com .
docker run -p 80:80 fraud-admin-frontend
```
Or bring it up via compose:
```bash
docker compose up --build
```
This uses the included `Dockerfile` (multi-stage Node build → nginx static serve,
receiving `VITE_API_BASE_URL` as a build ARG) and `nginx.conf`, which reverse-proxies
the API route families straight to the deployed Render backend at `https://financialfraudbackend.onrender.com`
— no local backend container or CORS configuration needed.

## Notes on API coverage

Phase 4 currently exposes **action** endpoints (`/auth/login`, `/api/v1/transactions/assess`,
`/vault/otp`, `/vault/review`, `/vault/move-to-vault`, `/honeypot/*`,
`/admin/run-attacker-profiling`, `/admin/feedback`) plus `/health`, `/ready`, and
`/model-info`, but no GET list endpoints for historical transactions, vault cases,
honeypot sessions, or attacker profiles. This dashboard therefore builds its live feeds
from the real responses returned by the actions an analyst performs during the session
(see `src/store/ActivityContext.tsx`). Adding list endpoints on the backend is the
natural next step to make Overview/Safe Vault/Threat Intelligence/Attacker Profiles
persist and reflect full historical state across page reloads and multiple analysts.
