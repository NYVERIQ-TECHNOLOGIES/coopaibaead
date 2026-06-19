import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import NotificationBell from "./NotificationBell";
import PageTOC from "./PageTOC";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <div className="absolute top-4 right-4 z-30">
          <NotificationBell />
        </div>
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 lg:py-6 pt-16 lg:pt-6 max-w-[1600px] mx-auto w-full">
          <Outlet />
        </div>
        <PageTOC />
      </main>
    </div>
  );
}
