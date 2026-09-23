import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  ClipboardClock,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  RotateCcw,
  ShoppingCart,
} from "lucide-react";
import { currentUser, logout } from "@/lib/store";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Book POS Dashboard" },
      { name: "description", content: "Manage products and sales in the Book POS system." },
    ],
  }),
  component: AppLayout,
});

const modules = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/pop", label: "POP", icon: Package, exact: false },
  { to: "/app/pos", label: "POS", icon: ShoppingCart, exact: false },
  { to: "/app/pop-history", label: "POP History", icon: History, exact: false },
  { to: "/app/pos-history", label: "POS History", icon: ClipboardClock, exact: false },
  { to: "/app/pop-return", label: "POP Return", icon: RotateCcw, exact: false },
  { to: "/app/pos-return", label: "POS Return", icon: RotateCcw, exact: false },
] as const;

function AppLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = currentUser();

  return (
    <div className="flex min-h-screen w-full bg-secondary/40">
      <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <BookOpen className="size-6" />
          <span className="font-bold">Book POS</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {modules.map((m) => {
            const active = m.exact ? pathname === m.to : pathname.startsWith(m.to);
            return (
              <Link
                key={m.to}
                to={m.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "hover:bg-sidebar-accent"
                }`}
              >
                <m.icon className="size-4" />
                {m.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => {
            logout();
            navigate({ to: "/" });
          }}
          className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-sidebar-accent"
        >
          <LogOut className="size-4" /> Logout
        </button>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
          <h1 className="text-sm font-semibold text-muted-foreground">Multistore Level</h1>
          <span className="text-sm text-muted-foreground">{user ?? "Guest user"}</span>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
