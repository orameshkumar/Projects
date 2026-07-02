// 1 world unit = 1mm. Screen pixels depend on zoom & pan.

export class CoordinateSystem {
  zoom: number = 1
  panX: number = 0
  panY: number = 0
  // pixels per mm at zoom=1
  private readonly BASE_PX_PER_MM = 2

  get pxPerMm() { return this.BASE_PX_PER_MM * this.zoom }

  worldToScreen(wx: number, wy: number): [number, number] {
    return [
      wx * this.pxPerMm + this.panX,
      wy * this.pxPerMm + this.panY,
    ]
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    return [
      (sx - this.panX) / this.pxPerMm,
      (sy - this.panY) / this.pxPerMm,
    ]
  }

  // Snap world coordinate to grid (gridSize in mm)
  snapToGrid(wx: number, wy: number, gridSize: number): [number, number] {
    return [
      Math.round(wx / gridSize) * gridSize,
      Math.round(wy / gridSize) * gridSize,
    ]
  }
}

export const coordSys = new CoordinateSystem()
