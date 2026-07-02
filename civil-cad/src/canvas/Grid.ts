import paper from 'paper'
import { coordSys } from './CoordinateSystem'

let gridGroup: paper.Group | null = null

export function drawGrid(canvasWidth: number, canvasHeight: number) {
  if (gridGroup) gridGroup.remove()
  gridGroup = new paper.Group()
  gridGroup.locked = true

  const minorMm = 100
  const majorMm = 500

  const pxMinor = minorMm * coordSys.pxPerMm

  const startX = ((coordSys.panX % pxMinor) + pxMinor) % pxMinor
  const startY = ((coordSys.panY % pxMinor) + pxMinor) % pxMinor

  for (let x = startX - pxMinor; x <= canvasWidth + pxMinor; x += pxMinor) {
    const wx = (x - coordSys.panX) / coordSys.pxPerMm
    const isMajor = Math.abs(wx % majorMm) < 1
    const line = new paper.Path.Line(new paper.Point(x, 0), new paper.Point(x, canvasHeight))
    line.strokeColor = new paper.Color(isMajor ? '#334155' : '#1e293b')
    line.strokeWidth = isMajor ? 1 : 0.5
    gridGroup.addChild(line)
  }

  for (let y = startY - pxMinor; y <= canvasHeight + pxMinor; y += pxMinor) {
    const wy = (y - coordSys.panY) / coordSys.pxPerMm
    const isMajor = Math.abs(wy % majorMm) < 1
    const line = new paper.Path.Line(new paper.Point(0, y), new paper.Point(canvasWidth, y))
    line.strokeColor = new paper.Color(isMajor ? '#334155' : '#1e293b')
    line.strokeWidth = isMajor ? 1 : 0.5
    gridGroup.addChild(line)
  }

  gridGroup.sendToBack()
}

export function removeGrid() {
  if (gridGroup) { gridGroup.remove(); gridGroup = null }
}
