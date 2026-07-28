import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <div className="absolute top-4 right-4 z-30 flex items-center gap-1 rounded-full border border-border/60 bg-card/70 px-1.5 py-1 shadow-card backdrop-blur">
          <ThemeToggle />
          <NotificationBell />
        </div>
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 lg:py-6 pt-16 lg:pt-6 max-w-[1600px] mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

