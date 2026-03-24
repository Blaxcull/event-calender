# Event Calendar — Project Report

## 1. Overview

The Event Calendar is a single-page web application that allows authenticated users to create, view, edit, and delete calendar events on a daily timeline. It supports recurring events (daily, weekly, monthly, yearly), multi-day events, reminders, and a sidebar with a mini calendar for quick date navigation.

**Live URL:** Uses Supabase hosted backend at `https://rhmpxbjaiihanqrzatxc.supabase.co`

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend framework | React 19 + TypeScript | UI rendering and component logic |
| Build tool | Vite 7 | Dev server and production bundling |
| Styling | Tailwind CSS 4 | Utility-first CSS |
| UI components | Radix UI + shadcn/ui | Accessible primitives (buttons, dialogs, cards, calendar) |
| Routing | React Router v7 | Client-side URL-based navigation |
| State management | Zustand 5 | Global store with persistence |
| Backend / Database | Supabase (PostgreSQL) | Auth, data storage, Row-Level Security |
| Date utilities | date-fns | Date formatting, arithmetic |
| Icons | Lucide React | Icon set |
| Testing | Vitest + Testing Library | Unit and component tests |

---

## 3. Project Structure

```
src/
├── App.tsx                    # Root component, routing, layout
├── main.tsx                   # Vite entry point
├── index.css                  # Global styles
├── components/
│   ├── AuthRedirect.tsx       # Redirects authenticated users to today's view
│   ├── DayViewRoute.tsx       # Route wrapper that parses URL date params
│   ├── RecurringActionDialog.tsx  # Dialog for "this event" vs "all events" choice
│   ├── TimeUpdater.tsx        # Listens to Supabase auth state changes
│   ├── TopBarLeft.tsx         # Top navigation bar
│   ├── ViewSwitcher.tsx       # Day view toggle
│   └── ui/                   # shadcn/ui component library (button, card, dialog, etc.)
├── Day_view/
│   ├── DayView.tsx            # Main day timeline grid
│   ├── TimeLine.tsx           # Timeline rendering with event blocks
│   └── TimeView.tsx           # Time column labels
├── hooks/
│   └── useRecurringPropertyChange.ts  # Hook for recurring event edit logic
├── lib/
│   └── supabase.ts            # Supabase client initialization
├── pages/
│   ├── Login.tsx              # Login page (email + password)
│   └── Signup.tsx             # Registration page
├── services/
│   └── reminderService.ts     # Polling-based browser alert reminders
├── SideBar/
│   └── SideBar.tsx            # Sidebar with calendar, nav controls, event editor
└── store/
    ├── eventsStore.ts         # Primary Zustand store (all event CRUD + caching)
    ├── types.ts               # TypeScript interfaces for Event, NewEvent, etc.
    ├── dbHelpers.ts           # Converts between app types and DB row format
    ├── dateUtils.ts           # Date string formatting and arithmetic helpers
    ├── recurringUtils.ts      # Generates virtual recurring event instances
    └── timeStore.ts           # Manages selected date and current time
```

**Root-level SQL migrations:**
- `supabase_migration_essential.sql`
- `supabase_migration_recurring_events.sql`
- `supabase_migration_exceptions.sql`
- `supabase_migration_new_recurring_schema.sql`
- `supabase_migration_repeat_end_mandatory.sql`
- `migrate_to_new_schema.sql`

---

## 4. Authentication

Authentication is handled entirely by Supabase Auth. The app uses email/password authentication with no OAuth providers.

| Action | File | Method |
|--------|------|--------|
| Sign up | `src/pages/Signup.tsx` | `supabase.auth.signUp({ email, password })` |
| Log in | `src/pages/Login.tsx` | `supabase.auth.signInWithPassword({ email, password })` |
| Sign out | `src/SideBar/SideBar.tsx` | `supabase.auth.signOut()` |
| Session check | `src/components/AuthRedirect.tsx` | `supabase.auth.getSession()` |
| Auth listener | `src/components/TimeUpdater.tsx` | `supabase.auth.onAuthStateChange()` |

