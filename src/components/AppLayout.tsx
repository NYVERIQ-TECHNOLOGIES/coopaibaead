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
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-3 sm:px-4 md:px-6 lg:px-8 backdrop-blur">
          <Link to="/app" className="flex items-center flex-shrink-0" aria-label="Início">
            <img
              src={somosCoopLogo.url}
              alt="Somos Coop"
              className="h-9 w-auto max-w-[120px] object-contain"
            />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 lg:py-6 max-w-[1600px] mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}


