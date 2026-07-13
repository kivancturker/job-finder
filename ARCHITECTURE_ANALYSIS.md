# Architecture Analysis & Refactoring Blueprint — DeepTech Job Radar

> **Generated:** 2026-07-13  
> **Scope:** Full monorepo (`backend/` + `frontend/`)  
> **Production LOC:** ~2,950 (Backend ~1,565 · Frontend ~1,385)

---

## 1. Architectural Overview

### High-Level Pattern

DeepTech Job Radar follows a **Monorepo Client–Server** architecture with a **React SPA frontend** and a **Node.js Express REST API backend** backed by an embedded **SQLite database**. Real-time updates are delivered via **Server-Sent Events (SSE)**. The system employs a **sequential in-memory task queue** for scraping orchestration and a **multi-provider LLM integration layer** for AI-powered job evaluation.

### Data Flow & Component Dependency Map

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Vite + React)                        │
│                                                                         │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────────────────────┐ │
│  │  Layout   │──▶│  Page Views   │──▶│  Inline fetch() calls (no API  │ │
│  │ (Sidebar) │   │ (6 pages)     │   │  service layer)                │ │
│  └──────────┘   └──────────────┘   └──────────────┬───────────────────┘ │
│       │              │                             │                     │
│       │     ┌────────┘                             │                     │
│       ▼     ▼                                      │                     │
│  StartSearchModal                                  │                     │
│  (local type re-decl)                              │                     │
└────────────────────────────────────────────────────┼─────────────────────┘
                                                     │
                        REST API + SSE               │
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express + TS)                          │
│                                                                         │
│  index.ts ──▶ Middleware (cors, json)                                   │
│      │                                                                   │
│      ├──▶ routes/companies.ts ────────────┐                              │
│      ├──▶ routes/searchConfigs.ts ────────┤                              │
│      ├──▶ routes/llmConfigs.ts ───────────┤──▶ db (singleton import)     │
│      ├──▶ routes/jobs.ts ─────────────────┤        │                     │
│      └──▶ routes/runSearch.ts ────────────┘        ▼                     │
│               │                            ┌──────────────┐              │
│               ▼                            │  database.ts  │              │
│      services/queueService.ts              │  (SQLite +    │              │
│               │                            │  better-sqlite3)│            │
│               ▼                            └──────────────┘              │
│      services/scraperService.ts ──┬──▶ services/filterEngine.ts         │
│               │                   └──▶ services/llmService.ts ──▶ db    │
│               │                                                          │
│               ├──▶ axios + cheerio  (Fast scrape)                        │
│               └──▶ playwright       (JS-rendered scrape)                 │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key observation:** Every arrow pointing to `db` is a **direct import of the global singleton**. There is no service layer, repository layer, or dependency injection boundary between route handlers and the database.

---

## 2. Component & Service Breakdown

---

### Backend: `db/database.ts`
- **Purpose:** Creates and exports the singleton `better-sqlite3` instance. Runs `CREATE TABLE IF NOT EXISTS` schema migration on import.
- **Core Logic:**
  - Builds DB path relative to `__dirname` at compile time (`backend/data/jobs.db`).
  - Creates `data/` directory if missing.
  - Enables `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL`.
  - Defines 4 tables: `companies`, `search_configs`, `job_postings`, `llm_configs`.
- **Interactions:** Imported by every route file and by `scraperService.ts` + `llmService.ts` directly.

---

### Backend: `types.ts`
- **Purpose:** Central type definitions. Defines **two layers**: DB Row types (SQLite representation with integer booleans and JSON strings) and API model types (parsed arrays, proper booleans).
- **Key Types (8 interfaces + 1 generic):**
  - `CompanyRow` / `Company` — Structurally identical (no JSON fields to parse).
  - `SearchConfigRow` / `SearchConfig` — Row has JSON strings; API has parsed `string[]` arrays.
  - `JobPostingRow` / `JobPosting` — Row has integer booleans + JSON `tech_stack`; API has proper booleans + `string[]`.
  - `LLMConfigRow` / `LLMConfig` — Row has integer `is_active`; API has boolean.
  - `ApiResponse<T>` — Generic wrapper `{ success, data?, error? }`.

---

### Backend: `routes/companies.ts` (133 lines)
- **Purpose:** Full CRUD for `/api/companies`.
- **Core Functions:**
  - `mapCompany(row)` — Field-by-field copy (no-op since `Company ≡ CompanyRow`).
  - `GET /` — List all, ordered by name.
  - `GET /:id` — Single company.
  - `POST /` — Create. Validates name, `career_url` (URL parse), `scraper_engine` enum. Handles UNIQUE→409.
  - `PUT /:id` — Update. Identical validation to POST (duplicated).
  - `DELETE /:id` — Delete with existence check.
- **Interactions:** Direct `db.prepare(...)` calls. No service layer.

---

### Backend: `routes/searchConfigs.ts` (173 lines)
- **Purpose:** Full CRUD for `/api/search_configs` plus nested `GET /:id/jobs` for fetching matched job postings.
- **Core Functions:**
  - `mapSearchConfig(row)` — Parses JSON fields (`keywords`, `negative_keywords`, `target_countries`). **Duplicated in 2 other files.**
  - `GET /`, `GET /:id`, `POST /`, `PUT /`, `DELETE /` — Standard CRUD.
  - `GET /:id/jobs` — JOIN query with `companies`, maps job rows **inline** (duplicates `mapJobPosting` from `jobs.ts`).
- **Interactions:** Direct `db` import. Contains inline job mapping logic that should be shared.

---

