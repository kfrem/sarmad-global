# BUILD PROMPT: Client Bookkeeping and Document Capture Portal

**For handoff to an AI coding tool (Codex, Claude Code, or similar).
Author context: a UK accountancy practice. British English throughout. Currency GBP.**

\---

## 1\. ROLE

You are a senior full-stack engineer building a low-cost, multi-tenant, white-label web application. You write complete, working files, not fragments. You explain where to click, paste, and deploy at each stage, because the client commissioning this is not a programmer. You keep the running cost as close to zero as possible and never add a paid service where a free tier or open-source option will do the job.

You will build **only the client-facing portal** described below. There is a separate practitioner system already in place; you do not build or touch it. Your output feeds that system through clean data exports.

\---

## 2\. WHAT THIS SOFTWARE IS FOR

A UK accountancy practice gives each of its clients a private login. The client uses the portal to:

1. Upload invoices, bank statements, and receipts, including photographs taken on a phone.
2. Let the system read each document and present every transaction clearly.
3. Confirm each transaction line by line: the amount, whether VAT is included, whether it is income, an expense, an asset, or none of these, and which category it belongs to.
4. Confirm whether each item is wholly business, wholly private, or part private, splitting part-private items so only the business portion is carried forward.
5. Match bank statement lines to supporting receipts, and flag amounts that have no receipt behind them.
6. Produce reports of everything submitted, giving the practice clean, categorised records ready for Making Tax Digital quarterly updates or for ordinary year-end accounts.

Every uploaded document is filed electronically against the client and kept, indexed, and linked to the transactions it supports.

The portal does **not** file anything to HMRC. It prepares clean digital records that the practice will carry into its own recognised software. Build accordingly: this is a digital record-keeping and document-capture front end, not a tax submission tool.

\---

## 3\. WHO THE CLIENTS ARE

Each tenant company is one of the following, and the build must adapt to the type:

|Client type|Tax framing|VAT logic|Notes|
|-|-|-|-|
|Sole trader|MTD ITSA quarterly records|Only if VAT-registered|SA103 expense categories apply|
|Landlord|MTD ITSA, property|Usually not|SA105 property categories; income/expense per property|
|Limited company|Ordinary accounts and Corporation Tax|Only if VAT-registered|Not in MTD ITSA; standard accounts categories|
|VAT-registered business (any of the above)|As above plus VAT|Yes, always show VAT|VAT summary required|

Each tenant record therefore carries two flags that drive the interface: **entity\_type** (sole\_trader, landlord, limited\_company, partnership) and **vat\_registered** (true/false). When VAT is off, hide all VAT questions. When the client is a landlord, allow income and expenses to be tagged to a specific property.

\---

## 4\. TECHNOLOGY STACK (chosen for lowest cost and true per-client isolation)

* **Database, authentication, file storage:** Supabase (free tier). Use Supabase Auth for logins, Supabase Postgres for data, Supabase Storage for uploaded documents.
* **Per-client isolation:** Postgres **Row-Level Security (RLS)**. Every table carries a `company\_id`. RLS policies must ensure a logged-in user can read and write only rows belonging to their own company. This is the mechanism that guarantees each client sees only their own company. Enforce it at the database level, not only in the interface.
* **Frontend:** Next.js (React), deployed on Vercel (free tier). Must be fully mobile-responsive so a client can photograph a receipt on a phone and upload it in seconds.
* **Document extraction:** a switchable provider behind a single interface (see Section 7). Default to a cheap vision model. Do not hard-wire one vendor.
* **Region:** host the Supabase project in a UK or EU region for data residency.

If a constraint forces a cheaper or simpler path (for example, deploying the whole thing on a single Hostinger instance with PHP and MySQL), state the trade-off plainly and let the practice decide. Default to the Supabase and Vercel path above.

\---

## 5\. WHITE-LABEL AND MULTI-TENANCY

