import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import TimeUpdater from "./components/TimeUpdater"
import { ViewSwitcher } from "./components/ViewSwitcher"
import { TopBarLeft } from "./components/TopBarLeft"
import {SideBar} from "./SideBar/SideBar.tsx"
import { DayViewRoute, TodayRedirect } from "./components/DayViewRoute"
import { Login } from "./pages/Login"
import { Signup } from "./pages/Signup"

function App() {
  const location = useLocation()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'
  const [currentView, setCurrentView] = useState<string>('day')

  return (
    <>
      <TimeUpdater />
      {!isAuthPage && <ViewSwitcher currentView={currentView as any} onViewChange={setCurrentView} />}
      {!isAuthPage && <TopBarLeft />}
      <div className={`flex h-screen overflow-hidden relative ${isAuthPage ? '' : ''}`}>
        {/* Main content - Routes */}
        <div className={`flex-1 overflow-hidden ${isAuthPage ? 'w-full' : ''}`}>
          <Routes>
            <Route path="/" element={<TodayRedirect />} />
            <Route path="/day/:year/:month/:day" element={<DayViewRoute />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Routes>
        </div>
        
        {/* Sidebar - Only show on non-auth pages */}
        {!isAuthPage && (
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
