# NoteNext — Frontend

Encrypted paste / URL-shortener frontend (Next.js 16). The browser talks to the
backend API **directly** — there is no server-side proxy. The app can be
deployed either to **Cloudflare Pages** or to any **VPS via Docker**.

## Configuration

Set the backend URL with `NEXT_PUBLIC_API_BASE_URL`. It is inlined into the
client bundle at **build time** (not runtime), so it must be present when you
build. Copy `.env.example` to `.env.local` for local dev:

```bash
cp .env.example .env.local
```

> ⚠️ Because the browser calls the backend cross-origin, the backend must send
> CORS headers (`Access-Control-Allow-Origin` for this app's origin, plus the
> `DELETE` method and the `X-Delete-Token` / `Delete-Token` headers).

## Local development

```bash
npm install
npm run dev
# http://localhost:3000
```

## Deploy: Docker / VPS

Docker does **not** run on Cloudflare Pages — use it on a VPS. The image builds
a standalone Node server (`output: 'standalone'`).

```bash
# Build (pass your backend URL so it gets inlined)
docker build -t notenext-frontend \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api-notenext.suvojeetsengupta.in .

# Run
docker run --rm -p 3000:3000 notenext-frontend
```

Or with Compose:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api-notenext.suvojeetsengupta.in docker compose up --build
```

Put nginx/Caddy in front for TLS. To build the standalone server without Docker:

```bash
npm run build:standalone
node .next/standalone/server.js
```

## Deploy: Cloudflare Pages

```bash
npm run pages:build     # @cloudflare/next-on-pages
npm run pages:preview    # local preview
npm run pages:deploy     # deploy
```

In the Cloudflare Pages dashboard, set `NEXT_PUBLIC_API_BASE_URL` as a build
environment variable and use `npm run pages:build` as the build command with
`.vercel/output/static` as the output directory.
