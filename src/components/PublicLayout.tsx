import { Link, NavLink, Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import logoImg from "@/assets/logo-coopaiba.png";
import CookieConsent from "@/components/CookieConsent";

const navItems = [
  { to: "/", label: "Início" },
  { to: "/sobre", label: "Sobre" },
  { to: "/cursos", label: "Cursos" },
  { to: "/planos", label: "Planos" },
  { to: "/contato", label: "Contato" },
  { to: "/validar-certificado", label: "Validar" },
];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImg} alt="Coopaiba EAD" className="w-9 h-9 rounded-lg object-contain" />
            <span className="font-heading font-bold text-foreground">Coopaiba EAD</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Entrar
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 text-sm font-medium gradient-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Criar conta
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label="Abrir menu"
            className="md:hidden p-2 rounded-md text-foreground hover:bg-muted"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
              {navItems.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium ${
                      isActive ? "text-primary bg-primary/10" : "text-muted-foreground"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
              <div className="flex gap-2 pt-2 border-t border-border mt-2">
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="flex-1 text-center px-4 py-2 text-sm font-medium border border-border rounded-lg"
                >
                  Entrar
                </Link>
                <Link
                  to="/register"
                  onClick={() => setOpen(false)}
                  className="flex-1 text-center px-4 py-2 text-sm font-medium gradient-primary text-primary-foreground rounded-lg"
                >
                  Criar conta
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-muted/30 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <img src={logoImg} alt="Coopaiba EAD" className="w-8 h-8 rounded-lg object-contain" />
              <span className="font-heading font-bold text-foreground">Coopaiba EAD</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Plataforma de Educação Cooperativista. Formação de cooperados, jovens, mulheres e comunidade
              através do conhecimento.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">Plataforma</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/cursos" className="hover:text-primary">Cursos</Link></li>
              <li><Link to="/sobre" className="hover:text-primary">Sobre</Link></li>
              <li><Link to="/validar-certificado" className="hover:text-primary">Validar Certificado</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/termos" className="hover:text-primary">Termos de Uso</Link></li>
              <li><Link to="/privacidade" className="hover:text-primary">Política de Privacidade</Link></li>
              <li><Link to="/login" className="hover:text-primary">Acessar conta</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Coopaiba EAD. Todos os direitos reservados.
          </div>
        </div>
      </footer>
      <CookieConsent />
    </div>
  );
}
