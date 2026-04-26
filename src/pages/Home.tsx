import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  ArrowRight,
  Target,
  Clock,
  BarChart3,
  Repeat,
  Bell,
  LayoutGrid,
  Flame,
  Search,
  TrendingUp,
  Check,
  Minus,
  Lock,
  Database,
  KeyRound,
  Download,
  RefreshCw,
  FileText,
  Star,
} from "lucide-react";

export function Home({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground font-sf">
      <Nav isAuthenticated={isAuthenticated} onLogout={handleLogout} />
      <main>
        <Hero isAuthenticated={isAuthenticated} />
        <SocialProof />
        <Features />
        <Benefits />
        <Testimonials />
        <Pricing isAuthenticated={isAuthenticated} />
        <Comparison />
        <Faq />
        <Trust />
        <CtaBanner isAuthenticated={isAuthenticated} />
      </main>
      <Footer />
    </div>
  );
}

/* ---------- NAV ---------- */
function Nav({ isAuthenticated, onLogout }: { isAuthenticated: boolean; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-6 font-sf">
        <Link to="/" className="flex items-center">
          <img src="/applogo.png" alt="Ortem Logo" className="h-20 w-auto" />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex font-medium font-sf">
          <a href="#features" className="hover:text-foreground transition">Features</a>
          <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
          <a href="#compare" className="hover:text-foreground transition">Compare</a>
          <a href="#faq" className="hover:text-foreground transition">FAQ</a>
        </nav>
        <div className="flex items-center gap-4">
          {!isAuthenticated ? (
            <>
              <Link to="/login" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline transition">Login</Link>
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 shadow-sm"
              >
                Start free
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-background px-6 py-2 text-sm font-bold text-foreground transition hover:bg-surface shadow-sm cursor-pointer"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <img src="/applogo.png" alt="Ortem Logo" className="h-7 w-auto object-contain" />
  );
}

/* ---------- HERO ---------- */
function Hero({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section id="top" className="relative overflow-hidden border-b border-hairline font-sf">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: "var(--gradient-spotlight)" }}
      />
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
            Used by 2,400+ focused planners
          </div>
          <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl leading-[1.1]">
            Goal-linked calendar that shows where your time went.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground leading-relaxed">
            For students, freelancers, and ADHD planners who want more than a schedule —
            Ortem ties every event to a goal so you can see exactly where your hours went
            and turn plans into measurable progress.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to={isAuthenticated ? "/today" : "/signup"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-8 py-3.5 text-sm font-medium text-background transition hover:opacity-90 sm:w-auto shadow-md"
            >
              {isAuthenticated ? "Go to Calendar" : "Start free"} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#demo"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-hairline bg-background px-8 py-3.5 text-sm font-medium text-foreground transition hover:bg-surface sm:w-auto shadow-sm"
            >
              See demo →
            </a>
          </div>
          <p className="mt-6 text-xs text-muted-foreground font-medium">
            No credit card required · Sign in with Google or email
          </p>
        </div>

        {/* Mockup */}
        <div className="relative mx-auto mt-20 max-w-5xl">
          <div
            className="overflow-hidden rounded-2xl border border-hairline bg-background shadow-2xl"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <img src="/monthview.png" alt="Ortem Month View" className="w-full h-auto block" />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-10 -bottom-10 h-40 -z-10 blur-3xl opacity-20"
            style={{ background: "radial-gradient(50% 100% at 50% 0%, oklch(0 0 0 / 0.5), transparent)" }}
          />
        </div>
      </div>
    </section>
  );
}

/* ---------- SOCIAL PROOF ---------- */
function SocialProof() {
  const stats = [
    { v: "2,400+", l: "Active planners tracking goals every week" },
    { v: "94%", l: "Say they stayed more consistent after 30 days" },
    { v: "4.8 ★", l: "Average rating across early-access users" },
  ];
  const built = [
    "🎓 Students managing coursework",
    "💼 Freelancers tracking billable hours",
    "🧠 ADHD planners who need structure",
    "📅 Calendar lovers who want analytics",
    "🏃 Habit builders with recurring routines",
    "📊 Data-driven weekly reviewers",
  ];
  return (
    <section className="border-b border-hairline bg-surface/50 font-sf">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <p className="text-center text-xs font-black uppercase tracking-[0.3em] text-muted-foreground mb-12">
          Built for focused people everywhere
        </p>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-3 shadow-lg">
          {stats.map((s) => (
            <div key={s.v} className="bg-background p-8 text-center group hover:bg-surface transition-colors">
              <div className="text-5xl font-bold tracking-tighter mb-2">{s.v}</div>
              <div className="text-sm font-medium text-muted-foreground leading-relaxed px-4">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {built.map((b) => (
            <span
              key={b}
              className="rounded-full border border-hairline bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-surface transition cursor-default"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FEATURES ---------- */
function Features() {
  const items = [
    { icon: Target, title: "Goal Linking", desc: "Attach any event to a goal with one tap. Every hour automatically counts toward that goal — no manual logging." },
    { icon: Clock, title: "Time-Per-Goal Tracking", desc: "See exactly how many hours you've invested in each goal this week, month, or custom range — in real time." },
    { icon: BarChart3, title: "Activity & Progress", desc: "Daily and weekly breakdown of completed vs planned time. Your personal analytics dashboard, built in." },
    { icon: Repeat, title: "Recurring Events", desc: "Daily, weekly, or custom rules so routines appear automatically. Edit one occurrence or the whole series." },
    { icon: Bell, title: "Reminders & Alerts", desc: "Push and email reminders before each event. Lead times set per event or per goal category." },
    { icon: LayoutGrid, title: "Multi-View Calendar", desc: "Day, Week, Month, and Agenda views without losing context. Goal colors persist across every view." },
  ];
  return (
    <section id="features" className="border-b border-hairline font-sf">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <div className="mx-auto max-w-2xl text-center mb-20">
          <h2 className="text-balance text-4xl font-bold tracking-tighter sm:text-6xl leading-[1.1]">
            Everything a goal-aware calendar needs.
          </h2>
          <p className="mt-6 text-lg font-medium text-muted-foreground leading-relaxed">
            Turn abstract ambitions into concrete momentum with built-in analytics.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline md:grid-cols-2 lg:grid-cols-3 shadow-sm">
          {items.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="group bg-background p-10 transition-all hover:bg-surface">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface shadow-sm group-hover:bg-background transition-colors">
                <Icon className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <h3 className="mt-8 text-xl font-bold tracking-tight">{title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground font-medium">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- BENEFITS ---------- */
function Benefits() {
  const items = [
    { icon: Flame, title: "Stay consistent", desc: "Recurring goal-linked events build routines automatically. Stop deciding what to do — the calendar already knows." },
    { icon: Search, title: "Know what you actually did", desc: "The Activity tab doesn't lie. See where your hours went — not where you planned them — and adjust next week." },
    { icon: TrendingUp, title: "Turn plans into progress", desc: "Every event scheduled and completed adds to your goal totals. Watch ambitions become trackable momentum." },
  ];
  return (
    <section className="border-b border-hairline bg-surface/30 font-sf">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-balance text-4xl font-bold tracking-tighter sm:text-5xl leading-tight">
            What changes when your calendar thinks in goals.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {items.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-3xl border border-hairline bg-background p-10 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              <div className="h-12 w-12 rounded-2xl bg-surface flex items-center justify-center mb-8">
                <Icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground font-medium">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- TESTIMONIALS ---------- */
function Testimonials() {
  const quotes = [
    {
      q: "Finally a calendar that shows me if I'm actually making progress on my thesis — not just feeling busy.",
      n: "Priya M.",
      r: "PhD student, Edinburgh",
    },
    {
      q: "I used to lose track of billable hours across five clients. Ortem's tracking pays for itself in the first week.",
      n: "James O.",
      r: "Freelance UX designer",
    },
    {
      q: "As someone with ADHD, the color-coded goals and recurring reminders are the only system that's actually stuck.",
      n: "Tomás R.",
      r: "Product manager & ADHD advocate",
    },
  ];
  return (
    <section className="border-b border-hairline font-sf">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {quotes.map((t) => (
            <figure
              key={t.n}
              className="flex flex-col rounded-3xl border border-hairline bg-background p-10 shadow-sm"
            >
              <div className="flex gap-0.5 text-foreground mb-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="flex-1 text-lg font-medium leading-relaxed text-foreground italic">
                "{t.q}"
              </blockquote>
              <figcaption className="mt-8 border-t border-hairline pt-6 flex items-center gap-4">
                 <div className="h-10 w-10 rounded-full bg-surface flex items-center justify-center font-bold text-xs uppercase">{t.n[0]}</div>
                 <div>
                    <div className="text-sm font-bold tracking-tight">{t.n}</div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-0.5">{t.r}</div>
                 </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- PRICING ---------- */
function Pricing({ isAuthenticated }: { isAuthenticated: boolean }) {
  const free = [
    "Up to 3 goals",
    "30 days activity history",
    "Basic recurring events",
    "Email reminders",
    "Single calendar view",
  ];
  const pro = [
    "Unlimited goals",
    "Full activity history",
    "Advanced recurrence rules",
    "Push + email reminders",
    "Day / Week / Month / Agenda views",
    "CSV & JSON export",
    "Priority support",
  ];
  return (
    <section id="pricing" className="border-b border-hairline bg-surface/50 font-sf">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-balance text-4xl font-bold tracking-tighter sm:text-6xl leading-none">
            Simple, honest pricing.
          </h2>
          <p className="mt-6 text-lg font-medium text-muted-foreground">
            Start free. Upgrade when you need more. No surprise charges.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
          {/* Free */}
          <div className="flex flex-col rounded-[32px] border border-hairline bg-background p-10 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Free Access</div>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-6xl font-bold tracking-tighter">$0</span>
              <span className="text-sm font-bold text-muted-foreground">/forever</span>
            </div>
            <p className="mt-4 text-sm font-medium text-muted-foreground leading-relaxed">Perfect for personal goal planning.</p>
            <ul className="mt-10 space-y-4 text-sm font-medium">
              {free.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-surface flex items-center justify-center flex-none mt-0.5">
                    <Check className="h-3 w-3 text-foreground" strokeWidth={3} />
                  </div>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to={isAuthenticated ? "/today" : "/signup"}
              className="mt-12 inline-flex items-center justify-center rounded-full border border-hairline bg-background px-6 py-3.5 text-sm font-bold transition hover:bg-surface shadow-sm"
            >
              {isAuthenticated ? "Go to Calendar" : "Start free →"}
            </Link>
          </div>

          {/* Pro */}
          <div
            className="relative flex flex-col rounded-[32px] border-2 border-foreground bg-foreground p-10 text-background shadow-2xl font-sf"
          >
            <div className="absolute -top-3 left-10 rounded-full bg-background px-3 py-1 text-[10px] font-black uppercase tracking-widest text-foreground shadow-sm">
              Recommended
            </div>
            <div className="text-xs font-black uppercase tracking-[0.2em] opacity-60">Pro Access</div>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-6xl font-bold tracking-tighter">$9</span>
              <span className="text-sm font-bold opacity-60">/month</span>
            </div>
            <p className="mt-4 text-sm font-medium opacity-60 leading-relaxed">For people who run their week on goals.</p>
            <ul className="mt-10 space-y-4 text-sm font-medium font-sf">
              {pro.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-background/10 flex items-center justify-center flex-none mt-0.5">
                    <Check className="h-3 w-3 text-background" strokeWidth={3} />
                  </div>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to={isAuthenticated ? "/today" : "/signup"}
              className="mt-12 inline-flex items-center justify-center gap-2 rounded-full bg-background px-6 py-3.5 text-sm font-bold text-foreground transition hover:opacity-90 shadow-xl"
            >
              {isAuthenticated ? "Go to Calendar" : "Upgrade to Pro"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- COMPARISON ---------- */
function Comparison() {
  const rows: { f: string; cells: (boolean | "partial" | string)[] }[] = [
    { f: "Goal-linked events", cells: [true, false, "partial", false] },
    { f: "Time per goal analytics", cells: [true, false, false, false] },
    { f: "Activity / progress tab", cells: [true, false, "partial", "partial"] },
    { f: "Recurring events", cells: [true, true, "partial", "partial"] },
    { f: "Reminders", cells: [true, true, true, true] },
    { f: "Multi-view calendar", cells: [true, true, false, false] },
    { f: "ADHD-friendly UX", cells: [true, false, false, false] },
    { f: "Data export", cells: ["CSV/JSON", "iCal", "Markdown", "Limited"] },
  ];
  const cols = ["Ortem", "Google Cal", "Notion", "To-do apps"];
  const cell = (v: boolean | "partial" | string) => {
    if (v === true) return <div className="h-5 w-5 bg-foreground text-background rounded-full mx-auto flex items-center justify-center shadow-sm"><Check className="h-3 w-3" strokeWidth={4} /></div>;
    if (v === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/30" />;
    if (v === "partial") return <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-surface px-2 py-0.5 rounded">Partial</span>;
    return <span className="text-xs font-bold uppercase tracking-tight">{v}</span>;
  };
  return (
    <section id="compare" className="border-b border-hairline font-sf">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <div className="mx-auto max-w-2xl text-center mb-16 font-sf">
          <h2 className="text-balance text-4xl font-bold tracking-tighter sm:text-6xl leading-[1.1]">
            Why not just use <br />Google Calendar?
          </h2>
          <p className="mt-6 text-lg font-medium text-muted-foreground">
            Other tools manage time. Ortem measures it against your goals.
          </p>
        </div>
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-hairline shadow-xl font-sf">
          <table className="w-full text-sm">
            <thead className="bg-surface/50 border-b border-hairline font-sf">
              <tr>
                <th className="px-6 py-5 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Feature</th>
                {cols.map((c, i) => (
                  <th
                    key={c}
                    className={`px-6 py-5 text-center font-bold tracking-tight ${i === 0 ? "text-foreground bg-surface/50" : "text-muted-foreground"}`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((row) => (
                <tr key={row.f} className="hover:bg-surface/20 transition-colors">
                  <td className="px-6 py-5 font-bold tracking-tight text-foreground/80">{row.f}</td>
                  {row.cells.map((c, i) => (
                    <td
                      key={i}
                      className={`px-6 py-5 text-center ${i === 0 ? "bg-surface/30 font-bold" : ""}`}
                    >
                      {cell(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
function Faq() {
  const items = [
    {
      q: "Is Ortem a time tracker?",
      a: "It's a goal-linked calendar with built-in time tracking. You schedule events as you normally would, and Ortem automatically tallies the hours against each goal. No separate timer app required.",
    },
    {
      q: "How does goal linking work?",
      a: "When you create or edit any calendar event, you choose which goal it belongs to. Ortem color-codes it instantly and adds the time to that goal's running total. One event belongs to one goal — keeping analytics clean.",
    },
    {
      q: "Can I track hours per goal?",
      a: "Yes — that's the core feature. The Activity tab shows hours logged per goal for today, this week, this month, or a custom range. Pro users get full history; Free users get the last 30 days.",
    },
    {
      q: "Does Ortem support recurring events?",
      a: "Yes. Set daily, weekly, every-weekday, or custom intervals when creating any event. Edit a single occurrence or all future events in a series. Recurring events count toward goal totals every time they're completed.",
    },
    {
      q: "Does Ortem work on mobile?",
      a: "Ortem is fully responsive in any modern mobile browser. Native iOS and Android apps are on the roadmap — join the in-app waitlist to be notified at launch.",
    },
    {
      q: "Is my data private and secure?",
      a: "Your data is stored on a Postgres database with row-level security — only your account can access your records. We never sell or share your data. All traffic is encrypted in transit, and you can export or delete your data at any time.",
    },
  ];
  return (
    <section id="faq" className="border-b border-hairline bg-surface/30 font-sf">
      <div className="mx-auto max-w-3xl px-6 py-28">
        <h2 className="text-balance text-center text-4xl font-bold tracking-tighter sm:text-6xl mb-16">
          Common Questions.
        </h2>
        <div className="divide-y divide-hairline overflow-hidden rounded-[32px] border border-hairline bg-background shadow-lg font-sf">
          {items.map((it) => (
            <details key={it.q} className="group p-8 [&_summary::-webkit-details-marker]:hidden font-sf">
              <summary className="flex cursor-pointer items-center justify-between gap-6">
                <span className="text-base font-bold tracking-tight">{it.q}</span>
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-hairline transition-all group-open:rotate-45 group-hover:bg-surface shadow-sm">
                  <PlusIcon />
                </span>
              </summary>
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground font-medium pr-10">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 1V11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 6H11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ---------- TRUST ---------- */
function Trust() {
  const items = [
    { icon: Lock, title: "Privacy first", desc: "No ads. No data sales. Your goals and calendar are yours alone." },
    { icon: Database, title: "Postgres + RLS", desc: "Every row is scoped to your user ID — other users cannot access your data." },
    { icon: KeyRound, title: "Secure accounts", desc: "Google OAuth or email sign-in. Short-lived JWTs. Revoke sessions anytime." },
    { icon: Download, title: "Export your data", desc: "Download a full CSV or JSON of goals, events, and activity history at any time." },
    { icon: RefreshCw, title: "Always up to date", desc: "Web app — no installs, no manual updates. New features ship continuously." },
    { icon: FileText, title: "Public changelog", desc: "Every release is documented. No silent changes to pricing, features, or policies." },
  ];
  return (
    <section className="border-b border-hairline font-sf">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-balance text-4xl font-bold tracking-tighter sm:text-5xl">
            Built to last. Built to trust.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[32px] border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3 shadow-md">
          {items.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-background p-10 hover:bg-surface/50 transition-colors font-sf">
              <div className="h-10 w-10 rounded-xl bg-surface flex items-center justify-center mb-8 font-sf">
                <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} />
              </div>
              <h3 className="text-lg font-bold tracking-tight font-sf">{title}</h3>
              <p className="mt-3 text-sm text-muted-foreground font-medium leading-relaxed font-sf">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- CTA BANNER ---------- */
function CtaBanner({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section id="start" className="border-b border-hairline font-sf">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <div
          className="relative overflow-hidden rounded-[48px] bg-foreground px-8 py-20 text-center text-background sm:px-16 sm:py-28 shadow-2xl"
        >
          <div className="relative z-10 font-sf">
            <h2 className="mx-auto max-w-3xl text-balance text-5xl font-bold tracking-tighter sm:text-7xl leading-[1]">
              The calendar that tells you if you're making progress.
            </h2>
            <p className="mx-auto mt-8 max-w-xl text-pretty text-lg font-medium opacity-60 leading-relaxed font-sf">
              Join 2,400+ planners turning intentions into measurable hours. Free forever — upgrade when you need more.
            </p>
            <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row font-sf">
              <Link
                to={isAuthenticated ? "/today" : "/signup"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-background px-10 py-4 text-sm font-bold text-foreground transition hover:opacity-90 sm:w-auto shadow-xl"
              >
                {isAuthenticated ? "Go to Calendar" : "Start free"} <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#demo"
                className="inline-flex w-full items-center justify-center rounded-full border border-background/20 px-10 py-4 text-sm font-bold text-background transition hover:bg-background/10 sm:w-auto"
              >
                See demo
              </a>
            </div>
          </div>
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
        </div>
      </div>
    </section>
  );
}

/* ---------- FOOTER ---------- */
function Footer() {
  const cols = [
    {
      title: "Product",
      links: ["Goal Linking", "Time-Per-Goal", "Activity & Progress", "Recurring Events", "Reminders", "Multi-View"],
    },
    { title: "Plans", links: ["Free Plan", "Pro ($9/mo)", "Compare plans"] },
    { title: "Resources", links: ["Changelog", "Blog & Tips", "Getting started", "Contact & support"] },
    { title: "Legal", links: ["Privacy Policy", "Terms of Service", "Cookie Policy", "Data export"] },
  ];
  return (
    <footer className="bg-background font-sf">
      <div className="mx-auto max-w-7xl px-6 pt-24 pb-12">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-6 mb-24 font-sf">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 font-sf">
              <Logo />
              <span className="text-xl font-bold tracking-tighter font-sf">Ortem</span>
            </div>
            <p className="mt-4 max-w-xs text-sm font-medium text-muted-foreground leading-relaxed font-sf">
              The only calendar that tells you if you're making progress. Hand-crafted for the focused.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title} className="col-span-1">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-8 font-sf">{c.title}</div>
              <ul className="space-y-4 text-sm font-bold text-muted-foreground font-sf">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="transition hover:text-foreground">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-12 border-t border-hairline flex flex-col items-center justify-between gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground sm:flex-row font-sf">
          <span>© 2025 Ortem • All rights reserved</span>
          <div className="flex gap-8">
            <span className="cursor-pointer hover:text-foreground transition font-sf">Twitter / X</span>
            <span className="cursor-pointer hover:text-foreground transition font-sf">GitHub</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
