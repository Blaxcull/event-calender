import TimeUpdater from "./components/TimeUpdater"
import { Analyser } from "@/CalenderPreview/Analyser"

function App() {
  return (
    <>
      <TimeUpdater />
      <div className="h-screen w-screen">
        <Analyser />
      </div>
    </>
  )
}

export default App