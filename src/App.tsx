import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Courses from "@/pages/Courses";
import CourseDetail from "@/pages/CourseDetail";
import Students from "@/pages/Students";
import LibraryPage from "@/pages/LibraryPage";
import Certificates from "@/pages/Certificates";
import Attendance from "@/pages/Attendance";
import Evaluations from "@/pages/Evaluations";
import SupplementaryMaterials from "@/pages/SupplementaryMaterials";
import StudentDashboard from "@/pages/StudentDashboard";
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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/students" element={<Students />} />
            <Route path="/cooperados" element={<Students />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/certificates" element={<Certificates />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/evaluations" element={<Evaluations />} />
            <Route path="/materials" element={<SupplementaryMaterials />} />
            <Route path="/student" element={<StudentDashboard />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
