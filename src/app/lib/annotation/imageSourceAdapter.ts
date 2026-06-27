import StaticImage from "ol/source/ImageStatic";

export type ImageSourceKind =
  | "static-image"
  | "zoomify"
  | "dzi"
  | "iiif"
  | "xyz";

export interface ImageSourceConfig {
  kind: ImageSourceKind;
  width: number;
  height: number;
  url?: string;
  tileUrlTemplate?: string;
  tileSize?: number;
  maxZoom?: number;
}

export function createStaticImageSource(
  config: ImageSourceConfig
): StaticImage {
  if (config.kind !== "static-image" || !config.url) {
    throw new Error("static-image kind requires a url");
  }
  return new StaticImage({
    url: config.url,
    imageExtent: [0, 0, config.width, config.height],
    projection: undefined, // use default view projection
  });
}
