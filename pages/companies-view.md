# Page: Companies View
**Route:** `/companies`

## Layout & Functionality
- **Header:** "Tracked Companies" + "Add New Company" button (routes to Company Form).
- **List/Grid:** Displays all companies from the database.
- **Card/Row Data:** Company Name, URL, Scraper Engine status.
- **Actions:** 
  - **Edit Button:** Routes to `/companies/edit/:id`.
  - **Delete Button:** Triggers a strict confirmation dialog ("Are you sure? This will delete all associated job history").
- **On Click (Row):** Clicking a company name opens a sub-view or list showing all `job_postings` associated with this specific company that are marked `is_relevant = true`.