### Backend: `routes/jobs.ts` (125 lines)
- **Purpose:** Job posting detail endpoints: get, mark visited, trigger individual LLM evaluation.
- **Core Functions:**
  - `mapJobPosting(row: any): any` — **Uses `any` types**, defeating TypeScript. Parses `tech_stack`, converts integer booleans.
  - `GET /:id` — Single job with company name via JOIN.
  - `PUT /:id/visit` — Sets `is_visited = 1`.
  - `POST /:id/evaluate` — **60-line orchestration handler**: fetches job → fetches search config → parses JSON → calls LLM → updates DB → re-fetches. Business logic leaked into route.
- **Interactions:** Imports `db`, `LlmService`. Contains duplicated `SearchConfigRow → SearchConfig` conversion.

---

### Backend: `routes/llmConfigs.ts` (146 lines)
- **Purpose:** Full CRUD + mutual-exclusion activation for LLM provider configurations.
- **Core Functions:**
  - `mapLLMConfig(row)` — Converts `is_active` integer to boolean.
  - `activateConfigTransaction` — `db.transaction()` for atomic deactivate-all / activate-one.
  - `POST /` — Create + optional auto-activate. **Race condition**: inserts with `is_active=1` before calling the transaction.
  - `POST /:id/activate` — Standalone activation endpoint.
- **Interactions:** Direct `db` import.

---

### Backend: `routes/runSearch.ts` (115 lines)
- **Purpose:** Triggers scraping runs, queue inspection, SSE streaming, and queue clearing.
- **Core Functions:**
  - `POST /` — Validates config exists, fetches all companies, pushes tasks to `queueService`. Returns 202.
  - `GET /queue` — Returns current queue state.
  - `GET /sse` — SSE endpoint with proper headers, initial-state push, listener registration, and cleanup on disconnect.
  - `POST /clear` — Clears completed/failed tasks.
- **Interactions:** Imports `db` and `queueService`.

---

### Backend: `services/queueService.ts` (123 lines)
- **Purpose:** In-memory sequential task queue with observer pattern for SSE notifications.
- **Core Functions:**
  - `push(companyId, companyName, searchConfigId)` — Enqueues a task, triggers processing.
  - `processNext()` — Sequential processor with `isProcessing` guard. Calls `scrapeCompany()`. 1-second delay between tasks.
  - `addListener` / `removeListener` / `notify` — Observer pattern for real-time event broadcasting.
  - `clearCompleted()` — Removes terminal-state tasks.
- **Interactions:** Direct import of `scrapeCompany` from `scraperService`. No dependency injection.

---

### Backend: `services/scraperService.ts` (315 lines) — **Largest backend file**
- **Purpose:** Core scraping engine. Orchestrates: career page scraping → URL deduplication → job detail fetching → keyword pre-filtering → LLM analysis → DB insertion.
- **Core Functions:**
  - `isJobUrl(url, text)` — Heuristic link classifier. Excludes social/nav, accepts known platforms (Lever, Greenhouse).
  - `cleanHtmlText(html)` — Strips scripts/styles/nav, extracts body text.
  - `scrapeWithCheerio(url, selector)` — HTTP GET + Cheerio DOM parse.
  - `scrapeWithPlaywright(url, selector)` — Headless Chromium scrape with network-idle wait.
  - `fetchJobDetails(url)` — Fetches single job page. Cheerio first, Playwright fallback.
  - `scrapeCompany(companyId, searchConfigId)` — **146-line God function** orchestrating the entire pipeline.
- **Interactions:** Imports `db`, `filterEngine`, `LlmService`. Launches Playwright browser per-call (no pooling).

---

### Backend: `services/llmService.ts` (206 lines)
- **Purpose:** Multi-provider LLM integration (Ollama, OpenAI, Anthropic, OpenRouter).
- **Core Functions:**
  - `extractAndParseJSON(text)` — Robust JSON extractor (strips fences, finds boundaries, validates types).
  - `LlmService.getSystemPrompt()` — Returns the job analysis system prompt.
  - `LlmService.formatUserPrompt(...)` — Formats user prompt with 12K-char text truncation.
  - `LlmService.analyzeJob(...)` — Main entry. Fetches active config from DB, dispatches to provider, parses response.
- **Interactions:** Imports `db` directly to query `llm_configs`. All methods are `static` (class is used as a namespace, not OOP).

---

### Backend: `services/filterEngine.ts` (29 lines)
- **Purpose:** Keyword matching utility for pre-filtering job descriptions.
- **Core Functions:**
  - `matchKeywords(text, keywords)` — Case-insensitive matching with word-boundary awareness for alphanumeric terms and literal matching for special-char terms (C++, .NET).
- **Interactions:** None. Pure utility function. **Best-architected module in the codebase.**

---

### Backend: Test Files (4 files, ~780 lines total)
- `test_scraper_server.ts` (110 lines) — Mock Express server simulating career pages.
- `test_api.ts` (219 lines) — CRUD integration tests via `fetch`.
- `test_queue.ts` (192 lines) — Queue pipeline integration tests.
- `test_ai_pipeline.ts` (259 lines) — Full AI pipeline E2E tests with mock LLM server.
- **All live in `src/`** alongside production code. No test framework. Compiled into `dist/`.

---

### Frontend: `App.tsx` / `main.tsx`
- **Purpose:** Routing configuration and React entry point.
- **Core Logic:** `BrowserRouter` with `Layout` as parent route. 8 child routes mapping to 6 page components. `/` redirects to `/companies`.
- **No issues.** Clean and well-structured.

---

### Frontend: `components/Layout.tsx` (115 lines)
- **Purpose:** App shell — sidebar navigation, connection health indicator, main content outlet.
- **Core Logic:**
  - Sidebar with brand header, `NavLink` items, and "START JOB SEARCH" CTA.
  - Health check: `fetch('/api/companies')` on every `location.pathname` change (using a data endpoint as a health probe).
  - Three-state connection indicator (connected / offline / syncing).
  - Renders `StartSearchModal` and `<Outlet />`.

---

