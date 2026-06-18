# Client Bookkeeping and Document Capture Portal - Deployment Guide

This is a low-cost, secure, multi-tenant, white-label bookkeeping and document capture portal designed for UK accountancy practices. It runs on the **Supabase** and **Vercel** free tiers, keeping operating costs close to zero (approximately **10 pence per month** for 10 clients and 500 monthly documents).

---

## 1. Cost & Free-Tier Limit Audit

Below is the estimated monthly cost and footprint for serving 10 clients and 500 documents per month:

| Service | Free-Tier Limits | Expected Footprint (10 Clients / 500 Docs) | Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Supabase Database** | 500 MB storage | ~15 MB database size (text & metadata) | £0.00 (Free Tier) |
| **Supabase Storage** | 1.0 GB file storage | ~50 MB (due to client-side 1024px photo compression) | £0.00 (Free Tier) |
| **Vercel Frontend** | 100 GB bandwidth / mo | < 2 GB bandwidth | £0.00 (Free Tier) |
| **Gemini API (Flash)** | 15 requests per minute | 500 requests per month (approx. 16 per day) | **~£0.10** (10p) (Pay-as-you-go) |
| **TOTAL** | - | - | **~£0.10 / month** |

---

## 2. Supabase Setup (Step-by-Step)

Supabase handles user logins, database records, and document files. Follow these steps to set up your project:

