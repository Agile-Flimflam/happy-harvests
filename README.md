# Happy Harvests - Internal App

This is a Next.js application for managing garden plots, beds, plants, and crops.

## Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, TypeScript)
- **Database & Auth:** [Supabase](https://supabase.com/)
- **UI:** [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **Styling:** Tailwind CSS
- **Maps & Geocoding:** [Mapbox](https://www.mapbox.com/) (address autocomplete and interactive maps)
- **Notifications:** [Sonner](https://sonner.emilkowal.ski/)
- **Forms:** React Hook Form (via shadcn/ui), Zod (for validation)
- **Linting/Formatting:** ESLint, Prettier
- **Hooks:** Husky (pre-commit)
- **Package Manager:** pnpm

## Quality gates (CI)

- `pnpm lint`
- `pnpm type-check`
- `pnpm test`

CI runs these checks on every PR and blocks merges on failure.

## Local Development Setup

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd happy-harvests
    ```

2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

3.  **Set up Supabase:**
    - Create a new project on [Supabase](https://app.supabase.com).
    - In your Supabase project dashboard, go to **Project Settings > API**.
    - Copy the **Project URL** and the **`anon` public key**.
    - Create a `.env.local` file in the root of your project by copying `.env.local.example`:
      ```bash
      cp .env.local.example .env.local
      ```
    - Paste your Supabase URL and Anon key into `.env.local`:
      ```
      NEXT_PUBLIC_SUPABASE_URL="YOUR_SUPABASE_URL"
      NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
      # Used to construct absolute redirect URLs for OAuth
      NEXT_PUBLIC_SITE_URL="http://localhost:4000"
      ```
    - **Enable Email Provider:** Go to **Authentication > Providers** in your Supabase dashboard and enable the **Email** provider. Disable "Confirm email" if you want users to be logged in instantly after clicking the magic link, otherwise they'll need to confirm their email first.
    - **Enable Google Provider:** In **Authentication > Providers > Google**, paste the **Client ID** and **Client Secret** from Google Cloud Console.
      - In Google Cloud Console, configure:
        - Authorized JavaScript origins: `http://localhost:4000` (dev) and your production origin (e.g., `https://app.happyharvests.com`).
        - Authorized redirect URIs: `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback` (replace with your Supabase project ref). Add one per environment if using separate Supabase projects.
      - In this app, OAuth sign-in will redirect to: `${NEXT_PUBLIC_SITE_URL}/auth/callback?next=/` which then exchanges the code and returns you to the app.

4.  **Set up Mapbox:**
    - Create a free account at [Mapbox](https://www.mapbox.com/) or sign in to your existing account.
    - Navigate to your [Account page](https://account.mapbox.com/) and copy your **Default public token** (or create a new access token if needed).
    - Add the Mapbox access token to your `.env.local` file:

      ```
      # Required: Public token for client-side map display and address autocomplete
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="YOUR_MAPBOX_PUBLIC_TOKEN"

      # Optional: Server-only token for reverse geocoding (more secure)
      # If not provided, the API route will fall back to NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      MAPBOX_ACCESS_TOKEN="YOUR_MAPBOX_SERVER_TOKEN"
      ```

    - **⚠️ Security Warning:** The `NEXT_PUBLIC_` prefix makes this variable available to client-side code, which is required for Mapbox to work in the browser. **This means your Mapbox access token will be visible in the browser's source code and network requests.**
      - Use a **public token** (typically starts with `pk.`), NOT a secret token (starts with `sk.`)
      - Configure **URL restrictions** in your Mapbox account to limit token usage to your domain(s)
      - Set **minimal scopes** (only styles:read, fonts:read, sprites:read for maps; geocoding for autocomplete)
      - Set up **rate limiting** and **usage quotas** in Mapbox to prevent abuse
      - Monitor your Mapbox usage regularly for unexpected activity
      - See the [Security Best Practices](#security-best-practices) section below for more information

5.  **Set up Supabase CLI and link project:**
    - Install the Supabase CLI: Follow instructions at [docs.supabase.com/guides/cli](https://supabase.com/docs/guides/cli)
    - Log in to the CLI:
      ```bash
      supabase login
      ```
    - Link your local project to your Supabase project (replace `<your-project-ref>` with your actual Supabase project reference found in Project Settings > General):
      ```bash
      supabase link --project-ref <your-project-ref>
      ```
      (Enter your database password when prompted - you can find/reset this in Project Settings > Database)

6.  **Apply Database Migrations:**
    - The initial schema is in `supabase/migrations`. Apply it to your Supabase database:
      ```bash
      supabase db push
      ```

7.  **Generate TypeScript Types from Schema:**
    - This step generates accurate TypeScript types based on your database schema, which are used in the Supabase client helper (`lib/supabase.ts`) and server actions.
      ```bash
      supabase gen types typescript --linked > lib/database.types.ts
      ```
    - **Important:** After generating, open `lib/supabase.ts` and replace the placeholder `Database` type definition with the actual import:

      ```diff
      -// Define a placeholder type for your database schema...
      -// export type Database = { ... };
      + import type { Database } from './database.types' // Use generated types

      // Type aliases for convenience
      export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
      // ... rest of the file
      ```

8.  **Seed the database (Optional but Recommended):**
    - The `supabase/seed.sql` script contains demo data.
      ```bash
      supabase db reset
      ```
      _(This command first drops the existing local database (if any), applies migrations, and then runs the seed script. Use with caution if you have important local data.)_
      *Alternatively, to run *only* the seed script on an existing database:* `psql -h localhost -p 54322 -U postgres -f supabase/seed.sql` _(Adjust port if necessary, password is `postgres` by default for local Supabase dev)_

9.  **Initialize shadcn/ui & Add Components:**
    - Run the `shadcn` init command (accept defaults or configure as needed):
      ```bash
      pnpm dlx shadcn@latest init
      ```
    - Add the necessary UI components and the notification library:
      ```bash
      pnpm dlx shadcn@latest add button input label checkbox dialog table select card textarea badge sonner
      ```
    - Install icon library:
      ```bash
      pnpm add lucide-react
      ```
    - Install date formatting library:
      ```bash
      pnpm add date-fns
      ```
    - Install Supabase helpers:
      ```bash
      pnpm add @supabase/ssr @supabase/supabase-js
      ```
    - Install Zod for validation:
      ```bash
      pnpm add zod
      ```

10. **Add Toaster Component:**
    - The `sonner` library requires its `<Toaster />` component to be present in your layout to render toasts.
    - Open `app/layout.tsx` (or your root layout file) and add the import and component:

      ```tsx
      // app/layout.tsx (or similar root layout)
      import { Toaster } from '@/components/ui/sonner'; // Import Toaster

      export default function RootLayout({ children }: { children: React.ReactNode }) {
        return (
          <html lang="en">
            <body>
              {children}
              <Toaster richColors /> {/* Add Toaster here */}
            </body>
          </html>
        );
      }
      ```

11. **Run the development server:**

    ```bash
    pnpm dev
    ```

12. **Open the app:**
    Navigate to [http://localhost:4000](http://localhost:4000) in your browser. You should be redirected to `/login`. Use the email link login to access the dashboard.

## Gemini-based Code Review & Test Scaffolding

This project includes helper scripts that use Google's Gemini API for code review, PR description generation, and test scaffolding:

- `pnpm gemini:review` – runs an AI-assisted code review for the current PR
- `pnpm gemini:describe` – generates a PR description based on code changes
- `pnpm gemini:scaffold` – generates Jest test scaffolding for new TypeScript/TSX files

These commands now use Vertex AI with workload identity (no API keys). Set the following environment variables locally or in CI:

```bash
export GCP_PROJECT_ID="your-gcp-project-id"
export GCP_LOCATION="your-vertex-location" # e.g., us-central1
export GCP_SA_EMAIL="workload-identity-sa@your-project.iam.gserviceaccount.com"
export GITHUB_TOKEN="your-github-token"
```

If required values are missing, the Gemini scripts will fail with a clear error message. In GitHub Actions, authentication is handled via workload identity federation (`google-github-actions/auth@v2`); the scripts rely on Application Default Credentials produced by that step.

## Row Level Security (RLS)

- RLS policies are included as comments in the initial migration (`supabase/migrations/..._initial_schema.sql`) and are essential for securing your data.
- You **must** enable RLS for each table in the Supabase dashboard (**Table Editor > Select Table > Table Settings > Enable Row Level Security (RLS)**) or via SQL (`alter table <table_name> enable row level security;`).
- Apply the example policies provided in the migration file using the Supabase SQL editor or by adding them to a new migration file (`supabase migration new add_rls_policies`) and running `supabase db push`.
- The example policies allow any authenticated user full CRUD access. You should refine these based on your specific authorization needs (e.g., only owners can modify certain records).

## Security Best Practices

### Environment Variables

- **Client-Side Exposure:** Any environment variable prefixed with `NEXT_PUBLIC_` will be bundled into your client-side JavaScript and is visible to anyone who views your website's source code or network requests. Never use `NEXT_PUBLIC_` for sensitive credentials like API secrets, database passwords, or private keys.
- **Server-Side Only:** Use environment variables without the `NEXT_PUBLIC_` prefix for sensitive values that should only be accessible on the server (e.g., Supabase service role key, OAuth client secrets).

### Mapbox Access Tokens

**Important Security Note:** The `mapbox-gl` and `@mapbox/search-js-react` libraries require the access token to be passed as a prop, which means it will be embedded in the client-side JavaScript bundle. This is a limitation of these libraries.

**Security Measures Implemented:**

- ✅ Reverse geocoding requests are proxied through `/api/mapbox/reverse-geocode` to keep the token server-side
- ✅ Token validation warns in development if a secret token (sk.\*) is detected (though the code will still run - you must use a public token)
- ✅ Token is never logged or exposed in error messages
- ✅ Token is only used for read-only operations (map display via `mapbox-gl` and address autocomplete via `@mapbox/search-js-react`)

**Required Security Practices:**

1. **Use Public Tokens Only:**
   - Always use Mapbox **public tokens** (typically start with `pk.`) for client-side applications
   - **NEVER** use secret tokens (start with `sk.`) in client-side code
   - Public tokens are designed to be exposed in the browser, but must still be properly secured

2. **Configure URL Restrictions:**
   - In your [Mapbox account settings](https://account.mapbox.com/), restrict your public token to specific domains to prevent unauthorized usage.

   **Option A: Single Token with Multiple Domains (Recommended for simplicity)**

   Add all domains where your app will run:
   - Production domain: `https://app.happyharvests.com`
   - Staging domain (if applicable): `https://staging.happyharvests.com`
   - Preview deployments: Use wildcard patterns where supported (e.g., `*.vercel.app` for Vercel preview deployments)
   - Local development: `http://localhost:*` (if Mapbox supports port wildcards) or add specific ports like `http://localhost:4000`

   **Option B: Separate Tokens per Environment (Recommended for security)**

   Create different tokens for different environments:
   - **Production token:** Restricted to production domain only
   - **Staging token:** Restricted to staging domain only
   - **Development token:** Restricted to `http://localhost:*` or specific local ports
   - **Preview token:** Restricted to preview deployment patterns (e.g., `*.vercel.app`)

   Use environment-specific tokens in your deployment configuration (e.g., Vercel environment variables).

   **Important Notes:**
   - Mapbox URL restrictions support wildcard patterns for subdomains (e.g., `*.vercel.app`)
   - Port wildcards may not be supported - you may need to add specific ports or use `localhost` without port restrictions for development
   - Preview deployments (e.g., Vercel preview URLs) change with each PR, so wildcard patterns are essential
   - If you have multiple developers, consider using a shared development token with localhost restrictions or individual tokens per developer

3. **Set Minimal Token Scopes:**
   - For map display: Only enable `styles:read`, `fonts:read`, `sprites:read`
   - For address autocomplete: Only enable geocoding API access
   - **DO NOT** enable uploads, datasets, or any write permissions

4. **Set Usage Limits:**
   - Configure rate limits and usage quotas in Mapbox to prevent abuse and unexpected charges:
     - Set daily/monthly request limits
     - Enable usage alerts
     - Monitor usage regularly in the Mapbox dashboard

5. **Rotate Tokens:**
   - If you suspect a token has been compromised, immediately revoke it in Mapbox and generate a new one
   - Rotate tokens periodically as a security best practice

6. **Server-Side Token (Optional but Recommended):**
   - For reverse geocoding, you can optionally use `MAPBOX_ACCESS_TOKEN` (without `NEXT_PUBLIC_` prefix) in your `.env.local`
   - The API route will prefer the server-only token over the public token
   - This provides an additional layer of security for server-only operations

### Supabase Keys

- **Anon Key:** The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose client-side as it's designed for public use. However, RLS policies must be properly configured to secure your data.
- **Service Role Key:** Never expose the Supabase service role key. It should only be used in server-side code and must never have the `NEXT_PUBLIC_` prefix.

### General Security Recommendations

- Regularly review and update your dependencies for security vulnerabilities
- Keep your Supabase RLS policies up to date and follow the principle of least privilege
- Use HTTPS in production to encrypt data in transit
- Never commit `.env.local` or `.env` files to version control (they should be in `.gitignore`)
- Use different credentials for development, staging, and production environments

## E2E Testing with Playwright

This project uses [Playwright](https://playwright.dev/) for end-to-end testing.

### Running E2E Tests Locally

1. **Install Playwright browsers** (first time only):

   ```bash
   pnpm playwright:install
   ```

2. **Start the development server** (in one terminal):

   ```bash
   pnpm dev
   ```

3. **Run E2E tests** (in another terminal):

   ```bash
   # Run tests headlessly
   pnpm test:e2e

   # Run tests with UI mode (interactive)
   pnpm test:e2e:ui

   # Run tests on a specific browser
   pnpm test:e2e --project=chromium
   ```

### Test Configuration

- Test files are located in `tests/e2e/`
- Base URL defaults to `http://localhost:4000` (configurable via `PLAYWRIGHT_BASE_URL` environment variable)
- Tests run against Chromium, Firefox, and WebKit browsers
- Screenshots and videos are captured on test failures
- HTML reports are generated after test runs

### CI/CD Integration

E2E tests run automatically in the CI/CD pipeline:

- Tests execute after the build job completes
- Test artifacts (videos, screenshots, HTML reports) are uploaded to GitHub Actions
- Tests run with retries enabled for flaky test handling

## Testing Database Migrations Locally

Before creating a PR with database migrations, it's important to test them locally to ensure they apply correctly and don't introduce errors.

### Quick Validation

The easiest way to validate all migrations is using the `db:validate` script:

```bash
pnpm db:validate
```

**⚠️ Warning:** This script is **destructive** and will reset your local database from scratch. Use with caution if you have important local data that isn't backed up.

This script will:

- Start a local Supabase instance (if not already running)
- Apply all migrations from scratch using `supabase db reset`
- Automatically run the seed script (`supabase/seed.sql`) to populate test data
- Verify migrations complete successfully
- Provide clear success/failure output

**Note:** `supabase db reset` applies **all migration files** in your local `supabase/migrations/` directory, **including uncommitted or modified files**. If you only want to validate committed migrations, ensure your working directory is clean (or stash/untracked changes) before running `pnpm db:validate`.

### Manual Testing Steps

1. **Start local Supabase** (if not already running):

   ```bash
   pnpm db:start
   ```

2. **Test all migrations from scratch**:

   ```bash
   pnpm db:reset
   ```

   **⚠️ Warning:** This command is **destructive** - it drops your local database completely.

   This command will:
   - Drop the existing local database (if any)
   - Apply all migrations in order
   - Automatically run the seed script (`supabase/seed.sql`) to populate test data

   **Use with caution if you have important local data that isn't backed up.**

3. **Test a specific migration**:
   - To test migrations incrementally, you can use:
     ```bash
     supabase migration up
     ```
   - This applies only pending migrations without resetting the database.

4. **Verify migration syntax**:
   - The Supabase CLI will validate SQL syntax when applying migrations
   - Check the output for any errors or warnings
   - Ensure all migrations are idempotent (can be run multiple times safely)

### Best Practices

- **Always test migrations locally** before creating a PR
- **Test from a clean state** using `db:reset` to catch issues with migration ordering
- **Verify migrations are reversible** if you plan to create down migrations
- **Check for breaking changes** that might affect existing data or application code
- **Run the validation script** (`pnpm db:validate`) to match CI/CD behavior

### CI/CD Integration

Migrations are automatically validated in the CI/CD pipeline on pull requests:

- The `validate-migrations` job runs on all PRs (not on main branch)
- It starts a fresh Supabase instance and applies all migrations
- PRs will fail if migrations have errors, preventing broken migrations from being merged
- The actual deployment to production only happens when code is merged to `main`

## Husky Pre-commit Hook

A pre-commit hook is set up using Husky and `lint-staged` (assuming `package.json` is configured) to automatically lint and format staged files before committing.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