### Frontend: `components/StartSearchModal.tsx` (197 lines)
- **Purpose:** Modal to select a search configuration and trigger a scraping run.
- **Core Logic:** Fetches search configs on open, POSTs to `/api/run-search`, navigates to `/queue` on success.
- **Notable issue:** Locally re-declares a `SearchConfig` interface (3rd copy of this type in the frontend).

---

### Frontend: Page Components (6 total)

| Component | Lines | State Vars | Purpose |
|---|---|---|---|
| `SearchConfigsPage` | 526 | 16 | Master-detail: strategy list + form + matched jobs |
| `LlmConfigPage` | 360 | 10 | LLM config form + stored configs list |
| `QueuePage` | 350 | 3 | Real-time task queue with SSE + fallback polling |
| `CompanyFormPage` | 263 | 7 | Create/edit company form |
| `JobDescriptionPage` | 247 | 4 | Job detail view with AI analysis trigger |
| `CompaniesPage` | 227 | 5 | Company list with inline delete confirmation |

---

### Frontend: `types.ts` (49 lines)
- **Purpose:** TypeScript interface definitions for API models.
- **Exports:** `Company`, `SearchConfig`, `JobPosting`, `LLMConfig`, `ApiResponse<T>`.
- **Critical finding:** These are **manually duplicated** from the backend's `types.ts`. Not shared, not generated.

---

### Frontend: CSS Layer
- `index.css` (67 lines) — Tailwind v4 setup, Google Fonts (Inter, Outfit), glass-effect utilities, custom scrollbar.
- `App.css` (185 lines) — **Completely dead code** from the Vite scaffold template. Imported nowhere.

---

## 3. Architectural Evaluation

### Strengths

1. **Clean Monorepo Structure.** Backend and frontend have clear boundaries with separate `package.json`, `tsconfig.json`, and build tooling. The Vite dev proxy handles API forwarding cleanly.

2. **Well-Designed Type System (Backend).** The dual-layer Row/API type pattern (`CompanyRow` → `Company`) correctly models the impedance mismatch between SQLite storage (integer booleans, JSON strings) and the API surface (proper booleans, parsed arrays). This is thoughtful design.

3. **Robust SSE Implementation.** The `runSearch.ts` SSE endpoint correctly sets headers, sends initial state, uses a listener pattern for real-time updates, and cleans up on client disconnect. The `queueService` observer pattern integrates cleanly.

4. **Resilient Scraping Pipeline.** The Cheerio → Playwright fallback strategy is well-designed. Per-job error isolation (catch-and-continue), URL deduplication (both in-page and DB-level), and rate limiting (500ms/1s delays) show production-quality thinking.

5. **Pure Filter Engine.** `filterEngine.ts` is dependency-free, well-tested conceptually, and correctly handles edge cases like `C++` and `.NET` with regex escaping. It's the gold standard for how all utility modules should be structured.

6. **Comprehensive Integration Tests.** Despite infrastructure issues, the 4 test files cover CRUD, queue processing, E2E scraping with mock servers, and the full AI pipeline with a mock LLM. The mock LLM server approach is particularly clever.

7. **Consistent Frontend Design Language.** Dark glassmorphic theme with indigo accents, lucide-react icons, and consistent card patterns. The visual language is cohesive across all 6 pages.

---

### Technical Debt

#### 🔴 Critical (Blocks maintainability and correctness)

1. **No Service/Repository Layer (Backend).** All 5 route files directly import the `db` singleton and execute raw SQL inline. Business logic (validation, JSON parsing, orchestration) is embedded in route handlers. This violates SRP, makes unit testing impossible without module-level mocking, and means the same logic is duplicated across routes.

2. **`SearchConfigRow → SearchConfig` Mapping Duplicated 3×.**  The identical JSON.parse conversion for `keywords`, `negative_keywords`, and `target_countries` exists in:
   - `routes/searchConfigs.ts` (`mapSearchConfig`, line 8-16)
   - `routes/jobs.ts` (`POST /:id/evaluate`, lines 77-85)
   - `services/scraperService.ts` (`scrapeCompany`, lines 180-188)

3. **`mapJobPosting` Duplicated 2×.** Job row-to-API mapping logic exists in `routes/jobs.ts` (the `mapJobPosting` function using `any` types) and inline in `routes/searchConfigs.ts` (`GET /:id/jobs`, lines 150-164).

4. **No Frontend API Service Layer.** Every page component contains inline `fetch()` calls with the same boilerplate pattern: `fetch(url)` → `res.json()` → check `result.success` → throw. This is copy-pasted in every component across ~15 distinct API endpoints. No centralized HTTP client, no base URL configuration, no request/response interceptors.

5. **Frontend Types Fully Duplicated.** `frontend/src/types.ts` is a manual copy of the backend's API model types. `StartSearchModal.tsx` contains a 3rd local re-declaration of `SearchConfig`. `QueuePage.tsx` declares `QueueItem` locally with **camelCase fields** while all other types use **snake_case** — a naming convention inconsistency.

6. **Anthropic Provider Bug.** In `llmService.ts` (lines 148-167), the Anthropic API branch fetches the response via `axios.post()` but **never assigns `responseText`** from the result. This means the Anthropic provider will always throw `"Empty response content received from LLM"`. This is a functional defect.

7. **`scrapeCompany` God Function (146 lines).** This single function in `scraperService.ts` handles: DB fetch, JSON parsing, scraping dispatch, URL deduplication, job detail fetching, keyword pre-filtering, LLM analysis, and DB insertion. It violates SRP and is extremely difficult to test, debug, or extend.

#### 🟡 Medium (Degrades developer experience and code quality)

8. **`mapJobPosting` Uses `any` Types.** Function signature `(row: any): any` in `jobs.ts` completely defeats TypeScript's purpose. All type safety is lost for the most complex data type in the system.

