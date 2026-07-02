import paper from 'paper'
import { coordSys } from './CoordinateSystem'

const SNAP_RADIUS_PX = 12

export interface SnapResult {
  point: paper.Point
  snapped: boolean
  snapType: 'grid' | 'endpoint' | 'midpoint' | 'none'
}

// Find nearest endpoint or midpoint on existing items within snap radius
function findObjectSnap(screenPt: paper.Point): paper.Point | null {
  let best: paper.Point | null = null
  let bestDist = SNAP_RADIUS_PX

  const check = (p: paper.Point) => {
    const d = screenPt.getDistance(p)
    if (d < bestDist) { bestDist = d; best = p }
  }

  paper.project.activeLayer.children.forEach((item) => {
    if (item instanceof paper.Path) {
      item.segments.forEach((seg) => check(seg.point))
      // midpoints of each segment
      for (let i = 0; i < item.segments.length - 1; i++) {
        const mid = item.segments[i].point.add(item.segments[i + 1].point).divide(2)
        check(mid)
      }
    } else if (item instanceof paper.Group) {
      item.children.forEach((child) => {
        if (child instanceof paper.Path) {
          child.segments.forEach((seg) => check(seg.point))
        }
      })
    }
  })

  return best
}

export function snapPoint(
  screenX: number,
  screenY: number,
  snapEnabled: boolean,
  gridSize = 100,
): SnapResult {
  const screenPt = new paper.Point(screenX, screenY)

  if (!snapEnabled) {
    return { point: new paper.Point(screenX, screenY), snapped: false, snapType: 'none' }
  }

  // Object snap first (higher priority)
  const objSnap = findObjectSnap(screenPt)
  if (objSnap) {
    return { point: objSnap, snapped: true, snapType: 'endpoint' }
  }

  // Grid snap
  const [wx, wy] = coordSys.screenToWorld(screenX, screenY)
  const [gwx, gwy] = coordSys.snapToGrid(wx, wy, gridSize)
  const [gsx, gsy] = coordSys.worldToScreen(gwx, gwy)
  return {
    point: new paper.Point(gsx, gsy),
    snapped: true,
    snapType: 'grid',
  }
}
