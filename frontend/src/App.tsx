import { useState, useEffect } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import TimeUpdater from "./components/TimeUpdater"
import { ViewSwitcher } from "./components/ViewSwitcher"
import { TopBarLeft } from "./components/TopBarLeft"
import {SideBar} from "./SideBar/SideBar.tsx"
import { DayViewRoute, TodayRedirect, WeekViewRoute } from "./components/DayViewRoute"
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
            <Route path="/goalview" element={isAuthenticated ? <GoalView /> : <Navigate to="/login" replace />} />
            <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/signup" element={isAuthenticated ? <Navigate to="/" replace /> : <Signup />} />
          </Routes>
        </div>
        
        {/* Sidebar - Only show on non-auth pages */}
        {!isAuthPage && !isGoalView && isAuthenticated && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
                <SideBar />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default App
