import paper from 'paper'
import { ToolBase } from './ToolBase'
import { snapPoint } from '../canvas/Snap'

// 3-click arc: start → end → through-point
export class ArcTool extends ToolBase {
  private points: paper.Point[] = []
  private preview: paper.Path | null = null

  constructor() {
    super()
    this.paperTool.onMouseDown = (e: paper.ToolEvent) => {
      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      this.points.push(point)

      if (this.points.length === 3) {
        const [p1, p2, p3] = this.points
        const arc = new paper.Path()
        arc.moveTo(p1)
        arc.arcTo(p3, p2)
        arc.strokeColor = this.layerColor()
        arc.strokeWidth = 1.5
        this.tagItem(arc)
        this.preview?.remove()
        this.preview = null
        this.points = []
        this.commit()
      }
    }

    this.paperTool.onMouseMove = (e: paper.ToolEvent) => {
      if (this.points.length === 0) return
      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      this.preview?.remove()

      if (this.points.length === 1) {
        this.preview = new paper.Path.Line(this.points[0], point)
      } else {
        this.preview = new paper.Path()
        this.preview.moveTo(this.points[0])
        this.preview.arcTo(point, this.points[1])
      }
      this.preview.strokeColor = new paper.Color(1, 1, 0, 0.6)
      this.preview.strokeWidth = 1
      this.preview.dashArray = [4, 4]
    }

    this.paperTool.onKeyDown = (e: paper.KeyEvent) => {
      if (e.key === 'escape') { this.preview?.remove(); this.preview = null; this.points = [] }
    }
  }
}
