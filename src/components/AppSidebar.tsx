import { useState, useMemo, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import logoImg from "@/assets/logo-coopaiba.png";
import {
  LayoutDashboard, BookOpen, Users, ClipboardCheck,
  BarChart3, Library, Award, Settings,
  ChevronLeft, ChevronRight, LogOut, Shield, ShieldCheck, Menu, X, Upload,
  MessageSquare, Activity, Headphones, UserX, CreditCard, Sparkles,
  Search, Star, ChevronDown, GraduationCap, Leaf, UsersRound,
  TrendingUp, Wrench, LifeBuoy, MoreHorizontal, Pin,
} from "lucide-react";

type NavItem = {
  label: string;
  icon: any;
  path: string;
  adminOnly?: boolean;
  studentOnly?: boolean;
  moderatorAllowed?: boolean;
  cooperadoAllowed?: boolean;
  cooperadoExcluded?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  icon: any;
  items: NavItem[];
  defaultOpen?: boolean;
};

const groups: NavGroup[] = [
  {
    id: "principal",
    label: "Principal",
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/app", adminOnly: true, moderatorAllowed: true },
      { label: "Meu Painel", icon: LayoutDashboard, path: "/student", studentOnly: true },
    ],
  },
  {
    id: "ensino",
    label: "Ensino",
    icon: GraduationCap,
    defaultOpen: true,
    items: [
      { label: "Ensino & Cooperados", icon: GraduationCap, path: "/ensino", moderatorAllowed: true, cooperadoAllowed: true },
      { label: "Fórum", icon: MessageSquare, path: "/forum" },
    ],
  },
  {
    id: "conteudo",
    label: "Conteúdo",
    icon: Library,
    items: [
      { label: "Materiais", icon: BookOpen, path: "/materials", adminOnly: true },
      { label: "Biblioteca", icon: Library, path: "/library" },
      { label: "Mídias", icon: Upload, path: "/media", adminOnly: true },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    icon: TrendingUp,
    items: [
      { label: "Relatórios", icon: BarChart3, path: "/reports", adminOnly: true },
    ],
  },
  {
    id: "admin",
    label: "Administração",
    icon: Wrench,
    items: [
      { label: "Administração", icon: Wrench, path: "/administracao", moderatorAllowed: true },
    ],
  },
  {
    id: "suporte",
    label: "Suporte",
    icon: LifeBuoy,
    items: [
      { label: "Suporte", icon: Headphones, path: "/support", moderatorAllowed: true },
    ],
  },
  {
    id: "extras",
    label: "Extras",
    icon: MoreHorizontal,
    items: [
      { label: "Não listados", icon: UserX, path: "/unlisted-users", adminOnly: true },
    ],
  },
];

const FAV_KEY = "coopaiba:sidebar:favorites";
const OPEN_KEY = "coopaiba:sidebar:openGroups";

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; }
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(OPEN_KEY) || "null");
      if (stored) return stored;
    } catch {}
    return Object.fromEntries(groups.map(g => [g.id, !!g.defaultOpen]));
  });

  const location = useLocation();
  const navigate = useNavigate();
  const { role, signOut } = useAuth();
  const isAdmin = role === "admin";
  const isModerator = role === "moderador";
  const isCooperado = role === "cooperado";

  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  }, [favorites]);
  useEffect(() => {
    localStorage.setItem(OPEN_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  const canSee = (item: NavItem) => {
    if (isModerator) return !!item.moderatorAllowed;
    if (isCooperado && item.cooperadoExcluded) return false;
    if (isCooperado && item.cooperadoAllowed) return true;
    if (item.adminOnly && !isAdmin) return false;
    if (item.studentOnly && isAdmin) return false;
    return true;
  };

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map(g => ({
        ...g,
        items: g.items.filter(i => canSee(i) && (q === "" || i.label.toLowerCase().includes(q))),
      }))
      .filter(g => g.items.length > 0);
  }, [query, role]);

  const allVisibleItems = useMemo(
    () => groups.flatMap(g => g.items).filter(canSee),
    [role]
  );
  const favItems = allVisibleItems.filter(i => favorites.includes(i.path));

  const toggleFav = (path: string) => {
    setFavorites(f => f.includes(path) ? f.filter(p => p !== path) : [...f, path]);
  };
  const toggleGroup = (id: string) => {
    setOpenGroups(o => ({ ...o, [id]: !o[id] }));
  };


  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const renderItem = (item: NavItem, opts?: { showFav?: boolean }) => {
    const isActive = location.pathname === item.path;
    const isFav = favorites.includes(item.path);
    return (
      <div key={item.path} className="group/item relative">
        {isActive && !collapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-sidebar-primary" />
        )}
        <Link
          to={item.path}
          onClick={() => setMobileOpen(false)}
          title={collapsed ? item.label : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
            ${isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-[inset_0_0_0_1px_hsl(var(--sidebar-primary)/0.14)]"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            }`}
        >
          <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
          {!collapsed && (
            <span className="text-sm truncate flex-1">{item.label}</span>
          )}
          {!collapsed && opts?.showFav !== false && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(item.path); }}
              className={`opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-sidebar-accent/60
                ${isFav ? "!opacity-100 text-warning" : "text-sidebar-foreground/40 hover:text-sidebar-foreground"}`}
              aria-label={isFav ? "Remover dos favoritos" : "Fixar nos favoritos"}
            >
              <Star className={`w-3.5 h-3.5 ${isFav ? "fill-current" : ""}`} />
            </button>
          )}
        </Link>
      </div>

    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-6 border-b border-sidebar-border/70 ${collapsed ? "justify-center" : ""}`}>
        <img src={logoImg} alt="Coopaiba EAD" className="w-11 h-11 rounded-2xl object-contain flex-shrink-0 shadow-card bg-card p-1" />
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-heading text-[17px] font-extrabold tracking-tight text-sidebar-foreground leading-tight">Coopaiba EAD</h1>
            <p className="text-[11px] text-sidebar-foreground/55">Ecossistema de Aprendizagem</p>
          </div>
        )}
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pt-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-sidebar-foreground/45" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no menu..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-sidebar-accent/50 text-sidebar-foreground placeholder:text-sidebar-foreground/40 border border-sidebar-border/60 transition-colors focus:outline-none focus:border-sidebar-primary/50 focus:bg-sidebar-accent"
            />
          </div>
        </div>
      )}


      {/* Navigation */}
      <nav className="flex-1 py-4 px-2.5 space-y-3 overflow-y-auto sidebar-scroll">
        {/* Favorites */}
        {!collapsed && favItems.length > 0 && query === "" && (
          <div>
            <div className="flex items-center gap-1.5 px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              <Pin className="w-3 h-3" /> Favoritos
            </div>
            <div className="space-y-0.5">
              {favItems.map(i => renderItem(i))}
            </div>
            <div className="h-px bg-sidebar-border/60 mx-3 mt-2" />
          </div>
        )}

        {filteredGroups.map((g, idx) => {
          const isOpen = query !== "" ? true : (openGroups[g.id] ?? false);
          if (collapsed) {
            return (
              <div key={g.id} className="space-y-0.5">
                {g.items.map(i => renderItem(i, { showFav: false }))}
                {idx < filteredGroups.length - 1 && (
                  <div className="h-px bg-sidebar-border/50 my-2 mx-2" />
                )}
              </div>
            );
          }
          return (
            <div key={g.id}>
              <button
                type="button"
                onClick={() => toggleGroup(g.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
              >
                <g.icon className="w-3 h-3" />
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 pt-0.5">
                      {g.items.map(i => renderItem(i))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {filteredGroups.length === 0 && !collapsed && (
          <p className="text-xs text-sidebar-foreground/50 px-3 py-4 text-center">
            Nenhum item encontrado
          </p>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-sidebar-border/70 p-3">
        <div className={`flex items-center rounded-2xl p-2 transition-colors hover:bg-sidebar-accent/50 ${collapsed ? "justify-center" : ""}`}>
          {!collapsed && (
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 text-sm font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair da conta</span>
            </button>
          )}
          {collapsed && (
            <button
              onClick={handleSignOut}
              title="Sair"
              aria-label="Sair"
              className="rounded-lg p-1.5 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>


      {/* Collapse button (desktop) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border items-center justify-center shadow-card hover:shadow-elevated transition-shadow z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3 text-foreground" /> : <ChevronLeft className="w-3 h-3 text-foreground" />}
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-card shadow-card flex items-center justify-center"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="lg:hidden fixed inset-0 bg-foreground/30 z-40"
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="lg:hidden fixed left-0 top-0 bottom-0 w-72 gradient-sidebar z-50"
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-sidebar-foreground/50 hover:text-sidebar-foreground z-10"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:block relative gradient-sidebar border-r border-sidebar-border/70 transition-all duration-300 flex-shrink-0
          ${collapsed ? "w-[76px]" : "w-[272px]"}`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
