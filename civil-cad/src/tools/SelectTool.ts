import paper from 'paper'
import { ToolBase } from './ToolBase'

export class SelectTool extends ToolBase {
  private selected: paper.Item | null = null

  constructor() {
    super()
    this.paperTool.onMouseDown = (e: paper.ToolEvent) => {
      const hit = paper.project.hitTest(e.point, {
        fill: true, stroke: true, tolerance: 6,
        match: (r: paper.HitResult) => r.item.data?.layerId !== 'titleblock',
      })

      // Deselect previous
      if (this.selected) { this.selected.selected = false; this.selected = null }

      if (hit) {
        const item = hit.item
        item.selected = true
        this.selected = item
      }
    }

    this.paperTool.onMouseDrag = (e: paper.ToolEvent) => {
      if (this.selected) {
        this.selected.position = this.selected.position.add(e.delta)
      }
    }

    this.paperTool.onMouseUp = () => {
      if (this.selected) this.commit()
    }

    this.paperTool.onKeyDown = (e: paper.KeyEvent) => {
      if ((e.key === 'delete' || e.key === 'backspace') && this.selected) {
        this.selected.remove()
        this.selected = null
        this.commit()
      }
      if (e.key === 'escape' && this.selected) {
        this.selected.selected = false
        this.selected = null
      }
    }
  }
}
