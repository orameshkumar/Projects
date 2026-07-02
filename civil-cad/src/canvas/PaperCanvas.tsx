import { useEffect, useRef, useCallback } from 'react'
import paper from 'paper'
import { useDrawingStore } from '../store/useDrawingStore'
import type { ToolName } from '../store/useDrawingStore'
import { history } from '../history/HistoryManager'
import { sharedCanvasRef } from './canvasRef'
import { coordSys } from './CoordinateSystem'
import { drawGrid, removeGrid } from './Grid'
import { applyLayerStates } from '../layers/LayerManager'
import { drawTitleBlock, removeTitleBlock } from '../titleblock/TitleBlock'

// Tools
import { SelectTool } from '../tools/SelectTool'
import { LineTool } from '../tools/LineTool'
import { RectangleTool } from '../tools/RectangleTool'
import { CircleTool } from '../tools/CircleTool'
import { ArcTool } from '../tools/ArcTool'
import { PolylineTool } from '../tools/PolylineTool'
import { WallTool } from '../tools/WallTool'
import { DimensionTool } from '../tools/DimensionTool'
import { HatchTool } from '../tools/HatchTool'
import { TextTool } from '../tools/TextTool'
import { SymbolTool } from '../tools/SymbolTool'
import { ToolBase } from '../tools/ToolBase'

const ZOOM_FACTOR = 1.1

export function PaperCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Expose to MenuBar for PDF export
  useEffect(() => { sharedCanvasRef.current = canvasRef.current }, [])
  const toolsRef = useRef<Record<ToolName, ToolBase>>({} as Record<ToolName, ToolBase>)
  const isPanning = useRef(false)
  const lastPan = useRef({ x: 0, y: 0 })

  const activeTool = useDrawingStore((s) => s.activeTool)
  const layers = useDrawingStore((s) => s.layers)
  const activeLayerId = useDrawingStore((s) => s.activeLayerId)
  const snapEnabled = useDrawingStore((s) => s.snapEnabled)
  const gridVisible = useDrawingStore((s) => s.gridVisible)
  const titleBlockVisible = useDrawingStore((s) => s.titleBlockVisible)
  const titleBlock = useDrawingStore((s) => s.titleBlock)
  const wallThickness = useDrawingStore((s) => s.wallThickness)
  const hatchPattern = useDrawingStore((s) => s.hatchPattern)
  const fontSize = useDrawingStore((s) => s.fontSize)
  const symbolType = useDrawingStore((s) => s.symbolType)
  const setZoom = useDrawingStore((s) => s.setZoom)
  const setPan = useDrawingStore((s) => s.setPan)

  const getLayerColor = useCallback(
    (id: string) => layers.find((l) => l.id === id)?.color ?? '#ffffff',
    [layers]
  )

  // Initialise Paper.js and tools
  useEffect(() => {
    const canvas = canvasRef.current!
    paper.setup(canvas)

    toolsRef.current = {
      select:    new SelectTool(),
      line:      new LineTool(),
      rectangle: new RectangleTool(),
      circle:    new CircleTool(),
      arc:       new ArcTool(),
      polyline:  new PolylineTool(),
      wall:      new WallTool(),
      dimension: new DimensionTool(),
      hatch:     new HatchTool(),
      text:      new TextTool(),
      symbol:    new SymbolTool(),
    }

    // Take initial snapshot for undo
    history.snapshot()

    // Keyboard shortcuts + undo/redo
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        history.undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault()
        history.redo()
        return
      }

      const map: Record<string, ToolName> = {
        v: 'select', l: 'line', r: 'rectangle', c: 'circle',
        a: 'arc', p: 'polyline', w: 'wall', d: 'dimension', h: 'hatch',
        t: 'text', s: 'symbol',
      }
      const tool = map[e.key.toLowerCase()]
      if (tool) useDrawingStore.getState().setActiveTool(tool)
    }
    window.addEventListener('keydown', onKey)

    // Resize observer
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      paper.view.viewSize = new paper.Size(canvas.offsetWidth, canvas.offsetHeight)
      redrawGrid()
    })
    ro.observe(canvas)

    return () => {
      window.removeEventListener('keydown', onKey)
      ro.disconnect()
    }
  }, [])

  const redrawGrid = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (useDrawingStore.getState().gridVisible) {
      drawGrid(canvas.offsetWidth, canvas.offsetHeight)
    } else {
      removeGrid()
    }
  }, [])

  // Switch active tool
  useEffect(() => {
    const tool = toolsRef.current[activeTool]
    if (!tool) return
    tool.setContext({
      activeLayerId,
      layerColor: getLayerColor,
      snapEnabled,
      wallThickness,
      hatchPattern,
      fontSize,
      symbolType,
    })
    tool.activate()
  }, [activeTool, activeLayerId, snapEnabled, wallThickness, hatchPattern, fontSize, symbolType, getLayerColor])

  // Apply layer visibility/lock
  useEffect(() => {
    if (paper.project) applyLayerStates(layers)
  }, [layers])

  // Grid
  useEffect(() => { redrawGrid() }, [gridVisible, redrawGrid])

  // Title block
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (titleBlockVisible) {
      drawTitleBlock(titleBlock, canvas.offsetWidth, canvas.offsetHeight)
    } else {
      removeTitleBlock()
    }
  }, [titleBlockVisible, titleBlock])

  // Zoom with mouse wheel
  useEffect(() => {
    const canvas = canvasRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
      coordSys.zoom *= factor

      // Zoom towards cursor
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      coordSys.panX = sx - (sx - coordSys.panX) * factor
      coordSys.panY = sy - (sy - coordSys.panY) * factor

      setZoom(coordSys.zoom)
      setPan(coordSys.panX, coordSys.panY)
      redrawGrid()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [setZoom, setPan, redrawGrid])

  // Pan with middle mouse / space+drag
  useEffect(() => {
    const canvas = canvasRef.current!
    const onDown = (e: MouseEvent) => {
      if (e.button === 1) { e.preventDefault(); isPanning.current = true; lastPan.current = { x: e.clientX, y: e.clientY } }
    }
    const onMove = (e: MouseEvent) => {
      if (!isPanning.current) return
      const dx = e.clientX - lastPan.current.x
      const dy = e.clientY - lastPan.current.y
      coordSys.panX += dx; coordSys.panY += dy
      lastPan.current = { x: e.clientX, y: e.clientY }
      setPan(coordSys.panX, coordSys.panY)
      redrawGrid()
    }
    const onUp = (e: MouseEvent) => { if (e.button === 1) isPanning.current = false }

    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [setPan, redrawGrid])

  return (
    <canvas
      id="paper-canvas"
      ref={canvasRef}
      className="flex-1 w-full h-full cursor-crosshair"
      style={{ background: '#0f172a' }}
    />
  )
}
