import { Outlet, Navigate } from "react-router";
import { Suspense, useEffect } from "react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/authStore";
import { TopNav } from "@/components/layout/TopNav";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { BreadcrumbProvider } from "@/lib/breadcrumb";

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
      <TooltipProvider delayDuration={300}>
        <div className="flex min-h-screen flex-col">
          <TopNav />
          <BreadcrumbProvider>
            <Breadcrumbs />
            <main className="flex-1 overflow-auto">
              <Suspense fallback={<LoadingSpinner />}>
                <Outlet />
              </Suspense>
            </main>
          </BreadcrumbProvider>
          <Toaster position="bottom-right" />
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  );
}
