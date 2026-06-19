import { useRef } from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import NotificationBell from "./NotificationBell";
import ScrollToTopButton from "./ScrollToTopButton";

export default function AppLayout() {
  const mainRef = useRef<HTMLElement>(null);

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto overflow-x-hidden relative content-scroll"
      >
        <div className="absolute top-4 right-4 z-30">
          <NotificationBell />
        </div>
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 lg:py-6 pt-16 lg:pt-6 max-w-[1600px] mx-auto w-full">
          <Outlet />
        </div>
        <ScrollToTopButton scrollRef={mainRef} />
      </main>
    </div>
  );
}
