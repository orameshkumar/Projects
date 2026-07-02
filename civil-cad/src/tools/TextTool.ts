import paper from 'paper'
import { ToolBase } from './ToolBase'
import { snapPoint } from '../canvas/Snap'

export class TextTool extends ToolBase {
  constructor() {
    super()
    this.paperTool.onMouseDown = (e: paper.ToolEvent) => {
      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)

      // Prompt for text content
      const content = window.prompt('Enter label text:')
      if (!content?.trim()) return

      const fontSize = (this.ctx as { fontSize?: number })?.fontSize ?? 14

      const text = new paper.PointText(point)
      text.content = content.trim()
      text.fillColor = this.layerColor()
      text.fontSize = fontSize
      text.fontFamily = 'monospace'
      this.tagItem(text)
      this.commit()
    }
  }
}
