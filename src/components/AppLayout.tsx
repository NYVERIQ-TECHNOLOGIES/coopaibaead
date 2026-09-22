import { Outlet } from "react-router-dom";
import { Link } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import somosCoopLogo from "@/assets/somos-coop.png.asset.json";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-end gap-2 border-b border-border/60 bg-background/80 px-3 sm:px-4 md:px-6 lg:px-8 backdrop-blur">
          <ThemeToggle />
          <NotificationBell />
          <UserMenu />
        </header>
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 lg:py-6 max-w-[1600px] mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}


