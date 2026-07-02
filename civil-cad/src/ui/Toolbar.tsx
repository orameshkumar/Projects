import { useDrawingStore } from '../store/useDrawingStore'
import type { ToolName } from '../store/useDrawingStore'

interface ToolBtn { name: ToolName; label: string; icon: string; key?: string }

const TOOLS: ToolBtn[] = [
  { name: 'select',    label: 'Select',    icon: '↖', key: 'V' },
  { name: 'line',      label: 'Line',      icon: '╱', key: 'L' },
  { name: 'rectangle', label: 'Rectangle', icon: '▭', key: 'R' },
  { name: 'circle',    label: 'Circle',    icon: '○', key: 'C' },
  { name: 'arc',       label: 'Arc',       icon: '⌒', key: 'A' },
  { name: 'polyline',  label: 'Polyline',  icon: '⌐', key: 'P' },
  { name: 'wall',      label: 'Wall',      icon: '⊞', key: 'W' },
  { name: 'dimension', label: 'Dimension', icon: '⟺', key: 'D' },
  { name: 'hatch',     label: 'Hatch',     icon: '▨', key: 'H' },
  { name: 'text',      label: 'Text',      icon: 'T',  key: 'T' },
  { name: 'symbol',    label: 'Symbol',    icon: '🚪', key: 'S' },
]

export function Toolbar() {
  const activeTool = useDrawingStore((s) => s.activeTool)
  const setActiveTool = useDrawingStore((s) => s.setActiveTool)
  const wallThickness = useDrawingStore((s) => s.wallThickness)
  const setWallThickness = useDrawingStore((s) => s.setWallThickness)
  const hatchPattern = useDrawingStore((s) => s.hatchPattern)
  const setHatchPattern = useDrawingStore((s) => s.setHatchPattern)
  const fontSize = useDrawingStore((s) => s.fontSize)
  const setFontSize = useDrawingStore((s) => s.setFontSize)
  const symbolType = useDrawingStore((s) => s.symbolType)
  const setSymbolType = useDrawingStore((s) => s.setSymbolType)

  return (
    <div className="flex flex-col gap-1 bg-slate-800 border-r border-slate-700 p-2 w-14 select-none overflow-y-auto">
      {TOOLS.map((t) => (
        <button
          key={t.name}
          title={`${t.label} (${t.key})`}
          onClick={() => setActiveTool(t.name)}
          className={`
            flex flex-col items-center justify-center w-10 h-10 rounded text-lg
            transition-colors cursor-pointer border shrink-0
            ${activeTool === t.name
              ? 'bg-blue-600 border-blue-400 text-white'
              : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}
          `}
        >
          <span>{t.icon}</span>
          <span className="text-[8px] leading-none mt-0.5 text-slate-400">{t.key}</span>
        </button>
      ))}

      <div className="border-t border-slate-600 mt-2 pt-2 flex flex-col gap-1">
        {activeTool === 'wall' && (
          <>
            <span className="text-[9px] text-slate-400 text-center">Wall</span>
            <input
              type="number"
              value={wallThickness}
              onChange={(e) => setWallThickness(Number(e.target.value))}
              className="w-10 bg-slate-700 text-slate-200 text-xs text-center rounded border border-slate-600 px-1 py-0.5"
              title="Wall thickness (mm)"
            />
            <span className="text-[8px] text-slate-500 text-center">mm</span>
          </>
        )}

        {activeTool === 'hatch' && (
          <>
            <span className="text-[9px] text-slate-400 text-center">Hatch</span>
            {(['concrete','soil','gravel','brick'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setHatchPattern(p)}
                className={`text-[8px] rounded px-1 py-0.5 capitalize border ${
                  hatchPattern === p
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300'
                }`}
              >
                {p}
              </button>
            ))}
          </>
        )}

        {activeTool === 'text' && (
          <>
            <span className="text-[9px] text-slate-400 text-center">Size</span>
            <input
              type="number"
              value={fontSize}
              min={6} max={120}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-10 bg-slate-700 text-slate-200 text-xs text-center rounded border border-slate-600 px-1 py-0.5"
              title="Font size (px)"
            />
            <span className="text-[8px] text-slate-500 text-center">px</span>
          </>
        )}

        {activeTool === 'symbol' && (
          <>
            <span className="text-[9px] text-slate-400 text-center">Type</span>
            {([
              { id: 'door-single',   label: 'Single' },
              { id: 'door-double',   label: 'Double' },
              { id: 'window-sliding', label: 'Slide' },
              { id: 'window-fixed',  label: 'Fixed' },
            ]).map((s) => (
              <button
                key={s.id}
                onClick={() => setSymbolType(s.id)}
                className={`text-[8px] rounded px-1 py-0.5 border ${
                  symbolType === s.id
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
