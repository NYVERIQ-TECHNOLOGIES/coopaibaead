import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import LibraryPage from "@/pages/LibraryPage";
import Certificates from "@/pages/Certificates";
import Attendance from "@/pages/Attendance";

import SupplementaryMaterials from "@/pages/SupplementaryMaterials";
import StudentDashboard from "@/pages/StudentDashboard";
import MediaManager from "@/pages/MediaManager";
import AdminManagement from "@/pages/AdminManagement";
import SettingsPage from "@/pages/SettingsPage";
import ProfilePage from "@/pages/ProfilePage";
import Forum from "@/pages/Forum";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
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
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<ProtectedRoute allowedRoles={["admin"]}><Dashboard /></ProtectedRoute>} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:id" element={<CourseDetail />} />
              <Route path="/students" element={<ProtectedRoute allowedRoles={["admin"]}><Students /></ProtectedRoute>} />
              
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/certificates" element={<Certificates />} />
              <Route path="/attendance" element={<ProtectedRoute allowedRoles={["admin"]}><Attendance /></ProtectedRoute>} />
              
              <Route path="/materials" element={<SupplementaryMaterials />} />
              <Route path="/media" element={<ProtectedRoute allowedRoles={["admin"]}><MediaManager /></ProtectedRoute>} />
              <Route path="/admins" element={<ProtectedRoute allowedRoles={["admin"]}><AdminManagement /></ProtectedRoute>} />
              <Route path="/forum" element={<Forum />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/student" element={<StudentDashboard />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