9. **Validation Logic Duplicated in POST/PUT.** Every route file (companies, searchConfigs, llmConfigs) duplicates identical validation between POST and PUT handlers.

10. **Test Files Live in `src/`.** 4 test files (780 lines) are in `backend/src/`, compiled into `dist/` alongside production code. No test framework (Jest/Mocha/Vitest) is used — tests are manual scripts with `throw` assertions.

11. **`LlmService` Class With All Static Methods.** The class acts as a namespace, not an OOP construct. No instance state, no constructor. It also queries the DB internally (`db.prepare(...)` to fetch `llm_configs`), creating hidden coupling.

12. **Playwright Browser Launched Per-Operation.** `scrapeWithPlaywright` and `fetchJobDetails` each launch a new Chromium instance. For a company with 20 jobs, this could spawn 20+ browser instances sequentially with full startup overhead. No browser pooling.

13. **Inconsistent Frontend Error Handling.** Some pages show styled inline error boxes (rose containers). Others use `alert()` for action errors and `confirm()` for delete confirmation — native browser dialogs that break the glassmorphic design language. No toast/notification system.

14. **Oversized Frontend Components.** `SearchConfigsPage.tsx` (526 lines, 16 state variables) handles strategy list, creation form, deletion, job fetching, and job card rendering in a single component. `LlmConfigPage.tsx` (360 lines) and `QueuePage.tsx` (350 lines) are similarly bloated.

15. **`App.css` Dead Code.** 185 lines of the original Vite scaffold CSS. Imported nowhere, used by nothing.

16. **Health Check Abuses Data Endpoint.** `Layout.tsx` fetches `/api/companies` on every route navigation to check server connectivity, rather than using a dedicated `/api/health` endpoint.

17. **Hardcoded Magic Numbers.** User-Agent string duplicated 3× in `scraperService.ts`. Timeout values (45s, 30s, 15s), `maxNewPostings = 20`, and sleep durations are scattered as literals.

18. **No Global Error Handler (Backend).** No Express error-handling middleware. Unhandled async rejections or thrown errors outside `try/catch` blocks will crash the process or leak stack traces.

---

## 4. Architectural Reasoning (The "Why")

### Why These Components Need Refactoring

The codebase was built rapidly in a phase-by-phase sprint (Phases 1-6 in `TASKS.md`), delivering working features at each step. This approach is excellent for initial velocity but has accumulated specific structural debts that will compound as the codebase grows:

#### 1. Route Handlers as God Objects (Violates SRP & Separation of Concerns)

Every route file simultaneously handles: HTTP request parsing, input validation, database querying, business logic execution, data transformation, and response formatting. This means:
- **You cannot unit test business logic** without spinning up Express and making HTTP requests.
- **You cannot reuse logic** — the `POST /:id/evaluate` handler in `jobs.ts` contains 60 lines of orchestration that would need to be duplicated if evaluation were triggered from a different entry point (e.g., a batch job, a WebSocket handler, or a CLI tool).
- **Bug isolation is difficult** — a bug in JSON parsing, LLM calling, or DB writing all manifest as a 500 error from the same route handler.

#### 2. Duplicated Mapping Functions (Violates DRY)

The `SearchConfigRow → SearchConfig` conversion is the most egregious: 3 independent copies of the same 8-line JSON.parse block. If the schema changes (e.g., adding a new JSON field), all 3 must be updated simultaneously or the system breaks silently. This is the textbook definition of DRY violation.

#### 3. Global Database Singleton (Violates Dependency Inversion)

Every module directly imports `db` from `../db/database`. This creates:
- **Untestable code**: You cannot substitute a test database without module-level mocking hacks.
- **Hidden dependencies**: A function's signature doesn't reveal that it accesses the database — you must read the implementation.
- **Tight coupling**: Swapping SQLite for PostgreSQL would require modifying every file that imports `db`.

#### 4. Missing API Service Layer (Frontend) (Violates DRY & Single Source of Truth)

The identical `fetch` → `json` → `check success` → `throw` pattern appears in every page component. This means:
- Adding authentication headers requires modifying every component.
- Changing the API base URL requires a global search-and-replace.
- Error handling improvements must be duplicated across ~15 call sites.

#### 5. Component Bloat (Violates SRP & Component Composition)

`SearchConfigsPage.tsx` at 526 lines with 16 state variables is doing the work of 4 separate components. This makes it:
- Difficult to reason about (which state belongs to which feature?).
- Impossible to reuse individual pieces (the job card is locked inside this page).
- Prone to re-render performance issues (any state change re-renders the entire 526-line tree).

---

## 5. Master Refactoring Execution Plan (For Coding Agent)

---

### Phase 1: Backend — Centralize Data Mapping & Shared Utilities

---

### Task 1: Extract All Row-to-API Mappers into a Shared Module

- [ ] **Step 1 (Locate & Isolate):** Identify the 4 mapping functions scattered across the codebase:
  - `mapCompany` in `backend/src/routes/companies.ts` (lines ~7-16)
  - `mapSearchConfig` in `backend/src/routes/searchConfigs.ts` (lines ~8-16)
  - `mapJobPosting` in `backend/src/routes/jobs.ts` (lines ~10-22) — uses `any` types
  - `mapLLMConfig` in `backend/src/routes/llmConfigs.ts` (lines ~8-12)
  - Inline job mapping in `backend/src/routes/searchConfigs.ts` (lines ~150-164)
  - Inline `SearchConfigRow → SearchConfig` parsing in `backend/src/routes/jobs.ts` (lines ~77-85)
  - Inline `SearchConfigRow → SearchConfig` parsing in `backend/src/services/scraperService.ts` (lines ~180-188)

