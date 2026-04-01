import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, BookOpen, Users, GraduationCap, ClipboardCheck,
  BarChart3, Library, Award, MessageSquare, Bell, Settings,
  ChevronLeft, ChevronRight, LogOut, Shield, Menu, X, Upload, Bell, Settings
} from "lucide-react";

const adminNav = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Cursos", icon: BookOpen, path: "/courses" },
  { label: "Alunos", icon: Users, path: "/students" },
  { label: "Cooperados", icon: Shield, path: "/cooperados" },
  { label: "Presença", icon: ClipboardCheck, path: "/attendance" },
  { label: "Avaliações", icon: BarChart3, path: "/evaluations" },
  { label: "Materiais", icon: BookOpen, path: "/materials" },
  { label: "Biblioteca", icon: Library, path: "/library" },
  { label: "Certificados", icon: Award, path: "/certificates" },
  { label: "Mídias", icon: Upload, path: "/media" },
  
  { label: "Notificações", icon: Bell, path: "/notifications" },
  { label: "Configurações", icon: Settings, path: "/settings" },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-6 h-6 text-primary-foreground" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <h1 className="font-heading text-lg font-bold text-sidebar-primary-foreground">CoopEdu</h1>
              <p className="text-xs text-sidebar-foreground/60">Plataforma EAD</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {adminNav.map((item) => {
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
          <div className="w-9 h-9 rounded-full gradient-secondary flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-secondary-foreground">{initials}</span>
          </div>
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
