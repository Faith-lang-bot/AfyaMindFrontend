import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "./AppSidebar";

export function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground animate-pulse font-serif text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="min-h-screen flex-1 bg-transparent md:ml-80">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-14 lg:py-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
