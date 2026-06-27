import { Navigate } from "react-router";

export default function IndexPage() {
  // Check for stored token to decide redirect target
  const hasToken = !!localStorage.getItem("anno_access");
  return <Navigate to={hasToken ? "/projects" : "/login"} replace />;
}
