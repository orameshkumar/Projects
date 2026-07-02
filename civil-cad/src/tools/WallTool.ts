import paper from 'paper'
import { ToolBase } from './ToolBase'
import { snapPoint } from '../canvas/Snap'
import { coordSys } from '../canvas/CoordinateSystem'

export class WallTool extends ToolBase {
  private points: paper.Point[] = []
  private wallGroup: paper.Group | null = null
  private previewGroup: paper.Group | null = null
  private lastClickTime = 0

  private get thicknessPx() {
    return (this.ctx?.wallThickness ?? 200) * coordSys.pxPerMm
  }

  private drawWallSegment(from: paper.Point, to: paper.Point, group: paper.Group, color: paper.Color, dash = false) {
    const half = this.thicknessPx / 2
    const dir = to.subtract(from).normalize()
    const perp = new paper.Point(-dir.y, dir.x).multiply(half)
    const line1 = new paper.Path.Line(from.add(perp), to.add(perp))
    const line2 = new paper.Path.Line(from.subtract(perp), to.subtract(perp))
    ;[line1, line2].forEach((l) => {
      l.strokeColor = color
      l.strokeWidth = 1.5
      if (dash) l.dashArray = [4, 4]
      group.addChild(l)
    })
  }

  private finish() {
    this.previewGroup?.remove()
    this.previewGroup = null
    if (this.wallGroup) this.commit()
    this.wallGroup = null
    this.points = []
  }

  constructor() {
    super()
    this.paperTool.onMouseDown = (e: paper.ToolEvent) => {
      const now = Date.now()
      const isDbl = now - this.lastClickTime < 300
      this.lastClickTime = now
      if (isDbl) { this.finish(); return }

      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      this.points.push(point)

      if (!this.wallGroup) {
        this.wallGroup = new paper.Group()
        this.tagItem(this.wallGroup)
      }

      if (this.points.length >= 2) {
        const last = this.points.length - 1
        this.drawWallSegment(this.points[last - 1], this.points[last], this.wallGroup, this.layerColor())
      }
    }

    this.paperTool.onMouseMove = (e: paper.ToolEvent) => {
      if (this.points.length === 0) return
      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      this.previewGroup?.remove()
      this.previewGroup = new paper.Group()
      this.drawWallSegment(this.points[this.points.length - 1], point, this.previewGroup, new paper.Color(1, 1, 0, 0.6), true)
    }

    this.paperTool.onKeyDown = (e: paper.KeyEvent) => {
      if (e.key === 'escape' || e.key === 'enter') this.finish()
    }
  }
}
