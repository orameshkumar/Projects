import paper from 'paper'
import { ToolBase } from './ToolBase'
import { snapPoint } from '../canvas/Snap'

export class PolylineTool extends ToolBase {
  private path: paper.Path | null = null
  private previewSeg: paper.Path | null = null
  private lastClickTime = 0

  private finish() {
    this.previewSeg?.remove()
    this.previewSeg = null
    if (this.path) this.commit()
    this.path = null
  }

  constructor() {
    super()
    this.paperTool.onMouseDown = (e: paper.ToolEvent) => {
      const now = Date.now()
      const isDbl = now - this.lastClickTime < 300
      this.lastClickTime = now

      if (isDbl) { this.finish(); return }

      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      if (!this.path) {
        this.path = new paper.Path()
        this.path.strokeColor = this.layerColor()
        this.path.strokeWidth = 1.5
        this.tagItem(this.path)
        this.path.moveTo(point)
      } else {
        this.path.lineTo(point)
      }
    }

    this.paperTool.onMouseMove = (e: paper.ToolEvent) => {
      if (!this.path || this.path.segments.length === 0) return
      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      this.previewSeg?.remove()
      const last = this.path.lastSegment.point
      this.previewSeg = new paper.Path.Line(last, point)
      this.previewSeg.strokeColor = new paper.Color(1, 1, 0, 0.6)
      this.previewSeg.strokeWidth = 1
      this.previewSeg.dashArray = [4, 4]
    }

    this.paperTool.onKeyDown = (e: paper.KeyEvent) => {
      if (e.key === 'escape' || e.key === 'enter') this.finish()
    }
  }
}
