import { useEffect, useState, type CSSProperties } from "react"
import {
  cancelMatchmaking,
  findMatch,
  joinMatch,
  onMatchmakerMatched,
} from "../nakama/client"
import type { RoomMode } from "../types/game"

interface Props {
  mode: RoomMode
  username: string
  onBack: () => void
  onMatchFound: (matchId: string) => void
}

export default function Matchmaking({
  mode,
  username,
  onBack,
  onMatchFound,
}: Props) {
  const [status, setStatus] = useState("Searching for a player...")

  useEffect(() => {
    let active = true
    let ticket: string | null = null

    // Listen for when matchmaker finds an opponent
    onMatchmakerMatched(async (matched) => {
      if (!active) return
      setStatus("Opponent found! Joining match...")
      try {
        const matchId = await joinMatch(matched.match_id, matched.token)
        if (!active) return
        onMatchFound(matchId)
      } catch {
        if (!active) return
        setStatus("Could not join the match. Try refreshing both tabs.")
      }
    })

    // Enter the matchmaker pool
    findMatch(mode)
      .then((matchTicket) => {
        ticket = matchTicket
      })
      .catch(() => {
        if (!active) return
        setStatus("Matchmaking failed. Try refreshing.")
      })

    return () => {
      active = false
      if (ticket) {
        void cancelMatchmaking(ticket).catch(() => {})
      }
    }
  }, [mode, onMatchFound])

  return (
    <div style={styles.card}>
      <div style={styles.spinnerWrap}>
        <div style={styles.spinner} />
      </div>
      <p style={styles.badge}>{mode === "timed" ? "Timed Queue" : "Classic Queue"}</p>
      <h2 style={styles.title}>Looking for an opponent</h2>
      <p style={styles.status}>{status}</p>
      <p style={styles.hint}>Signed in as {username}</p>
      <p style={styles.hint}>Keep this screen open while the server matches you.</p>
      <button style={styles.button} onClick={onBack}>
        Back to Lobby
      </button>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  card: {
    width: "min(92vw, 420px)",
    background: "#ffffff",
    borderRadius: 28,
    padding: "40px 30px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.12)",
  },
  spinnerWrap: {
    width: 90,
    height: 90,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f3f3",
  },
  spinner: {
    width: 48,
    height: 48,
    border: "4px solid #d7d7d7",
    borderTop: "4px solid #111111",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  badge: {
    margin: 0,
    padding: "6px 12px",
    borderRadius: 999,
    background: "#efefef",
    color: "#333333",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: 0,
    color: "#111111",
    fontSize: 30,
    fontWeight: 700,
  },
  status: {
    color: "#333333",
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1.5,
    margin: 0,
  },
  hint: { color: "#666666", margin: 0, fontSize: 14, textAlign: "center" },
  button: {
    marginTop: 8,
    padding: "12px 18px",
    borderRadius: 14,
    border: "1px solid #cfcfcf",
    background: "#ffffff",
    color: "#111111",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
}
