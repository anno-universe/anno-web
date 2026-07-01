import { Outlet, Navigate } from "react-router";
import { Suspense } from "react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

export default function AuthLayout() {
  const hasToken = !!localStorage.getItem("anno_access");
  if (hasToken) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">Anno</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoadingSpinner />}>
            <Outlet />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
