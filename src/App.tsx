import { useLocation } from 'react-router-dom'
import { SearchEventsDialog } from '@/SideBar/SearchEventsDialog'
import { AppRoutes } from '@/app/AppRoutes'
import { CompactSidebarOverlay, DesktopSidebar, FloatingSidebarControls } from '@/app/AppSidebar'
import { useAppShell } from '@/app/useAppShell'
import TimeUpdater from '@/components/TimeUpdater'
import { TopBarLeft } from '@/components/TopBarLeft'
import { ViewSwitcher } from '@/components/ViewSwitcher'

function App() {
  const location = useLocation()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'
  const isGoalView = location.pathname === '/goalview'
  const isHomePage = location.pathname === '/'
  const isShellHiddenPage = isAuthPage || isHomePage
  const {
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
  } = useAppShell(isShellHiddenPage, isGoalView)

  if (isAuthLoading) {
    return <div className="h-screen w-screen bg-[#f3f3f2]" />
  }

  return (
    <>
      {isAuthenticated ? <TimeUpdater /> : null}
      {!isShellHiddenPage && isAuthenticated && <ViewSwitcher currentView={currentView as any} onViewChange={setCurrentView} />}
      {!isShellHiddenPage && isAuthenticated && <TopBarLeft />}
      <div className={`flex h-screen overflow-hidden relative ${isShellHiddenPage ? '' : ''}`}>
        <div className={`flex-1 ${isShellHiddenPage ? 'w-full overflow-y-auto no-scrollbar' : 'overflow-hidden'}`}>
          <AppRoutes isAuthenticated={isAuthenticated} />
        </div>

        {showAppSidebar && !isCompactSidebar && <DesktopSidebar />}
      </div>

      {showAppSidebar && isCompactSidebar && isSidebarMounted && (
        <CompactSidebarOverlay
          isVisible={isSidebarVisible}
          onClose={closeCompactSidebarAndClearSelection}
        />
      )}

      {showFloatingSidebarButton && (
        <FloatingSidebarControls
          isHoverVisible={isSidebarHoverVisible}
          onHoverVisibleChange={setIsSidebarHoverVisible}
          onOpenSidebar={openCompactSidebar}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      )}

      <SearchEventsDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  )
}

export default App
