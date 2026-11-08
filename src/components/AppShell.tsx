import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  LayoutDashboard,
  List,
  LogOut,
  Bot,
  FlaskConical,
  PlayCircle,
  Library,
  Menu,
  X,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { deleteAuthSession } from "../api/auth";
import { ApiError } from "../api/system";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/studio", label: "Studio", icon: PlayCircle },
  { to: "/backtests/history", label: "Run History", icon: List },
  { to: "/experiments", label: "Experiments", icon: FlaskConical },
  { to: "/library", label: "Library", icon: Library },
] as const;

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary navigation" className="flex flex-col gap-1">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          end={to === "/"}
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          <Icon className="size-[18px] shrink-0" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const logout = useMutation({ mutationFn: deleteAuthSession });
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="border-b border-border p-5">
          <NavLink
            className="flex items-center gap-3 rounded-md text-lg font-semibold tracking-tight text-foreground focus-visible:outline-none"
            to="/"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bot size={20} aria-hidden="true" />
            </div>
            <span>StockBOT</span>
          </NavLink>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <NavigationLinks />
        </ScrollArea>

        <div className="mt-auto border-t border-border p-3">
          {logout.error instanceof ApiError && (
            <p className="mb-3 text-sm text-destructive" role="alert">
              {logout.error.message}
            </p>
          )}
          <Button
            variant="ghost"
            className="mb-1 w-full justify-start gap-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut size={18} />
            {logout.isPending ? "Signing out…" : "Sign out"}
          </Button>
          <div className="flex items-center justify-between px-2 pt-2 text-xs text-muted-foreground">
            <span>Appearance</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-border bg-card px-4 md:hidden">
        <NavLink
          className="flex items-center gap-2 rounded-md text-base font-semibold tracking-tight text-foreground focus-visible:outline-none"
          to="/"
        >
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Bot size={18} aria-hidden="true" />
          </div>
          StockBOT
        </NavLink>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            onClick={() => setNavigationOpen(true)}
          >
            <Menu aria-hidden="true" />
          </Button>
        </div>
      </header>

      <DialogPrimitive.Root
        open={navigationOpen}
        onOpenChange={setNavigationOpen}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 md:hidden" />
          <DialogPrimitive.Content className="elevation-floating fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100%-2rem))] flex-col border-r border-border bg-card outline-none md:hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <DialogPrimitive.Title className="flex items-center gap-2 text-base font-semibold text-foreground">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Bot size={18} aria-hidden="true" />
                </span>
                StockBOT
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close navigation"
                >
                  <X aria-hidden="true" />
                </Button>
              </DialogPrimitive.Close>
            </div>
            <div className="flex-1 p-3">
              <NavigationLinks onNavigate={() => setNavigationOpen(false)} />
            </div>
            <div className="border-t border-border p-3">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                <LogOut size={18} aria-hidden="true" />
                {logout.isPending ? "Signing out…" : "Sign out"}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="mt-14 flex min-h-screen min-w-0 flex-1 flex-col overflow-x-clip px-4 py-6 focus:outline-none md:mt-0 md:px-8 md:py-8 lg:px-10"
      >
        <Outlet />
      </main>
    </div>
  );
}
