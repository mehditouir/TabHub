import * as fs   from 'fs'
import * as path from 'path'

const STATE_FILE = path.join(__dirname, '..', 'run-state.json')

export interface RunState {
  tableQrToken: string   // qrToken UUID for table T1 — used in customer ordering tests
  tableId:      string   // UUID of table T1
  spaceId:      string   // UUID of Terrasse space
}

export function readState(): Partial<RunState> {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

export function writeState(partial: Partial<RunState>): void {
  const current = readState()
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...current, ...partial }, null, 2))
}
