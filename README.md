# FocusClub

Group coworking platform matching solo workers into groups of 3-5 at partner cafes in Bangalore.

## Tech Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Auth, Postgres, Edge Functions, Realtime, Storage)
- **Hosting:** Vercel

## Development

```bash
npm install
npm run dev        # Start dev server (localhost:8080)
npm run build      # Production build
npm run lint       # ESLint
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```
