import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, Lock, Mail } from "lucide-react";
import { ApiError } from "@/lib/api";
import { login } from "@/lib/store";

export function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      onClose();
      navigate({ to: "/app" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/40 bg-card/70 p-8 shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="size-6" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your Books POS account</p>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background/70 px-3">
              <Mail className="size-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full bg-transparent text-sm outline-none"
                placeholder="you@store.com"
                autoComplete="username"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background/70 px-3">
              <Lock className="size-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full bg-transparent text-sm outline-none"
                placeholder="••••••"
                autoComplete="current-password"
              />
            </div>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