On sign-in, the listener fetches events for the current date. On sign-out, the local event cache is cleared and the user is redirected to `/login`.

---

## 5. Database Schema

The app stores all events in a single **`events`** table in Supabase PostgreSQL.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `user_id` | UUID | Foreign key to `auth.users`, set from `supabase.auth.getUser()` |
| `title` | text | Event name |
| `description` | text | Optional description |
| `notes` | text | Optional notes |
| `urls` | text[] | Optional array of URLs |
| `date` | date | Start date (YYYY-MM-DD) |
| `end_date` | date | End date for multi-day events |
| `start_time` | int | Minutes since midnight (0–1439) |
| `end_time` | int | Minutes since midnight (0–1439) |
| `color` | text | Event color hex code |
| `is_all_day` | boolean | All-day event flag |
| `location` | text | Event location |
| `repeat` | text | Recurrence: "None", "Daily", "Weekly", "Monthly", "Yearly" |
| `series_start_date` | date | Start of recurring series |
| `series_end_date` | date | End of recurring series (10 years from creation) |
| `early_reminder` | text | Reminder timing (e.g., "15 minutes before") |
| `created_at` | timestamptz | Row creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

**Row-Level Security (RLS):** All queries are scoped by `auth.uid() = user_id` via RLS policies, ensuring users can only access their own data. The `user_id` is injected on the client before each insert.

**Additional tables defined in migrations but not yet used by client code:**
- `exceptions` — per-date overrides for recurring series
- `recurring_series` — normalized recurring series definitions
- `event_exceptions` — alternative exception tracking

---

## 6. Data Flow — How Data is Sent to Supabase

This is a **client-side only** application. There is no backend server, no API routes, and no server actions. All Supabase calls happen directly from the browser using the anon public key.

### 6.1 Supabase Client

`src/lib/supabase.ts` creates a single shared client instance:

```ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### 6.2 Data Conversions

`src/store/dbHelpers.ts` provides three conversion functions:

| Function | Direction | Purpose |
|----------|-----------|---------|
| `buildEventForDb(event, userId)` | App → DB | Converts `NewEvent` to a DB-ready row. Maps `earlyReminder` to `early_reminder`. Injects `user_id`. |
| `filterUpdatesForDb(updates)` | App → DB | Strips non-DB fields from a partial update object. Maps camelCase to snake_case. |
| `dbRowToEvent(row)` | DB → App | Converts a Supabase response row back to the app's `Event` type. |

### 6.3 CRUD Operations

All mutations are in `src/store/eventsStore.ts`:

| Operation | Supabase Call | Function |
|-----------|--------------|----------|
| **Create** | `.from('events').insert([eventForDb]).select().single()` | `addEvent()`, `addEventOptimistic()`, `saveTempEvent()` |
| **Read** | `.from('events').select('*').eq('user_id', ...).gte('date', ...).lte('date', ...)` | `fetchEventsWindow()` |
| **Update** | `.from('events').update(updates).eq('id', id)` | `updateEvent()`, `updateEventField()`, `saveSelectedEvent()` |
| **Delete** | `.from('events').delete().eq('id', id)` | `deleteEvent()` |

### 6.4 Data Fetching Strategy

Events are fetched in a **sliding window** of ±17 days around the currently viewed date. When the user navigates beyond the cached window, a new fetch is triggered. The cache is stored in Zustand state and persisted to `localStorage`.

```
fetchEventsWindow(centerDate)
  → SELECT * FROM events
    WHERE user_id = current_user
      AND date >= centerDate - 17 days
      AND date <= centerDate + 17 days
    ORDER BY start_time
