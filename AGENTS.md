# AGENTS.md

## Project Context
This is a single-user local web app ("DeepTech Job Radar") designed to scrape deep-tech career pages, filter them, and run local AI analysis. 
The repository is a monorepo containing a TypeScript Express backend and a React (Vite) frontend.

## Setup Commands
- Install all dependencies: `npm install` (run in both `/backend` and `/frontend`)
- Start backend: `npm run dev` in `/backend` (Runs Express on port 3001)
- Start frontend: `npm run dev` in `/frontend` (Runs Vite on port 5173)

## Stack & Conventions
- **Backend:** Node.js, Express, TypeScript.
- **Database:** SQLite (using `better-sqlite3`).
- **Scraping:** `axios` + `cheerio` (Fast tier), `playwright` (JS tier).
- **Frontend:** React, TypeScript, Tailwind CSS, Vite. 
- **Real-time Updates:** Use Server-Sent Events (SSE) from Express to React. Do not overcomplicate with Socket.io unless necessary.

## Coding Style
- Use strict TypeScript mode.
- All backend responses must be typed.
- Frontend components must be functional components using Hooks. 
- UI should be non-blocking. Never use full-screen loading spinners for background tasks.
- Keep the code modular: Separate routes, services, and the scraping queue into distinct directories.