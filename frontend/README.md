# Stockholm Price Intelligence (frontend)

Next.js + Tailwind UI for the Stockholm Price Intelligence API.

For full project documentation (backend, training, API scripts), see the repo root README.

## Run locally

From repo root:

```bash
cd frontend
copy .env.example .env.local
npm ci
npm run dev
```

Open: http://localhost:3000

## API base URL

The UI reads the API base URL from `NEXT_PUBLIC_API_BASE_URL` in `.env.local`.

Examples:
- SCB API: `http://localhost:8000`
- Full-feature API: `http://localhost:8001`
