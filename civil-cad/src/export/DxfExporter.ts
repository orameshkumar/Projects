import paper from 'paper'
import Drawing from 'dxf-writer'
import type { Layer } from '../store/useDrawingStore'
import { coordSys } from '../canvas/CoordinateSystem'

function hexToAci(hex: string): number {
  const map: Record<string, number> = {
    '#ffffff': 7, '#e2e8f0': 7, '#60a5fa': 5, '#34d399': 3,
    '#fbbf24': 2, '#94a3b8': 8, '#ff0000': 1, '#00ff00': 3,
    '#0000ff': 5, '#ffff00': 2, '#00ffff': 4, '#ff00ff': 6,
  }
  return map[hex.toLowerCase()] ?? 7
}

function px(v: number) { return v / coordSys.pxPerMm }

function exportItem(d: Drawing, item: paper.Item) {
  if (!item.visible) return

  if (item instanceof paper.Path) {
    if (item.segments.length === 0) return

    // Circle: 4 segments, closed, square bounds
    if (item.segments.length === 4 && item.closed &&
        Math.abs(item.bounds.width - item.bounds.height) < 1) {
      d.drawCircle(px(item.bounds.center.x), -px(item.bounds.center.y), px(item.bounds.width / 2))
      return
    }

    // Straight two-point line
    if (item.segments.length === 2 && !item.closed) {
      const s = item.segments[0], e = item.segments[1]
      const hasCurve = s.handleOut.length > 1 || e.handleIn.length > 1
      if (!hasCurve) {
        d.drawLine(px(s.point.x), -px(s.point.y), px(e.point.x), -px(e.point.y))
        return
      }
    }

    // General polyline / arc approximation
    const pts: [number, number][] = []
    const steps = Math.max(10, Math.ceil(item.length / 5))
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * item.length
      const p = item.getPointAt(Math.min(t, item.length))
      pts.push([px(p.x), -px(p.y)])
    }
    if (pts.length >= 2) d.drawPolyline(pts, item.closed)

  } else if (item instanceof paper.PointText) {
    d.drawText(px(item.point.x), -px(item.point.y), (item.fontSize as number) || 10, 0, item.content)

  } else if (item instanceof paper.Group) {
    item.children.forEach((child) => exportItem(d, child))
  }
}

export function exportDxf(layers: Layer[]): string {
  const d = new Drawing()
  d.setUnits('Millimeters')

  layers.forEach((layer) => {
    d.addLayer(layer.name, hexToAci(layer.color), 'CONTINUOUS')
  })

  paper.project.activeLayer.children.forEach((item) => {
    const layerId = item.data?.layerId as string | undefined
    const layer = layers.find((l) => l.id === layerId)
    if (!layer || !layer.visible) return
    d.setActiveLayer(layer.name)
    exportItem(d, item)
  })

  return d.toDxfString()
}

export function downloadDxf(layers: Layer[], filename = 'civil-drawing.dxf') {
  const content = exportDxf(layers)
  const blob = new Blob([content], { type: 'application/dxf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
