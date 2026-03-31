export type Marker = "X" | "O" | ""
export type RoomMode = "classic" | "timed"
export type GameStatus = "waiting" | "active" | "finished" | "abandoned"

export interface GameState {
  board: Marker[]
  turn: Marker
  winner: Marker
  draw: boolean
  game_over: boolean
  players: Record<string, Marker>
  player_names: Record<string, string>
  player_count: number
  room_code: string
  mode: RoomMode
  message: string
  status: GameStatus
  turn_duration_seconds: number
  turn_deadline_unix: number
  countdown_seconds: number
}

export interface MoveMessage {
  index: number
}

export interface RoomSummary {
  match_id: string
  room_code: string
  mode: RoomMode
  player_count: number
}

export interface CreatedRoom {
  match_id: string
  room_code: string
  mode: RoomMode
}
