import paper from 'paper'
import { ToolBase } from './ToolBase'
import { snapPoint } from '../canvas/Snap'

export class RectangleTool extends ToolBase {
  private start: paper.Point | null = null
  private preview: paper.Path | null = null

  constructor() {
    super()
    this.paperTool.onMouseDown = (e: paper.ToolEvent) => {
      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      if (!this.start) {
        this.start = point
      } else {
        const rect = new paper.Path.Rectangle(this.start, point)
        rect.strokeColor = this.layerColor()
        rect.strokeWidth = 1.5
        this.tagItem(rect)
        this.preview?.remove()
        this.preview = null
        this.start = null
        this.commit()
      }
    }

    this.paperTool.onMouseMove = (e: paper.ToolEvent) => {
      if (!this.start) return
      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      this.preview?.remove()
      this.preview = new paper.Path.Rectangle(this.start, point)
      this.preview.strokeColor = new paper.Color(1, 1, 0, 0.6)
      this.preview.strokeWidth = 1
      this.preview.dashArray = [4, 4]
    }

    this.paperTool.onKeyDown = (e: paper.KeyEvent) => {
      if (e.key === 'escape') { this.preview?.remove(); this.preview = null; this.start = null }
    }
  }
}
