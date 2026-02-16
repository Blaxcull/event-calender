# Supabase Setup Instructions

## 1. Create Supabase Account & Project

### Step 1: Sign Up
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub, GitLab, or email

### Step 2: Create New Project
1. Click "New Project"
2. Enter project details:
   - **Name**: `event-calendar` (or your preferred name)
   - **Database Password**: Generate a secure password (save this!)
   - **Region**: Choose closest to your location
   - **Pricing Plan**: Free tier is sufficient for development

### Step 3: Get API Keys
1. After project creation, go to **Settings → API**
2. Copy these values:
   - **Project URL**: `https://xxxxxxxxxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 2. Configure Authentication

### Step 1: Enable Email/Password Auth
1. Go to **Authentication → Providers**
2. Under "Email", ensure "Enable email provider" is ON
3. Configure email templates if needed

### Step 2: Set Up Google OAuth (Optional)
1. Go to **Authentication → Providers**
2. Click "Google"
3. Enable Google provider
4. You'll need to create OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project or use existing
   - Go to **APIs & Services → Credentials**
   - Create **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5173/*`
   - Copy **Client ID** and **Client Secret** to Supabase

### Step 3: Configure Redirect URLs
1. Go to **Authentication → URL Configuration**
2. Add these Site URLs:
   - `http://localhost:5173`
   - `http://localhost:5173/auth/callback`
3. Save changes

## 3. Set Up Database Schema

### Option A: Use SQL Editor (Recommended)
1. Go to **SQL Editor**
2. Create new query
3. Copy and paste the SQL from `backend/supabase/schema.sql`
4. Run the query

### Option B: Use Table Editor
1. Go to **Table Editor**
2. Create table "events" with these columns:
   - `id` (uuid, primary key, default: `gen_random_uuid()`)
   - `user_id` (uuid, references `auth.users(id)`)
   - `title` (text, not null)
   - `date` (date, not null)
   - `start_time` (integer, not null)
   - `end_time` (integer, not null)
   - `created_at` (timestamptz, default: `now()`)
   - `updated_at` (timestamptz, default: `now()`)
3. Enable Row Level Security (RLS)
4. Create RLS policies (see SQL file for details)

## 4. Environment Variables

Create `.env.local` file in `frontend/` directory:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 5. Test Connection

### Quick Test Script
Create `test-supabase.js` in project root:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// Test connection
async function testConnection() {
  const { data, error } = await supabase.from('events').select('count')
  console.log('Connection test:', error ? 'FAILED' : 'SUCCESS', data)
}

testConnection()
```

## 6. Troubleshooting

### Common Issues

1. **CORS Errors**: 
   - Go to **Settings → API**
   - Add `http://localhost:5173` to "Additional Redirect URLs"

2. **RLS Policy Errors**:
   - Ensure RLS is enabled on events table
   - Check policy conditions match user ID

3. **Authentication Errors**:
   - Verify redirect URLs in Supabase settings
   - Check Google OAuth credentials are valid

4. **Database Connection**:
   - Verify project URL and anon key
   - Check if database is running (Status should be "ACTIVE")

## 7. Next Steps

After setup:
1. Run `npm install` in frontend directory
2. Start dev server: `npm run dev`
3. Test authentication flow
4. Create test events to verify database integration

## Support
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase/issues)