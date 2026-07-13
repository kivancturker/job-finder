# Agentic Coding Tasks (SDLC)
Strictly complete these phases in order. Do not skip to UI before API is tested.
Once complete leave a checkmark.

## Phase 1: Backend & DB Foundation
- [x] Initialize Express + TypeScript server.
- [x] Implement `better-sqlite3` and create tables strictly matching `DATABASE.md`.
- [x] Create basic CRUD REST endpoints for `/api/companies`, `/api/search_configs`, and `/api/llm_configs`.

## Phase 2: Core Scraping Engine & Queue
- [x] Create an in-memory `QueueService` to handle scraping jobs sequentially.
- [x] Implement Cheerio scraper (fast) and Playwright scraper (fallback).
- [x] Create a deduplication check: before inserting a job, query the DB to ensure `url` does not exist.
- [x] Build the `/api/run-search` endpoint. It must accept a `search_config_id`, fetch all companies, and push them to the `QueueService`.

## Phase 3: AI Evaluation Pipeline
- [x] Implement the Pre-Filter: Check scraped text against `search_configs.keywords`. If no match, discard or mark `is_relevant = false`.
- [x] Implement the LLM Service: Fetch the active config from `llm_configs`. Send the text to the LLM requesting a JSON response (summary, tech_stack).
- [x] Update `job_postings` with the LLM response.

## Phase 4: Frontend Scaffolding & Layout
- [x] Initialize Vite + React + Tailwind.
- [x] Implement the Split-Pane layout (Sidebar component + Main Content Area).
- [x] Setup React Router to handle the different right-pane views.

## Phase 5: Building the Views (Right Pane)
- [x] Build the **Companies Page**: List view with Edit/Delete buttons.
- [x] Build the **Company Form Page**: Add/Edit company details.
- [x] Build the **LLM Config Page**: Form for provider, model, API key.
- [x] Build the **Search Config Page**: CRUD for search strategies, plus a list of matching `job_postings` for each strategy.
- [x] Build the **Job Description Page**: Render the raw text, LLM summary, and tech stack tags. Mark `is_visited = true` on load.

## Phase 6: Real-time Task Queue UI
- [x] Implement Server-Sent Events (SSE) on the backend to broadcast Queue state.
- [x] Build the **Task Queue Page**: Render a list of tasks. Green for completed, Orange for processing, Slate Gray for pending.
- [x] Implement the "Start Job Search" modal in the sidebar.
