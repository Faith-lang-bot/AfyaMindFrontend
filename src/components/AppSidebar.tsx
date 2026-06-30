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
} from "lucide-react";

const userNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Check-in", url: "/checkin", icon: Heart },
  { title: "Journal", url: "/journal", icon: BookOpen },
  { title: "Appointments", url: "/appointments", icon: Calendar },
  { title: "CHW Support", url: "/directory", icon: Users },
  { title: "Community", url: "/community", icon: MessageCircle },
  { title: "Resources", url: "/resources", icon: BookHeart },
  { title: "Rewards", url: "/rewards", icon: Gift },
  { title: "AI Companion", url: "/ai-chat", icon: Sparkles },
];

const chwNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Caseload", url: "/caseload", icon: ClipboardList },
  { title: "Directory", url: "/directory", icon: Users },
  { title: "Community", url: "/community", icon: MessageCircle },
  { title: "Resources", url: "/resources", icon: BookHeart },
  { title: "AI Companion", url: "/ai-chat", icon: Sparkles },
];

export function AppSidebar() {
  const { user, logout, isUser } = useAuth();
  const navItems = isUser ? userNav : chwNav;
  const initials = user?.name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-80 border-r border-white/60 bg-[linear-gradient(180deg,rgba(232,245,236,0.96),rgba(220,239,226,0.9))] px-6 py-8 backdrop-blur md:flex md:flex-col">
      <div className="mb-10 rounded-[2rem] border border-white/70 bg-white/65 px-5 py-5 shadow-[0_12px_32px_rgba(48,95,68,0.08)]">
        <div className="text-sm font-medium uppercase tracking-[0.24em] text-primary/70">Mental wellness</div>
        <div className="mt-2 font-serif text-[2.15rem] tracking-tight text-foreground">AfyaMind</div>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          Calm support, greener space, and clearer care steps through every part of the journey.
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-2 pr-1">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/dashboard"}
            className="nav-item"
            activeClassName="nav-item-active"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[1.02rem]">{item.title}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 rounded-[1.6rem] border border-white/75 bg-white/72 p-4 shadow-[0_12px_32px_rgba(48,95,68,0.09)]">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/10 bg-[radial-gradient(circle_at_top,rgba(122,176,138,0.38),rgba(73,129,92,0.16))] text-sm font-semibold tracking-[0.12em] text-foreground shadow-[inset_0_1px_8px_rgba(255,255,255,0.55)]">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{user?.name}</div>
            <div className="mt-1 truncate text-[11px] uppercase tracking-[0.16em] text-primary/70">
              {isUser ? "Patient" : "Health Worker"}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-[0_10px_24px_rgba(46,112,74,0.22)] transition-all hover:brightness-105"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
