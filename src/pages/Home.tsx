import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { motion, useScroll, useSpring, useMotionValue, useTransform } from "framer-motion";
import type { Variants } from "framer-motion";
import { useEffect } from "react";
import {
  ArrowRight,
  Target,
  BarChart3,
  Repeat,
  Bell,
  LayoutGrid,
  Flame,
  Search,
  TrendingUp,
  Check,
  Minus,
  Zap,
  Github,
  Twitter,
  Linkedin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function Home({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground font-sf-pro overflow-x-hidden">
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-foreground z-[100] origin-left"
        style={{ scaleX }}
      />
      <MouseSpotlight />
      <Nav isAuthenticated={isAuthenticated} />
      <main>
        <Hero isAuthenticated={isAuthenticated} itemVariants={itemVariants} />
        <Process />
        <BentoFeatures />
        <Benefits />
        <Pricing isAuthenticated={isAuthenticated} />
        <Comparison />
        <BottomCTA isAuthenticated={isAuthenticated} />
        <Quote />
      </main>
      <Footer />
    </div>
  );
}

/* ---------- UTILS ---------- */
function MouseSpotlight() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
      style={{
        background: useTransform(
          [mouseX, mouseY],
          ([x, y]) => `radial-gradient(600px circle at ${x}px ${y}px, oklch(0.6 0.1 250 / 0.03), transparent 80%)`
        ),
      }}
    />
  );
}

/* ---------- NAV ---------- */
function Nav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-6">
      <motion.div 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex h-16 w-full max-w-5xl items-center justify-between rounded-full border border-hairline bg-background/60 px-8 backdrop-blur-xl shadow-lg"
      >
        <Link to="/" className="flex items-center gap-2 group">
          <img src="/applogo.png" alt="Logo" className="h-10 w-auto transition-transform group-hover:scale-110" />
          <span className="font-bold text-xl tracking-tighter">Waydots</span>
        </Link>
        <nav className="hidden items-center gap-10 text-sm text-muted-foreground md:flex font-medium tracking-wide">
          <a href="#how-it-works" className="hover:text-foreground transition-colors uppercase tracking-widest text-[10px]">How it works</a>
          <a href="#features" className="hover:text-foreground transition-colors uppercase tracking-widest text-[10px]">Features</a>
          <a href="#pricing" className="hover:text-foreground transition-colors uppercase tracking-widest text-[10px]">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-background px-6 py-2 text-sm font-bold text-foreground transition hover:bg-surface shadow-sm cursor-pointer tracking-tight"
            >
              Logout
            </button>
          ) : (
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-6 py-2 text-sm font-semibold text-background transition hover:scale-[1.02] active:scale-[0.98] shadow-sm tracking-tight"
            >
              Get started
            </Link>
          )}
        </div>
      </motion.div>
    </header>
  );
}

/* ---------- HERO ---------- */
function Hero({ isAuthenticated, itemVariants }: { isAuthenticated: boolean; itemVariants: Variants }) {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-16 sm:pt-48 sm:pb-24">
      {/* Dynamic Animated Background Glow */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        aria-hidden
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] -z-10 blur-[140px] pointer-events-none"
        style={{ background: "radial-gradient(circle, oklch(0.6 0.1 250 / 0.15), transparent 70%)" }}
      />
      
      <div className="mx-auto max-w-7xl px-6 text-center">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          className="mx-auto max-w-4xl"
        >
          <motion.div
            variants={itemVariants}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground"></span>
            </span>
            New: Goal Analytics v2
          </motion.div>

          <motion.h1 
            variants={itemVariants}
            className="text-balance text-5xl font-bold tracking-tighter sm:text-7xl md:text-8xl leading-[0.95] text-foreground"
          >
            Turn plans into <br />
            <span className="bg-gradient-to-r from-foreground via-foreground/70 to-foreground/40 bg-clip-text text-transparent italic">measurable progress.</span>
          </motion.h1>
          <motion.p 
            variants={itemVariants}
            className="mx-auto mt-8 max-w-2xl text-pretty text-lg sm:text-xl text-muted-foreground leading-relaxed font-medium"
          >
            Waydots links every event to a goal — so you can see exactly where your time goes, and how each hour moves you forward.
          </motion.p>
          <motion.div 
            variants={itemVariants}
            className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link
              to={isAuthenticated ? "/today" : "/signup"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-10 py-5 text-base font-semibold text-background transition hover:scale-[1.05] active:scale-[0.95] sm:w-auto shadow-2xl tracking-tight group"
            >
              {isAuthenticated ? "Go to Calendar" : "Get started for free"} 
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#demo"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-hairline bg-background/50 px-10 py-5 text-base font-semibold text-foreground transition hover:bg-surface backdrop-blur-sm sm:w-auto shadow-sm tracking-tight"
            >
              See how it works
            </a>
          </motion.div>
        </motion.div>

        {/* Mockup with floating elements */}
        <motion.div 
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-24 max-w-6xl px-4 sm:px-0"
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-hairline bg-background shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] z-10">
            <img src="/monthview.png" alt="Waydots Month View" className="w-full h-auto block" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
          </div>

          {/* Floating Elements - Adjusted for better mobile/desktop overlap */}
          <FloatingIcon src="/assets/goal.png" className="-top-6 -left-4 sm:top-10 sm:-left-12 h-16 w-16 sm:h-24 sm:w-24" delay={0} />
          <FloatingIcon src="/assets/clock.png" className="-bottom-6 -right-4 sm:bottom-20 sm:-right-16 h-16 w-16 sm:h-24 sm:w-24" delay={1} />
          <FloatingIcon src="/assets/plus.png" className="-top-12 right-4 sm:-top-10 sm:right-10 h-16 w-16 sm:h-24 sm:w-24" delay={0.5} />
          
          <div className="absolute -inset-10 bg-foreground/5 blur-3xl rounded-[3rem] -z-10 opacity-50" />
        </motion.div>
      </div>
    </section>
  );
}

