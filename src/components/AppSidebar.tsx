import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  Heart,
  BookOpen,
  Calendar,
  Users,
  Gift,
  BookHeart,
  MessageCircle,
  ClipboardList,
  LogOut,
  Sparkles,
  Video,
} from "lucide-react";

const userNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Check-in", url: "/checkin", icon: Heart },
  { title: "Journal", url: "/journal", icon: BookOpen },
  { title: "Appointments", url: "/appointments", icon: Calendar },
  { title: "CHW Support", url: "/directory", icon: Users },
  { title: "Care Chat", url: "/care-chat", icon: Video },
  { title: "Community", url: "/community", icon: MessageCircle },
  { title: "Resources", url: "/resources", icon: BookHeart },
  { title: "Rewards", url: "/rewards", icon: Gift },
  { title: "AI Companion", url: "/ai-chat", icon: Sparkles },
];

const chwNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Caseload", url: "/caseload", icon: ClipboardList },
  { title: "Directory", url: "/directory", icon: Users },
  { title: "Care Chat", url: "/care-chat", icon: Video },
  { title: "Community", url: "/community", icon: MessageCircle },
  { title: "Resources", url: "/resources", icon: BookHeart },
  { title: "AI Companion", url: "/ai-chat", icon: Sparkles },
];

export function AppSidebar() {
  const { user, logout, isUser } = useAuth();
  const navItems = isUser ? userNav : chwNav;

  return (
    <aside className="w-72 shrink-0 border-r border-border/50 py-10 px-6 flex flex-col bg-card/50">
      <div className="font-serif text-2xl tracking-tight text-foreground px-4 mb-10">
        AfyaMind
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/dashboard"}
            className="nav-item"
            activeClassName="nav-item-active"
          >
            <item.icon className="h-5 w-5" />
            <span>{item.title}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border/50 pt-6 px-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-medium text-foreground">
            {user?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-xs text-muted-foreground truncate capitalize">
              {isUser ? "Patient" : "Health Worker"}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
