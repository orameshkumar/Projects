import paper from 'paper'
import { ToolBase } from './ToolBase'
import { snapPoint } from '../canvas/Snap'

export class CircleTool extends ToolBase {
  private center: paper.Point | null = null
  private preview: paper.Path | null = null

  constructor() {
    super()
    this.paperTool.onMouseDown = (e: paper.ToolEvent) => {
      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      if (!this.center) {
        this.center = point
      } else {
        const radius = this.center.getDistance(point)
        const circle = new paper.Path.Circle(this.center, radius)
        circle.strokeColor = this.layerColor()
        circle.strokeWidth = 1.5
        this.tagItem(circle)
        this.preview?.remove()
        this.preview = null
        this.center = null
        this.commit()
      }
    }

    this.paperTool.onMouseMove = (e: paper.ToolEvent) => {
      if (!this.center) return
      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      const radius = this.center.getDistance(point)
      this.preview?.remove()
      this.preview = new paper.Path.Circle(this.center, radius)
      this.preview.strokeColor = new paper.Color(1, 1, 0, 0.6)
      this.preview.strokeWidth = 1
      this.preview.dashArray = [4, 4]
    }

    this.paperTool.onKeyDown = (e: paper.KeyEvent) => {
      if (e.key === 'escape') { this.preview?.remove(); this.preview = null; this.center = null }
    }
  }
}
