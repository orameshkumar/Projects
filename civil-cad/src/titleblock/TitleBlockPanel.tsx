import { useDrawingStore } from '../store/useDrawingStore'

export function TitleBlockPanel() {
  const titleBlock = useDrawingStore((s) => s.titleBlock)
  const setTitleBlock = useDrawingStore((s) => s.setTitleBlock)
  const titleBlockVisible = useDrawingStore((s) => s.titleBlockVisible)
  const toggleTitleBlock = useDrawingStore((s) => s.toggleTitleBlock)

  const fields: { key: keyof typeof titleBlock; label: string }[] = [
    { key: 'project',  label: 'Project' },
    { key: 'title',    label: 'Drawing Title' },
    { key: 'scale',    label: 'Scale' },
    { key: 'date',     label: 'Date' },
    { key: 'drawnBy',  label: 'Drawn By' },
    { key: 'revision', label: 'Revision' },
  ]

  return (
    <div className="flex flex-col bg-slate-800 border-l border-slate-700 w-52 text-xs select-none">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
        <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">Title Block</span>
        <button
          onClick={toggleTitleBlock}
          className={`px-1.5 py-0.5 rounded border text-[10px] ${
            titleBlockVisible
              ? 'bg-blue-700 border-blue-500 text-white'
              : 'border-slate-600 text-slate-400'
          }`}
        >
          {titleBlockVisible ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="p-2 flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <label className="text-slate-400 text-[10px]">Paper Size</label>
          <select
            value={titleBlock.paperSize}
            onChange={(e) => setTitleBlock({ paperSize: e.target.value as 'A3' | 'A4' })}
            className="bg-slate-700 text-slate-200 rounded px-2 py-1 border border-slate-600 outline-none text-xs"
          >
            <option value="A3">A3 (420×297mm)</option>
            <option value="A4">A4 (297×210mm)</option>
          </select>
        </div>

        {fields.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-0.5">
            <label className="text-slate-400 text-[10px]">{label}</label>
            <input
              type="text"
              value={titleBlock[key]}
              onChange={(e) => setTitleBlock({ [key]: e.target.value })}
              className="bg-slate-700 text-slate-200 rounded px-2 py-1 border border-slate-600 outline-none focus:border-blue-500 text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
