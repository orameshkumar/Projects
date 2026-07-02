import paper from 'paper'
import { ToolBase } from './ToolBase'
import { snapPoint } from '../canvas/Snap'
import { coordSys } from '../canvas/CoordinateSystem'

const WITNESS_OFFSET_PX = 10
const DIM_LINE_OFFSET_PX = 24
const ARROW_SIZE_PX = 6

export class DimensionTool extends ToolBase {
  private start: paper.Point | null = null
  private preview: paper.Group | null = null

  private buildDimension(p1: paper.Point, p2: paper.Point, isPreview = false): paper.Group {
    const group = new paper.Group()
    const color = isPreview ? new paper.Color(1, 1, 0, 0.6) : new paper.Color('#fbbf24')
    const sw = isPreview ? 1 : 1.2

    // Direction & perpendicular
    const dir = p2.subtract(p1).normalize()
    const perp = new paper.Point(-dir.y, dir.x)

    const offset = perp.multiply(DIM_LINE_OFFSET_PX)
    const d1 = p1.add(offset)
    const d2 = p2.add(offset)

    // Witness lines
    const w1 = new paper.Path.Line(p1.add(perp.multiply(WITNESS_OFFSET_PX)), d1.add(perp.multiply(4)))
    const w2 = new paper.Path.Line(p2.add(perp.multiply(WITNESS_OFFSET_PX)), d2.add(perp.multiply(4)))

    // Dimension line
    const dimLine = new paper.Path.Line(d1, d2)

    // Arrows
    const makeArrow = (base: paper.Point, direction: paper.Point) => {
      const left = base.add(direction.multiply(ARROW_SIZE_PX)).add(perp.multiply(ARROW_SIZE_PX / 2))
      const right = base.add(direction.multiply(ARROW_SIZE_PX)).subtract(perp.multiply(ARROW_SIZE_PX / 2))
      const a = new paper.Path([base, left, right])
      a.closed = true
      a.fillColor = color
      a.strokeColor = color
      return a
    }

    const arrow1 = makeArrow(d1, dir)
    const arrow2 = makeArrow(d2, dir.multiply(-1))

    // Distance label
    const distPx = p1.getDistance(p2)
    const distMm = distPx / coordSys.pxPerMm
    const label = new paper.PointText(d1.add(d2).divide(2).add(perp.multiply(8)))
    label.content = distMm >= 1000
      ? `${(distMm / 1000).toFixed(2)}m`
      : `${Math.round(distMm)}mm`
    label.fillColor = color
    label.fontSize = 11
    label.justification = 'center'

    ;[w1, w2, dimLine].forEach((p) => {
      p.strokeColor = color
      p.strokeWidth = sw
      if (isPreview) p.dashArray = [4, 4]
      group.addChild(p)
    })
    group.addChild(arrow1)
    group.addChild(arrow2)
    group.addChild(label)

    return group
  }

  constructor() {
    super()
    this.paperTool.onMouseDown = (e: paper.ToolEvent) => {
      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      if (!this.start) {
        this.start = point
      } else {
        const dim = this.buildDimension(this.start, point)
        this.tagItem(dim)
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
      this.preview = this.buildDimension(this.start, point, true)
    }

    this.paperTool.onKeyDown = (e: paper.KeyEvent) => {
      if (e.key === 'escape') { this.preview?.remove(); this.preview = null; this.start = null }
    }
  }
}
