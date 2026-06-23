# 🏸 RallyUp Frontend (badminton-fe)

Next.js 14 (App Router) PWA for **RallyUp**, the Bintang Badminton group app.
Pairs with the API in [badminton-be-rust](https://github.com/vikasm0455/badminton-be-rust).

Stack: Next.js 14 · React 18 · Tailwind v4 · recharts. Service worker for Web
Push + offline shell; mobile-first (390px).

## Run locally

```bash
npm install
npm run dev        # http://localhost:3090
```

In dev, Next proxies `/api/*` and `/health` to the API at `http://localhost:8090`
(override with `API_PROXY`), so the browser sees a single origin and the
SameSite=Strict auth cookie works without CORS. Start the API first
([badminton-be-rust](https://github.com/vikasm0455/badminton-be-rust)).

## Build / Deploy (Docker)

The app builds to a standalone Node server (`output: "standalone"`).

```bash
npm run build && npm start     # local production build on :3090
```

GitHub Actions (`.github/workflows/deploy.yml`) builds and pushes
`vikasm0455/badminton-fe:latest` to Docker Hub on every push to `main`. The
production stack (API + FE + Postgres + Redis + Nginx) is orchestrated by the
`docker-compose.yml` in the **badminton-be-rust** repo, which pulls this image.

At runtime set `API_PROXY` to the API's internal URL (compose sets
`http://badminton-api:8090`); Nginx routes `/api` to the API and everything else
here.

### Required CI secrets

| Secret | Purpose |
|---|---|
| `DOCKER_USERNAME` | Docker Hub user (`vikasm0455`) |
| `DOCKER_TOKEN` | Docker Hub access token |

> Note: unlike WatchWhere (where the static SPA is baked into the backend
> image), this Next.js app ships as its own image — so pushing here rebuilds the
> FE independently; no backend `repository_dispatch` is needed.
