import paper from 'paper'
import { ToolBase } from './ToolBase'
import { snapPoint } from '../canvas/Snap'

type Pattern = 'concrete' | 'soil' | 'gravel' | 'brick'

function generateHatch(bounds: paper.Rectangle, pattern: Pattern, color: paper.Color): paper.Group {
  const group = new paper.Group()
  const { x, y, width, height } = bounds

  if (pattern === 'soil') {
    // Diagonal lines 45°
    const spacing = 12
    const count = Math.ceil((width + height) / spacing) * 2
    for (let i = -count; i < count; i++) {
      const x1 = x + i * spacing
      const line = new paper.Path.Line(
        new paper.Point(x1, y),
        new paper.Point(x1 + height, y + height)
      )
      line.strokeColor = color
      line.strokeWidth = 0.8
      group.addChild(line)
    }
  } else if (pattern === 'concrete') {
    // Cross-hatch + random aggregate dots
    const spacing = 16
    for (let cx = x; cx <= x + width; cx += spacing) {
      const line = new paper.Path.Line(new paper.Point(cx, y), new paper.Point(cx, y + height))
      line.strokeColor = color; line.strokeWidth = 0.6; group.addChild(line)
    }
    for (let cy = y; cy <= y + height; cy += spacing) {
      const line = new paper.Path.Line(new paper.Point(x, cy), new paper.Point(x + width, cy))
      line.strokeColor = color; line.strokeWidth = 0.6; group.addChild(line)
    }
    // Random aggregate
    const seed = Math.floor(x + y)
    for (let i = 0; i < 40; i++) {
      const px = x + ((seed * (i * 7 + 3)) % width)
      const py = y + ((seed * (i * 11 + 5)) % height)
      const dot = new paper.Path.Circle(new paper.Point(px, py), 2 + (i % 3))
      dot.fillColor = color; group.addChild(dot)
    }
  } else if (pattern === 'gravel') {
    // Random small ovals
    const seed = Math.floor(x + y)
    for (let i = 0; i < 60; i++) {
      const px = x + 4 + ((seed * (i * 13 + 7)) % (width - 8))
      const py = y + 4 + ((seed * (i * 17 + 3)) % (height - 8))
      const rx = 4 + (i % 4)
      const ry = 2 + (i % 3)
      const oval = new paper.Path.Ellipse(new paper.Rectangle(
        new paper.Point(px - rx, py - ry),
        new paper.Size(rx * 2, ry * 2)
      ))
      oval.strokeColor = color; oval.strokeWidth = 0.8; group.addChild(oval)
    }
  } else if (pattern === 'brick') {
    // Horizontal courses with offset joints
    const courseH = 18
    const brickW = 36
    for (let row = 0; y + row * courseH <= y + height; row++) {
      const cy = y + row * courseH
      const offset = (row % 2) * brickW / 2
      // Horizontal mortar line
      const hLine = new paper.Path.Line(new paper.Point(x, cy), new paper.Point(x + width, cy))
      hLine.strokeColor = color; hLine.strokeWidth = 0.8; group.addChild(hLine)
      // Vertical joints
      for (let bx = x - offset; bx <= x + width; bx += brickW) {
        const vLine = new paper.Path.Line(new paper.Point(bx, cy), new paper.Point(bx, cy + courseH))
        vLine.strokeColor = color; vLine.strokeWidth = 0.8; group.addChild(vLine)
      }
    }
  }

  return group
}

export class HatchTool extends ToolBase {
  private boundary: paper.Point[] = []
  private preview: paper.Path | null = null

  constructor() {
    super()
    this.paperTool.onMouseDown = (e: paper.ToolEvent) => {
      const now = Date.now()
      const isDbl = now - this.lastClickTime < 300
      this.lastClickTime = now
      if (isDbl && this.boundary.length >= 3) { this.commitHatch(); return }

      const { point } = snapPoint(e.point.x, e.point.y, this.ctx?.snapEnabled ?? true)
      this.boundary.push(point)

      // Draw boundary path
      this.preview?.remove()
      if (this.boundary.length >= 2) {
        this.preview = new paper.Path(this.boundary)
        this.preview.closed = true
        this.preview.strokeColor = new paper.Color(1, 1, 0, 0.6)
        this.preview.strokeWidth = 1
        this.preview.dashArray = [4, 4]
      }
    }

    this.paperTool.onKeyDown = (e: paper.KeyEvent) => {
      if (e.key === 'enter' && this.boundary.length >= 3) {
        this.commitHatch()
      }
      if (e.key === 'escape') {
        this.preview?.remove(); this.preview = null; this.boundary = []
      }
    }
  }

  private lastClickTime = 0

  private commitHatch() {
    this.preview?.remove()
    this.preview = null

    const clip = new paper.Path(this.boundary)
    clip.closed = true
    clip.strokeColor = this.layerColor()
    clip.strokeWidth = 1.5

    const pattern = (this.ctx?.hatchPattern ?? 'concrete') as Pattern
    const hatch = generateHatch(clip.bounds, pattern, new paper.Color(this.layerColor().toCSS(true) + '99'))

    // Clip hatch to boundary
    const clipCopy = clip.clone()
    hatch.clipMask = false
    const group = new paper.Group([clipCopy, hatch])
    group.clipped = true
    this.tagItem(group)
    this.commit()
    this.boundary = []
  }
}
