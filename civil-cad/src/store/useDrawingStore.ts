import { create } from 'zustand'

export type ToolName =
  | 'select' | 'line' | 'rectangle' | 'circle' | 'arc'
  | 'polyline' | 'wall' | 'dimension' | 'hatch' | 'text' | 'symbol'

export type HatchPattern = 'concrete' | 'soil' | 'gravel' | 'brick'

export interface Layer {
  id: string
  name: string
  color: string
  visible: boolean
  locked: boolean
}

export interface TitleBlockData {
  project: string
  title: string
  scale: string
  date: string
  drawnBy: string
  revision: string
  paperSize: 'A3' | 'A4'
}

interface DrawingState {
  layers: Layer[]
  activeLayerId: string
  activeTool: ToolName
  wallThickness: number
  hatchPattern: HatchPattern
  fontSize: number
  symbolType: string
  snapEnabled: boolean
  gridVisible: boolean
  titleBlockVisible: boolean
  titleBlock: TitleBlockData
  zoom: number
  panX: number
  panY: number

  setActiveTool: (tool: ToolName) => void
  setActiveLayer: (id: string) => void
  addLayer: (layer: Layer) => void
  updateLayer: (id: string, patch: Partial<Layer>) => void
  removeLayer: (id: string) => void
  setWallThickness: (t: number) => void
  setHatchPattern: (p: HatchPattern) => void
  setFontSize: (n: number) => void
  setSymbolType: (s: string) => void
  toggleSnap: () => void
  toggleGrid: () => void
  toggleTitleBlock: () => void
  setTitleBlock: (data: Partial<TitleBlockData>) => void
  setZoom: (z: number) => void
  setPan: (x: number, y: number) => void
}

const DEFAULT_LAYERS: Layer[] = [
  { id: 'walls',      name: 'Walls',      color: '#ffffff', visible: true, locked: false },
  { id: 'doors',      name: 'Doors',      color: '#60a5fa', visible: true, locked: false },
  { id: 'plumbing',   name: 'Plumbing',   color: '#34d399', visible: true, locked: false },
  { id: 'dimensions', name: 'Dimensions', color: '#fbbf24', visible: true, locked: false },
  { id: 'hatch',      name: 'Hatch',      color: '#94a3b8', visible: true, locked: false },
  { id: 'titleblock', name: 'Title Block', color: '#e2e8f0', visible: true, locked: true  },
]

export const useDrawingStore = create<DrawingState>((set) => ({
  layers: DEFAULT_LAYERS,
  activeLayerId: 'walls',
  activeTool: 'select',
  wallThickness: 200,
  hatchPattern: 'concrete',
  fontSize: 14,
  symbolType: 'door-single',
  snapEnabled: true,
  gridVisible: true,
  titleBlockVisible: false,
  titleBlock: {
    project: 'Project Name',
    title: 'Drawing Title',
    scale: '1:100',
    date: new Date().toLocaleDateString(),
    drawnBy: '',
    revision: 'A',
    paperSize: 'A3',
  },
  zoom: 1,
  panX: 0,
  panY: 0,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveLayer: (id) => set({ activeLayerId: id }),
  addLayer: (layer) => set((s) => ({ layers: [...s.layers, layer] })),
  updateLayer: (id, patch) =>
    set((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
  removeLayer: (id) =>
    set((s) => ({ layers: s.layers.filter((l) => l.id !== id) })),
  setWallThickness: (wallThickness) => set({ wallThickness }),
  setHatchPattern: (hatchPattern) => set({ hatchPattern }),
  setFontSize: (fontSize) => set({ fontSize }),
  setSymbolType: (symbolType) => set({ symbolType }),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleTitleBlock: () => set((s) => ({ titleBlockVisible: !s.titleBlockVisible })),
  setTitleBlock: (data) => set((s) => ({ titleBlock: { ...s.titleBlock, ...data } })),
  setZoom: (zoom) => set({ zoom }),
  setPan: (panX, panY) => set({ panX, panY }),
}))
