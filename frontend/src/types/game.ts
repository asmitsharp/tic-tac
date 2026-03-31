export type Marker = "X" | "O" | ""

export interface GameState {
  board: Marker[]
  turn: Marker
  winner: Marker
  draw: boolean
  game_over: boolean
  players: Record<string, Marker>
}

export interface MoveMessage {
  index: number
}
