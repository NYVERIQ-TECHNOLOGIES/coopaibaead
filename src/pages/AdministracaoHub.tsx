import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import AdminManagement from "@/pages/AdminManagement";
import AdminLogs from "@/pages/AdminLogs";
import SettingsPage from "@/pages/SettingsPage";
import AdminSubscriptions from "@/pages/AdminSubscriptions";

export default function AdministracaoHub() {
  const [params, setParams] = useSearchParams();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const tabs = [
    ...(isAdmin ? [{ value: "admins", label: "Administradores", el: <AdminManagement /> }] : []),
    ...(isAdmin ? [{ value: "logs", label: "Logs de Acesso", el: <AdminLogs /> }] : []),
    { value: "settings", label: "Configurações", el: <SettingsPage /> },
    ...(isAdmin ? [{ value: "subscriptions", label: "Assinaturas", el: <AdminSubscriptions /> }] : []),
  ];

  const current = params.get("tab") && tabs.some(t => t.value === params.get("tab"))
    ? (params.get("tab") as string)
    : tabs[0]?.value;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Administração</h1>
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
