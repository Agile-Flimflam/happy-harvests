# Happy Harvests - Internal App

This is a Next.js application for managing garden plots, beds, plants, and crops.

## Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, TypeScript)
- **Database & Auth:** [Supabase](https://supabase.com/)
- **UI:** [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **Styling:** Tailwind CSS
- **Notifications:** [Sonner](https://sonner.emilkowal.ski/)
- **Forms:** React Hook Form (via shadcn/ui), Zod (for validation)
- **Linting/Formatting:** ESLint, Prettier
- **Hooks:** Husky (pre-commit)
- **Package Manager:** pnpm

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

4.  **Set up Supabase CLI and link project:**
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

5.  **Apply Database Migrations:**
    - The initial schema is in `supabase/migrations`. Apply it to your Supabase database:
      ```bash
      supabase db push
      ```

6.  **Generate TypeScript Types from Schema:**
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

7.  **Seed the database (Optional but Recommended):**
    - The `supabase/seed.sql` script contains demo data.
      ```bash
      supabase db reset
      ```
      _(This command first drops the existing local database (if any), applies migrations, and then runs the seed script. Use with caution if you have important local data.)_
      *Alternatively, to run *only* the seed script on an existing database:* `psql -h localhost -p 54322 -U postgres -f supabase/seed.sql` _(Adjust port if necessary, password is `postgres` by default for local Supabase dev)_

8.  **Initialize shadcn/ui & Add Components:**
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

9.  **Add Toaster Component:**
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

10. **Run the development server:**

    ```bash
    pnpm dev
    ```

11. **Open the app:**
    Navigate to [http://localhost:4000](http://localhost:4000) in your browser. You should be redirected to `/login`. Use the email link login to access the dashboard.

## Gemini-based Code Review & Test Scaffolding

This project includes helper scripts that use Google's Gemini API for code review, PR description generation, and test scaffolding:

- `pnpm gemini:review` – runs an AI-assisted code review for the current PR
- `pnpm gemini:describe` – generates a PR description based on code changes
- `pnpm gemini:scaffold` – generates Jest test scaffolding for new TypeScript/TSX files

These commands require the following environment variables to be set (locally or in CI):

```bash
export GEMINI_API_KEY="your-gemini-api-key"
export GITHUB_TOKEN="your-github-token"
```

If either variable is missing or empty, the Gemini scripts will fail with a clear error message.

## Row Level Security (RLS)

- RLS policies are included as comments in the initial migration (`supabase/migrations/..._initial_schema.sql`) and are essential for securing your data.
- You **must** enable RLS for each table in the Supabase dashboard (**Table Editor > Select Table > Table Settings > Enable Row Level Security (RLS)**) or via SQL (`alter table <table_name> enable row level security;`).
- Apply the example policies provided in the migration file using the Supabase SQL editor or by adding them to a new migration file (`supabase migration new add_rls_policies`) and running `supabase db push`.
- The example policies allow any authenticated user full CRUD access. You should refine these based on your specific authorization needs (e.g., only owners can modify certain records).

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
