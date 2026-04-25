import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { startReminderService, stopReminderService } from '@/services/reminderService'
import { useEventsStore } from '@/store/eventsStore'

interface UseAppShellResult {
  currentView: string
  setCurrentView: (view: string) => void
  isAuthLoading: boolean
  isAuthenticated: boolean
  isCompactSidebar: boolean
  isSearchOpen: boolean
  isSidebarMounted: boolean
  isSidebarVisible: boolean
  isSidebarHoverVisible: boolean
  showAppSidebar: boolean
  showFloatingSidebarButton: boolean
  closeCompactSidebarAndClearSelection: () => void
  openCompactSidebar: () => void
  setIsSearchOpen: (open: boolean) => void
  setIsSidebarHoverVisible: (visible: boolean) => void
}

export function useAppShell(isAuthPage: boolean, isGoalView: boolean): UseAppShellResult {
  const [currentView, setCurrentView] = useState<string>('day')
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCompactSidebar, setIsCompactSidebar] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSidebarMounted, setIsSidebarMounted] = useState(false)
  const [isSidebarVisible, setIsSidebarVisible] = useState(false)
  const [isSidebarHoverVisible, setIsSidebarHoverVisible] = useState(false)
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)

  const showAppSidebar = !isAuthPage && !isGoalView && isAuthenticated
  const showFloatingSidebarButton = showAppSidebar && isCompactSidebar && !isSidebarOpen

  const closeCompactSidebarAndClearSelection = useCallback(() => {
    setIsSidebarOpen(false)
    setSelectedEvent(null)
  }, [setSelectedEvent])

  const openCompactSidebar = useCallback(() => {
    setIsSidebarOpen(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(max-width: 1360px)')
    const applySidebarMode = (matches: boolean) => {
      setIsCompactSidebar(matches)
      setIsSidebarOpen(!matches)
    }

    applySidebarMode(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => applySidebarMode(event.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (!isCompactSidebar || !isSidebarOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCompactSidebar, isSidebarOpen])

  useEffect(() => {
    if (!isAuthenticated || isAuthPage || isGoalView || !isCompactSidebar) return
    if (!selectedEventId) return
    setIsSidebarOpen(true)
  }, [isAuthenticated, isAuthPage, isGoalView, isCompactSidebar, selectedEventId])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!showAppSidebar || !isCompactSidebar) {
      setIsSidebarMounted(false)
      setIsSidebarVisible(false)
      return
    }

    if (isSidebarOpen) {
      setIsSidebarVisible(false)
      setIsSidebarMounted(true)
      let secondFrameId = 0
      const firstFrameId = window.requestAnimationFrame(() => {
        secondFrameId = window.requestAnimationFrame(() => {
          setIsSidebarVisible(true)
        })
      })

      return () => {
        window.cancelAnimationFrame(firstFrameId)
        if (secondFrameId) window.cancelAnimationFrame(secondFrameId)
      }
    }

    setIsSidebarVisible(false)

    const timeoutId = window.setTimeout(() => {
      setIsSidebarMounted(false)
    }, 260)

    return () => window.clearTimeout(timeoutId)
  }, [isCompactSidebar, isSidebarOpen, showAppSidebar])

  useEffect(() => {
    if (!showFloatingSidebarButton) {
      setIsSidebarHoverVisible(false)
    }
  }, [showFloatingSidebarButton])

  useEffect(() => {
    startReminderService()
    return () => stopReminderService()
  }, [])

  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      setIsAuthenticated(!!session)
      setIsAuthLoading(false)
    }

    void checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
      setIsAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return {
    currentView,
    setCurrentView,
    isAuthLoading,
    isAuthenticated,
    isCompactSidebar,
    isSearchOpen,
    isSidebarMounted,
    isSidebarVisible,
    isSidebarHoverVisible,
    showAppSidebar,
    showFloatingSidebarButton,
    closeCompactSidebarAndClearSelection,
    openCompactSidebar,
    setIsSearchOpen,
    setIsSidebarHoverVisible,
  }
}
