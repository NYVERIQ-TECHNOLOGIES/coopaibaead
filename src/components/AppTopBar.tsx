import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Search, Settings, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logoImg from "@/assets/logo-coopaiba.png";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";

const topLinks = [
  { label: "Dashboard", to: "/app", altTo: "/student" },
  { label: "Cursos", to: "/courses" },
  { label: "Certificados", to: "/certificates" },
];

export default function AppTopBar() {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const isStaff = role === "admin" || role === "moderador";
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/courses?q=${encodeURIComponent(term)}` : "/courses");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Logo */}
        <Link
          to={isStaff ? "/app" : "/student"}
          className="flex items-center gap-2 flex-shrink-0 rounded-xl pl-10 lg:pl-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Coopaiba EAD — início"
        >
          <img src={logoImg} alt="" className="h-9 w-9 rounded-xl object-contain" loading="lazy" />
          <span className="hidden sm:block font-heading text-lg font-extrabold tracking-tight text-foreground">
            COOPAÍBA
          </span>
        </Link>

        {/* Search */}
        <form onSubmit={handleSearch} role="search" className="flex-1 flex justify-center px-1">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="topbar-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cursos..."
              aria-label="Buscar cursos"
              className="w-full h-10 pl-9 pr-3 rounded-full bg-muted/60 border border-border/70 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:bg-background focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        </form>

        {/* Horizontal menu */}
        <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-1">
          {topLinks.map((l) => (
            <NavLink
              key={l.label}
              to={l.label === "Dashboard" ? (isStaff ? l.to : l.altTo ?? l.to) : l.to}
              className={({ isActive }) =>
                `relative px-3 py-2 text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "text-foreground font-semibold after:absolute after:left-3 after:right-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* Icons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <ThemeToggle />
          <NotificationBell />
          <Link
            to="/settings"
            aria-label="Configurações"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Settings className="w-[18px] h-[18px]" />
          </Link>
          <Link
            to="/profile"
            className="ml-1 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card py-1 pl-1 pr-1 sm:pr-3 transition-all hover:shadow-card hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Meu Perfil"
          >
            <span className="h-7 w-7 rounded-full gradient-secondary flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="text-[11px] font-bold text-brand-foreground">{initials}</span>
              )}
            </span>
            <span className="hidden sm:inline text-xs font-semibold text-foreground">Meu Perfil</span>
            <User className="sm:hidden w-3.5 h-3.5 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </header>
  );
}
