import DayView from "./Day_view/DayView"
import TimeUpdater from "./components/TimeUpdater"

import { CalendarPreview }  from "@/CalenderPreview/CalendarPreview"
function App() {
  return (
    <>
      <TimeUpdater />
      <DayView />
        
        <CalendarPreview />
    </>
  )
}

export default App
