import { useEffect } from "react";
import { useTimeStore } from "@/store/timeStore";

export default function TimeUpdater() {
  const updateTime = useTimeStore((state) => state.updateTime);

  useEffect(() => {
    // Update immediately
    updateTime();

    // Set up interval to update every second
    const intervalId = setInterval(() => {
      updateTime();
    }, 1000);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [updateTime]);

  return null; // This component doesn't render anything
}