* The app is multi-tenant. One deployment serves many client companies.
* On login, a client sees **only their own company name and logo**. No reference to the practice, to other clients, or to the fact that other tenants exist.
* Each company record holds: company name, logo, entity type, VAT status, active industry module(s), and an optional accent colour for light branding.
* A practice administrator (a hidden role, not a normal client) can create companies, issue logins, set the entity type and VAT status, and activate industry modules. Keep this administration minimal; the practitioner system handles the heavy lifting.
* No client can ever see, query, or infer another client's data. Verify this with RLS tests.

\---

## 6\. CHART OF ACCOUNTS (seed data)

A spreadsheet named **UK\_Chart\_of\_Accounts\_Master\_v2.xlsx** is provided. Load it into the database as the category reference. Key facts you must honour:

* Every account is a **5-digit self-describing code** in the form C-GG-NN: first digit is the account class (1 to 9), digits 2 and 3 are the group, digits 4 and 5 are the individual account.
* Codes ending in 000 are **group headers**: display only, never selectable for posting. The client must never be offered a header as a category.
* Each account row carries: Code, Account Name, Class, Class Name, Group, Group Name, Nature (Dr/Cr), Type (Header/Posting), Statement (Balance Sheet/P\&L), VAT default code, Cashflow category, Statutory Line, Description, and **Industry Module** tag.
* VAT codes are: **S20** standard 20%, **R5** reduced 5%, **Z** zero, **E** exempt, **OS** outside scope, **RC** reverse charge.
* Industry modules: **UNI** universal (always on), plus **CH** charities, **CN** construction, **HP** hospitality, **AG** agriculture, **CR** care services. A company sees UNI plus whichever modules are active for it.

Build the `accounts` table from the workbook's "Programmer Notes" schema:
`code INT(5) PRIMARY KEY, name VARCHAR(120), class TINYINT, group\_code TINYINT, nature CHAR(2), type ENUM('Header','Posting'), statement ENUM('BS','PL'), vat\_default VARCHAR(4), cashflow\_category VARCHAR(20), statutory\_line VARCHAR(80), description TEXT, industry\_module VARCHAR(4), is\_active BOOLEAN`.

When the client picks a category, offer **only posting accounts**, filtered to the company's active modules, and default the VAT code from the account's `vat\_default`.

\---

## 7\. DOCUMENT EXTRACTION (the running-cost lever)

Build a single extraction interface, `extractDocument(file) -> structured JSON`, with a swappable backend selected by an environment variable. Provide three modes:

1. **Vision model (default).** Send the document image or PDF page to a cheap vision-capable model and ask for structured JSON. Default to a low-cost model in the Gemini Flash class. Keep the provider and model name in config so the practice can switch as prices change.
2. **OCR plus model (hybrid).** Run a cheap or free OCR first (for example Google Cloud Vision, which has a free monthly tier, or open-source Tesseract for clean printed receipts), then pass the text to a small language model for structuring and category suggestion. Use this for high-volume clean documents to cut cost.
3. **Manual.** Client types the figures and attaches the photo. Near-zero running cost. Always available as a fallback when extraction is poor.

**Cost controls you must implement:**

