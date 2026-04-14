import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "./AppSidebar";
import { hasCompletedAdmission } from "@/lib/wellness";

export function AppLayout() {
  const { user, loading, isUser } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground animate-pulse font-serif text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isUser && !hasCompletedAdmission(user.id) && location.pathname !== "/admission") {
    return <Navigate to="/admission" replace />;
  }
  if (isUser && hasCompletedAdmission(user.id) && location.pathname === "/admission") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-10 lg:px-16 lg:py-14">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
