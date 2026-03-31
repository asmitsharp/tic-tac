import { useState, type CSSProperties } from "react"
import { authenticate, connectSocket } from "../nakama/client"

interface Props {
  onLogin: (username: string) => void
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit() {
    if (!username.trim()) return
    setLoading(true)
    setError("")
    try {
      await authenticate(username.trim())
      await connectSocket()
      onLogin(username.trim())
    } catch {
      setError("Failed to connect. Is Nakama running?")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.card}>
      <p style={styles.badge}>Realtime Multiplayer</p>
      <h1 style={styles.title}>Tic-Tac-Toe Arena</h1>
      <p style={styles.subtitle}>
        Sign in with a display name to enter matchmaking, create private rooms,
        or test timed mode.
      </p>
      <input
        style={styles.input}
        autoFocus
        maxLength={20}
        placeholder="Enter your display name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        disabled={loading}
      />
      <button style={styles.button} onClick={handleSubmit} disabled={loading}>
        {loading ? "Connecting..." : "Play"}
      </button>
      {error && <p style={styles.error}>{error}</p>}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  card: {
    width: "min(92vw, 460px)",
    background: "#ffffff",
    borderRadius: 28,
    padding: "40px 30px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 18,
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.12)",
  },
  badge: {
    margin: 0,
    color: "#666666",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  title: {
    margin: 0,
    fontSize: "clamp(2.2rem, 6vw, 3.6rem)",
    lineHeight: 1,
    fontWeight: 800,
    color: "#111111",
  },
  subtitle: {
    margin: 0,
    color: "#555555",
    lineHeight: 1.55,
    fontSize: 15,
    textAlign: "center",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #d0d0d0",
    background: "#f5f5f5",
    color: "#111111",
    fontSize: 16,
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "none",
    background: "#111111",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  error: { color: "#8a3b3b", margin: 0, textAlign: "center", lineHeight: 1.5 },
}
