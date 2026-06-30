/**
 * Coordinate transforms between image pixel space and OpenLayers map space.
 *
 * Image coordinate system: origin at top-left, x → right, y → down.
 * OpenLayers' default view projection is y-up, and a StaticImage drawn into
 * imageExtent [0, 0, width, height] places the image's top row at map-y =
 * height and its bottom row at map-y = 0. So map-y is the vertical MIRROR of
 * image-pixel-y: converting between the two requires the flip y → height − y.
 */

import type Geometry from "ol/geom/Geometry";

export interface ImagePoint {
  x: number;
  y: number;
}

export function createImageExtent(
  width: number,
  height: number
): [number, number, number, number] {
  return [0, 0, width, height];
}

export function imageToMap(point: ImagePoint, height: number): [number, number] {
  return [point.x, height - point.y];
}

export function mapToImage(coordinate: number[], height: number): ImagePoint {
  return { x: coordinate[0], y: height - coordinate[1] };
}

/**
 * Flip a geometry's y-coordinates between image-pixel space (origin top-left,
 * y-down) and OpenLayers map space (y-up), in place. The transform y → height − y
 * is self-inverse, so the same call converts in either direction.
 */
export function flipGeometryY(geometry: Geometry, height: number): void {
  geometry.applyTransform((input, output, dimension = 2) => {
    const out = output ?? input;
    for (let i = 0; i < input.length; i += dimension) {
      out[i] = input[i];
      out[i + 1] = height - input[i + 1];
    }
    return out;
  });
}
