import DayView from "./Day_view/DayView"
import TimeUpdater from "./components/TimeUpdater"
import { CalendarPreview }  from "@/CalenderPreview/CalendarPreview"

function App() {

  return (
    <>
      <TimeUpdater />
      <div className="flex h-screen relative">
        {/* Main content - DayView */}
          <DayView />
        
        {/* Sidebar with animation */}
          <div className=" h-full">
            <CalendarPreview />
          </div>
        </div>
    </>
  )
}

export default App
