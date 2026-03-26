# Supabase Authentication Setup Guide

## Overview
This guide will help you set up Supabase authentication for your Event Calendar application.

## Step 1: Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Enter a name for your project (e.g., "event-calendar")
4. Choose a database password (save this securely)
5. Select a region closest to your users
6. Click "Create new project"

Wait for the project to finish setting up (this may take a few minutes).

## Step 2: Get Your API Credentials

Once your project is created:

1. In the Supabase dashboard, click on the **Settings** icon (gear icon) in the left sidebar
2. Click on **API** in the Settings menu
3. Copy the following values:
   - **URL** (Project URL) - looks like `https://xxxxxxxxxxxxxxxxx.supabase.co`
   - **anon public** (anon key) - a long string starting with `eyJ...`

## Step 3: Configure Environment Variables

1. In your frontend directory, create a `.env` file:
   ```bash
   cd /home/skulz/dev/event-calender/frontend
   touch .env
   ```

2. Add these variables to the `.env` file:
   ```env
   VITE_SUPABASE_URL=https://your-project-url.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

   Replace the values with your actual Supabase credentials.

## Step 4: Enable Email Auth Provider

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Ensure **Email** provider is enabled (should be enabled by default)
3. Configure email settings if needed (confirmation emails, etc.)

### Important Settings:

**Confirm email** - Choose based on your needs:
- **Enabled**: Users must click a link in email to activate account
- **Disabled**: Users can login immediately after signup

To change this:
1. Go to **Authentication** → **Email Templates**
2. Or modify in **Settings** → **Authentication** → **Email Auth**

## Step 5: Test the Authentication

1. Start your frontend development server:
   ```bash
   cd /home/skulz/dev/event-calender/frontend
   npm run dev
   ```

2. Navigate to `http://localhost:5173/login` (or your dev server URL)

3. Try creating a new account via the Sign Up page

4. After successful signup/login, you should be redirected to today's day view

## Step 6: View Users in Dashboard

To see registered users:
1. Go to **Authentication** → **Users** in Supabase dashboard
2. Here you can view, manage, and delete user accounts

## Additional Configuration (Optional)

### Row Level Security (RLS)

If you want to secure your database tables based on authenticated users:

1. Go to **Table Editor**
2. Select a table
3. Click **Authentication** → **Policies**
4. Enable RLS and create policies

Example policy to allow users to only see their own data:
```sql
CREATE POLICY "Users can only access their own events" ON events
  FOR ALL USING (auth.uid() = user_id);
```

### Email Templates

Customize confirmation and reset password emails:
1. Go to **Authentication** → **Email Templates**
2. Edit the templates as needed

### OAuth Providers (Optional)

To add Google, GitHub, etc. login:
1. Go to **Authentication** → **Providers**
2. Enable desired provider
3. Configure OAuth credentials

## Troubleshooting

**"Invalid login credentials" error**
- Check that your `.env` values are correct
- Ensure the user has confirmed their email (if required)
- Check Supabase dashboard for the user in Authentication → Users

**"Error connecting to Supabase"**
- Verify your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly
- Check that the Supabase project is active

**CORS errors**
- In Supabase dashboard, go to **Authentication** → **URL Configuration**
- Add your frontend URL to **Site URL** and **Redirect URLs**
- For local development, add `http://localhost:5173`

## Security Notes

- Never commit the `.env` file to git (it's already in `.gitignore`)
- The anon key is safe to use in the frontend - it has restricted permissions
- Always use Row Level Security (RLS) for production database tables
- Enable email confirmation for production apps

## Next Steps

After auth is working, you might want to:
1. Add password reset functionality
2. Implement protected routes
3. Add user profile management
4. Set up RLS policies for your data tables
