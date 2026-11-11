# Wrold

Spaceship is a Next.js app for managing GitHub-backed translation projects. Users can create accounts, connect their GitHub installation, create translation projects from repositories, manage translation files, and collaborate through invite tokens.

## Overview

The product is organized around a few core flows:
- Account creation and session-based authentication
- GitHub App installation and repository selection
- Project creation and permission management
- Translation file inspection and updates
- Invite-token based collaboration for teams

## Stack

- Next.js 16
- React 19
- TypeScript
- Drizzle ORM
- Neon Postgres
- GitHub App API via Octokit
- Argon2 for password hashing

## Sitemap

```text
wrold/
├── auth/
│   ├── login/
│   └── signin/
├── dashboard/
├── invite/[token]/
├── projects/
│   └── [project]/
│       ├── [locale]/
│       │   └── [[...path]]
│       └── (page)
└── settings/
```

## Key routes

```text
/auth/login         Login page
/auth/signin        Sign-up page
/dashboard          User's project dashboard
/invite/[token]     Redeem project invite token
/projects/new       Create a project from a repo
/projects/[project] Project details and translation config
/settings           Account and session settings
```

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env` or `.env.local`:
   ```bash
   DATABASE_URL=...
   GITHUB_APP_ID=...
   GITHUB_APP_KEY=...
   ```

3. Start the app locally:
   ```bash
   npm run dev
   ```

4. Open the app in your browser:
   ```text
   http://localhost:3000
   ```

## Database

The app uses Drizzle with a Postgres-compatible database. The schema is defined in `app/db/schema.ts` and initialized through the configured `DATABASE_URL`.

## GitHub integration

The app connects to GitHub using a GitHub App. After installation, it stores the installation ID and account on the user record and then uses Octokit to list repos, inspect files, and create translation branches when needed.

## Documentation

- API reference: `app/api/README.md`
- Database schema: `app/db/schema.ts`
- Project utilities: `app/util/`

## Scripts

```bash
npm run dev      # start the Next.js development server
npm run build    # production build
npm run start    # run the production build
npm run lint     # run ESLint
npm run drizzle  # generate and apply Drizzle migrations
```

## Notes

This project is still under active development, and some endpoints and UI flows are implementation-focused rather than fully polished. The API README documents the current behavior and request/response patterns used by the application.