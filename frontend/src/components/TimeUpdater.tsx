import { useEffect, useRef } from "react";
import { useTimeStore } from "@/store/timeStore";
import { useEventsStore } from "@/store/eventsStore";
import { useGoalsStore } from "@/store/goalsStore";
import { supabase } from "@/lib/supabase";

export default function TimeUpdater() {
  const updateTime = useTimeStore((state) => state.updateTime);
  const clearCache = useEventsStore((state) => state.clearCache);
  const fetchEventsWindow = useEventsStore((state) => state.fetchEventsWindow);
  const prefetchCurrentGoals = useGoalsStore((state) => state.prefetchCurrentGoals);
  const clearGoals = useGoalsStore((state) => state.clearGoals);
  const lastTickRef = useRef<Date>(new Date());

  useEffect(() => {
    // Update immediately on mount
    updateTime();

    // Check every 15 seconds but only update when minute changes
    // This reduces re-renders from every second to only when needed
    const intervalId = setInterval(() => {
      const now = new Date();
      const previousNow = lastTickRef.current;
      const currentMinute = now.getMinutes();
      const previousMinute = previousNow.getMinutes();
      const didDayChange =
        now.getFullYear() !== previousNow.getFullYear() ||
        now.getMonth() !== previousNow.getMonth() ||
        now.getDate() !== previousNow.getDate();
      
      // Only update if the minute has changed
      if (currentMinute !== previousMinute || didDayChange) {
        updateTime(previousNow);

        if (didDayChange) {
          fetchEventsWindow(now);
          void prefetchCurrentGoals(now, now);
        }

        lastTickRef.current = now;
      }
    }, 15000); // Check every 15 seconds

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [updateTime]);

  // Listen for auth state changes
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await prefetchCurrentGoals(new Date(), new Date());
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      
      if (event === 'SIGNED_OUT') {
        // Clear cache when user signs out
        clearCache();
        clearGoals();
      } else if (event === 'SIGNED_IN') {
        // Fetch events for the new user
        const today = new Date();
        fetchEventsWindow(today);
        void prefetchCurrentGoals(today, today);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [clearCache, clearGoals, fetchEventsWindow, prefetchCurrentGoals]);

  return null; // This component doesn't render anything
}
