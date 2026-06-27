import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "@/stores/authStore";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      await register(username.trim(), email.trim(), password);
      navigate("/projects", { replace: true });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Registration failed.";
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
          autoComplete="username"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          autoComplete="email"
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
          autoComplete="new-password"
          required
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? <LoadingSpinner /> : "Create account"}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
