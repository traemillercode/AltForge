# AltForge

Bulk alt-text for accessibility audits. Generate WCAG-compliant alt text for hundreds of images in minutes using AI.

## Project Structure

```
AltForge/
├── backend/        # Bun + Hono API server
│   ├── src/
│   │   ├── index.ts          # Server entry point
│   │   ├── db/index.ts       # SQLite database setup
│   │   ├── routes/auth.ts    # Auth endpoints
│   │   ├── middleware/auth.ts # Session middleware
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
└── README.md
```

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, React Router
- **Backend:** Bun, Hono, SQLite (bun:sqlite)
- **Auth:** Email + password with bcrypt hashing, httpOnly session cookies

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (>= 1.1.0)

### Install Dependencies

```bash
# Backend
cd backend
bun install

# Frontend
cd ../frontend
bun install
```

### Environment Variables

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend (optional — Vite proxy handles API in dev)
cp frontend/.env.example frontend/.env
```

### Run Development Servers

```bash
# Terminal 1: Backend (port 3000)
cd backend
bun run dev

# Terminal 2: Frontend (port 5173, proxies /api to backend)
cd frontend
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
cd frontend
bun run build
# Outputs to frontend/dist/
```

## Database

SQLite database is created automatically at `backend/data/altforge.db` on first run.

### Schema

- **users** — id, email, password_hash, credits (default 25), created_at
- **jobs** — id, user_id, type (csv/crawl), status, total_images, source_url, source_filename, timestamps
- **results** — id, job_id, image_url, alt_text, char_count, status, context_text, created_at

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/signup` | Create account (25 free credits) |
| POST | `/api/auth/login` | Log in |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Log out |

## Accessibility

AltForge itself meets WCAG 2.1 AA standards:
- Proper heading hierarchy
- Visible focus indicators on all interactive elements
- Skip-to-content link
- Semantic HTML and ARIA landmarks
- Sufficient color contrast (4.5:1 for text, 3:1 for large text)
- All images include alt text
- Keyboard-navigable throughout
