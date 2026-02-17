import { useEffect, useRef } from "react";
import { useTimeStore } from "@/store/timeStore";
import { useEventsStore } from "@/store/eventsStore";
import { supabase } from "@/lib/supabase";

export default function TimeUpdater() {
  const updateTime = useTimeStore((state) => state.updateTime);
  const clearCache = useEventsStore((state) => state.clearCache);
  const fetchEventsWindow = useEventsStore((state) => state.fetchEventsWindow);
  const lastMinuteRef = useRef<number>(new Date().getMinutes());

  useEffect(() => {
    // Update immediately on mount
    updateTime();

    // Check every 15 seconds but only update when minute changes
    // This reduces re-renders from every second to only when needed
    const intervalId = setInterval(() => {
      const now = new Date();
      const currentMinute = now.getMinutes();
      
      // Only update if the minute has changed
      if (currentMinute !== lastMinuteRef.current) {
        lastMinuteRef.current = currentMinute;
        updateTime();
      }
    }, 15000); // Check every 15 seconds

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [updateTime]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_OUT') {
        // Clear cache when user signs out
        console.log('User signed out, clearing event cache');
        clearCache();
      } else if (event === 'SIGNED_IN') {
        // Fetch events for the new user
        console.log('User signed in, fetching events');
        const today = new Date();
        fetchEventsWindow(today);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [clearCache, fetchEventsWindow]);

  return null; // This component doesn't render anything
}