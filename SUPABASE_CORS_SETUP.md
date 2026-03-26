# Supabase CORS Configuration Fix

## Current Issue
CORS error: `Access to fetch at 'https://supabase.com/dashboard/project/rhmpxbjaiihanqrzatxc/auth/v1/token' from origin 'http://localhost:5173' has been blocked by CORS policy`

## Root Cause
1. **Wrong URL format**: Using dashboard URL instead of API URL
2. **Missing CORS configuration**: Supabase not configured to allow `http://localhost:5173`

## Fix Steps

### Step 1: Update Environment Variables ✅ DONE
Changed in `.env.local`:
```diff
- VITE_SUPABASE_URL=https://supabase.com/dashboard/project/rhmpxbjaiihanqrzatxc/
+ VITE_SUPABASE_URL=https://rhmpxbjaiihanqrzatxc.supabase.co
```

### Step 2: Configure Supabase CORS Settings

1. **Go to Supabase Dashboard**:
   - Navigate to: https://supabase.com/dashboard/project/rhmpxbjaiihanqrzatxc

2. **Configure Authentication Settings**:
   - Go to **Authentication → URL Configuration**
   - Add these URLs:
     - `http://localhost:5173`
     - `http://localhost:5173/auth/callback`
     - `http://localhost:5173/*`

3. **Configure API Settings**:
   - Go to **Settings → API**
   - Under "Additional Redirect URLs", add:
     - `http://localhost:5173`
     - `http://localhost:5173/auth/callback`
   - Under "Site URL", add:
     - `http://localhost:5173`

4. **Save Changes**:
   - Click "Save" on both pages

### Step 3: Test the Fix

1. **Restart your development server**:
   ```bash
   cd frontend
   pkill -f "npm run dev"
   npm run dev
   ```

2. **Open browser console** (F12) and check for:
   - No CORS errors
   - Debug output from `supabaseDebug.ts`
   - Successful connection messages

3. **Test authentication**:
   - Try to sign up/login
   - Check if Google OAuth redirects properly

## Alternative Solutions

### If CORS persists:

#### Option A: Use Supabase CLI (Recommended)
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Update CORS settings via CLI
supabase projects update rhmpxbjaiihanqrzatxc \
  --site-url http://localhost:5173 \
  --redirect-urls http://localhost:5173,http://localhost:5173/auth/callback
```

#### Option B: Manual API Call
```bash
# Get your Supabase access token from Settings → Access Tokens
ACCESS_TOKEN="your-access-token"

# Update CORS settings via API
curl -X PUT \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_url": "http://localhost:5173",
    "redirect_urls": ["http://localhost:5173", "http://localhost:5173/auth/callback"]
  }' \
  https://api.supabase.com/v1/projects/rhmpxbjaiihanqrzatxc/config/auth
```

#### Option C: Temporary Development Workaround
1. **Install CORS browser extension**:
   - Chrome: "Allow CORS: Access-Control-Allow-Origin"
   - Firefox: "CORS Everywhere"

2. **Disable CORS in browser** (Chrome only):
   ```bash
   # Windows
   chrome.exe --disable-web-security --user-data-dir="C:/temp"

   # Mac
   open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security
   ```

## Verification

After applying the fix, you should see:

1. **In Browser Console**:
   ```
   ✅ Basic connection successful
   ✅ Auth client configured correctly
   ✅ CORS preflight successful
   ```

2. **Authentication Flow**:
   - Email/password login works
   - Google OAuth redirects properly
   - Session persists across page reloads

3. **Database Access**:
   - Events load for selected date
   - CRUD operations work without CORS errors

## Common Issues & Solutions

### Issue 1: "Invalid redirect URL"
**Solution**: Ensure exact URL match in Supabase settings, including trailing slashes.

### Issue 2: Google OAuth not working
**Solution**:
1. Check Google Cloud Console OAuth credentials
2. Verify `authorized redirect URIs` includes `http://localhost:5173/auth/callback`
3. Ensure Google OAuth is enabled in Supabase Authentication → Providers

### Issue 3: Session not persisting
**Solution**: Check `persistSession` and `autoRefreshToken` settings in `supabase.ts`

### Issue 4: Events table not accessible
**Solution**: Run the database schema from `backend/supabase/schema.sql` in Supabase SQL Editor.

## Next Steps After CORS Fix

1. **Test authentication thoroughly**
2. **Verify database connectivity**
3. **Implement custom Express backend** (if still needed)
4. **Add error handling and user feedback**

## Support

If issues persist:
1. Check Supabase project status at https://status.supabase.com/
2. Review Supabase logs in Dashboard → Logs
3. Join Supabase Discord for community support
4. Create issue at https://github.com/supabase/supabase/issues