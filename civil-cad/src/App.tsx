import { useState } from 'react'
import { MenuBar } from './ui/MenuBar'
import { Toolbar } from './ui/Toolbar'
import { StatusBar } from './ui/StatusBar'
import { LayerPanel } from './layers/LayerPanel'
import { TitleBlockPanel } from './titleblock/TitleBlockPanel'
import { PaperCanvas } from './canvas/PaperCanvas'

type RightPanel = 'layers' | 'titleblock' | null

export default function App() {
  const [rightPanel, setRightPanel] = useState<RightPanel>('layers')

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-900">
      <MenuBar />

      <div className="flex flex-1 overflow-hidden">
        <Toolbar />

        <div className="flex-1 relative overflow-hidden">
          <PaperCanvas />
        </div>

        {/* Right panel tabs */}
        <div className="flex flex-col border-l border-slate-700 bg-slate-800 shrink-0">
          <div className="flex flex-col gap-1 p-1 border-b border-slate-700">
            {([
              { id: 'layers' as RightPanel, icon: '⊞', label: 'Layers' },
              { id: 'titleblock' as RightPanel, icon: '📋', label: 'Title Block' },
            ]).map(({ id, icon, label }) => (
              <button
                key={id as string}
                title={label}
                onClick={() => setRightPanel(rightPanel === id ? null : id)}
                className={`w-8 h-8 rounded text-base flex items-center justify-center border transition-colors ${
                  rightPanel === id
                    ? 'bg-blue-600 border-blue-400'
                    : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {rightPanel === 'layers' && <LayerPanel />}
        {rightPanel === 'titleblock' && <TitleBlockPanel />}
      </div>

      <StatusBar />
    </div>
  )
}
