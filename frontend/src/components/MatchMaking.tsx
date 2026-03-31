import { useEffect, useState, type CSSProperties } from "react"
import {
  cancelMatchmaking,
  findMatch,
  joinMatch,
  onMatchmakerMatched,
} from "../nakama/client"

interface Props {
  username: string
  onMatchFound: (matchId: string) => void
}

export default function Matchmaking({ username, onMatchFound }: Props) {
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
    findMatch()
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
  }, [onMatchFound])

  return (
    <div style={styles.card}>
      <div style={styles.spinner} />
      <p style={styles.status}>{status}</p>
      <p style={styles.hint}>Signed in as {username}</p>
      <p style={styles.hint}>
        Open another browser tab to play against yourself
      </p>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: "#16213e",
    borderRadius: 16,
    padding: "40px 48px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
    minWidth: 320,
  },
  spinner: {
    width: 48,
    height: 48,
    border: "4px solid #2d3748",
    borderTop: "4px solid #e94560",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  status: { fontSize: 18, fontWeight: 600, margin: 0 },
  hint: { color: "#a0aec0", margin: 0, fontSize: 14, textAlign: "center" },
}
