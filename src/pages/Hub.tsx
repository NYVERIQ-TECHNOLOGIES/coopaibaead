import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, BookOpen, Users, ClipboardCheck, BarChart3, Library,
  Award, Settings, Shield, Upload, MessageSquare, Activity, Headphones,
  UserX, CreditCard, User, Compass,
} from "lucide-react";

type Item = {
  label: string;
  description: string;
  icon: any;
  path: string;
  roles: Array<"admin" | "moderador" | "aluno" | "cooperado">;
};

const items: Item[] = [
  { label: "Dashboard", description: "Visão geral da plataforma", icon: LayoutDashboard, path: "/app", roles: ["admin", "moderador"] },
  { label: "Meu Painel", description: "Seu progresso e atividades", icon: LayoutDashboard, path: "/student", roles: ["aluno", "cooperado"] },
  { label: "Cursos", description: "Acesse e gerencie cursos", icon: BookOpen, path: "/courses", roles: ["admin", "aluno", "cooperado"] },
  { label: "Biblioteca", description: "Materiais e documentos", icon: Library, path: "/library", roles: ["admin", "aluno", "cooperado"] },
  { label: "Certificados", description: "Seus certificados emitidos", icon: Award, path: "/certificates", roles: ["admin", "aluno", "cooperado"] },
  { label: "Fórum", description: "Discussões da comunidade", icon: MessageSquare, path: "/forum", roles: ["admin", "aluno", "cooperado"] },
  { label: "Suporte", description: "Tire dúvidas e abra chamados", icon: Headphones, path: "/support", roles: ["admin", "moderador", "aluno", "cooperado"] },
  { label: "Alunos", description: "Gestão de alunos", icon: Users, path: "/students", roles: ["admin", "moderador"] },
  { label: "Não listados", description: "Usuários sem matrícula", icon: UserX, path: "/unlisted-users", roles: ["admin"] },
  { label: "Presença", description: "Controle de presença em aulas", icon: ClipboardCheck, path: "/attendance", roles: ["admin"] },
  { label: "Presença Digital", description: "Eventos com QR Code e assinatura", icon: ClipboardCheck, path: "/presenca", roles: ["admin", "moderador"] },
  { label: "Materiais", description: "Materiais complementares", icon: BookOpen, path: "/materials", roles: ["admin"] },
  { label: "Mídias", description: "Upload e gestão de mídias", icon: Upload, path: "/media", roles: ["admin"] },
  { label: "Administradores", description: "Gestão da equipe admin", icon: Shield, path: "/admins", roles: ["admin"] },
  { label: "Relatórios", description: "Indicadores e exportações", icon: BarChart3, path: "/reports", roles: ["admin"] },
  { label: "Assinaturas", description: "Gestão de assinaturas", icon: CreditCard, path: "/subscriptions", roles: ["admin"] },
  { label: "Planos", description: "Configuração de planos", icon: CreditCard, path: "/plans", roles: ["admin"] },
  { label: "Logs de Acesso", description: "Auditoria do sistema", icon: Activity, path: "/admin-logs", roles: ["admin"] },
  { label: "Perfil", description: "Seus dados pessoais", icon: User, path: "/profile", roles: ["admin", "moderador", "aluno", "cooperado"] },
  { label: "Configurações", description: "Preferências da conta", icon: Settings, path: "/settings", roles: ["admin", "moderador", "aluno", "cooperado"] },
];

export default function Hub() {
  const { role, profile } = useAuth();
  const currentRole = (role ?? "aluno") as Item["roles"][number];
  const visible = items.filter((i) => i.roles.includes(currentRole));

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
          <Compass className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
            Olá{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!
          </h1>
          <p className="text-sm text-muted-foreground">Acesse rapidamente qualquer área do sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
        {visible.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="group bg-card border border-border rounded-2xl p-5 shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-200"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <item.icon className="w-5 h-5 text-primary group-hover:text-primary-foreground" />
            </div>
            <h3 className="font-heading text-base font-semibold text-foreground">{item.label}</h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
