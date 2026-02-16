import { Routes, Route, useLocation } from 'react-router-dom'
import TimeUpdater from "./components/TimeUpdater"
import { CalendarPreview }  from "@/CalenderPreview/CalendarPreview"
import { DayViewRoute, TodayRedirect } from "./components/DayViewRoute"
import { Login } from "./pages/Login"
import { Signup } from "./pages/Signup"

function App() {
  const location = useLocation()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'

  return (
    <>
      <TimeUpdater />
      <div className={`flex h-screen relative ${isAuthPage ? '' : ''}`}>
        {/* Main content - Routes */}
        <div className={`${isAuthPage ? 'w-full' : 'flex-1'}`}>
          <Routes>
            <Route path="/" element={<TodayRedirect />} />
            <Route path="/day/:year/:month/:day" element={<DayViewRoute />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Routes>
        </div>
        
        {/* Sidebar - Only show on non-auth pages */}
        {!isAuthPage && (
          <div className="h-full flex flex-col">
            <div className="flex-1">
              <CalendarPreview />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default App
