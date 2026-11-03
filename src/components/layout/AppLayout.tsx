import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { BarChart3, BookOpen, ChevronsLeft, ChevronsRight, LayoutDashboard, LogOut, Menu, Moon, Plus, Settings as SettingsIcon, Sun, TrendingUp, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { LoadingScreen } from "@/components/common";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/journal", label: "Trading Journal", icon: BookOpen },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const rowBase = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";
const rowIdle = "text-white/65 hover:bg-white/5 hover:text-white";

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { loading, error, settings, updateSettings } = useData();
  const isDark = settings.theme === "dark";
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("tj-sidebar") === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    try {
      localStorage.setItem("tj-sidebar", collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const sidebar = (isMobile: boolean) => {
    const slim = collapsed && !isMobile;
    return (
      <aside
        className={cn(
          "flex h-full flex-col border-r border-white/5 bg-gradient-to-b from-[#1d1c52] via-[#15153d] to-[#0e0e2b] text-white/80 transition-[width] duration-200",
          slim ? "w-[68px]" : "w-[236px]",
        )}
      >
        <div className={cn("flex h-16 items-center gap-2.5 px-4", slim && "justify-center px-0")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-primary text-white shadow-lg shadow-primary/30">
            <TrendingUp className="h-4 w-4" />
          </div>
          {!slim && <span className="truncate text-[15px] font-semibold tracking-tight text-white">Trading Journal</span>}
        </div>

        <div className={cn("px-3 pb-3 pt-1", slim && "px-2")}>
          <Link
            to="/journal?new=1"
            title="Add trade"
            className={cn("flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white shadow-md shadow-primary/30 transition hover:brightness-110")}
          >
            <Plus className="h-4 w-4" />
            {!slim && "Add trade"}
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={slim ? label : undefined}
              className={({ isActive }) => cn(rowBase, slim && "justify-center px-0", isActive ? "bg-white/10 text-white" : rowIdle)}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!slim && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-white/10 p-3">
          {!slim && (
            <div className="mb-1 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/30 text-xs font-semibold uppercase text-white">{(user?.email ?? "?").charAt(0)}</div>
              <div className="min-w-0 truncate text-xs text-white/60">{user?.email}</div>
            </div>
          )}
          <button
            onClick={() => updateSettings({ ...settings, theme: isDark ? "light" : "dark" }).catch(() => {})}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={cn(rowBase, rowIdle, slim && "justify-center px-0")}
          >
            {isDark ? <Sun className="h-[18px] w-[18px] shrink-0" /> : <Moon className="h-[18px] w-[18px] shrink-0" />}
            {!slim && (isDark ? "Light mode" : "Dark mode")}
          </button>
          <button onClick={signOut} title="Sign out" className={cn(rowBase, rowIdle, slim && "justify-center px-0")}>
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!slim && "Sign out"}
          </button>
          {!isMobile && (
            <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className={cn(rowBase, rowIdle, slim && "justify-center px-0")}>
              {collapsed ? <ChevronsRight className="h-[18px] w-[18px] shrink-0" /> : <ChevronsLeft className="h-[18px] w-[18px] shrink-0" />}
              {!slim && "Collapse"}
            </button>
          )}
        </div>
      </aside>
    );
  };

  return (
    <div className="flex h-full">
      <div className="hidden md:block">{sidebar(false)}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 animate-fade-in">{sidebar(true)}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4 md:hidden">
          <Button variant="ghost" size="icon" aria-label={mobileOpen ? "Close menu" : "Open menu"} onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X /> : <Menu />}
          </Button>
          <span className="text-[15px] font-semibold tracking-tight">Trading Journal</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] animate-fade-in p-4 md:p-6" key={location.pathname}>
            {error && <div className="mb-4 rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</div>}
            {loading ? <LoadingScreen label="Loading your journal…" /> : <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
