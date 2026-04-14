import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Admission from "./pages/Admission";
import Checkin from "./pages/Checkin";
import Journal from "./pages/Journal";
import Appointments from "./pages/Appointments";
import Community from "./pages/Community";
import Resources from "./pages/Resources";
import Rewards from "./pages/Rewards";
import Caseload from "./pages/Caseload";
import Directory from "./pages/Directory";
import CareChat from "./pages/CareChat";
import AIChat from "./pages/AIChat";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admission" element={<Admission />} />
              <Route path="/checkin" element={<Checkin />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/community" element={<Community />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/caseload" element={<Caseload />} />
              <Route path="/directory" element={<Directory />} />
              <Route path="/care-chat" element={<CareChat />} />
              <Route path="/ai-chat" element={<AIChat />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
