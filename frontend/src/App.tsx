import { useState, useEffect } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import TimeUpdater from "./components/TimeUpdater"
import { ViewSwitcher } from "./components/ViewSwitcher"
import { TopBarLeft } from "./components/TopBarLeft"
import {SideBar} from "./SideBar/SideBar.tsx"
import { SearchEventsDialog } from "./SideBar/SearchEventsDialog"
import { Button } from "./components/ui/button"
import SearchIcon from "@/assets/search.svg"
import { useEventsStore } from "./store/eventsStore"
import { DayViewRoute, MonthViewRoute, TodayRedirect, WeekViewRoute, YearViewRoute } from "./components/DayViewRoute"
import { Login } from "./pages/Login"
import { Signup } from "./pages/Signup"
import GoalView from "./Goal_view/GoalView"
import { startReminderService, stopReminderService } from "./services/reminderService"
import { supabase } from "./lib/supabase"

function App() {
  const location = useLocation()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'
  const isGoalView = location.pathname === '/goalview'
  const [currentView, setCurrentView] = useState<string>('day')
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCompactSidebar, setIsCompactSidebar] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSidebarMounted, setIsSidebarMounted] = useState(false)
  const [isSidebarVisible, setIsSidebarVisible] = useState(false)
  const [isSidebarHoverVisible, setIsSidebarHoverVisible] = useState(false)
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)
  const showAppSidebar = !isAuthPage && !isGoalView && isAuthenticated
  const showFloatingSidebarButton = showAppSidebar && isCompactSidebar && !isSidebarOpen

  const closeCompactSidebarAndClearSelection = () => {
    setIsSidebarOpen(false)
    setSelectedEvent(null)
  }

  useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia("(max-width: 1360px)")
    const applySidebarMode = (matches: boolean) => {
      setIsCompactSidebar(matches)
      setIsSidebarOpen(!matches)
    }

    applySidebarMode(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => applySidebarMode(event.matches)
    mediaQuery.addEventListener("change", handleChange)

    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  useEffect(() => {
    if (!isCompactSidebar || !isSidebarOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isCompactSidebar, isSidebarOpen])

  useEffect(() => {
    if (!isAuthenticated || isAuthPage || isGoalView || !isCompactSidebar) return
    if (!selectedEventId) return
    setIsSidebarOpen(true)
  }, [isAuthenticated, isAuthPage, isGoalView, isCompactSidebar, selectedEventId])

  useEffect(() => {
    if (!showAppSidebar || !isCompactSidebar) {
      setIsSidebarMounted(false)
      setIsSidebarVisible(false)
      return
    }

    if (isSidebarOpen) {
      setIsSidebarVisible(false)
      setIsSidebarMounted(true)
      let secondFrameId = 0
      const firstFrameId = window.requestAnimationFrame(() => {
        secondFrameId = window.requestAnimationFrame(() => {
          setIsSidebarVisible(true)
        })
      })
      return () => {
        window.cancelAnimationFrame(firstFrameId)
        if (secondFrameId) window.cancelAnimationFrame(secondFrameId)
      }
    }

    setIsSidebarVisible(false)

    const timeoutId = window.setTimeout(() => {
      setIsSidebarMounted(false)
    }, 260)

    return () => window.clearTimeout(timeoutId)
  }, [isCompactSidebar, isSidebarOpen, showAppSidebar])

  useEffect(() => {
    if (!showFloatingSidebarButton) {
      setIsSidebarHoverVisible(false)
    }
  }, [showFloatingSidebarButton])

  useEffect(() => {
    startReminderService()
    return () => stopReminderService()
  }, [])

  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      setIsAuthenticated(!!session)
      setIsAuthLoading(false)
    }

    void checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
      setIsAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (isAuthLoading) {
    return <div className="h-screen w-screen bg-[#f3f3f2]" />
  }

  return (
    <>
      {isAuthenticated ? <TimeUpdater /> : null}
      {!isAuthPage && isAuthenticated && <ViewSwitcher currentView={currentView as any} onViewChange={setCurrentView} />}
      {!isAuthPage && isAuthenticated && <TopBarLeft />}
      <div className={`flex h-screen overflow-hidden relative ${isAuthPage ? '' : ''}`}>
        {/* Main content - Routes */}
        <div className={`flex-1 overflow-hidden ${isAuthPage ? 'w-full' : ''}`}>
          <Routes>
            <Route path="/" element={isAuthenticated ? <TodayRedirect /> : <Navigate to="/login" replace />} />
            <Route path="/day/:year/:month/:day" element={isAuthenticated ? <DayViewRoute /> : <Navigate to="/login" replace />} />
            <Route path="/week/:year/:month/:day" element={isAuthenticated ? <WeekViewRoute /> : <Navigate to="/login" replace />} />
            <Route path="/month/:year/:month/:day" element={isAuthenticated ? <MonthViewRoute /> : <Navigate to="/login" replace />} />
            <Route path="/year/:year/:month/:day" element={isAuthenticated ? <YearViewRoute /> : <Navigate to="/login" replace />} />
            <Route path="/goalview" element={isAuthenticated ? <GoalView /> : <Navigate to="/login" replace />} />
            <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/signup" element={isAuthenticated ? <Navigate to="/" replace /> : <Signup />} />
          </Routes>
        </div>
        
        {/* Sidebar - Only show on non-auth pages */}
        {showAppSidebar && !isCompactSidebar && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
                <SideBar />
            </div>
          </div>
        )}

      </div>

      {showAppSidebar && isCompactSidebar && isSidebarMounted && (
        <>
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className={`fixed inset-0 z-[20000] bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
              isSidebarVisible ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeCompactSidebarAndClearSelection}
          />
          <div
            className={`fixed inset-y-0 right-0 z-[20010] flex max-w-[calc(100vw-24px)] flex-col overflow-hidden pr-3 pt-3 pb-3 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isSidebarVisible ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="h-full overflow-hidden">
              <SideBar compact onRequestClose={closeCompactSidebarAndClearSelection} />
            </div>
          </div>
        </>
      )}

      {showFloatingSidebarButton && (
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setIsSearchOpen(true)
            }}
            className="pointer-events-auto fixed right-4 top-4 z-[20050] h-16 w-16 rounded-full border-[1px] bg-[#ececeb]/95 text-slate-600 shadow-lg backdrop-blur-sm transition-all duration-200 ease-out hover:scale-110 hover:text-slate-800 hover:shadow-xl"
            aria-label="Search events"
          >
            <img src={SearchIcon} alt="Search" className="h-8 w-8 opacity-60" />
          </Button>
          <div
            className="fixed inset-y-0 right-0 z-[19990] hidden w-24 md:block"
            onMouseEnter={() => setIsSidebarHoverVisible(true)}
            onMouseLeave={() => setIsSidebarHoverVisible(false)}
          >
            <div
              className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-200 ${
                isSidebarHoverVisible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
              }`}
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsSidebarOpen(true)}
                className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#cfcfcb] bg-[#f3f3f2]/95 text-[#404040] shadow-[0_14px_30px_rgba(0,0,0,0.16)] backdrop-blur-md transition-all duration-200 hover:translate-x-[-2px] hover:bg-white"
                aria-label="Open sidebar"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </>
      )}

      <SearchEventsDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  )
}

export default App