```

Events are stored in `eventsCache` keyed by date string (e.g., `"2026-03-24"`).

---

## 7. Optimistic Updates — How Changes Appear Instantly

The app uses an **optimistic-first, background-sync** pattern to make the UI feel instant. Here is the step-by-step flow:

### Step 1: Create a Temporary Event

When a user creates an event, a temp object is built immediately with a temporary ID like `temp-1711276800000-abc123`. This temp event is inserted directly into the local `eventsCache`. The UI updates **without waiting** for the server.

### Step 2: Track Pending Sync

The temp ID is added to `pendingSyncs: Set<string>`, which tracks which events have not yet been confirmed by the database.

### Step 3: Background Database Save

The actual Supabase `insert` call is wrapped in `setTimeout(..., 0)` so it runs after the current render cycle and does not block the UI:

```ts
setTimeout(async () => {
  const { data, error } = await supabase
    .from('events')
    .insert([eventForDb])
    .select()
    .single()
  // ... handle result
}, 0)
```

### Step 4: Handle Rapid Edits (Update Queuing)

If the user edits a temp event **before** the insert completes, those edits are queued in `pendingUpdates: Map<string, Partial<NewEvent>[]>`. After the insert returns the real database row, the queued updates are merged and sent as a follow-up `.update()` call.

### Step 5: Swap Temp ID for Real ID

On successful insert, the temp event in the cache is replaced with the real database-returned event (which has the real UUID). If the currently selected event was the temp one, `selectedEventId` is also updated to point to the real ID.

### Step 6: Rollback on Failure

If the insert fails (network error, auth expired, etc.), the `rollbackTempEvent()` function removes the temp event from `eventsCache`, `pendingSyncs`, and `pendingUpdates`. The UI reverts to its previous state.

### Summary Diagram

```
User clicks "Add Event"
        │
        ▼
┌─────────────────────┐
│ Create temp event   │  ← Instant, no network call
│ Add to local cache  │
│ UI updates NOW      │
└─────────┬───────────┘
          │
          ▼ (setTimeout 0)
┌─────────────────────┐
│ POST to Supabase    │  ← Background, async
│ INSERT INTO events  │
└─────────┬───────────┘
          │
     ┌────┴────┐
     │         │
  Success    Failure
     │         │
     ▼         ▼
┌─────────┐ ┌──────────┐
│ Replace  │ │ Rollback │
│ temp →   │ │ remove   │
│ real ID  │ │ temp     │
└─────────┘ └──────────┘
```

---

## 8. Recurring Events

Recurring events are stored as a single row in the `events` table with `repeat`, `series_start_date`, and `series_end_date` fields set. Virtual instances for each occurrence date are generated **client-side** on demand.

### Supported Patterns

| Pattern | Repeat Value | Generation Logic |
|---------|-------------|-----------------|
| Daily | `"Daily"` | Add 1 day per occurrence |
| Weekly | `"Weekly"` | Add 7 days per occurrence |
| Monthly | `"Monthly"` | Add 1 month per occurrence |
| Yearly | `"Yearly"` | Add 1 year per occurrence |

### Generation Process

`src/store/recurringUtils.ts` contains `generateRecurringInstances()` which:
1. Takes a master event and a date range
2. Iterates from `series_start_date` to the earlier of `series_end_date` or the range end
3. Creates a `CalendarEvent` for each occurrence with `isRecurringInstance: true`
**Live URL:** Uses Supabase hosted backend at `https://rhmpxbjaiihanqrzatxc.supabase.co`
4. These virtual instances are stored in `computedEventsCache`

Here's how computedEventsCache works:
What It Is
computedEventsCache is a derived/aggregated cache that holds the final list of events for a given date — ready to render. It sits between raw data (eventsCache) and the UI.
Type: { [dateKey: string]: CalendarEvent[] }
Why It Exists
For any given date, the events shown on screen come from three sources:
1. Real events — rows in eventsCache[dateKey] that are stored on that exact date in the DB
2. Multi-day events — events from other dates whose date → end_date range spans into this date
3. Recurring instances — virtual occurrences generated from master recurring events
Combining these three sources on every render would be expensive. So getEventsForDate() computes the merged result once, caches it in computedEventsCache, and returns the cached version on subsequent calls.
How It Gets Populated
In eventsStore.ts:655-758, getEventsForDate() does this:
1. Check computedEventsCache[dateKey]
   → If exists, return immediately (cache hit)
