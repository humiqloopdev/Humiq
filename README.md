# Humiq Loop Platform

AI-powered global hiring platform — candidate, employer, and admin portals with mock-auth demo mode.

## Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite 7 |
| Routing | TanStack Router (file-based) |
| Data fetching | TanStack Query v5 |
| Tables | TanStack Table v8 |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS v4 + Radix UI primitives |
| State | Zustand |
| Testing | Vitest + Testing Library |

## Getting started

```bash
npm install
cp .env.example .env   # set VITE_API_URL if you have a real backend
npm run dev
```

Visit `http://localhost:5173`. Use the demo accounts shown on the login screen
(admin / employer / candidate) — the app runs entirely on a mock auth layer
(`src/api/auth/mockAuth.ts`), no backend required.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — typecheck + production build
- `npm run preview` — preview the production build
- `npm run generate-routes` — regenerate `src/routeTree.gen.ts` from `src/routes/`
- `npm test` — run Vitest in watch mode
- `npm run test:run` — run Vitest once (CI mode)

## Project structure

```
src/
  api/<domain>/        # authApi.ts (or candidateApi.ts etc.) + useXQueries.ts (React Query hooks) + index.ts barrel
  components/ui/<area>/  # common, layout, auth, candidate, employer, admin
  hooks/                # generic hooks (useDebounce, useClickOutside, useLocalStorage)
  lib/                  # http.ts (axios instance), utils.ts (cn helper)
  routes/               # TanStack Router file-based routes
    _authenticated.tsx       # auth guard layout (redirects to /login if signed out)
    _authenticated/
      candidate.tsx           # role guard (candidate only) + candidate/*.tsx leaf routes
      employer.tsx             # role guard (employer only) + employer/*.tsx leaf routes
      admin.tsx                 # role guard (admin only) + admin/*.tsx leaf routes
      onboarding.tsx             # role guard (candidate only) + onboarding/*.tsx leaf routes
  schemas/              # Zod schemas, shared by forms via @hookform/resolvers/zod
  store/                # Zustand authStore (replaces old React Context)
  types/                # shared TypeScript types
```

### Adding a new feature (per the project convention)

1. **API** — add types to `src/types/`, create a function in `src/api/<domain>/`, export a
   React Query hook from `useXQueries.ts` in that same folder.
2. **Route** — add a file under `src/routes/_authenticated/` (or directly under `src/routes/`
   for public pages) and run `npm run generate-routes`.
3. **Component** — build the UI under `src/components/ui/<area>/` using existing
   Radix/Tailwind primitives from `src/components/ui/common`.
4. **Sidebar** — register the new route in `src/components/ui/layout/sidebar.tsx` if it
   needs a nav entry.

## Migration notes

This project was migrated from a Create React App + React 18 + react-router-dom + axios
stack to the table above. Key behavioral notes:

- All original routes, role guards, and redirect behavior were preserved exactly
  (including a couple of dead sidebar/nav links — e.g. `/profile`, `/settings`,
  `/employer/jobs` — that had no matching page in the original app either and fell
  through to the catch-all redirect; that fallback behavior is preserved here).
- `ForgotPasswordPage` is new: the original had a `forgotPasswordSchema` and a
  "Forgot password?" link pointing at `/forgot-password`, but no page implementing it.
  A minimal page was added so the link isn't dead.
- The custom `useZodForm` hook was replaced by React Hook Form + `zodResolver`, reusing
  the same Zod schemas unchanged.
- The custom `<DataTable>` (plain `<table>`) was rebuilt on TanStack Table v8, keeping
  the same `cols`/`rows` call signature so existing call sites didn't need to change.
- `Modal`, `Tabs`, and the account dropdown menu were rebuilt on Radix primitives
  (`Dialog`, `Tabs`, `DropdownMenu`).
- `AuthContext` (React Context) was replaced by a Zustand store (`src/store/authStore.ts`)
  with the same `login`/`register`/`logout`/role-flag API.
