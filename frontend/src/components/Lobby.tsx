import { useEffect, useState, type CSSProperties } from "react"
import { createRoom, joinMatch, listRooms } from "../nakama/client"
import type { RoomMode, RoomSummary } from "../types/game"

interface Props {
  username: string
  onQuickMatch: (mode: RoomMode) => void
  onMatchFound: (matchId: string) => void
}

const ROOM_MODES: { label: string; value: RoomMode; detail: string }[] = [
  {
    label: "Classic",
    value: "classic",
    detail: "Normal turn-based tic-tac-toe",
  },
  {
    label: "Timed",
    value: "timed",
    detail: "30-second turn timer with forfeit on timeout",
  },
]

export default function Lobby({ username, onQuickMatch, onMatchFound }: Props) {
  const [selectedMode, setSelectedMode] = useState<RoomMode>("classic")
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [roomCode, setRoomCode] = useState("")
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [pendingAction, setPendingAction] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    void refreshRooms()
  }, [])

  async function refreshRooms() {
    setLoadingRooms(true)
    setError("")

    try {
      setRooms(await listRooms())
    } catch {
      setError("Could not load open rooms right now.")
    } finally {
      setLoadingRooms(false)
    }
  }

  async function handleCreateRoom() {
    setPendingAction("create")
    setError("")

    try {
      const room = await createRoom(selectedMode)
      const matchId = await joinMatch(room.match_id)
      onMatchFound(matchId)
    } catch {
      setError("Could not create a room. Try again.")
    } finally {
      setPendingAction("")
    }
  }

  async function handleJoinRoom(matchId: string) {
    setPendingAction(matchId)
    setError("")

    try {
      const joinedMatchId = await joinMatch(matchId)
      onMatchFound(joinedMatchId)
    } catch {
      setError("That room is no longer available.")
      void refreshRooms()
    } finally {
      setPendingAction("")
    }
  }

  async function handleJoinByCode() {
    const normalizedCode = roomCode.trim().toUpperCase()
    if (!normalizedCode) return

    setPendingAction("join-code")
    setError("")

    let latestRooms: RoomSummary[] = rooms
    try {
      latestRooms = await listRooms()
      setRooms(latestRooms)
    } catch {
      setPendingAction("")
      setError("Could not refresh rooms before joining by code.")
      return
    }

    const room = latestRooms.find(
      (candidate) => candidate.room_code.toUpperCase() === normalizedCode,
    )

    if (!room) {
      setPendingAction("")
      setError("No open room matches that code right now.")
      return
    }

    setSelectedMode(room.mode)
    await handleJoinRoom(room.match_id)
  }

  const filteredRooms = rooms.filter((room) => {
    const matchesMode = room.mode === selectedMode
    const normalizedCode = roomCode.trim().toUpperCase()
    const matchesCode =
      normalizedCode === "" || room.room_code.toUpperCase().includes(normalizedCode)
    return matchesMode && matchesCode
  })

  return (
    <div style={styles.shell}>
      <div style={styles.hero}>
        <p style={styles.eyebrow}>Signed in as {username}</p>
        <h1 style={styles.title}>Choose How You Want To Play</h1>
        <p style={styles.subtitle}>
          Quick match for instant pairing, or open a named room and invite someone
          in directly.
        </p>
      </div>

      <div style={styles.modeRow}>
        {ROOM_MODES.map((mode) => {
          const isActive = mode.value === selectedMode
          return (
            <button
              key={mode.value}
              style={{
                ...styles.modeButton,
                background: isActive ? "#111111" : "#ffffff",
                borderColor: isActive ? "#111111" : "#d2d2d2",
                color: isActive ? "#ffffff" : "#222222",
              }}
              onClick={() => setSelectedMode(mode.value)}
            >
              <span style={styles.modeLabel}>{mode.label}</span>
              <span style={styles.modeDetail}>{mode.detail}</span>
            </button>
          )
        })}
      </div>

      <div style={styles.panelGrid}>
        <section style={styles.primaryCard}>
          <p style={styles.sectionTag}>Quick Start</p>
          <h2 style={styles.sectionTitle}>Matchmaking</h2>
          <p style={styles.sectionText}>
            Find an opponent automatically for the selected mode.
          </p>
          <button
            style={styles.primaryButton}
            disabled={pendingAction !== ""}
            onClick={() => onQuickMatch(selectedMode)}
          >
            Quick Match
          </button>

          <div style={styles.divider} />

          <p style={styles.sectionTag}>Private Room</p>
          <h2 style={styles.sectionTitle}>Create Room</h2>
          <p style={styles.sectionText}>
            Create a room, copy the code, and wait inside for another player.
          </p>
          <button
            style={styles.secondaryButton}
            disabled={pendingAction !== ""}
            onClick={handleCreateRoom}
          >
            {pendingAction === "create" ? "Creating..." : "Create Room"}
          </button>
        </section>

        <section style={styles.secondaryCard}>
          <div style={styles.roomHeader}>
            <div>
              <p style={styles.sectionTag}>Open Rooms</p>
              <h2 style={styles.sectionTitle}>Discover Or Join</h2>
            </div>
            <button
              style={styles.ghostButton}
              disabled={loadingRooms || pendingAction !== ""}
              onClick={() => void refreshRooms()}
            >
              {loadingRooms ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div style={styles.joinBar}>
            <input
              style={styles.codeInput}
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              placeholder="Filter or paste room code"
            />
            <button
              style={styles.joinButton}
              disabled={pendingAction !== ""}
              onClick={() => void handleJoinByCode()}
            >
              {pendingAction === "join-code" ? "Checking..." : "Join Code"}
            </button>
          </div>

          <div style={styles.roomList}>
            {filteredRooms.length === 0 && !loadingRooms ? (
              <div style={styles.emptyState}>
                No open {selectedMode} rooms. Create one or use quick match.
              </div>
            ) : null}

            {filteredRooms.map((room) => (
              <div key={room.match_id} style={styles.roomItem}>
                <div style={styles.roomMeta}>
                  <span style={styles.roomCode}>{room.room_code}</span>
                  <span style={styles.roomBadge}>
                    {room.mode === "timed" ? "Timed" : "Classic"}
                  </span>
                  <span style={styles.roomCount}>{room.player_count}/2 players</span>
                </div>
                <button
                  style={styles.roomJoinButton}
                  disabled={pendingAction !== ""}
                  onClick={() => void handleJoinRoom(room.match_id)}
                >
                  {pendingAction === room.match_id ? "Joining..." : "Join"}
                </button>
              </div>
            ))}
          </div>

          {error ? <p style={styles.error}>{error}</p> : null}
        </section>
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  shell: {
    width: "min(94vw, 960px)",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  hero: {
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  eyebrow: {
    color: "#666666",
    fontSize: 14,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontSize: "clamp(2rem, 5vw, 3.8rem)",
    lineHeight: 1,
    color: "#111111",
  },
  subtitle: {
    margin: 0,
    color: "#555555",
    fontSize: 16,
    maxWidth: 680,
    lineHeight: 1.5,
  },
  modeRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  modeButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 6,
    borderRadius: 20,
    border: "1px solid #d2d2d2",
    padding: "18px 20px",
    cursor: "pointer",
    textAlign: "left",
  },
  modeLabel: {
    fontSize: 18,
    fontWeight: 700,
  },
  modeDetail: {
    fontSize: 14,
    lineHeight: 1.4,
  },
  panelGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 18,
  },
  primaryCard: {
    background: "#ffffff",
    borderRadius: 28,
    padding: 28,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.1)",
  },
  secondaryCard: {
    background: "#ffffff",
    borderRadius: 28,
    padding: 28,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.1)",
  },
  sectionTag: {
    color: "#666666",
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: "0.12em",
  },
  sectionTitle: {
    margin: 0,
    color: "#111111",
    fontSize: 28,
    fontWeight: 700,
  },
  sectionText: {
    color: "#555555",
    fontSize: 15,
    lineHeight: 1.55,
  },
  primaryButton: {
    border: "none",
    borderRadius: 16,
    padding: "14px 18px",
    background: "#111111",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cfcfcf",
    borderRadius: 16,
    padding: "14px 18px",
    background: "#ffffff",
    color: "#111111",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  ghostButton: {
    border: "1px solid #cfcfcf",
    borderRadius: 12,
    padding: "10px 14px",
    background: "transparent",
    color: "#333333",
    fontSize: 14,
    cursor: "pointer",
  },
  joinButton: {
    border: "none",
    borderRadius: 14,
    padding: "12px 16px",
    background: "#111111",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  divider: {
    height: 1,
    background: "#e5e5e5",
    margin: "4px 0",
  },
  roomHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  joinBar: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
  },
  codeInput: {
    width: "100%",
    padding: "13px 15px",
    borderRadius: 14,
    border: "1px solid #d0d0d0",
    background: "#f6f6f6",
    color: "#111111",
    fontSize: 15,
    boxSizing: "border-box",
    textTransform: "uppercase",
  },
  roomList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxHeight: 300,
    overflowY: "auto",
    paddingRight: 2,
  },
  roomItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    background: "#f6f6f6",
    borderRadius: 18,
    border: "1px solid #dddddd",
  },
  roomMeta: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  roomCode: {
    fontSize: 16,
    fontWeight: 700,
    color: "#111111",
    letterSpacing: "0.08em",
  },
  roomBadge: {
    padding: "4px 10px",
    borderRadius: 999,
    background: "#ececec",
    color: "#333333",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  roomCount: {
    color: "#666666",
    fontSize: 13,
  },
  roomJoinButton: {
    border: "none",
    borderRadius: 12,
    padding: "10px 14px",
    background: "#111111",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  emptyState: {
    borderRadius: 18,
    border: "1px dashed #cfcfcf",
    padding: "22px 16px",
    color: "#666666",
    fontSize: 14,
    lineHeight: 1.5,
  },
  error: {
    color: "#8a3b3b",
    fontSize: 14,
    lineHeight: 1.5,
  },
}
