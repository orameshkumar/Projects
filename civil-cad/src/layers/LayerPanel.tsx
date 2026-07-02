import { useState } from 'react'
import { useDrawingStore } from '../store/useDrawingStore'

export function LayerPanel() {
  const layers = useDrawingStore((s) => s.layers)
  const activeLayerId = useDrawingStore((s) => s.activeLayerId)
  const setActiveLayer = useDrawingStore((s) => s.setActiveLayer)
  const updateLayer = useDrawingStore((s) => s.updateLayer)
  const addLayer = useDrawingStore((s) => s.addLayer)
  const removeLayer = useDrawingStore((s) => s.removeLayer)
  const [newName, setNewName] = useState('')

  const handleAdd = () => {
    if (!newName.trim()) return
    const id = newName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    addLayer({ id, name: newName.trim(), color: '#60a5fa', visible: true, locked: false })
    setNewName('')
  }

  return (
    <div className="flex flex-col bg-slate-800 border-l border-slate-700 w-52 text-xs select-none">
      <div className="px-3 py-2 border-b border-slate-700 font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
        Layers
      </div>
      <div className="flex-1 overflow-y-auto">
        {layers.map((layer) => (
          <div
            key={layer.id}
            onClick={() => !layer.locked && setActiveLayer(layer.id)}
            className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer border-b border-slate-700/50 transition-colors
              ${activeLayerId === layer.id ? 'bg-blue-900/40' : 'hover:bg-slate-700/40'}`}
          >
            {/* Colour swatch */}
            <input
              type="color"
              value={layer.color}
              onChange={(e) => updateLayer(layer.id, { color: e.target.value })}
              className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
              title="Layer colour"
              onClick={(e) => e.stopPropagation()}
            />
            {/* Name */}
            <span className={`flex-1 truncate ${layer.locked ? 'text-slate-500' : 'text-slate-200'}`}>
              {layer.name}
            </span>
            {/* Visibility */}
            <button
              onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }) }}
              className={`text-base leading-none ${layer.visible ? 'text-slate-300' : 'text-slate-600'}`}
              title="Toggle visibility"
            >
              {layer.visible ? '👁' : '🙈'}
            </button>
            {/* Lock */}
            <button
              onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }) }}
              className={`text-base leading-none ${layer.locked ? 'text-amber-400' : 'text-slate-600'}`}
              title="Toggle lock"
            >
              {layer.locked ? '🔒' : '🔓'}
            </button>
            {/* Delete */}
            {!layer.locked && (
              <button
                onClick={(e) => { e.stopPropagation(); removeLayer(layer.id) }}
                className="text-slate-600 hover:text-red-400 text-xs leading-none ml-0.5"
                title="Delete layer"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {/* Add layer */}
      <div className="flex gap-1 p-2 border-t border-slate-700">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="New layer…"
          className="flex-1 bg-slate-700 text-slate-200 rounded px-2 py-1 text-xs border border-slate-600 outline-none focus:border-blue-500"
        />
        <button
          onClick={handleAdd}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded px-2 py-1 text-xs"
        >
          +
        </button>
      </div>
    </div>
  )
}
