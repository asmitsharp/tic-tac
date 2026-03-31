import { useEffect, useState, type CSSProperties } from "react"
import {
  getMatchState,
  getSession,
  onMatchData,
  sendMove,
} from "../nakama/client"
import type { GameState, Marker } from "../types/game"

interface Props {
  matchId: string
  onExit: () => void
  username: string
}

export default function Board({ matchId, onExit, username }: Props) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [myMarker, setMyMarker] = useState<Marker>("")

  useEffect(() => {
    let active = true

    function syncPlayer(state: GameState) {
      const userId = getSession().user_id
      if (userId && state.players[userId]) {
        setMyMarker(state.players[userId])
      }
    }

    onMatchData((state) => {
      if (!active) return
      setGameState(state)
      syncPlayer(state)
    })

    void getMatchState(matchId)
      .then((state) => {
        if (!active) return
        setGameState(state)
        syncPlayer(state)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [matchId])

  function handleCellClick(index: number) {
    if (!gameState || gameState.game_over) return
    if (gameState.status !== "active") return
    if (gameState.turn !== myMarker) return
    if (gameState.board[index] !== "") return

    sendMove(matchId, index)
  }

  if (!gameState) {
    return (
      <div style={styles.shell}>
        <div style={styles.card}>
          <p style={styles.badge}>Joining Room</p>
          <h2 style={styles.title}>Connecting to authoritative match...</h2>
          <p style={styles.subtitle}>
            Nakama is preparing the match state for {username}.
          </p>
          <button style={styles.secondaryButton} onClick={onExit}>
            Back to Lobby
          </button>
        </div>
      </div>
    )
  }

  const userId = getSession().user_id ?? ""
  const myName = gameState.player_names[userId] ?? username
  const opponentEntry = Object.entries(gameState.player_names).find(
    ([playerId]) => playerId !== userId,
  )
  const opponentName = opponentEntry?.[1] ?? "Waiting..."
  const opponentMarker =
    opponentEntry && gameState.players[opponentEntry[0]]
      ? gameState.players[opponentEntry[0]]
      : ""
  const isMyTurn = gameState.turn === myMarker && !gameState.game_over

  const statusText = getStatusText(gameState, myMarker)
  const actionLabel = gameState.status === "waiting" ? "Cancel Room" : "Back to Lobby"
  const winnerName = getWinnerName(gameState)
  const modalTitle = gameState.draw
    ? "Match Drawn"
    : gameState.status === "abandoned"
      ? "Match Ended"
      : winnerName
        ? `${winnerName} won the match`
        : "Match Complete"
  const modalText = gameState.draw
    ? "No winner this round. The server confirmed a draw."
    : gameState.status === "abandoned"
      ? gameState.message || "The match ended because a player disconnected."
      : winnerName
        ? `${winnerName} is the winner of this round.`
        : "The match has finished."

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.headerCopy}>
            <p style={styles.badge}>
              Room {gameState.room_code} •{" "}
              {gameState.mode === "timed" ? "Timed Mode" : "Classic Mode"}
            </p>
            <h2 style={styles.title}>Server-Authoritative Tic-Tac-Toe</h2>
            <p style={styles.subtitle}>{statusText}</p>
          </div>

          <div style={styles.chips}>
            <span style={styles.chip}>{gameState.player_count}/2 players</span>
            {gameState.mode === "timed" ? (
              <span style={styles.chip}>{gameState.countdown_seconds}s left</span>
            ) : (
              <span style={styles.chip}>No turn timer</span>
            )}
          </div>
        </div>

        <div style={styles.players}>
          <div
            style={{
              ...styles.playerCard,
              borderColor: myMarker === gameState.turn ? "#111111" : "#d0d0d0",
            }}
          >
            <span style={styles.playerRole}>You</span>
            <strong style={styles.playerName}>{myName}</strong>
            <span style={styles.playerMarker}>{myMarker || "..."}</span>
          </div>

          <div
            style={{
              ...styles.playerCard,
              borderColor:
                opponentMarker !== "" && opponentMarker === gameState.turn
                  ? "#111111"
                  : "#d0d0d0",
            }}
          >
            <span style={styles.playerRole}>Opponent</span>
            <strong style={styles.playerName}>{opponentName}</strong>
            <span style={styles.playerMarker}>{opponentMarker || "..."}</span>
          </div>
        </div>

        <div style={styles.board}>
          {gameState.board.map((cell: Marker, index: number) => (
            <button
              key={index}
              style={{
                ...styles.cell,
                cursor:
                  isMyTurn && cell === "" && gameState.status === "active"
                    ? "pointer"
                    : "default",
                color: cell === "X" ? "#111111" : "#6b6b6b",
                opacity: gameState.status === "waiting" ? 0.75 : 1,
              }}
              disabled={
                gameState.status !== "active" || !isMyTurn || cell !== "" || gameState.game_over
              }
              onClick={() => handleCellClick(index)}
            >
              {cell}
            </button>
          ))}
        </div>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            {gameState.message || "Validated moves are broadcast from the server."}
          </p>
          <button style={styles.secondaryButton} onClick={onExit}>
            {actionLabel}
          </button>
        </div>

        {gameState.game_over && (
          <div style={styles.modalBackdrop}>
            <div style={styles.modal}>
              <p style={styles.modalBadge}>Result</p>
              <h3 style={styles.modalTitle}>{modalTitle}</h3>
              <p style={styles.modalText}>{modalText}</p>
              <button style={styles.primaryButton} onClick={onExit}>
                Return to Lobby
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getStatusText(gameState: GameState, myMarker: Marker): string {
  if (gameState.status === "waiting") {
    return `Share room code ${gameState.room_code} and wait for another player to join.`
  }

  if (gameState.status === "abandoned") {
    return gameState.message || "A player disconnected."
  }

  if (gameState.winner) {
    return gameState.winner === myMarker ? "You win the match." : "You lose the match."
  }

  if (gameState.draw) {
    return "The match ended in a draw."
  }

  if (gameState.message) {
    return gameState.message
  }

  return gameState.turn === myMarker ? "Your turn" : "Opponent's turn"
}

function getWinnerName(gameState: GameState): string {
  if (!gameState.winner) return ""

  const winnerEntry = Object.entries(gameState.players).find(
    ([, marker]) => marker === gameState.winner,
  )
  if (!winnerEntry) return gameState.winner

  return gameState.player_names[winnerEntry[0]] ?? gameState.winner
}

const styles: Record<string, CSSProperties> = {
  shell: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
  },
  card: {
    width: "min(94vw, 720px)",
    position: "relative",
    background: "#ffffff",
    borderRadius: 30,
    padding: "min(6vw, 34px)",
    display: "flex",
    flexDirection: "column",
    gap: 22,
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.12)",
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  headerCopy: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    textAlign: "left",
  },
  badge: {
    margin: 0,
    color: "#6f6f6f",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  title: {
    margin: 0,
    color: "#111111",
    fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
    lineHeight: 1.05,
  },
  subtitle: {
    margin: 0,
    color: "#545454",
    fontSize: 15,
    lineHeight: 1.5,
    maxWidth: 460,
    textAlign: "left",
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    padding: "9px 12px",
    borderRadius: 999,
    background: "#f1f1f1",
    color: "#333333",
    fontSize: 13,
    fontWeight: 700,
  },
  players: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  playerCard: {
    background: "#f7f7f7",
    border: "1px solid #d0d0d0",
    borderRadius: 20,
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    textAlign: "left",
  },
  playerRole: {
    color: "#6f6f6f",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  playerName: {
    color: "#111111",
    fontSize: 18,
  },
  playerMarker: {
    color: "#444444",
    fontSize: 15,
    fontWeight: 700,
  },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "min(2vw, 12px)",
    alignSelf: "center",
    width: "min(88vw, 360px)",
  },
  cell: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 22,
    border: "1px solid #d8d8d8",
    background: "#f4f4f4",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "clamp(2.2rem, 9vw, 4rem)",
    fontWeight: 800,
    transition: "transform 0.15s ease, background 0.15s ease",
  },
  footer: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  footerText: {
    margin: 0,
    color: "#666666",
    fontSize: 14,
    lineHeight: 1.5,
    textAlign: "left",
    flex: "1 1 240px",
  },
  secondaryButton: {
    border: "1px solid #cfcfcf",
    borderRadius: 14,
    padding: "12px 18px",
    background: "#ffffff",
    color: "#111111",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  primaryButton: {
    border: "none",
    borderRadius: 14,
    padding: "12px 18px",
    background: "#111111",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  modalBackdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(0, 0, 0, 0.38)",
    borderRadius: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    width: "min(100%, 360px)",
    background: "#ffffff",
    borderRadius: 24,
    padding: "28px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 18px 54px rgba(0, 0, 0, 0.2)",
  },
  modalBadge: {
    margin: 0,
    color: "#6f6f6f",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  modalTitle: {
    margin: 0,
    color: "#111111",
    fontSize: 28,
    lineHeight: 1.1,
    textAlign: "center",
  },
  modalText: {
    margin: 0,
    color: "#555555",
    fontSize: 15,
    lineHeight: 1.5,
    textAlign: "center",
  },
}
