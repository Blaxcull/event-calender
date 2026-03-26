# Event Calendar with Supabase Backend

A full-stack event calendar application with a React/TypeScript frontend and Supabase PostgreSQL backend.

## Features

- **Day View Calendar**: Visual hour-by-hour event scheduling
- **Event Management**: Create, drag, resize, and delete events
- **Supabase Integration**: PostgreSQL database with Row Level Security
- **Authentication**: Email/password + Google OAuth login
- **Real-time Updates**: Events sync automatically across sessions
- **Responsive UI**: Modern design with Tailwind CSS

## Project Structure

```
event-calender/
├── frontend/                 # React/TypeScript frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and helpers
│   │   ├── store/          # Zustand state management
│   │   └── context/        # React context providers
│   └── .env.local          # Environment variables (create from .env.local.example)
├── backend/
│   └── supabase/
│       └── schema.sql      # Database schema for Supabase
└── SUPABASE_SETUP.md       # Complete setup instructions
```

## Quick Start

### 1. Set Up Supabase

1. **Create Supabase Account**: Go to [supabase.com](https://supabase.com) and sign up
2. **Create New Project**: 
   - Name: `event-calendar`
   - Database Password: Generate and save
   - Region: Choose closest to you
3. **Get API Keys**: From Settings → API, copy:
   - `Project URL` (e.g., `https://xxxx.supabase.co`)
   - `anon/public key`

### 2. Configure Environment

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

### 3. Set Up Database

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the SQL from `backend/supabase/schema.sql`
3. Run the query to create tables and security policies

### 4. Configure Authentication

1. Go to Authentication → Providers
2. Enable Email/Password
3. (Optional) Add Google OAuth:
   - Create OAuth credentials in Google Cloud Console
   - Add Client ID and Secret to Supabase

### 5. Run the Application

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to use the calendar.

## Database Schema

```sql
events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  title TEXT NOT NULL,
  date DATE NOT NULL,          -- Calendar date (YYYY-MM-DD)
  start_time INTEGER NOT NULL, -- Minutes since midnight (0-1439)
  end_time INTEGER NOT NULL,   -- Minutes since midnight
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

## API Integration

The frontend uses Supabase client directly:

- **Authentication**: `@supabase/supabase-js` auth methods
- **Events CRUD**: Direct Supabase table operations with RLS
- **Real-time**: Built-in Supabase real-time subscriptions

## Development

### Frontend Commands

```bash
cd frontend
npm run dev      # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run test     # Run tests
```

### Backend Management

- **Database Changes**: Update `backend/supabase/schema.sql`
- **Migrations**: Apply via Supabase SQL Editor
- **Row Level Security**: Policies defined in schema

## Security Features

- **Row Level Security**: Users can only access their own events
- **JWT Authentication**: Secure token-based auth
- **Input Validation**: Client and server-side validation
- **Password Hashing**: bcrypt via Supabase Auth

## Deployment

### Frontend (Vercel/Netlify)

1. Build: `npm run build`
2. Deploy `dist/` folder
3. Set environment variables in hosting platform

### Supabase

- Database hosted on Supabase
- Automatic backups and scaling
- Free tier includes 500MB database

## Troubleshooting

### Common Issues

1. **CORS Errors**: Add `http://localhost:5173` to Supabase redirect URLs
2. **RLS Policy Errors**: Verify user is authenticated and policies exist
3. **Database Connection**: Check Supabase project URL and anon key
4. **Authentication**: Verify redirect URLs in Supabase settings

### Debugging

1. Check browser console for errors
2. Verify `.env.local` variables are set
3. Test Supabase connection with `testConnection()` in `supabase.ts`
4. Check Supabase logs in dashboard

## Next Steps

Potential enhancements:

1. **Week/Month Views**: Expand calendar functionality
2. **Event Categories**: Color coding and filtering
3. **Recurring Events**: Weekly/monthly repeating events
4. **Notifications**: Email/SMS reminders
5. **Calendar Sharing**: Share calendars with other users
6. **Import/Export**: ICS file support

## Support

- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Create GitHub Issue](https://github.com/your-repo/issues)