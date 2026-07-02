import paper from 'paper'
import type { TitleBlockData } from '../store/useDrawingStore'
import { coordSys } from '../canvas/CoordinateSystem'

let tbGroup: paper.Group | null = null

const PAPER_SIZES = {
  A3: { w: 420, h: 297 },
  A4: { w: 297, h: 210 },
}

export function drawTitleBlock(data: TitleBlockData, canvasW: number, canvasH: number) {
  if (tbGroup) tbGroup.remove()
  tbGroup = new paper.Group()
  tbGroup.data = { layerId: 'titleblock' }
  tbGroup.locked = true

  const { w: pw, h: ph } = PAPER_SIZES[data.paperSize]
  const pxW = pw * coordSys.pxPerMm
  const pxH = ph * coordSys.pxPerMm

  // Centre on canvas
  const ox = (canvasW - pxW) / 2
  const oy = (canvasH - pxH) / 2

  const white = new paper.Color('#e2e8f0')
  const thin = 0.8
  const thick = 2

  // Border
  const border = new paper.Path.Rectangle(
    new paper.Point(ox + 20 * coordSys.pxPerMm, oy + 10 * coordSys.pxPerMm),
    new paper.Size(pxW - 30 * coordSys.pxPerMm, pxH - 20 * coordSys.pxPerMm)
  )
  border.strokeColor = white
  border.strokeWidth = thick
  tbGroup.addChild(border)

  // Title block box (bottom right, 180×50mm)
  const tbW = 180 * coordSys.pxPerMm
  const tbH = 50 * coordSys.pxPerMm
  const tbX = ox + pxW - 10 * coordSys.pxPerMm - tbW
  const tbY = oy + pxH - 10 * coordSys.pxPerMm - tbH

  const box = new paper.Path.Rectangle(new paper.Point(tbX, tbY), new paper.Size(tbW, tbH))
  box.strokeColor = white
  box.strokeWidth = thin
  tbGroup.addChild(box)

  // Fields
  const fields = [
    { label: 'PROJECT', value: data.project, y: tbY + 8 },
    { label: 'TITLE',   value: data.title,   y: tbY + 20 },
    { label: 'SCALE',   value: data.scale,   y: tbY + 32 },
    { label: 'DATE',    value: data.date,    y: tbY + 44 },
    { label: 'DRAWN',   value: data.drawnBy, y: tbY + 32, x2: true },
    { label: 'REV',     value: data.revision,y: tbY + 44, x2: true },
  ]

  const col2X = tbX + tbW / 2

  fields.forEach(({ label, value, y, x2 }) => {
    const bx = x2 ? col2X + 4 : tbX + 4
    const lbl = new paper.PointText(new paper.Point(bx, y))
    lbl.content = label
    lbl.fillColor = new paper.Color('#94a3b8')
    lbl.fontSize = 6
    tbGroup!.addChild(lbl)

    const val = new paper.PointText(new paper.Point(bx, y + 8))
    val.content = value || '—'
    val.fillColor = white
    val.fontSize = 8
    val.fontWeight = 'bold'
    tbGroup!.addChild(val)
  })

  // Divider lines
  const midY1 = tbY + 14; const midY2 = tbY + 26; const midY3 = tbY + 38
  const midX = tbX + tbW / 2
  ;[midY1, midY2, midY3].forEach((hy) => {
    const l = new paper.Path.Line(new paper.Point(tbX, hy), new paper.Point(tbX + tbW, hy))
    l.strokeColor = new paper.Color('#334155'); l.strokeWidth = thin
    tbGroup!.addChild(l)
  })
  const vl = new paper.Path.Line(new paper.Point(midX, tbY + 28), new paper.Point(midX, tbY + tbH))
  vl.strokeColor = new paper.Color('#334155'); vl.strokeWidth = thin
  tbGroup!.addChild(vl)
}

export function removeTitleBlock() {
  if (tbGroup) { tbGroup.remove(); tbGroup = null }
}
