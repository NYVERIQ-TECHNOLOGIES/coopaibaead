import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Courses from "@/pages/Courses";
import CourseDetail from "@/pages/CourseDetail";
import Students from "@/pages/Students";
import UnlistedUsers from "@/pages/UnlistedUsers";
import LibraryPage from "@/pages/LibraryPage";
import Certificates from "@/pages/Certificates";
import Attendance from "@/pages/Attendance";

import SupplementaryMaterials from "@/pages/SupplementaryMaterials";
import StudentDashboard from "@/pages/StudentDashboard";
import MediaManager from "@/pages/MediaManager";
import AdminManagement from "@/pages/AdminManagement";
import AdminLogs from "@/pages/AdminLogs";
import Reports from "@/pages/Reports";
import AdminSubscriptions from "@/pages/AdminSubscriptions";

import SettingsPage from "@/pages/SettingsPage";
import ProfilePage from "@/pages/ProfilePage";
import Forum from "@/pages/Forum";
import Support from "@/pages/Support";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ValidateCertificate from "@/pages/ValidateCertificate";
import CertificatePickup from "@/pages/CertificatePickup";
import CertificatePickupSettings from "@/pages/CertificatePickupSettings";
import CertificateReports from "@/pages/CertificateReports";
import PublicLayout from "@/components/PublicLayout";
import Home from "@/pages/public/Home";
import Sobre from "@/pages/public/Sobre";
import CursosPublic from "@/pages/public/CursosPublic";
import Planos from "@/pages/public/Planos";
import CheckoutReturn from "@/pages/CheckoutReturn";
import Contato from "@/pages/public/Contato";
import Termos from "@/pages/public/Termos";
import Privacidade from "@/pages/public/Privacidade";
import Seguranca from "@/pages/public/Seguranca";
import PresencaList from "@/pages/PresencaList";
import PresencaNovo from "@/pages/PresencaNovo";
import PresencaEvento from "@/pages/PresencaEvento";
import PresencaRelatorios from "@/pages/PresencaRelatorios";
import PresencaAssinar from "@/pages/PresencaAssinar";

