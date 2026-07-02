import { Link, useRouterState } from "@tanstack/react-router";
import { Home, User, Plus } from "lucide-react";
import { PicklyLogo } from "./PicklyLogo";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border">
      <div className="mx-auto max-w-md px-5 h-16 flex items-center justify-between">
        <Link to="/home" className="flex items-center">
          <PicklyLogo size={28} />
        </Link>
        <nav className="flex items-center gap-1">
          <NavIcon to="/home" icon={Home} active={pathname === "/home"} />
          <Link
            to="/create"
            className="mx-1 size-10 rounded-full bg-gradient-brand flex items-center justify-center glow-primary"
            aria-label="새 투표"
          >
            <Plus className="size-5 text-background" strokeWidth={2.6} />
          </Link>
          <NavIcon to="/mypage" icon={User} active={pathname === "/mypage"} />
        </nav>
      </div>
    </header>
  );
}

function NavIcon({ to, icon: Icon, active }: { to: string; icon: typeof Home; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "size-10 rounded-full flex items-center justify-center transition-colors",
        active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-5" />
    </Link>
  );
}
