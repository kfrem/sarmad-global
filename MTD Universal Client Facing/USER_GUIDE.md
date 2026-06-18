# MTD Client Portal - User & Developer Guide

Welcome to the **Making Tax Digital (MTD) Client Portal**. This guide provides an easy-to-follow, step-by-step manual for the **Practice Administrator** (the accountant/firm), the **Client Users** (the businesses uploading documents), and **Developers** taking over the codebase.

---

## Part 1: Practice Administrator Guide
As the Practice Admin, you manage the workspaces and logins for all your clients.

### 1. Logging In
1. Go to: [https://mtd-client-portal.vercel.app/login](https://mtd-client-portal.vercel.app/login)
2. Enter your administrator credentials:
   * **Email**: `admin@yourpractice.co.uk`
   * **Password**: `YourSecurePasswordHere123`
3. Click **Sign In**.

### 2. Onboarding a New Client Company
Before a client can use the portal, you must provision their workspace:
1. Navigate to the **Client Companies** tab.
2. Under **Provision New Company**, fill in the form:
   * **Company Legal Name**: The official registered name of your client (e.g., *Acme Trading Ltd*).
   * **Logo URL (Optional)**: A direct link to their logo image (e.g., `https://example.com/logo.png`) to brand their dashboard.
   * **Entity Type & Tax Framing**: Select their business type (e.g., *Limited Company*, *Sole Trader*, etc.).
   * **VAT Registered**: Check this box if they are registered for UK VAT.
   * **Workspace Accent Color**: Choose their brand color (this theme will apply automatically when they log in).
   * **Active Industry Modules**: Select modules relevant to their business (e.g., *UNI (Universal)*, *CN (Construction)*, *HP (Hospitality)*).
3. Click **Create Company Workspace**.

### 3. Creating Login Credentials for a Client
Once the workspace is created, register their login accounts:
1. Navigate to the **User Credentials** tab.
2. Under **Create Login Credentials**:
   * **Email Address**: The client's business email.
   * **Password**: Set a secure temporary password.
   * **Assign to Company**: Select their company workspace from the dropdown list.
   * **User Role**: Set to **Client User (Standard)**.
3. Click **Create Login Credentials**.
4. Provide the login email, temporary password, and portal URL to your client.

---

## Part 2: Client User Guide
This section explains how your clients interact with their dashboard to upload documents, review entries, and track tax status.

### 1. Logging In
1. Go to: [https://mtd-client-portal.vercel.app/login](https://mtd-client-portal.vercel.app/login)
2. Enter the email and password provided by your accountant.
3. Click **Sign In**. You will land on your custom-branded dashboard.

### 2. Uploading Bookkeeping Documents
To upload receipts, purchase invoices, or bank statement spreadsheets:
1. Click **Upload Documents** in the left sidebar.
2. Select your file type (e.g., *Receipt*, *Invoice*, or *Bank Statement*).
3. Click the upload box or drag-and-drop your file (PDF, PNG, JPG, or Excel format supported).
4. The system will securely save your document in the storage bucket for audit verification.

### 3. Reviewing Transactions
1. Click **Review Transactions** in the left sidebar.
2. Here you will see a list of records extracted from your uploads.
3. Review the status, account categories, and VAT amounts.
4. Click **Confirm** on verified entries to lock them for tax submission.

### 4. Matching Bank Statements
1. Click **Bank Statement Matching** in the left sidebar.
2. Select a bank transaction from the statement log.
3. Match it against your uploaded invoices/receipts list or categorize it directly.
4. Click **Reconcile** to confirm the match.

### 5. Viewing Tax & Profit Reports
1. Click **Reports** in the left sidebar.
2. View your live income vs. expenditure chart and estimated VAT/Tax liabilities.
3. Use the filters to select specific tax quarters.
4. Click **Export Report** to download the ledger spreadsheet.

### 6. Resetting/Changing Your Password
Clients can update their passwords directly at any time:
1. Click **Settings** (⚙️) in the left sidebar.
2. Enter a new password.
3. Confirm the new password.
4. Click **Save Password**.

---

## Part 3: Developer Technical Manual
This section is for any software engineer taking over the repository.

### 1. Tech Stack & Architecture
* **Framework**: Next.js 16.2.9 (App Router)
* **Language**: TypeScript & React 19
* **Database & Auth**: Supabase (Postgres, GoTrue Auth, and Storage Buckets)
* **Styling**: Vanilla CSS (CSS Variables) with native React `<style dangerouslySetInnerHTML>` blocks to guarantee cross-compiler compatibility.
* **Compiler**: Webpack (configured via `package.json` to bypass Turbopack compatibility limits with certain styled assets).

### 2. Environment Setup
Create a `.env.local` or `.env.production.local` file in the project root containing:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
*(Refer to your local, git-ignored `DEVELOPER_LOCAL_SECRETS.md` file for active production keys).*

### 3. Development & Build Commands
* Run development server:
  ```bash
  npm run dev
  ```
* Compile and build production bundles locally:
  ```bash
  npm run build
  ```
* Deploy changes directly to production on Vercel:
  ```bash
  npx vercel deploy --prod --yes
  ```
