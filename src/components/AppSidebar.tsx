import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import logoImg from "@/assets/logo-coopaiba.png";
import {
  LayoutDashboard, BookOpen, Users, ClipboardCheck,
  BarChart3, Library, Award, Settings,
  ChevronLeft, ChevronRight, LogOut, Shield, Menu, X, Upload, MessageSquare, Activity, Headphones, UserX, CreditCard
} from "lucide-react";

// adminOnly: visível apenas para admin
// studentOnly: visível apenas para aluno/cooperado
// moderatorAllowed: também visível para o moderador (subset do adminOnly)
// (sem flag): visível para alunos/cooperados/admin (não moderador, salvo flag)
const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/app", adminOnly: true, moderatorAllowed: true },
  { label: "Meu Painel", icon: LayoutDashboard, path: "/student", studentOnly: true },
  { label: "Cursos", icon: BookOpen, path: "/courses" },
  { label: "Alunos", icon: Users, path: "/students", adminOnly: true, moderatorAllowed: true },
  { label: "Não listados", icon: UserX, path: "/unlisted-users", adminOnly: true },
  { label: "Presença", icon: ClipboardCheck, path: "/attendance", adminOnly: true },
  { label: "Materiais", icon: BookOpen, path: "/materials", adminOnly: true },
  { label: "Biblioteca", icon: Library, path: "/library" },
  { label: "Certificados", icon: Award, path: "/certificates" },
  { label: "Fórum", icon: MessageSquare, path: "/forum" },
  { label: "Suporte", icon: Headphones, path: "/support", moderatorAllowed: true },
  { label: "Mídias", icon: Upload, path: "/media", adminOnly: true },
  { label: "Administradores", icon: Shield, path: "/admins", adminOnly: true },
  { label: "Relatórios", icon: BarChart3, path: "/reports", adminOnly: true },
  { label: "Assinaturas", icon: CreditCard, path: "/subscriptions", adminOnly: true },
  { label: "Planos", icon: CreditCard, path: "/plans", adminOnly: true },
  { label: "Logs de Acesso", icon: Activity, path: "/admin-logs", adminOnly: true },
  { label: "Configurações", icon: Settings, path: "/settings", moderatorAllowed: true },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, role, signOut } = useAuth();
  const isAdmin = role === "admin";
  const isModerator = role === "moderador";

  const filteredNav = navItems.filter((item) => {
    if (isModerator) return !!item.moderatorAllowed;
    if (item.adminOnly && !isAdmin) return false;
    if (item.studentOnly && isAdmin) return false;
    return true;
  });

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border">
        <img src={logoImg} alt="Coopaiba EAD" className="w-10 h-10 rounded-xl object-contain flex-shrink-0" />
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <h1 className="font-heading text-lg font-bold text-sidebar-primary-foreground">Coopaiba EAD</h1>
              <p className="text-xs text-sidebar-foreground/60">Educação Cooperativista</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group
                ${isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "" : "group-hover:scale-110 transition-transform"}`} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="text-sm font-medium overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Link to="/profile" onClick={() => setMobileOpen(false)}
            className="w-9 h-9 rounded-full gradient-secondary flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-secondary-foreground">{initials}</span>
            )}
          </Link>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || "Usuário"}</p>
                <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button onClick={handleSignOut} className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapse button (desktop) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border items-center justify-center shadow-card hover:shadow-elevated transition-shadow"
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
            className="lg:hidden fixed left-0 top-0 bottom-0 w-64 gradient-sidebar z-50"
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-sidebar-foreground/50 hover:text-sidebar-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:block relative gradient-sidebar transition-all duration-300 flex-shrink-0
          ${collapsed ? "w-[72px]" : "w-64"}`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
