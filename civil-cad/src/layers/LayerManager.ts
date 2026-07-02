import paper from 'paper'
import type { Layer } from '../store/useDrawingStore'

// Apply layer visibility/lock state to all paper items
export function applyLayerStates(layers: Layer[]) {
  const layerMap = Object.fromEntries(layers.map((l) => [l.id, l]))

  paper.project.activeLayer.children.forEach((item) => {
    const layerId = item.data?.layerId as string | undefined
    if (!layerId) return
    const layer = layerMap[layerId]
    if (layer) {
      item.visible = layer.visible
      item.locked = layer.locked
    }
  })
}
