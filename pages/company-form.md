# Page: Company Form (Add/Edit)
**Route:** `/companies/new` or `/companies/edit/:id`

## Layout & Functionality
- **Form Fields:**
  - `Company Name` (Text input, required).
  - `Career Page URL` (URL input, required).
  - `Target Selector` (Text input, optional) - Placehoder: ".job-listing-class".
  - `Force Playwright` (Toggle switch) - Allows user to manually override the fast scraper.
- **Actions:**
  - "Save Company" button.
  - "Cancel" button (returns to `/companies`).
- **Validation:** Ensure URL is valid before submission.