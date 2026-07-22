import { createBrowserRouter } from "react-router";
import { lazy } from "react";

// Layouts
const AuthLayout = lazy(() => import("@/routes/_auth"));
const AppLayout = lazy(() => import("@/routes/_app"));

// Pages
const IndexPage = lazy(() => import("@/routes/_index"));
const LoginPage = lazy(() => import("@/routes/_auth.login"));
const RegisterPage = lazy(() => import("@/routes/_auth.register"));
const ProjectsPage = lazy(() => import("@/routes/_app.projects._index"));
const ProjectLayout = lazy(
  () => import("@/routes/_app.projects.$projectId")
);
const ProjectIndexRedirect = lazy(
  () => import("@/routes/_app.projects.$projectId._index")
);
const ProjectSettingsPage = lazy(
  () => import("@/routes/_app.projects.$projectId.settings")
);
const ProjectKeypointConfigurationPage = lazy(
  () => import("@/routes/_app.projects.$projectId.keypoints")
);
const ProjectMembersPage = lazy(
  () => import("@/routes/_app.projects.$projectId.members")
);
const ProjectDeveloperPage = lazy(
  () => import("@/routes/_app.projects.$projectId.developer")
);
const ProjectInferencePage = lazy(
  () => import("@/routes/_app.projects.$projectId.inference")
);
const ProjectInferenceRunDetailPage = lazy(
  () =>
    import("@/routes/_app.projects.$projectId.inference.$runId")
);
const ProjectExportsPage = lazy(
  () => import("@/routes/_app.projects.$projectId.exports")
);
const UploadPage = lazy(
  () => import("@/routes/_app.projects.$projectId.upload")
);
const ImagesPage = lazy(
  () => import("@/routes/_app.projects.$projectId.images._index")
);
const AnnotatePage = lazy(
  () =>
    import("@/routes/_app.projects.$projectId.images.$imageId.annotate")
);

export const router = createBrowserRouter([
  {
    path: "/",
    Component: IndexPage,
  },
  {
    Component: AuthLayout,
    children: [
      {
        path: "login",
        Component: LoginPage,
      },
      {
        path: "register",
        Component: RegisterPage,
      },
    ],
  },
  {
    Component: AppLayout,
    children: [
      {
        path: "projects",
        Component: ProjectsPage,
        handle: { breadcrumb: "Projects" } as any,
      },
      {
        path: "projects/:projectId",
        Component: ProjectLayout,
        handle: { dynamicKey: "project" } as any,
        children: [
          {
            index: true,
            Component: ProjectIndexRedirect,
          },
          {
            path: "upload",
            Component: UploadPage,
            handle: { breadcrumb: "Upload" } as any,
          },
          {
            path: "images",
            Component: ImagesPage,
            handle: { breadcrumb: "Images" } as any,
          },
          {
            path: "settings",
            Component: ProjectSettingsPage,
            handle: { breadcrumb: "Settings" } as any,
          },
          {
            path: "keypoints",
            Component: ProjectKeypointConfigurationPage,
            handle: { breadcrumb: "Keypoints" } as any,
          },
          {
            path: "members",
            Component: ProjectMembersPage,
            handle: { breadcrumb: "Members" } as any,
          },
          {
            path: "developer",
            Component: ProjectDeveloperPage,
            handle: { breadcrumb: "Developer" } as any,
          },
          {
            path: "inference",
            Component: ProjectInferencePage,
            handle: { breadcrumb: "Inference" } as any,
          },
          {
            path: "inference/:runId",
            Component: ProjectInferenceRunDetailPage,
            handle: { dynamicKey: "inferenceRun" } as any,
          },
          {
            path: "exports",
            Component: ProjectExportsPage,
            handle: { breadcrumb: "Exports" } as any,
          },
        ],
      },
      {
        path: "projects/:projectId/images/:imageId/annotate",
        Component: AnnotatePage,
        handle: { dynamicKey: "image" } as any,
      },
    ],
  },
]);
