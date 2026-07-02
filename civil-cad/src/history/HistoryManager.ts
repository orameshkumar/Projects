import paper from 'paper'

const MAX_HISTORY = 50

class HistoryManager {
  private stack: string[] = []
  private cursor = -1

  snapshot() {
    if (!paper.project) return
    // Discard any redo states beyond current cursor
    this.stack = this.stack.slice(0, this.cursor + 1)
    this.stack.push(paper.project.exportJSON())
    if (this.stack.length > MAX_HISTORY) this.stack.shift()
    this.cursor = this.stack.length - 1
  }

  undo() {
    if (this.cursor <= 0) return
    this.cursor--
    paper.project.importJSON(this.stack[this.cursor])
  }

  redo() {
    if (this.cursor >= this.stack.length - 1) return
    this.cursor++
    paper.project.importJSON(this.stack[this.cursor])
  }

  canUndo() { return this.cursor > 0 }
  canRedo() { return this.cursor < this.stack.length - 1 }

  clear() { this.stack = []; this.cursor = -1 }
}

export const history = new HistoryManager()
