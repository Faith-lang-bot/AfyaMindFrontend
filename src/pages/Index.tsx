import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground animate-pulse font-serif text-xl">AfyaMind</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
