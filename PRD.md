# Product Requirements Document (PRD)

## Core Vision
A multi-strategy, self-hosted job scraping and AI-analysis dashboard. It allows a user to define custom job-hunting configurations, scrape specific company career pages, and use an LLM to evaluate the relevance of those jobs based on the configuration.

## Layout & Architecture (Split-Pane Design)
The UI must mimic modern email clients (Outlook) or AI chat interfaces.
- **Left Sidebar (Fixed, 250px-300px width):** Contains navigation buttons, configuration menus, and the master "Start Job Search" action button.
- **Right Content Area (Flexible width):** Displays the content corresponding to the active sidebar selection.

## Sidebar Structure (Top to Bottom)
1. **Companies:** View all targets.
2. **Task Queue:** View live scraping/LLM progress.
3. **LLM Config:** Set AI parameters.
4. **Job Search:** Create/View search strategies and their results.
5. *(Spacer)*
6. **[ START JOB SEARCH ] (Prominent Button):** Opens a modal asking "Which configuration should we run?" before triggering the backend queue.

## UX Requirements
- **Non-blocking UI:** Scraping must happen in the background. The user can navigate to any page while the queue is running.
- **Visited State:** Job listings must visually indicate if they have been clicked/read by the user (similar to unread emails being bold).