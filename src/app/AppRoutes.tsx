import { Navigate, Route, Routes } from 'react-router-dom'
import { DayViewRoute, MonthViewRoute, TodayRedirect, WeekViewRoute, YearViewRoute } from '@/components/DayViewRoute'
import GoalView from '@/Goal_view/GoalView'
import { Home } from '@/pages/Home'
import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'

interface AppRoutesProps {
  isAuthenticated: boolean
}

export function AppRoutes({ isAuthenticated }: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<Home isAuthenticated={isAuthenticated} />} />
      <Route path="/today" element={isAuthenticated ? <TodayRedirect /> : <Navigate to="/login" replace />} />
      <Route path="/day/:year/:month/:day" element={isAuthenticated ? <DayViewRoute /> : <Navigate to="/login" replace />} />
      <Route path="/week/:year/:month/:day" element={isAuthenticated ? <WeekViewRoute /> : <Navigate to="/login" replace />} />
      <Route path="/month/:year/:month/:day" element={isAuthenticated ? <MonthViewRoute /> : <Navigate to="/login" replace />} />
      <Route path="/year/:year/:month/:day" element={isAuthenticated ? <YearViewRoute /> : <Navigate to="/login" replace />} />
      <Route path="/goalview" element={isAuthenticated ? <GoalView /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/" replace /> : <Signup />} />
    </Routes>
  )
}
