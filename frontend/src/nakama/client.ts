import { Client, Session } from "@heroiclabs/nakama-js"
import type { MatchmakerMatched, Socket } from "@heroiclabs/nakama-js"
import type { GameState } from "../types/game"

const client = new Client("defaultkey", "127.0.0.1", "7350", false)

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
  socket = client.createSocket(false, false)
  await socket.connect(session, true)
  return socket
}

export async function findMatch(): Promise<string> {
  if (!socket) throw new Error("Socket not connected")
  const ticket = await socket.addMatchmaker("*", 2, 2)
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
