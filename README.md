# AltForge

Bulk alt-text for accessibility audits. Generate WCAG 2.1 AA-compliant alt text for hundreds of images in minutes using AI.

## Project Structure

```
AltForge/
├── backend/        # Bun + Hono API server
│   ├── src/
│   │   ├── index.ts          # Server entry point
│   │   ├── db/index.ts       # SQLite database setup
│   │   ├── routes/auth.ts    # Auth endpoints
│   │   ├── routes/jobs.ts    # Job CRUD, processing, export
│   │   ├── routes/credits.ts # Credit management
│   │   ├── middleware/auth.ts # Session middleware
│   │   ├── ai.ts             # OpenAI GPT-4o-mini integration
│   │   ├── crawler.ts        # Website crawler for image discovery
│   │   └── types.ts          # Shared types
│   └── package.json
├── frontend/       # React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── main.tsx          # React entry
│   │   ├── App.tsx           # Router setup
│   │   ├── pages/            # Page components
│   │   ├── components/       # Shared components
│   │   └── lib/              # API client, auth context
│   └── package.json
├── package.json    # Root scripts (build, start, dev)
└── README.md
```

## Tech Stack

- **Frontend:** React 18, Vite 6, TypeScript, Tailwind CSS 3, React Router 6
- **Backend:** Bun, Hono 4, SQLite (bun:sqlite)
- **AI:** OpenAI GPT-4o-mini (vision-capable, generates alt-text from images)
- **Auth:** Email + password with bcrypt hashing, httpOnly session cookies (7-day TTL)

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (>= 1.1.0)
- An [OpenAI API key](https://platform.openai.com/api-keys) (for AI alt-text generation)

### Quick Start

```bash
# 1. Clone and install dependencies
cd AltForge
cd backend && cp .env.example .env && bun install
cd ../frontend && cp .env.example .env && bun install

# 2. Set your OpenAI API key in backend/.env
#    OPENAI_API_KEY=sk-your-key-here

# 3. Start development servers
# Terminal 1: Backend (port 3000)
cd backend
bun run dev

# Terminal 2: Frontend (port 5173, proxies /api to backend)
cd frontend
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Mode

```bash
# Build the frontend
cd frontend
bun run build

# Start the production server (serves API + frontend on port 3000)
cd ../backend
NODE_ENV=production bun run start
```

Or use root scripts:

```bash
bun run build   # builds frontend only
bun run start   # builds frontend + starts production server on :3000
```

The production server serves the built frontend from `frontend/dist` and falls back to `index.html` for client-side routing.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend origin for CORS |
| `DATABASE_PATH` | `./data/altforge.db` | SQLite database path |
| `OPENAI_API_KEY` | *required* | OpenAI API key for alt-text generation |
| `NODE_ENV` | `development` | Set to `production` to serve built frontend |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000` | Backend API base URL |

## Database

SQLite database is created automatically at `backend/data/altforge.db` on first run.

### Schema

- **users** — id, email, password_hash, credits (default 25), created_at
- **jobs** — id, user_id, type (csv/crawl), status, total_images, processed_images, source_url, source_filename, timestamps
- **results** — id, job_id, image_url, alt_text, char_count, status, context_text, created_at

## API Endpoints

### Auth (no auth required)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/signup` | Create account (25 free credits) |
| `POST` | `/api/auth/login` | Log in |
| `GET` | `/api/auth/me` | Get current user |
| `POST` | `/api/auth/logout` | Log out |

### Jobs (auth required)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/jobs` | List all jobs |
| `POST` | `/api/jobs/csv` | Upload CSV (multipart form) |
| `POST` | `/api/jobs/crawl` | Crawl website for images |
| `GET` | `/api/jobs/:id` | Get job with results |
| `POST` | `/api/jobs/:id/process` | Start AI processing |
| `GET` | `/api/jobs/:id/progress` | Poll processing progress |
| `PUT` | `/api/jobs/:jobId/results/:resultId` | Update alt text |
| `GET` | `/api/jobs/:id/export` | Export as CSV or HTML |

### Credits (auth required)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/credits/balance` | Get credit balance |
| `POST` | `/api/credits/add` | Add credits (admin) |

### Dashboard (auth required)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dashboard` | User info + job count |

## Frontend Routes

| Path | Auth | Description |
|------|------|-------------|
| `/` | No | Landing page |
| `/pricing` | No | Pricing plans |
| `/terms` | No | Terms of service |
| `/login` | No | Login form |
| `/signup` | No | Signup form |
| `/dashboard` | Yes | User dashboard |
| `/upload` | Yes | CSV upload + job list |
| `/jobs/:id` | Yes | Job detail + results table |

## Accessibility

AltForge itself meets WCAG 2.1 AA standards:
- Proper heading hierarchy on every page
- Visible focus indicators on all interactive elements (2px #2563eb outline)
- Skip-to-content link on every page
- Semantic HTML and ARIA landmarks (banner, main, contentinfo, navigation)
- All form inputs have associated labels and error messaging via `aria-describedby`
- Sufficient color contrast (brand colors meet 4.5:1 ratio)
- All icons and SVGs include `aria-hidden="true"` for decorative images
- Keyboard-navigable throughout — all interactive elements focusable
- Loading and status states announced to screen readers via `role="status"`

## License

Proprietary — all rights reserved.
