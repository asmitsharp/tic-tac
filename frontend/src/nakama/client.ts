import { Client, Session } from "@heroiclabs/nakama-js"
import type { MatchmakerMatched, Socket } from "@heroiclabs/nakama-js"
import type { CreatedRoom, GameState, RoomMode, RoomSummary } from "../types/game"

const NAKAMA_SERVER_KEY = import.meta.env.VITE_NAKAMA_SERVER_KEY ?? "defaultkey"
const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST ?? "127.0.0.1"
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT ?? "7350"
const NAKAMA_SSL = import.meta.env.VITE_NAKAMA_SSL === "true"

const client = new Client(
  NAKAMA_SERVER_KEY,
  NAKAMA_HOST,
  NAKAMA_PORT,
  NAKAMA_SSL,
)

let session: Session | null = null
let socket: Socket | null = null

export async function authenticate(username: string): Promise<Session> {
  const deviceId = sessionStorage.getItem("deviceId") ?? crypto.randomUUID()
  sessionStorage.setItem("deviceId", deviceId)
  session = await client.authenticateDevice(deviceId, true, username)
  return session
}

export async function connectSocket(): Promise<Socket> {
  if (!session) throw new Error("Not authenticated")
  socket = client.createSocket(NAKAMA_SSL, false)
  await socket.connect(session, true)
  return socket
}

export async function findMatch(mode: RoomMode): Promise<string> {
  if (!socket) throw new Error("Socket not connected")
  const ticket = await socket.addMatchmaker("*", 2, 2, { mode })
  return ticket.ticket
}

export async function cancelMatchmaking(ticket: string): Promise<void> {
  if (!socket) throw new Error("Socket not connected")
  await socket.removeMatchmaker(ticket)
}

export async function joinMatch(matchId?: string, token?: string): Promise<string> {
  if (!socket) throw new Error("Socket not connected")
  const match = await socket.joinMatch(matchId, token)
  return match.match_id
}

export async function leaveMatch(matchId: string): Promise<void> {
  if (!socket) return
  await socket.leaveMatch(matchId)
}

export async function createRoom(mode: RoomMode): Promise<CreatedRoom> {
  if (!session) throw new Error("Not authenticated")
  const response = await client.rpc(session, "create_match", { mode })
  return parseRpcPayload<CreatedRoom>(response.payload)
}

export async function listRooms(mode?: RoomMode): Promise<RoomSummary[]> {
  if (!session) throw new Error("Not authenticated")
  const response = await client.rpc(session, "list_rooms", mode ? { mode } : {})
  return parseRpcPayload<{ rooms: RoomSummary[] }>(response.payload).rooms ?? []
}

export async function getMatchState(matchId: string): Promise<GameState> {
  if (!session) throw new Error("Not authenticated")
  const response = await client.rpc(session, "get_match_state", { match_id: matchId })
  return parseRpcPayload<GameState>(response.payload)
}

export function sendMove(matchId: string, cellIndex: number): void {
  if (!socket) throw new Error("Socket not connected")
  socket.sendMatchState(matchId, 1, JSON.stringify({ index: cellIndex }))
}

export function onMatchData(callback: (state: GameState) => void): void {
  if (!socket) throw new Error("Socket not connected")
  socket.onmatchdata = (data) => {
    if (data.op_code === 2) {
      const state: GameState = JSON.parse(new TextDecoder().decode(data.data))
      callback(state)
    }
  }
}

export function onMatchmakerMatched(
  callback: (matched: MatchmakerMatched) => void,
): void {
  if (!socket) throw new Error("Socket not connected")
  socket.onmatchmakermatched = (matched) => {
    callback(matched)
  }
}

export function getSession(): Session {
  if (!session) throw new Error("Not authenticated")
  return session
}

function parseRpcPayload<T>(payload?: object | string): T {
  if (!payload) {
    throw new Error("Missing RPC payload")
  }
  if (typeof payload === "string") {
    return JSON.parse(payload) as T
  }
  return payload as T
}
