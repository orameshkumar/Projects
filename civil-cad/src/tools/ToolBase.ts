import paper from 'paper'
import { history } from '../history/HistoryManager'

export interface ToolContext {
  activeLayerId: string
  layerColor: (id: string) => string
  snapEnabled: boolean
  wallThickness: number
  hatchPattern: string
  fontSize: number
  symbolType: string
}

export abstract class ToolBase {
  protected paperTool: paper.Tool
  protected ctx!: ToolContext

  constructor() {
    this.paperTool = new paper.Tool()
  }

  setContext(ctx: ToolContext) { this.ctx = ctx }

  activate() { this.paperTool.activate() }

  deactivate() {
    // no-op; paper handles tool switching
  }

  protected layerColor(): paper.Color {
    const hex = this.ctx?.layerColor(this.ctx.activeLayerId) ?? '#ffffff'
    return new paper.Color(hex)
  }

  protected tagItem(item: paper.Item) {
    item.data = { ...item.data, layerId: this.ctx?.activeLayerId }
  }

  protected commit() {
    history.snapshot()
  }
}