### Step 2.1: Create your Supabase Project
1. Open your browser and go to [Supabase](https://supabase.com/). Sign in or create a free account.
2. Click **New Project** and select an organisation.
3. Fill in the project details:
   * **Name**: `MTD Client Portal`
   * **Database Password**: Choose a secure password (write it down).
   * **Region**: Select **London (eu-west-2)** or **Frankfurt (eu-central-1)** to comply with UK GDPR data residency rules.
   * **Pricing Plan**: Select the **Free Tier**.
4. Click **Create new project**. Wait 2-3 minutes for the database to provision.

### Step 2.2: Run Database Setup Scripts
Once your project is ready, load the schema, security rules, and chart of accounts:
1. In the Supabase left-hand menu, click on the **SQL Editor** icon (looks like `>_`).
2. Click **New Query**.
3. Open the file [01_init_schema.sql](file:///c:/Users/kfrem/OneDrive/CLIENTS/CLOSE%20COMPANIES/KAFS%20LTD/KAFS%20AUTOMATION/Coaching%20Business/Apps%20Dev/Sarmad%20global/MTD%20Universal%20Client%20Facing/supabase/migrations/20260618000000_init_schema.sql) on your computer, copy the entire content, paste it into the editor, and click **Run** (bottom right).
4. Create another query, copy the content from [02_rls_policies.sql](file:///c:/Users/kfrem/OneDrive/CLIENTS/CLOSE%20COMPANIES/KAFS%20LTD/KAFS%20AUTOMATION/Coaching%20Business/Apps%20Dev/Sarmad%20global/MTD%20Universal%20Client%20Facing/supabase/migrations/20260618000100_rls_policies.sql), paste it, and click **Run**.
5. Create a final query, copy the content from [03_seed_data.sql](file:///c:/Users/kfrem/OneDrive/CLIENTS/CLOSE%20COMPANIES/KAFS%20LTD/KAFS%20AUTOMATION/Coaching%20Business/Apps%20Dev/Sarmad%20global/MTD%20Universal%20Client%20Facing/supabase/migrations/20260618000200_seed_data.sql) (this contains all 584 accounts from the master sheet), paste it, and click **Run**.
6. Open a fourth query, copy the content from [04_storage_policies.sql](file:///c:/Users/kfrem/OneDrive/CLIENTS/CLOSE%20COMPANIES/KAFS%20LTD/KAFS%20AUTOMATION/Coaching%20Business/Apps%20Dev/Sarmad%20global/MTD%20Universal%20Client%20Facing/supabase/migrations/20260618000300_storage_policies.sql), paste it, and click **Run**.

### Step 2.3: Provision the Practice Administrator User
To access the admin panel, you need to register a practice administrator login credentials:
1. Go to the **SQL Editor** in Supabase and click **New Query**.
2. Run the following command (replace with your desired administrator email and a strong password):
   ```sql
   -- Create auth user (generates sub UUID)
   INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
   VALUES (
     gen_random_uuid(), 
     'admin@yourpractice.co.uk', 
     crypt('YourSecurePasswordHere123', gen_salt('bf')), 
     now(), 
     '{"provider":"email","providers":["email"]}', 
     '{}', 
     now(), 
     now(), 
     'authenticated', 
     'authenticated'
   )
   RETURNING id;
   ```
3. Copy the returned **id** (UUID string) from the result.
4. Run the following insert query (replace the first value with the UUID copied above, and keep `company_id` as `NULL`):
   ```sql
   -- Link to public profile as practice admin
   INSERT INTO public.users (id, company_id, email, role)
   VALUES ('YOUR_COPIED_UUID_HERE', NULL, 'admin@yourpractice.co.uk', 'admin');
   ```

---

## 3. Local Configuration & Env Setup

To run or build the Next.js app locally, create a file named `.env.local` in the root folder of the project:
1. Create a file named `.env.local` in the project root directory.
2. Add the following keys (retrieve the Supabase URLs from the **Project Settings** -> **API** tab in Supabase, and the Gemini API key from [Google AI Studio](https://aistudio.google.com/)):
   ```env
   # Supabase Keys (Publicly accessible on client)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here

   # Supabase Private Admin Key (Keep SECRET! Do not push to git)
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here

   # Document Extraction API Credentials
   GEMINI_API_KEY=your-google-gemini-api-key-here
   GEMINI_MODEL=gemini-1.5-flash
   ```

---

## 4. Frontend Deployment on Vercel (Free Tier)

Vercel is the recommended serverless hosting provider for Next.js.

### Step 4.1: Push Project to GitHub
1. Create a private repository on [GitHub](https://github.com/).
2. Push your project folder up to GitHub (ensure `.env.local` is listed in your `.gitignore` so your secret keys are not uploaded).

### Step 4.2: Import to Vercel
1. Sign in to [Vercel](https://vercel.com/) (using your GitHub account).
2. Click **Add New** -> **Project**.
3. Select your private repository from the import list.
4. Expand the **Environment Variables** section and paste all keys from your `.env.local`:
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   * `SUPABASE_SERVICE_ROLE_KEY` (secret service role key)
   * `GEMINI_API_KEY`
   * `GEMINI_MODEL` (set value to `gemini-1.5-flash`)
5. Click **Deploy**. Vercel will build and launch your application in less than 2 minutes.

---

## 5. How to Add a New Client Company (Practitioner Guide)

Once deployed, log into your practitioner portal to configure client workspaces:
1. Navigate to `/login` and sign in using your practice administrator credentials (`admin@yourpractice.co.uk`).
2. You will be automatically redirected to the **Practice Admin Panel** at `/admin`.
3. In the **Client Companies** tab:
   * Enter the client's business name.
   * Select their entity type (e.g. Sole Trader, Landlord, or Limited Company).
   * Specify if they are VAT registered.
   * Pick an accent branding colour (e.g. green for agriculture, blue for limited companies).
   * Tick active modules: `UNI` is always active. Check others (e.g., `HP` for hospitality, `CN` for construction) based on the client's sector.
   * Click **Create Company Workspace**.
4. In the **User Credentials** tab:
   * Enter the client's email address and assign a temporary password.
   * Select their company name from the dropdown.
   * Select the role **Client User**.
   * Click **Create Login Credentials**.
5. Pass the link, username, and password to the client. When they sign in, they will only see their logo, company name, custom accent color, and the bookkeeping forms matching their specific tax profile.
