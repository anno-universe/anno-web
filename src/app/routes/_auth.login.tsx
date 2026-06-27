import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "@/stores/authStore";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate("/projects", { replace: true });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium text-foreground">
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Enter your username"
          autoComplete="username"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-foreground">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? <LoadingSpinner /> : "Sign in"}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="font-medium text-primary underline underline-offset-4">
          Register
        </Link>
      </p>
    </form>
  );
}