2. Otherwise, build the full list:
   a. Real events from eventsCache[dateKey]
   b. Multi-day events from other dates that span into this date
   c. Recurring instances generated via recurringUtils for this date's month
3. Deduplicate and sort by start_time
4. Write result into computedEventsCache[dateKey] via setTimeout(0)
5. Return the computed list
When It Gets Invalidated
The cache is cleared (set to {}) whenever the underlying data changes — after insert, update, delete, fetch, or series operations. This forces the next getEventsForDate() call to recompute.
The Intermediate Cache: recurringEventsCache
There's also recurringEventsCache keyed by month ("2026-03"). When generating recurring instances, the entire month's worth of instances is computed at once and cached. This avoids regenerating the same series for every date in the same month.
recurringEventsCache["2026-03"] = [all recurring instances for March 2026]
    ↓
getEventsForDate() filters by e.date === dateKey
    ↓
computedEventsCache["2026-03-24"] = [final merged list for that day]
In short: recurringEventsCache is the month-level raw recurring data, and computedEventsCache is the per-day final render-ready list that combines everything.





### Editing Recurring Events

When a user edits a recurring event, a `RecurringActionDialog` appears asking:
- **"This event"** — Creates an exception or splits the series at that date
- **"All events"** — Updates the master event, affecting all future occurrences

The `updateThisAndFollowing()` function handles splitting by:
1. Ending the original series at the day before the edit
2. Creating a new series starting from the edit date with the updated properties

---

## 9. Reminders

`src/services/reminderService.ts` implements a simple polling-based reminder system:

- Runs every **10 seconds** via `setInterval`
- Checks all cached events for `earlyReminder` values
- Triggers a `window.alert()` when the current time falls between the reminder time and the event start time
- Supports: 5 min, 10 min, 15 min, 30 min, 1 hour, 1 day before
- Tracks already-alerted events to avoid duplicate alerts

---

## 10. Application Routing

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `TodayRedirect` | Redirects to `/day/{today's date}` |
| `/day/:year/:month/:day` | `DayViewRoute` | Main calendar view for a specific date |
| `/login` | `Login` | Email/password login |
| `/signup` | `Signup` | Email/password registration |

The URL structure `/day/2026/3/24` encodes the currently viewed date, making the app bookmarkable and shareable.

---

## 11. State Management

The app uses **Zustand** with two stores:

### `eventsStore` (primary store)
- `eventsCache` — Raw events keyed by date, fetched from Supabase
- `computedEventsCache` — Generated recurring instances keyed by date
- `pendingSyncs` — Temp IDs awaiting DB confirmation
- `pendingUpdates` — Queued edits for temp events
- `selectedEventId` — Currently selected event for the sidebar editor
- `recurringDialog*` — State for the recurring edit/delete dialog

### `timeStore`
- `selectedDate` — The currently viewed date
- `currentTime` — Live clock for timeline rendering

The events store uses Zustand's `persist` middleware to save the cache to `localStorage`, reducing load times on page refresh.

---

## 12. Key Architectural Decisions

1. **No server layer** — All backend interaction is direct client-to-Supabase. This simplifies deployment but means the anon key is exposed in the browser (protected by RLS policies).

2. **Optimistic UI** — All mutations are local-first with background sync. This makes the app feel instant even on slow connections.

3. **Client-side recurring generation** — Recurring instances are computed in the browser rather than stored as individual DB rows. This reduces storage but means the client must process the full series.

4. **Sliding window cache** — Events are fetched in a ±17 day window rather than loading everything. This keeps memory usage bounded.

5. **localStorage persistence** — The Zustand store is persisted to localStorage so the app loads instantly on refresh without waiting for Supabase.

---

## 13. Running the Project

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

**Environment variables required** (in `.env`):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
