import { useCallback, useEffect, useRef, useState } from "react";
import { getProject } from "@/api/projects";
import { getImage } from "@/api/images";
import { getAnnotations } from "@/api/annotations";
import { getOperations } from "@/api/operations";
import { getImageTags, getProjectTags } from "@/api/tags";
import type { Annotation2DOutput } from "@/types/annotation";
import type { Image2DOutput } from "@/types/image";
import type { OperationOutput } from "@/types/operation";
import type { ProjectOutput } from "@/types/project";
import type { ImageTagOutput, TagOutput } from "@/types/tag";

export function useAnnotationPageData(projectId: number, imageId: number) {
  const [project, setProject] = useState<ProjectOutput | null>(null);
  const [image, setImage] = useState<Image2DOutput | null>(null);
  const [annotations, setAnnotations] = useState<Annotation2DOutput[]>([]);
  const [operations, setOperations] = useState<OperationOutput[]>([]);
  const [projectTags, setProjectTags] = useState<TagOutput[]>([]);
  const [imageTags, setImageTags] = useState<ImageTagOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const resourceKey = `${projectId}:${imageId}`;
  const resourceKeyRef = useRef(resourceKey);
  resourceKeyRef.current = resourceKey;

  const loadAll = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");

    void getOperations(projectId, imageId, { limit: 500 }, { signal })
      .then((response) => {
        if (!signal.aborted) setOperations(response.items);
      })
      .catch(() => {});

    void Promise.all([
      getProjectTags(
        projectId,
        { limit: 200, is_active: true },
        { signal }
      ),
      getImageTags(projectId, imageId, { signal }),
    ])
      .then(([projectTagResponse, imageTagResponse]) => {
        if (signal.aborted) return;
        setProjectTags(projectTagResponse.items);
        setImageTags(imageTagResponse);
      })
      .catch(() => {});

    try {
      const [projectResponse, imageResponse, annotationResponse] =
        await Promise.all([
          getProject(projectId, { signal }),
          getImage(projectId, imageId, { signal }),
          getAnnotations(
            projectId,
            imageId,
            { limit: 500 },
            { signal }
          ),
        ]);
      if (signal.aborted) return;
      setProject(projectResponse);
      setImage(imageResponse);
      setAnnotations(annotationResponse.items);
    } catch (loadError: unknown) {
      if (signal.aborted) return;
      setError(loadError instanceof Error ? loadError.message : "Failed to load");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [projectId, imageId]);

  const reload = useCallback(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    void loadAll(controller.signal);
  }, [loadAll]);

  useEffect(() => {
    reload();
    return () => requestRef.current?.abort();
  }, [reload]);

  const refreshOperations = useCallback(async () => {
    const requestedResource = resourceKey;
    try {
      const response = await getOperations(projectId, imageId, { limit: 500 });
      if (resourceKeyRef.current === requestedResource) {
        setOperations(response.items);
      }
    } catch {
      // Operation history is auxiliary; annotation editing remains available.
    }
  }, [projectId, imageId, resourceKey]);

  return {
    project,
    image,
    annotations,
    setAnnotations,
    operations,
    projectTags,
    imageTags,
    setImageTags,
    loading,
    error,
    reload,
    refreshOperations,
  };
}