* Downscale and compress every image to roughly 1024px on the long edge before sending to a model.
* Make exactly **one** model call per document for extraction. All confirmation happens in the app with no further model calls.
* Pass only a **compact category reference** to the model (codes and names for the company's active modules), never the whole workbook, to keep tokens low.
* Show an estimated per-document cost in the admin view so the practice can monitor spend.

**Extraction output for each document** must be JSON: an array of transactions, each with a best-guess date, description, gross amount, a suggested VAT treatment, a suggested classification (income / expense / asset / transfer / personal), and a suggested category code with a confidence flag. Treat every suggestion as a draft the client confirms.

\---

## 8\. THE TRANSACTION REVIEW WORKFLOW (core feature)

For each extracted transaction, walk the client through a clear, one-line-at-a-time review. Show the source document thumbnail beside the line at all times.

**Step 1: Confirm the amount.** Show the extracted figure. Client accepts or corrects it.

**Step 2: VAT (only if the company is VAT-registered).** Ask: is VAT included in this amount? If yes, confirm the rate from the chart's VAT codes (default suggested from the chosen account). Calculate and display the net and VAT figures. If the company is not VAT-registered, skip this step entirely and treat the amount as gross with no VAT recovery.

**Step 3: Classify.** Client selects one of: **Income**, **Expense**, **Asset purchase**, **Transfer between own accounts**, **Personal / drawings**, **None / ignore**.

**Step 4: Category (only for Income, Expense, Asset).** Present a **toggle between two category systems**, and store both where a mapping exists:

* **(a) Chart of Accounts:** the 5-digit posting accounts, filtered to the company's active industry modules, searchable by name, grouped sensibly (expenses, assets, income).
* **(b) HMRC categories:** the simplified self-assessment set appropriate to the entity type. For sole traders use the SA103 self-employment expense categories (for example: cost of goods, car and travel, premises, repairs, office and admin, advertising, interest and bank charges, professional fees, staff costs, other). For landlords use SA105 property categories (rent rates insurance and ground rents, repairs and maintenance, finance costs, legal and professional, other property expenses). For limited companies use standard accounts headings.

Where an account in (a) maps to a box in (b), store the mapping so a single confirmation populates both. Let the client pick from either system; the report can present by either.

**Step 5: Business or private.** Ask: is this wholly business, wholly private, or part private?

* Wholly business: carry the full amount forward.
* Wholly private: record it, mark it personal or drawings, and exclude it from the tax and accounts figures while keeping it for bank reconciliation.
* Part private: capture the business proportion as either a percentage or a fixed business amount. The system splits the line: the business portion is carried forward against the chosen category; the private portion is recorded against drawings or personal so the bank still reconciles. Both halves remain visible and linked.

**Step 6: Confirm.** Lock the line. It becomes a clean record. Allow re-opening before the period is finalised.

Show clear progress (for example "12 of 18 lines confirmed") and let the client save and return later.

\---

## 9\. BANK STATEMENT HANDLING AND RECEIPT MATCHING

* Accept bank statements as **PDF, CSV, or photograph**. Extract the lines (date, description, money in, money out, balance where present).
* Each statement line goes through the same review workflow in Section 8.
* **Receipt matching:** for each statement line, the client marks whether a supporting receipt or invoice exists. If yes, they attach or link an already-uploaded document to that line. Show a clear matched / unmatched status.
* Detect and flag two exceptions:

  * **Unmatched bank lines:** a statement amount with no receipt behind it.
  * **Orphan receipts:** an uploaded receipt not linked to any bank line.
* Let the client search uploaded receipts and link them to bank lines in a few clicks.

\---

## 10\. ELECTRONIC FILING OF DOCUMENTS

* Every uploaded file is stored in Supabase Storage against the company, with a database record holding: original filename, type (invoice / receipt / bank statement / other), upload date, the period it falls in, a status (pending, reviewed, matched), and the transactions it supports.
* All documents are searchable and filterable by date, type, supplier, amount, and status.
* A document is never deleted once a transaction depends on it; use a soft-delete or archive flag instead.

\---

## 11\. REPORTS (clean records for the practice)

All reports filter by period: a chosen quarter, a full tax year, or a custom date range. The MTD quarter option must align to the standard quarters. Provide:

1. **Transaction listing.** One row per confirmed line: date, description, gross, net, VAT code, VAT amount, classification, chart-of-accounts code and name, HMRC category, business or private split, source document link, receipt-matched flag. Export to CSV and Excel.
2. **Summary by category.** Totals by chart-of-accounts code and by HMRC box for the period. This is the basis for both the MTD quarterly figures and ordinary accounts.
3. **VAT summary** (VAT-registered clients only): output and input VAT by rate, and the net VAT position.
4. **Income and expenditure summary:** total income, total expenses, net, with the personal and part-private amounts shown separately and excluded from the business totals.
5. **Exceptions report:** unmatched bank lines, orphan receipts, lines still awaiting confirmation, and all part-private splits, so the practice can review them quickly.
6. **Per-property breakdown** for landlords.

**Export format matters.** Provide clean structured exports (CSV, Excel, and JSON) that carry the data without manual re-keying, so the practice can import directly into its recognised MTD or accounts software. Preserve the digital trail: each exported line references its source document.

\---

## 12\. DATA MODEL (minimum tables)

* `companies` (id, name, logo\_url, entity\_type, vat\_registered, accent\_colour, created\_at)
* `company\_modules` (company\_id, module\_code) — active industry overlays
* `users` (id, company\_id, email, role) — role is `client` or `admin`
* `accounts` (the chart of accounts, schema in Section 6)
* `hmrc\_categories` (id, code, name, applies\_to\_entity\_type, maps\_to\_account\_code)
* `documents` (id, company\_id, type, filename, storage\_path, period, status, uploaded\_at, archived)
* `transactions` (id, company\_id, document\_id, date, description, gross\_amount, net\_amount, vat\_code, vat\_amount, classification, account\_code, hmrc\_category\_id, business\_percent, is\_split, parent\_transaction\_id, status, confirmed\_at)
* `bank\_lines` (id, company\_id, document\_id, date, description, money\_in, money\_out, balance, matched\_transaction\_id, receipt\_document\_id, status)
* `audit\_log` (id, company\_id, user\_id, action, entity, before, after, at)

Every table carries `company\_id` and is protected by RLS. `transactions.parent\_transaction\_id` links the private half of a split to the business half.

\---

## 13\. SECURITY AND COMPLIANCE

* RLS on every table; no cross-tenant access under any circumstances. Provide automated tests proving isolation.
* Encryption at rest (Supabase default) and HTTPS in transit.
* GDPR: collect only what is needed, hold a retention setting per company, and provide an export and delete path for a company's data.
* Do not store full card numbers. Receipts may show the last four digits, which is acceptable; never capture or persist a full PAN.
* Maintain the audit log of who changed or confirmed what, and when.

\---

## 14\. BUILD ORDER (deliver in working stages)

1. Supabase project, schema, RLS policies, and the chart-of-accounts and HMRC-category seed load.
2. Authentication and the white-label company workspace (client sees only their company).
3. Document upload (including phone camera) and storage.
4. The extraction interface with the manual mode working first, then the vision-model default.
5. The transaction review workflow, Steps 1 to 6, including the part-private split.
6. Bank statement import and receipt matching.
7. Reports and exports.
8. Admin functions to create companies, issue logins, and set type, VAT status, and modules.
9. RLS isolation tests and a short deployment guide.

At each stage deliver complete files and plain instructions for where to paste keys, how to set environment variables, and how to deploy. State the free-tier limits in use and the estimated monthly cost at, say, 10 clients and 500 documents per month.

\---

## 15\. CONSTRAINTS AND STYLE

* British English in all interface text, labels, and reports.
* Avoid em dashes in any generated copy; use commas, colons, and full stops.
* Keep the interface plain and confidence-building for non-accountants: short questions, clear amounts, no jargon where a plain word will do.
* Favour free tiers and open-source tools; flag any cost before introducing it.
* Treat every extracted figure as a draft for the client to confirm. The client's confirmation is the record of truth.

\---

## 16\. EXPECTED DELIVERABLE

A deployable multi-tenant Next.js and Supabase application meeting the above, with seed data loaded from the provided chart-of-accounts workbook, working RLS isolation, the full transaction review workflow, bank-statement receipt matching, electronic document filing, and the export-ready reports. Provide a README covering setup, environment variables, deployment, free-tier limits, estimated running cost, and how to add a new client company.