- [ ] **Step 2 (Implementation Action):** Create a new file `backend/src/mappers.ts`. Move all 4 named mapper functions into it. Give `mapJobPosting` proper types: `(row: JobPostingRow & { company_name?: string }): JobPosting & { company_name?: string }`. Export all 4 functions.

- [ ] **Step 3 (Dependency Fixes):** Update these files to import from `../mappers` (or `./mappers` depending on relative path):
  - `backend/src/routes/companies.ts` — remove local `mapCompany`, import from mappers.
  - `backend/src/routes/searchConfigs.ts` — remove local `mapSearchConfig`, remove inline job mapping (lines 150-164), import `mapSearchConfig` and `mapJobPosting` from mappers.
  - `backend/src/routes/jobs.ts` — remove local `mapJobPosting`, remove inline SearchConfig parsing (lines 77-85), import `mapJobPosting` and `mapSearchConfig` from mappers.
  - `backend/src/routes/llmConfigs.ts` — remove local `mapLLMConfig`, import from mappers.
  - `backend/src/services/scraperService.ts` — remove inline SearchConfig parsing (lines 180-188), import `mapSearchConfig` from mappers.

- [ ] **Step 4 (Definition of Done):** All mapping logic exists in a single file (`mappers.ts`). No route or service file contains local mapping functions or inline JSON.parse conversions for DB rows. `mapJobPosting` no longer uses `any` type. The backend compiles with `npm run build` without errors. All existing test scripts (`test_api.ts`, `test_queue.ts`, `test_ai_pipeline.ts`) pass when run against a live server.

---

### Task 2: Extract Shared Validation Utilities

- [ ] **Step 1 (Locate & Isolate):** Identify duplicated validation logic:
  - URL validation (`new URL(career_url)`) in `backend/src/routes/companies.ts` POST (line ~50) and PUT (line ~92).
  - Scraper engine enum check (`['cheerio', 'playwright'].includes(...)`) in POST (line ~55) and PUT (line ~97) of the same file.
  - Provider enum check in `backend/src/routes/llmConfigs.ts` POST (line ~51) and PUT (line ~89).
  - `keywords` array validation in `backend/src/routes/searchConfigs.ts` POST (lines ~47-52) and PUT (lines ~90-95).

- [ ] **Step 2 (Implementation Action):** Create `backend/src/utils/validators.ts`. Extract:
  - `validateUrl(url: string): void` — throws on invalid URL.
  - `validateScraperEngine(engine: string): void` — throws if not in allowed enum.
  - `validateLlmProvider(provider: string): void` — throws if not in allowed enum.
  - `validateKeywordsArray(keywords: unknown): void` — throws if not a non-empty string array.

- [ ] **Step 3 (Dependency Fixes):**
  - `backend/src/routes/companies.ts` — import `validateUrl`, `validateScraperEngine`. Replace inline checks in both POST and PUT.
  - `backend/src/routes/llmConfigs.ts` — import `validateLlmProvider`. Replace inline checks in POST and PUT.
  - `backend/src/routes/searchConfigs.ts` — import `validateKeywordsArray`. Replace inline checks in POST and PUT.

- [ ] **Step 4 (Definition of Done):** No route file contains inline validation logic for URL parsing, enum membership, or array shape. Each validation function throws a descriptive error message. Backend compiles and all test scripts pass.

---

### Task 3: Extract Shared Constants

- [ ] **Step 1 (Locate & Isolate):**
  - User-Agent string hardcoded 3× in `backend/src/services/scraperService.ts` (inside `scrapeWithCheerio`, `scrapeWithPlaywright`, `fetchJobDetails`).
  - `maxNewPostings = 20` in `scraperService.ts` (line ~200).
  - Various timeout values: `10000`, `30000`, `15000`, `45000` in `scraperService.ts` and `llmService.ts`.
  - Provider enum values `['ollama', 'openai', 'anthropic', 'openrouter']` used in `llmConfigs.ts` and `llmService.ts`.
  - Scraper engine enum `['cheerio', 'playwright']` used in `companies.ts`.

- [ ] **Step 2 (Implementation Action):** Create `backend/src/constants.ts`. Define:
  - `export const USER_AGENT = '...'`
  - `export const MAX_NEW_POSTINGS_PER_RUN = 20`
  - `export const SCRAPE_DELAY_MS = 500`
  - `export const QUEUE_DELAY_MS = 1000`
  - `export const LLM_TIMEOUT_MS = { ollama: 45000, openai: 30000, anthropic: 30000, openrouter: 45000 }`
  - `export const SCRAPER_ENGINES = ['cheerio', 'playwright'] as const`
  - `export const LLM_PROVIDERS = ['ollama', 'openai', 'anthropic', 'openrouter'] as const`
  - `export const RAW_TEXT_TRUNCATION_LIMIT = 12000`

- [ ] **Step 3 (Dependency Fixes):**
  - `backend/src/services/scraperService.ts` — import `USER_AGENT`, `MAX_NEW_POSTINGS_PER_RUN`, `SCRAPE_DELAY_MS`, and replace all 3 hardcoded User-Agent strings + the magic number.
  - `backend/src/services/llmService.ts` — import `LLM_TIMEOUT_MS`, `RAW_TEXT_TRUNCATION_LIMIT` and replace hardcoded values.
  - `backend/src/routes/companies.ts` — import `SCRAPER_ENGINES` and use in validation.
  - `backend/src/routes/llmConfigs.ts` — import `LLM_PROVIDERS` and use in validation.
  - `backend/src/services/queueService.ts` — import `QUEUE_DELAY_MS` and replace `setTimeout(1000)`.

- [ ] **Step 4 (Definition of Done):** No magic strings or numbers remain in service or route files. All configurable values are imported from `constants.ts`. Backend compiles. Tests pass.

---

### Phase 2: Backend — Fix Critical Bugs & Type Safety

---