function FloatingIcon({ src, className, delay }: { src: string; className: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        y: [0, -20, 0]
      }}
      transition={{
        opacity: { duration: 0.5, delay: 0.8 + delay },
        scale: { duration: 0.5, delay: 0.8 + delay },
        y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay }
      }}
      className={`absolute z-20 rounded-3xl bg-background/80 p-4 backdrop-blur-md shadow-2xl border border-hairline ${className}`}
    >
      <img src={src} alt="icon" className="h-full w-full object-contain" />
    </motion.div>
  );
}

/* ---------- PROCESS ---------- */
function Process() {
  const steps = [
    { num: "01", title: "Plan", desc: "Schedule your day as you normally would." },
    { num: "02", title: "Link", desc: "Attach events to specific goals with one tap." },
    { num: "03", title: "Review", desc: "See exactly how much time went toward your ambitions." },
  ];
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground mb-16">The Workflow</h2>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          {steps.map((step, idx) => (
            <motion.div 
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="relative flex flex-col items-center group"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground text-background text-2xl font-bold mb-6 transition-transform group-hover:rotate-12 group-hover:scale-110">
                {step.num}
              </div>
              <h3 className="text-xl font-bold mb-3 tracking-tight">{step.title}</h3>
              <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-[200px]">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- BENTO FEATURES ---------- */
function BentoFeatures() {
  return (
    <section id="features" className="py-28 bg-surface/20 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-balance text-4xl font-bold tracking-tighter sm:text-6xl"
          >
            Everything you need <br /> to own your time.
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 h-auto md:h-[800px]">
          {/* Big Card 1 */}
          <BentoCard 
            className="md:col-span-4 md:row-span-2"
            icon={Target}
            title="Goal-Linked Events"
            desc="Every hour counts toward something bigger. Attach any event to a goal with one tap. Every hour automatically counts toward your progress."
            image="/monthview.png"
          />
          {/* Small Card 1 */}
          <BentoCard 
            className="md:col-span-2 md:row-span-1"
            icon={BarChart3}
            title="Analytics"
            desc="Deep visibility into your week."
          />
          {/* Small Card 2 */}
          <BentoCard 
            className="md:col-span-2 md:row-span-1"
            icon={Repeat}
            title="Smart Series"
            desc="Routines that run themselves."
          />
          {/* Medium Card 1 */}
          <BentoCard 
            className="md:col-span-3 md:row-span-2"
            icon={Bell}
            title="Focus Reminders"
            desc="Focus on the work, not the clock. Push and email reminders before each event. Lead times set per event or per goal category."
          />
          {/* Medium Card 2 */}
          <BentoCard 
            className="md:col-span-3 md:row-span-2"
            icon={LayoutGrid}
            title="Flexible Views"
            desc="Day, Week, Month, and Agenda views. Goal colors persist across every view for clarity. Switch seamlessly between levels of detail."
          />
        </div>
      </div>
    </section>
  );
}

function BentoCard({ icon: Icon, title, desc, className, image }: { icon: LucideIcon; title: string; desc: string; className: string; image?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -5 }}
      className={`group relative overflow-hidden rounded-[2.5rem] border border-hairline bg-background p-8 transition-all hover:border-foreground/20 hover:shadow-2xl ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface border border-hairline shadow-sm transition-colors group-hover:bg-foreground group-hover:text-background">
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <h3 className="mt-6 text-2xl font-bold tracking-tighter leading-tight">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground font-medium max-w-[280px]">{desc}</p>
      
      {image && (
        <div className="mt-8 relative h-64 overflow-hidden rounded-2xl border border-hairline transition-transform group-hover:scale-[1.02]">
          <img src={image} alt={title} className="w-full h-full object-cover object-top" />
        </div>
      )}

      {/* Background Decor */}
      <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
        <Icon className="h-40 w-40" />
      </div>
    </motion.div>
  );
}

/* ---------- BENEFITS ---------- */
function Benefits() {
  const items = [
    { icon: Flame, title: "Built for consistency", desc: "Recurring goal-linked events build routines automatically. Stop deciding what to do — follow the plan." },
    { icon: Search, title: "Deep visibility", desc: "The Activity tab doesn't lie. See where your hours actually went and adjust for next week." },
    { icon: TrendingUp, title: "Momentum you can see", desc: "Every completed event adds to your goal totals. Watch abstract ambitions become trackable momentum." },
  ];
  return (
    <section className="bg-background py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          {items.map(({ icon: Icon, title, desc }, idx) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="text-center md:text-left"
            >
              <div className="mx-auto md:mx-0 h-12 w-12 rounded-2xl bg-surface border border-hairline flex items-center justify-center mb-8">
                <Icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground font-medium">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- PRICING ---------- */
function Pricing({ isAuthenticated }: { isAuthenticated: boolean }) {
  const free = [
    "Up to 3 goals per category",
    "30 days activity history",
    "Goal-linked events",
    "Basic time analytics",
  ];
  const pro = [
    "Unlimited goals",
    "Full activity history",
    "Push + email reminders",
    "All calendar views",
  ];
  return (
    <section id="pricing" className="py-28 overflow-hidden bg-surface/30">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <motion.h2 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             className="text-balance text-4xl font-bold tracking-tighter sm:text-6xl"
          >
            Simple, honest pricing.
          </motion.h2>
          <p className="mt-4 text-muted-foreground font-medium tracking-tight">Focus on your goals, not your subscription.</p>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
          {/* Free */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5 }}
            className="flex flex-col rounded-[2.5rem] border border-hairline bg-background p-10 transition-all hover:border-foreground/10 hover:shadow-xl"
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Standard</div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-5xl font-bold tracking-tighter">$0</span>
              <span className="text-sm font-bold text-muted-foreground">/mo</span>
            </div>
            <ul className="mt-10 space-y-4 text-sm font-medium flex-1">
              {free.map((f) => (
                <li key={f} className="flex items-center gap-3 text-muted-foreground">
                  <Check className="h-4 w-4" />
                  <span className="tracking-tight">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to={isAuthenticated ? "/today" : "/signup"}
              className="mt-10 inline-flex items-center justify-center rounded-full border border-hairline bg-background py-4 text-sm font-bold transition hover:bg-surface tracking-tight"
            >
              Get started
            </Link>
          </motion.div>

          {/* Pro */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5 }}
            className="relative flex flex-col rounded-[2.5rem] bg-foreground p-10 text-background shadow-2xl transition-all hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] group"
          >
            <div className="absolute top-6 right-10 rounded-full bg-background/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] backdrop-blur-md">
              Most Popular
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Pro</div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-5xl font-bold tracking-tighter">$9</span>
              <span className="text-sm font-bold opacity-60">/mo</span>
            </div>
            <ul className="mt-10 space-y-4 text-sm font-medium flex-1">
              {pro.map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <Check className="h-4 w-4 opacity-100" />
                  <span className="tracking-tight">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to={isAuthenticated ? "/today" : "/signup"}
              className="mt-10 inline-flex items-center justify-center gap-2 rounded-full bg-background py-4 text-sm font-bold text-foreground transition hover:scale-[1.02] active:scale-[0.98] tracking-tight"
            >
              {isAuthenticated ? "Go to Calendar" : "Upgrade to Pro"}
            </Link>
            
            {/* Subtle glow effect */}
            <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-white/5 blur-3xl group-hover:bg-white/10 transition-colors" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ---------- COMPARISON ---------- */
function Comparison() {
  type CellValue = boolean | "partial";
  const rows: { f: string; cells: CellValue[] }[] = [
    { f: "Goal-linked events", cells: [true, false, "partial", false] },
    { f: "Time per goal analytics", cells: [true, false, false, false] },
    { f: "Activity / progress tab", cells: [true, false, "partial", "partial"] },
    { f: "Smart recurrence", cells: [true, true, "partial", "partial"] },
    { f: "ADHD-friendly UX", cells: [true, false, false, false] },
  ];
  const cols = ["Waydots", "Google Cal", "Notion", "To-do apps"];
  const cell = (v: CellValue) => {
    if (v === true) return <Check className="h-4 w-4 text-foreground mx-auto" strokeWidth={3} />;
    if (v === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/30" />;
    return <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-surface px-2 py-0.5 rounded">Partial</span>;
  };
  return (
    <section id="compare" className="py-28 bg-background border-y border-hairline relative">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-balance text-4xl font-bold tracking-tighter sm:text-6xl"
          >
            Why Waydots?
          </motion.h2>
          <p className="mt-4 text-muted-foreground font-medium tracking-tight">
            Measure your time, don't just manage it.
          </p>
        </div>
        <div className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-hairline bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline">
                <th className="px-6 py-5 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Feature</th>
                {cols.map((c, i) => (
                  <th key={c} className={`px-6 py-5 text-center font-bold tracking-tight ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((row) => (
                <tr key={row.f}>
                  <td className="px-6 py-5 font-semibold tracking-tight">{row.f}</td>
                  {row.cells.map((c, i) => (
                    <td key={i} className={`px-6 py-5 text-center ${i === 0 ? "bg-surface/40" : ""}`}>{cell(c)}</td>
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

/* ---------- BOTTOM CTA ---------- */
function BottomCTA({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="py-32 px-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="mx-auto max-w-5xl rounded-[3.5rem] bg-foreground p-12 md:p-24 text-center text-background shadow-2xl relative overflow-hidden group"
      >
        <Zap className="h-16 w-16 mx-auto mb-10 opacity-20 transition-opacity group-hover:opacity-40 animate-pulse" />
        <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-8 leading-[0.95]">Ready to see where <br/> your time goes?</h2>
        <p className="text-xl opacity-60 mb-12 max-w-lg mx-auto tracking-tight font-medium">Join thousands of focused planners who turn intentions into measurable momentum.</p>
        <Link
          to={isAuthenticated ? "/today" : "/signup"}
          className="inline-flex items-center gap-2 rounded-full bg-background px-12 py-6 text-xl font-bold text-foreground transition hover:scale-[1.05] active:scale-[0.95] shadow-xl tracking-tight"
        >
          {isAuthenticated ? "Go to Calendar" : "Get started for free"} <ArrowRight className="h-6 w-6" />
        </Link>
        {/* Animated accent glow */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 blur-[100px] rounded-full pointer-events-none group-hover:bg-white/10 transition-all duration-1000" />
      </motion.div>
    </section>
  );
}

/* ---------- QUOTE ---------- */
function Quote() {
  return (
    <section className="py-32 px-6 bg-surface/10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="mx-auto max-w-3xl text-center"
      >
        <p className="text-2xl md:text-3xl font-medium italic text-muted-foreground leading-relaxed tracking-tight">
          "Setting goals is the first step in turning the invisible into the visible."
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <div className="h-px w-12 bg-hairline" />
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-foreground/40">Jim Rohn</span>
          <div className="h-px w-12 bg-hairline" />
        </div>
      </motion.div>
    </section>
  );
}

/* ---------- FOOTER ---------- */
function Footer() {
  return (
    <footer className="bg-background border-t border-hairline py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12">
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <img src="/applogo.png" alt="Logo" className="h-8 w-auto" />
              <span className="font-bold text-xl tracking-tighter">Waydots</span>
            </Link>
            <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-xs mb-8">
              The calendar that turns abstract ambitions into trackable momentum. Built for clarity, consistency, and focus.
            </p>
            <div className="flex gap-4">
              <SocialLink icon={Twitter} href="#" />
              <SocialLink icon={Github} href="#" />
              <SocialLink icon={Linkedin} href="#" />
            </div>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-6 uppercase tracking-widest text-foreground/40">Product</h4>
            <ul className="space-y-4 text-sm font-medium text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
              <li><a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a></li>
              <li><a href="/login" className="hover:text-foreground transition-colors">Sign in</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-6 uppercase tracking-widest text-foreground/40">Company</h4>
            <ul className="space-y-4 text-sm font-medium text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-6 uppercase tracking-widest text-foreground/40">Legal</h4>
            <ul className="space-y-4 text-sm font-medium text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Cookie Policy</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-20 pt-8 border-t border-hairline flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-[0.1em]">
            © 2026 Waydots Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
             <div className="h-2 w-2 rounded-full bg-emerald-500" />
             <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ icon: Icon, href }: { icon: LucideIcon; href: string }) {
  return (
    <a 
      href={href} 
      className="h-10 w-10 flex items-center justify-center rounded-xl border border-hairline bg-surface hover:bg-foreground hover:text-background transition-all duration-300 shadow-sm"
    >
      <Icon className="h-5 w-5" />
    </a>
  );
}

