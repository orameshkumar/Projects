import { useDrawingStore } from '../store/useDrawingStore'
import { downloadDxf } from '../export/DxfExporter'
import { exportPdf } from '../export/PdfExporter'
import { history } from '../history/HistoryManager'
import { sharedCanvasRef } from '../canvas/canvasRef'
import paper from 'paper'
import { set as idbSet, get as idbGet } from 'idb-keyval'

export function MenuBar() {
  const layers = useDrawingStore((s) => s.layers)
  const titleBlock = useDrawingStore((s) => s.titleBlock)

  const handleNewDrawing = () => {
    if (confirm('Start a new drawing? Unsaved changes will be lost.')) {
      paper.project.clear()
      history.clear()
      history.snapshot()
    }
  }

  const handleSave = async () => {
    const json = paper.project.exportJSON()
    await idbSet('civil-cad-project', json)
    alert('Project saved to browser storage.')
  }

  const handleLoad = async () => {
    const json = await idbGet<string>('civil-cad-project')
    if (json) {
      paper.project.importJSON(json)
      history.snapshot()
    } else {
      alert('No saved project found.')
    }
  }

  const handleExportDxf = () => {
    downloadDxf(layers, `${titleBlock.project || 'civil-drawing'}.dxf`)
  }

  const handleExportPdf = () => {
    const canvas = sharedCanvasRef.current
    if (!canvas) { alert('Canvas not ready.'); return }
    exportPdf(canvas, titleBlock.paperSize, titleBlock.project || 'civil-drawing')
  }

  return (
    <div className="flex items-center gap-1 px-3 h-9 bg-slate-900 border-b border-slate-700 text-xs text-slate-300 shrink-0 select-none">
      <span className="text-blue-400 font-bold mr-3 text-sm">⬡ CivilCAD</span>

      {/* File actions */}
      {[
        { label: 'New', action: handleNewDrawing },
        { label: 'Save', action: handleSave },
        { label: 'Load', action: handleLoad },
      ].map(({ label, action }) => (
        <button key={label} onClick={action} className="px-2 py-1 rounded hover:bg-slate-700 transition-colors">
          {label}
        </button>
      ))}

      <span className="text-slate-700 mx-1">|</span>

      {/* Undo / Redo */}
      <button
        onClick={() => history.undo()}
        title="Undo (Ctrl+Z)"
        className="px-2 py-1 rounded hover:bg-slate-700 transition-colors"
      >
        ↩ Undo
      </button>
      <button
        onClick={() => history.redo()}
        title="Redo (Ctrl+Y)"
        className="px-2 py-1 rounded hover:bg-slate-700 transition-colors"
      >
        ↪ Redo
      </button>

      <span className="text-slate-700 mx-1">|</span>

      {/* Exports */}
      <button onClick={handleExportDxf} className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-medium transition-colors">
        Export DXF
      </button>
      <button onClick={handleExportPdf} className="px-2 py-1 rounded bg-violet-700 hover:bg-violet-600 text-white font-medium transition-colors">
        Export PDF
      </button>

      <span className="text-slate-700 mx-1">|</span>

      <span className="text-slate-500 text-[10px] ml-auto">
        {titleBlock.project} — {titleBlock.title} ({titleBlock.scale}) &nbsp;·&nbsp; Ctrl+Z undo &nbsp; Ctrl+Y redo
      </span>
    </div>
  )
}