### Task 4: Fix the Anthropic Provider Bug in `llmService.ts`

- [ ] **Step 1 (Locate & Isolate):** Open `backend/src/services/llmService.ts`. Locate the Anthropic provider branch (approximately lines 148-167). The `axios.post()` call assigns the result to `res`, but `responseText` is never assigned from `res.data`.

- [ ] **Step 2 (Implementation Action):** After the `axios.post()` call in the Anthropic branch, add the assignment:
  ```typescript
  responseText = res.data?.content?.[0]?.text || '';
  ```
  The Anthropic Messages API returns `{ content: [{ type: "text", text: "..." }] }`.

- [ ] **Step 3 (Dependency Fixes):** None. This is a self-contained bug fix.

- [ ] **Step 4 (Definition of Done):** With a valid Anthropic API key and an active Anthropic LLM config, calling `POST /api/jobs/:id/evaluate` returns a successful AI analysis instead of an "Empty response" error. Verify by inspecting the response or by modifying `test_ai_pipeline.ts` to test the Anthropic code path.

---

### Task 5: Fix `mapJobPosting` Type Safety

- [ ] **Step 1 (Locate & Isolate):** After Task 1, `mapJobPosting` lives in `backend/src/mappers.ts`. Its current signature uses `(row: any): any`.

- [ ] **Step 2 (Implementation Action):** Change the function signature to:
  ```typescript
  export function mapJobPosting(row: JobPostingRow & { company_name?: string }): JobPosting & { company_name?: string }
  ```
  Ensure all field accesses use the typed properties from `JobPostingRow`. Remove any `any` casts.

- [ ] **Step 3 (Dependency Fixes):** All callers already import from `mappers.ts` (from Task 1). Verify that the JOIN queries in `routes/jobs.ts` (`GET /:id`) and `routes/searchConfigs.ts` (`GET /:id/jobs`) cast their `db.prepare(...).get()` / `.all()` results to the correct type before passing to `mapJobPosting`.

- [ ] **Step 4 (Definition of Done):** `backend/src/mappers.ts` contains zero occurrences of the `any` keyword. Backend compiles with `strict: true` without errors.

---

### Task 6: Fix LLM Config Race Condition in `llmConfigs.ts`

- [ ] **Step 1 (Locate & Isolate):** Open `backend/src/routes/llmConfigs.ts`. In the `POST /` handler, after the INSERT statement, the code calls `activateConfigTransaction` if `is_active` is truthy. Between the INSERT and the transaction call, two configs can be simultaneously active.

- [ ] **Step 2 (Implementation Action):** Wrap the INSERT and the activation into a single `db.transaction()` call:
  ```typescript
  const createAndActivate = db.transaction((data) => {
    const result = insertStmt.run(data.provider, data.model_name, data.api_key, 0); // Always insert as inactive
    if (data.is_active) {
      db.prepare('UPDATE llm_configs SET is_active = 0').run();
      db.prepare('UPDATE llm_configs SET is_active = 1 WHERE id = ?').run(result.lastInsertRowid);
    }
    return result;
  });
  ```

- [ ] **Step 3 (Dependency Fixes):** None. Self-contained fix within the POST handler.

- [ ] **Step 4 (Definition of Done):** Creating an LLM config with `is_active: true` atomically deactivates all other configs. At no point do two configs have `is_active = 1` simultaneously. Verify by rapid-fire creating two active configs and checking the DB state.

---

### Phase 3: Backend — Add Health Endpoint & Global Error Handler

---

### Task 7: Add a Dedicated `/api/health` Endpoint

- [ ] **Step 1 (Locate & Isolate):** `backend/src/index.ts` currently has `app.get('/', ...)` returning `{ status: 'ok' }`. The frontend's `Layout.tsx` abuses `GET /api/companies` as a health check.

- [ ] **Step 2 (Implementation Action):** In `backend/src/index.ts`, add:
  ```typescript
  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  });
  ```

- [ ] **Step 3 (Dependency Fixes):** Update `frontend/src/components/Layout.tsx` to fetch `/api/health` instead of `/api/companies` in the connectivity check `useEffect`.

- [ ] **Step 4 (Definition of Done):** `GET /api/health` returns `{ success: true, data: { status: "ok", ... } }`. `Layout.tsx` uses this endpoint for connectivity checks. The sidebar connection indicator still works correctly.

---

### Task 8: Add Global Error-Handling Middleware

- [ ] **Step 1 (Locate & Isolate):** `backend/src/index.ts` — no error-handling middleware exists after route mounting.

- [ ] **Step 2 (Implementation Action):** After all `app.use(...)` route mounts, add:
  ```typescript
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });
  ```

- [ ] **Step 3 (Dependency Fixes):** None.

- [ ] **Step 4 (Definition of Done):** An unhandled error in any route returns a clean JSON `{ success: false, error }` response instead of crashing or leaking a stack trace.

---

### Phase 4: Backend — Reorganize Test Files

---

### Task 9: Move Test Files Out of `src/`

- [ ] **Step 1 (Locate & Isolate):** 4 test files in `backend/src/`:
  - `backend/src/test_api.ts`
  - `backend/src/test_queue.ts`
  - `backend/src/test_ai_pipeline.ts`
  - `backend/src/test_scraper_server.ts`

- [ ] **Step 2 (Implementation Action):**
  1. Create `backend/tests/` directory.
  2. Move all 4 files into `backend/tests/`.
  3. Update internal import paths (e.g., `'./types'` → `'../src/types'`, `'./db/database'` → `'../src/db/database'`, `'./test_scraper_server'` → `'./test_scraper_server'`).
  4. Update `backend/tsconfig.json` to add `"exclude": ["tests/**/*"]` so test files are not compiled into `dist/`.
  5. Add a `backend/tsconfig.test.json` that extends `tsconfig.json` but includes `tests/`:
     ```json
     {
       "extends": "./tsconfig.json",
       "include": ["src/**/*", "tests/**/*"]
     }
     ```
  6. Add a script in `backend/package.json`: `"test": "ts-node-dev tests/test_api.ts"` (or similar runner).

