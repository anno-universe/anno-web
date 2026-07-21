import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "@/stores/authStore";
import { Spinner } from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

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
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? <Spinner /> : "Create account"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </FieldGroup>
    </form>
  );
}
