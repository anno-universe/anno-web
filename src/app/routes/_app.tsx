import { Outlet, Navigate } from "react-router";
import { Suspense, useEffect } from "react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ToastContainer } from "@/components/shared/ToastContainer";
import { useAuthStore } from "@/stores/authStore";
import { TopNav } from "@/components/layout/TopNav";

export default function AppLayout() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col">
        <TopNav />
        <main className="flex-1 overflow-auto">
          <Suspense fallback={<LoadingSpinner />}>
            <Outlet />
          </Suspense>
        </main>
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}