import CooperadosEventuaisList from "@/pages/CooperadosEventuaisList";
import CooperadosEventuaisDetalhe from "@/pages/CooperadosEventuaisDetalhe";
import AdminCampanhas from "@/pages/admin/AdminCampanhas";
import AdminCampanhaDetalhe from "@/pages/admin/AdminCampanhaDetalhe";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/checkout/return" element={<CheckoutReturn />} />
            <Route path="/p/:codigo" element={<PresencaAssinar />} />


            {/* Páginas públicas (institucional) */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/sobre" element={<Sobre />} />
              <Route path="/cursos" element={<CursosPublic />} />
              <Route path="/planos" element={<Planos />} />
              <Route path="/contato" element={<Contato />} />
              <Route path="/termos" element={<Termos />} />
              <Route path="/privacidade" element={<Privacidade />} />
              <Route path="/seguranca" element={<Seguranca />} />
              <Route path="/validar-certificado" element={<ValidateCertificate />} />
              <Route path="/validar-certificado/:code" element={<ValidateCertificate />} />
            </Route>

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              
              <Route path="/app" element={<ProtectedRoute allowedRoles={["admin", "moderador"]}><Dashboard /></ProtectedRoute>} />
              <Route path="/student" element={<ProtectedRoute allowedRoles={["aluno", "cooperado"]}><StudentDashboard /></ProtectedRoute>} />

              {/* Acessível a alunos, cooperados e admins */}
              <Route path="/courses" element={<ProtectedRoute allowedRoles={["admin", "aluno", "cooperado"]}><Courses /></ProtectedRoute>} />
              <Route path="/courses/:id" element={<ProtectedRoute allowedRoles={["admin", "aluno", "cooperado"]}><CourseDetail /></ProtectedRoute>} />
              <Route path="/library" element={<ProtectedRoute allowedRoles={["admin", "aluno", "cooperado"]}><LibraryPage /></ProtectedRoute>} />
              <Route path="/forum" element={<ProtectedRoute allowedRoles={["admin", "aluno", "cooperado"]}><Forum /></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute allowedRoles={["admin", "moderador", "aluno", "cooperado"]}><Support /></ProtectedRoute>} />

              {/* Disponível a todos autenticados */}
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              {/* Certificados: alunos veem apenas os próprios; admins gerenciam tudo */}
              <Route path="/certificates" element={<ProtectedRoute allowedRoles={["admin", "moderador", "aluno", "cooperado"]}><Certificates /></ProtectedRoute>} />
              <Route path="/certificates/configuracoes" element={<ProtectedRoute allowedRoles={["admin"]}><CertificatePickupSettings /></ProtectedRoute>} />
              <Route path="/certificates/relatorios" element={<ProtectedRoute allowedRoles={["admin", "moderador"]}><CertificateReports /></ProtectedRoute>} />
              <Route path="/certificates/:code/retirada" element={<ProtectedRoute allowedRoles={["admin", "moderador", "aluno", "cooperado"]}><CertificatePickup /></ProtectedRoute>} />

              {/* Restrito a admins (moderador tem acesso somente-leitura a Alunos) */}
              <Route path="/students" element={<ProtectedRoute allowedRoles={["admin", "moderador"]}><Students /></ProtectedRoute>} />
              <Route path="/unlisted-users" element={<ProtectedRoute allowedRoles={["admin"]}><UnlistedUsers /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute allowedRoles={["admin"]}><Attendance /></ProtectedRoute>} />
              <Route path="/presenca" element={<ProtectedRoute allowedRoles={["admin", "moderador", "cooperado"]}><PresencaList /></ProtectedRoute>} />
              <Route path="/presenca/novo" element={<ProtectedRoute allowedRoles={["admin"]}><PresencaNovo /></ProtectedRoute>} />
              <Route path="/presenca/:id/editar" element={<ProtectedRoute allowedRoles={["admin"]}><PresencaNovo /></ProtectedRoute>} />
              <Route path="/presenca/relatorios" element={<ProtectedRoute allowedRoles={["admin", "moderador"]}><PresencaRelatorios /></ProtectedRoute>} />
              <Route path="/presenca/:id" element={<ProtectedRoute allowedRoles={["admin", "moderador"]}><PresencaEvento /></ProtectedRoute>} />
              <Route path="/materials" element={<ProtectedRoute allowedRoles={["admin"]}><SupplementaryMaterials /></ProtectedRoute>} />
              <Route path="/media" element={<ProtectedRoute allowedRoles={["admin"]}><MediaManager /></ProtectedRoute>} />
              <Route path="/admins" element={<ProtectedRoute allowedRoles={["admin"]}><AdminManagement /></ProtectedRoute>} />
              <Route path="/admin-logs" element={<ProtectedRoute allowedRoles={["admin"]}><AdminLogs /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={["admin"]}><Reports /></ProtectedRoute>} />
              <Route path="/subscriptions" element={<ProtectedRoute allowedRoles={["admin"]}><AdminSubscriptions /></ProtectedRoute>} />
              <Route path="/plans" element={<Navigate to="/subscriptions?tab=plans" replace />} />

              {/* Cooperados Eventuais */}
              <Route path="/cooperados-eventuais" element={<ProtectedRoute allowedRoles={["admin", "moderador", "aluno", "cooperado"]}><CooperadosEventuaisList /></ProtectedRoute>} />
              <Route path="/cooperados-eventuais/:id" element={<ProtectedRoute allowedRoles={["admin", "moderador", "aluno", "cooperado"]}><CooperadosEventuaisDetalhe /></ProtectedRoute>} />
              <Route path="/admin/cooperados-eventuais" element={<ProtectedRoute allowedRoles={["admin"]}><AdminCampanhas /></ProtectedRoute>} />
              <Route path="/admin/cooperados-eventuais/:id" element={<ProtectedRoute allowedRoles={["admin"]}><AdminCampanhaDetalhe /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
