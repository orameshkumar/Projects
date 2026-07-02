import paper from 'paper'
import { ToolBase } from './ToolBase'
import { snapPoint } from '../canvas/Snap'
import { coordSys } from '../canvas/CoordinateSystem'

export type SymbolType = 'door-single' | 'door-double' | 'window-sliding' | 'window-fixed'

function buildSymbol(type: SymbolType, origin: paper.Point, sizePx: number, color: paper.Color): paper.Group {
  const g = new paper.Group()
  const s = sizePx

  switch (type) {
    case 'door-single': {
      // Door frame line
      const frame = new paper.Path.Line(origin, origin.add(new paper.Point(s, 0)))
      // Swing arc (quarter circle)
      const arc = new paper.Path()
      arc.moveTo(origin.add(new paper.Point(s, 0)))
      arc.arcTo(origin.add(new paper.Point(s, s)), origin.add(new paper.Point(0, s)))
      // Radial line showing door position
      const swing = new paper.Path.Line(origin, origin.add(new paper.Point(0, s)))
      ;[frame, arc, swing].forEach(p => { p.strokeColor = color; p.strokeWidth = 1.5; g.addChild(p) })
      break
    }
    case 'door-double': {
      const cx = origin.add(new paper.Point(s, 0))
      const frame = new paper.Path.Line(origin, origin.add(new paper.Point(s * 2, 0)))
      // Left leaf
      const arc1 = new paper.Path()
      arc1.moveTo(origin)
      arc1.arcTo(cx.add(new paper.Point(-s, s)), cx)
      // Right leaf
      const arc2 = new paper.Path()
      arc2.moveTo(cx)
      arc2.arcTo(cx.add(new paper.Point(s, s)), origin.add(new paper.Point(s * 2, 0)))
      ;[frame, arc1, arc2].forEach(p => { p.strokeColor = color; p.strokeWidth = 1.5; g.addChild(p) })
      break
    }
    case 'window-sliding': {
      // Outer frame
      const outer = new paper.Path.Rectangle(origin, new paper.Size(s, s * 0.3))
      // Two sliding panes
      const mid = s / 2
      const pane1 = new paper.Path.Rectangle(origin.add(new paper.Point(2, 2)), new paper.Size(mid - 3, s * 0.3 - 4))
      const pane2 = new paper.Path.Rectangle(origin.add(new paper.Point(mid + 1, 2)), new paper.Size(mid - 3, s * 0.3 - 4))
      ;[outer, pane1, pane2].forEach(p => { p.strokeColor = color; p.strokeWidth = 1.5; g.addChild(p) })
      break
    }
    case 'window-fixed': {
      // Frame + cross
      const outer = new paper.Path.Rectangle(origin, new paper.Size(s, s * 0.3))
      const h = s * 0.3
      const cross = new paper.Path.Line(
        origin.add(new paper.Point(s / 2, 0)),
        origin.add(new paper.Point(s / 2, h))
      )
      ;[outer, cross].forEach(p => { p.strokeColor = color; p.strokeWidth = 1.5; g.addChild(p) })
      break
    }
  }

  return g
}

export class SymbolTool extends ToolBase {
  private preview: paper.Group | null = null

  constructor() {
    super()

    this.paperTool.onMouseMove = (e: paper.ToolEvent) => {
      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      this.preview?.remove()
      const sizePx = 900 * coordSys.pxPerMm / 1000   // ~900mm door
      const sType = ((this.ctx as { symbolType?: string })?.symbolType ?? 'door-single') as SymbolType
      this.preview = buildSymbol(sType, point, sizePx, new paper.Color(1, 1, 0, 0.6))
    }

    this.paperTool.onMouseDown = (e: paper.ToolEvent) => {
      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      this.preview?.remove()
      this.preview = null

      const sizePx = 900 * coordSys.pxPerMm / 1000
      const sType = ((this.ctx as { symbolType?: string })?.symbolType ?? 'door-single') as SymbolType
      const sym = buildSymbol(sType, point, sizePx, this.layerColor())
      this.tagItem(sym)
      this.commit()
    }

    this.paperTool.onKeyDown = (e: paper.KeyEvent) => {
      if (e.key === 'escape') { this.preview?.remove(); this.preview = null }
    }
  }
}
