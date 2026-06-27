/**
 * Coordinate transforms between image pixel space and OpenLayers map space.
 *
 * Image coordinate system: origin at top-left, x → right, y → down.
 * OpenLayers StaticImage with imageExtent [0, 0, width, height] maps
 * image pixels 1:1 to map coordinates. No Y-flip needed.
 */

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

export function imageToMap(point: ImagePoint): [number, number] {
  return [point.x, point.y];
}

export function mapToImage(coordinate: number[]): ImagePoint {
  return { x: coordinate[0], y: coordinate[1] };
}