- [ ] **Step 3 (Dependency Fixes):**
  - `test_queue.ts` imports `./test_scraper_server` — update to `./test_scraper_server` (same directory after move).
  - `test_ai_pipeline.ts` imports `./test_scraper_server` — same update.
  - `test_queue.ts` and `test_ai_pipeline.ts` import `./db/database` — update to `../src/db/database`.

- [ ] **Step 4 (Definition of Done):** `backend/src/` contains zero `test_*.ts` files. `npm run build` in `/backend` produces a `dist/` directory with no test files. Test files can still be run via `ts-node-dev` from the new `tests/` directory.

---

### Phase 5: Frontend — Create API Service Layer

---

### Task 10: Build a Centralized API Client Module

- [ ] **Step 1 (Locate & Isolate):** Inline `fetch()` calls exist in every page component and in `StartSearchModal.tsx`. Identify all distinct API endpoints used:
  - `GET /api/companies` — `CompaniesPage.tsx`, `Layout.tsx` (health check)
  - `DELETE /api/companies/:id` — `CompaniesPage.tsx`
  - `GET /api/companies/:id` — `CompanyFormPage.tsx`
  - `POST /api/companies` — `CompanyFormPage.tsx`
  - `PUT /api/companies/:id` — `CompanyFormPage.tsx`
  - `GET /api/search_configs` — `SearchConfigsPage.tsx`, `StartSearchModal.tsx`
  - `POST /api/search_configs` — `SearchConfigsPage.tsx`
  - `DELETE /api/search_configs/:id` — `SearchConfigsPage.tsx`
  - `GET /api/search_configs/:id/jobs` — `SearchConfigsPage.tsx`
  - `GET /api/llm_configs` — `LlmConfigPage.tsx`
  - `POST /api/llm_configs` — `LlmConfigPage.tsx`
  - `POST /api/llm_configs/:id/activate` — `LlmConfigPage.tsx`
  - `DELETE /api/llm_configs/:id` — `LlmConfigPage.tsx`
  - `GET /api/jobs/:id` — `JobDescriptionPage.tsx`
  - `PUT /api/jobs/:id/visit` — `JobDescriptionPage.tsx`
  - `POST /api/jobs/:id/evaluate` — `JobDescriptionPage.tsx`
  - `POST /api/run-search` — `StartSearchModal.tsx`
  - `GET /api/run-search/queue` — `QueuePage.tsx`
  - `POST /api/run-search/clear` — `QueuePage.tsx`

- [ ] **Step 2 (Implementation Action):** Create `frontend/src/api/client.ts`:
  ```typescript
  const API_BASE = '/api';

  async function request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'API request failed');
    return result.data;
  }
  ```
  Then create domain-specific modules:
  - `frontend/src/api/companies.ts` — `list()`, `get(id)`, `create(data)`, `update(id, data)`, `remove(id)`.
  - `frontend/src/api/searchConfigs.ts` — `list()`, `get(id)`, `create(data)`, `remove(id)`, `getJobs(id)`.
  - `frontend/src/api/llmConfigs.ts` — `list()`, `create(data)`, `activate(id)`, `remove(id)`.
  - `frontend/src/api/jobs.ts` — `get(id)`, `markVisited(id)`, `evaluate(id)`.
  - `frontend/src/api/runSearch.ts` — `start(configId)`, `getQueue()`, `clearQueue()`.
  - `frontend/src/api/health.ts` — `check()`.
  - `frontend/src/api/index.ts` — barrel export.

- [ ] **Step 3 (Dependency Fixes):** Update every page component and `StartSearchModal.tsx` to use the API module instead of inline `fetch()`. Remove all raw `fetch()` calls from components. Update `Layout.tsx` to use `api.health.check()`.

- [ ] **Step 4 (Definition of Done):** Zero occurrences of `fetch('/api/` in any component file. All API calls go through the `api/` module. Error handling is centralized in `client.ts`. Backend API responses are still correctly parsed and used.

---

### Phase 6: Frontend — Decompose Oversized Components

---

### Task 11: Decompose `SearchConfigsPage.tsx` (526 lines → ~4 components)

- [ ] **Step 1 (Locate & Isolate):** `frontend/src/pages/SearchConfigsPage.tsx`. This component manages: strategy list, strategy creation form, strategy deletion, job list fetching, and job card rendering with 16 state variables.

- [ ] **Step 2 (Implementation Action):**
  1. Extract `frontend/src/components/StrategyForm.tsx` — The "Create New Strategy" form section. Props: `onSubmit(data)`, `loading`, `error`.
  2. Extract `frontend/src/components/JobCard.tsx` — The individual job listing card (~80 lines of JSX). Props: `job: JobPosting`.
  3. Extract `frontend/src/components/StrategyList.tsx` — The left-panel strategy list. Props: `configs`, `selectedId`, `onSelect(id)`, `onDelete(id)`, `actionId`.
  4. Refactor `SearchConfigsPage.tsx` to compose these 3 sub-components. It should only manage top-level state and data fetching.

- [ ] **Step 3 (Dependency Fixes):** Ensure `JobCard` imports types from `../types`. The new sub-components should import from the `api/` module (from Task 10) rather than doing their own `fetch()`.

- [ ] **Step 4 (Definition of Done):** `SearchConfigsPage.tsx` is under 150 lines. Each extracted component is under 150 lines. The page renders and behaves identically to before. All interactive features (create strategy, delete strategy, select strategy, view jobs, navigate to job detail) still work.

---

### Task 12: Decompose `QueuePage.tsx` (350 lines → ~3 components)

