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
      <h1 style={styles.title}>Tic-Tac-Toe</h1>
      <p style={styles.subtitle}>Enter your name to play</p>
      <input
        style={styles.input}
        placeholder="Your name"
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
    background: "#16213e",
    borderRadius: 16,
    padding: "40px 48px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    minWidth: 320,
  },
  title: { margin: 0, fontSize: 32, fontWeight: 700 },
  subtitle: { margin: 0, color: "#a0aec0" },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 8,
    border: "1px solid #2d3748",
    background: "#0f3460",
    color: "white",
    fontSize: 16,
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 8,
    border: "none",
    background: "#e94560",
    color: "white",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  error: { color: "#fc8181", margin: 0 },
}
