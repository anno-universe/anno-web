import { Outlet, Navigate } from "react-router";
import { Suspense } from "react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

export default function AuthLayout() {
  const hasToken = !!localStorage.getItem("anno_access");
  if (hasToken) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-semibold tracking-tight text-foreground">
          Anno
        </h1>
        <Suspense fallback={<LoadingSpinner />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
