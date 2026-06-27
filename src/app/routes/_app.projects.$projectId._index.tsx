import { useParams, Navigate } from "react-router";

export default function ProjectIndexPage() {
  const { projectId } = useParams();
  return <Navigate to={`/projects/${projectId}/images`} replace />;
}
