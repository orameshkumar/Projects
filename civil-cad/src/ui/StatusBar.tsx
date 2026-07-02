import { useEffect, useState } from 'react'
import { useDrawingStore } from '../store/useDrawingStore'
import { coordSys } from '../canvas/CoordinateSystem'

export function StatusBar() {
  const activeTool = useDrawingStore((s) => s.activeTool)
  const snapEnabled = useDrawingStore((s) => s.snapEnabled)
  const gridVisible = useDrawingStore((s) => s.gridVisible)
  const toggleSnap = useDrawingStore((s) => s.toggleSnap)
  const toggleGrid = useDrawingStore((s) => s.toggleGrid)
  const zoom = useDrawingStore((s) => s.zoom)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const canvas = document.getElementById('paper-canvas') as HTMLCanvasElement
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const [wx, wy] = coordSys.screenToWorld(sx, sy)
      setCursor({ x: Math.round(wx), y: Math.round(wy) })
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  return (
    <div className="flex items-center gap-4 px-3 h-7 bg-slate-900 border-t border-slate-700 text-xs text-slate-400 select-none shrink-0">
      <span className="text-slate-300 capitalize font-medium">{activeTool}</span>
      <span className="text-slate-600">|</span>
      <span>X: <span className="text-slate-200">{cursor.x}</span>mm</span>
      <span>Y: <span className="text-slate-200">{cursor.y}</span>mm</span>
      <span className="text-slate-600">|</span>
      <span>Zoom: <span className="text-slate-200">{Math.round(zoom * 100)}%</span></span>
      <span className="text-slate-600">|</span>
      <button onClick={toggleSnap} className={`px-1.5 py-0.5 rounded text-[10px] border ${snapEnabled ? 'bg-blue-700 border-blue-500 text-white' : 'border-slate-600 text-slate-400'}`}>
        SNAP
      </button>
      <button onClick={toggleGrid} className={`px-1.5 py-0.5 rounded text-[10px] border ${gridVisible ? 'bg-slate-600 border-slate-500 text-white' : 'border-slate-700 text-slate-500'}`}>
        GRID
      </button>
      <span className="ml-auto text-slate-600 text-[10px]">ESC: cancel  DEL: delete  Enter/DblClick: finish</span>
    </div>
  )
}