- [ ] **Step 1 (Locate & Isolate):** `frontend/src/pages/QueuePage.tsx`. Contains: SSE connection logic, active task hero card, task list, and error log section.

- [ ] **Step 2 (Implementation Action):**
  1. Extract `frontend/src/components/ActiveTaskCard.tsx` — The animated hero card for the currently processing task.
  2. Extract `frontend/src/components/TaskCard.tsx` — Individual task list item with color-coded status badge.
  3. Keep SSE connection logic in `QueuePage.tsx` (it's page-level orchestration).
  4. Move the `QueueItem` interface into `frontend/src/types.ts`.

- [ ] **Step 3 (Dependency Fixes):** Import `QueueItem` from `../types` in all new components and in `QueuePage.tsx`.

- [ ] **Step 4 (Definition of Done):** `QueuePage.tsx` is under 200 lines. `QueueItem` is in `types.ts`. The SSE live updates, fallback polling, active task animation, and task status badges all work identically.

---

### Task 13: Extract Reusable UI Primitives

- [ ] **Step 1 (Locate & Isolate):** Identify repeated UI patterns across all page components:
  - **Loading spinner** (centered `Loader2` icon with text) — appears in `CompaniesPage`, `CompanyFormPage`, `JobDescriptionPage`, `LlmConfigPage`, `SearchConfigsPage`, `QueuePage`.
  - **Error alert box** (rose-colored container with `AlertCircle` icon) — appears in every page.
  - **Empty state** (centered icon + title + description + CTA button) — appears in `CompaniesPage`, `LlmConfigPage`, `SearchConfigsPage`, `QueuePage`.

- [ ] **Step 2 (Implementation Action):** Create:
  - `frontend/src/components/ui/LoadingSpinner.tsx` — Props: `text?: string`.
  - `frontend/src/components/ui/ErrorAlert.tsx` — Props: `message: string`, `onRetry?: () => void`.
  - `frontend/src/components/ui/EmptyState.tsx` — Props: `icon: LucideIcon`, `title: string`, `description: string`, `actionLabel?: string`, `onAction?: () => void`.

- [ ] **Step 3 (Dependency Fixes):** Replace all inline loading/error/empty-state JSX blocks in every page component with the extracted components.

- [ ] **Step 4 (Definition of Done):** No page component contains hand-written loading spinner JSX, error alert JSX, or empty state JSX. All use the shared components. Visual appearance is unchanged.

---

### Phase 7: Frontend — Cleanup & Fix Type Sharing

---

### Task 14: Remove Dead `App.css`

- [ ] **Step 1 (Locate & Isolate):** `frontend/src/App.css` — 185 lines of unused Vite scaffold CSS.

- [ ] **Step 2 (Implementation Action):** Delete `frontend/src/App.css`.

- [ ] **Step 3 (Dependency Fixes):** Search for any `import './App.css'` or `import '../App.css'` statements. If found, remove them. (Based on analysis, this file is imported nowhere.)

- [ ] **Step 4 (Definition of Done):** `App.css` no longer exists. `npm run build` in `/frontend` succeeds. No visual changes in the application.

---

### Task 15: Consolidate Frontend Types & Fix Naming Inconsistency

- [ ] **Step 1 (Locate & Isolate):**
  - `frontend/src/types.ts` — main type definitions (duplicated from backend).
  - `frontend/src/components/StartSearchModal.tsx` — local `SearchConfig` re-declaration (lines 10-14).
  - `frontend/src/pages/QueuePage.tsx` — local `QueueItem` interface (lines 16-26) using camelCase fields.

- [ ] **Step 2 (Implementation Action):**
  1. Move the `QueueItem` interface from `QueuePage.tsx` into `frontend/src/types.ts`. Rename fields from camelCase to snake_case for consistency with all other types (`companyId` → `company_id`, `companyName` → `company_name`, `searchConfigId` → `search_config_id`, `createdAt` → `created_at`, `updatedAt` → `updated_at`).
  2. Remove the local `SearchConfig` interface from `StartSearchModal.tsx`. Import `SearchConfig` from `../types`.
  3. Ensure `QueuePage.tsx` references in component code are updated to use the renamed snake_case fields.

- [ ] **Step 3 (Dependency Fixes):**
  - `QueuePage.tsx` — remove local `QueueItem` declaration, import from `../types`, update all field references to snake_case.
  - `StartSearchModal.tsx` — remove local `SearchConfig`, import from `../types`.
  - Verify the backend's SSE `QueueEvent` payloads match the field naming. If the backend sends camelCase, update the backend's `QueueItem` interface in `queueService.ts` to use snake_case for consistency with the rest of the API (and update the service logic accordingly), OR keep the frontend mapping layer.

- [ ] **Step 4 (Definition of Done):** `frontend/src/types.ts` is the single source of truth for all frontend types including `QueueItem`. No component file declares its own local type aliases for API models. Field naming is consistently snake_case across all types. The queue page renders correctly with live SSE updates.

---

### Task 16: Fix `Layout.tsx` Health Check

- [ ] **Step 1 (Locate & Isolate):** `frontend/src/components/Layout.tsx` — the `useEffect` that fetches `/api/companies` (or `/api/health` after Task 7) on every `location.pathname` change.

- [ ] **Step 2 (Implementation Action):** Replace the health check with the API service call from Task 10 (`api.health.check()`). Also, consider using an `AbortController` to cancel in-flight requests when the pathname changes rapidly.

- [ ] **Step 3 (Dependency Fixes):** Depends on Task 7 (health endpoint) and Task 10 (API service layer) being completed first.

- [ ] **Step 4 (Definition of Done):** `Layout.tsx` uses `api.health.check()` instead of raw `fetch`. Navigation between pages correctly updates the connection indicator without stale state.
