import { useEffect, useState, type CSSProperties } from "react"
import { sendMove, onMatchData, getSession } from "../nakama/client"
import type { GameState, Marker } from "../types/game"

interface Props {
  matchId: string
  username: string
}

export default function Board({ matchId, username }: Props) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [myMarker, setMyMarker] = useState<Marker>("")

  useEffect(() => {
    onMatchData((state) => {
      setGameState(state)

      // Figure out which marker we are from the players map
      const userId = getSession().user_id
      if (userId && state.players[userId]) {
        setMyMarker(state.players[userId])
      }
    })
  }, [])

  function handleCellClick(index: number) {
    if (!gameState || gameState.game_over) return
    if (gameState.turn !== myMarker) return // not your turn
    if (gameState.board[index] !== "") return // cell taken

    sendMove(matchId, index)
  }

  // Waiting for the second player to join
  if (!gameState) {
    return (
      <div style={styles.card}>
        <p>Waiting for game to start...</p>
      </div>
    )
  }

  const isMyTurn = gameState.turn === myMarker && !gameState.game_over
  const statusText = gameState.winner
    ? gameState.winner === myMarker
      ? "🎉 You win!"
      : "😔 You lose"
    : gameState.draw
      ? "🤝 It's a draw!"
      : isMyTurn
        ? "Your turn"
        : "Opponent's turn"

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Tic-Tac-Toe</h2>

      <div style={styles.info}>
        <span>
          {username}: <strong>{myMarker || "..."}</strong>
        </span>
        <span style={{ color: isMyTurn ? "#68d391" : "#a0aec0" }}>
          {statusText}
        </span>
      </div>

      <div style={styles.board}>
        {gameState.board.map((cell: Marker, i: number) => (
          <div
            key={i}
            style={{
              ...styles.cell,
              cursor: isMyTurn && cell === "" ? "pointer" : "default",
              color: cell === "X" ? "#e94560" : "#63b3ed",
            }}
            onClick={() => handleCellClick(i)}
          >
            {cell}
          </div>
        ))}
      </div>

      {gameState.game_over && (
        <button style={styles.button} onClick={() => window.location.reload()}>
          Play Again
        </button>
      )}
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
    gap: 24,
  },
  title: { margin: 0, fontSize: 28, fontWeight: 700 },
  info: {
    display: "flex",
    gap: 24,
    fontSize: 16,
  },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
  },
  cell: {
    width: 96,
    height: 96,
    background: "#0f3460",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 48,
    fontWeight: 700,
    transition: "background 0.15s",
  },
  button: {
    padding: "12px 32px",
    borderRadius: 8,
    border: "none",
    background: "#e94560",
    color: "white",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
}
