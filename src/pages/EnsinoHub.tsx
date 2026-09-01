import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import Courses from "@/pages/Courses";
import Certificates from "@/pages/Certificates";
import Attendance from "@/pages/Attendance";
import Students from "@/pages/Students";
import PresencaList from "@/pages/PresencaList";
import CooperadosEventuaisList from "@/pages/CooperadosEventuaisList";
import AdminCampanhas from "@/pages/admin/AdminCampanhas";
import AdminCooperadosPendentes from "@/pages/AdminCooperadosPendentes";
import LiveClasses from "@/pages/LiveClasses";


function CooperadosEventuaisTab({ isAdmin }: { isAdmin: boolean }) {
  const [params, setParams] = useSearchParams();
  const sub = params.get("sub") === "gestao" && isAdmin ? "gestao" : "lista";
  return (
    <Tabs
      value={sub}
      onValueChange={(v) => setParams({ tab: "cooperados-eventuais", sub: v }, { replace: true })}
    >
      <TabsList className="flex flex-wrap h-auto">
        <TabsTrigger value="lista">Cooperados Eventuais</TabsTrigger>
        {isAdmin && <TabsTrigger value="gestao">Gestão Eventuais</TabsTrigger>}
      </TabsList>
      <TabsContent value="lista" className="mt-2"><CooperadosEventuaisList /></TabsContent>
      {isAdmin && <TabsContent value="gestao" className="mt-2"><AdminCampanhas /></TabsContent>}
    </Tabs>
  );
}

export default function EnsinoHub() {
  const [params, setParams] = useSearchParams();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const isModerator = role === "moderador";
  const isCooperado = role === "cooperado";

  const tabs = [
    { value: "cursos", label: "Cursos", el: <Courses />, show: !isModerator },
    { value: "certificados", label: "Certificados", el: <Certificates />, show: true },
    { value: "presenca", label: "Presença", el: <Attendance />, show: isAdmin },
    { value: "alunos", label: "Alunos", el: <Students />, show: isAdmin || isModerator },
    { value: "dia-de-campo", label: "Dia de Campo", el: <PresencaList />, show: isAdmin || isModerator || isCooperado },
    {
      value: "cooperados-eventuais",
      label: "Cooperados Eventuais",
      el: <CooperadosEventuaisTab isAdmin={isAdmin} />,
      show: !isCooperado,
    },
    { value: "aulas-ao-vivo", label: "Aulas ao Vivo", el: <LiveClasses />, show: isAdmin || isModerator },
    { value: "autorizar", label: "Autorizar Cooperados", el: <AdminCooperadosPendentes />, show: isAdmin },

  ].filter(t => t.show);

  const current = params.get("tab") && tabs.some(t => t.value === params.get("tab"))
    ? (params.get("tab") as string)
    : tabs[0]?.value;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Ensino & Cooperados</h1>
      <Tabs
        value={current}
        onValueChange={(v) => setParams({ tab: v }, { replace: true })}
      >
        <TabsList className="flex flex-wrap h-auto">
          {tabs.map(t => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(t => (
          <TabsContent key={t.value} value={t.value} className="mt-2">
            {t.el}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
