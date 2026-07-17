import { contactFloorY, FloorYStabilizer, type FloorYResolveResult } from "./floor-y-stabilizer";

/**
 * Session virtual floor plane — a fixed horizontal surface for scan, ring, and placement.
 *
 * Real rooms have boxes and clutter on the floor; hit-test may return box tops.
 * The plane Y comes from filtered scan samples (low cluster / camera-ray confirmation)
 * in FloorYStabilizer, then all post-scan ring and model Y values snap to this plane.
 */
export class VirtualFloorPlane {
  private planeY: number | null = null;
  private lockedRawY: number | null = null;
  private scanViewerXZ: { x: number; z: number } | null = null;

  get isEstablished(): boolean {
    return this.planeY != null;
  }

  /** Contact-adjusted plane height used for ring and models (meters). */
  get planeHeightM(): number | null {
    return this.planeY;
  }

  /** Raw locked scan Y before contact bias. */
  get lockedScanY(): number | null {
    return this.lockedRawY;
  }

  get scanOriginXZ(): { x: number; z: number } | null {
    return this.scanViewerXZ;
  }

  /** Establish the virtual plane when floor scan completes. */
  establish(
    lockedY: number,
    viewerXZ?: { x: number; z: number } | null
  ): void {
    this.lockedRawY = lockedY;
    this.planeY = contactFloorY(lockedY);
    if (viewerXZ != null) {
      this.scanViewerXZ = { x: viewerXZ.x, z: viewerXZ.z };
    }
  }

  clear(): void {
    this.planeY = null;
    this.lockedRawY = null;
    this.scanViewerXZ = null;
  }

  /** Resolve ring/placement Y onto the virtual plane (delegates box filtering to stabilizer). */
  resolveY(
    rawHitY: number,
    stabilizer: FloorYStabilizer,
    floorScanComplete: boolean,
    viewerOriginY?: number | null
  ): FloorYResolveResult {
    return stabilizer.resolveY(rawHitY, floorScanComplete, viewerOriginY);
  }
}
