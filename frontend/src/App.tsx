import { useCallback, useState, type CSSProperties } from "react"
import Lobby from "./components/Lobby"
import Login from "./components/Login"
import Matchmaking from "./components/MatchMaking"
import Board from "./components/Board"
import { leaveMatch } from "./nakama/client"
import type { RoomMode } from "./types/game"

const SCREEN = {
  Login: "login",
  Lobby: "lobby",
  Matchmaking: "matchmaking",
  Game: "game",
} as const

type Screen = (typeof SCREEN)[keyof typeof SCREEN]

export default function App() {
  const [screen, setScreen] = useState<Screen>(SCREEN.Login)
  const [username, setUsername] = useState("")
  const [matchId, setMatchId] = useState<string | null>(null)
  const [matchMode, setMatchMode] = useState<RoomMode>("classic")

  const handleLoggedIn = useCallback((name: string) => {
    setUsername(name)
    setScreen(SCREEN.Lobby)
  }, [])

  const handleMatchFound = useCallback((id: string) => {
    setMatchId(id)
    setScreen(SCREEN.Game)
  }, [])

  const handleQuickMatch = useCallback((mode: RoomMode) => {
    setMatchMode(mode)
    setScreen(SCREEN.Matchmaking)
  }, [])

  const handleExitMatch = useCallback(() => {
    if (matchId) {
      void leaveMatch(matchId).catch(() => {})
    }
    setMatchId(null)
    setScreen(SCREEN.Lobby)
  }, [matchId])

  return (
    <div style={styles.container}>
      {screen === SCREEN.Login && <Login onLogin={handleLoggedIn} />}
      {screen === SCREEN.Lobby && (
        <Lobby
          username={username}
          onQuickMatch={handleQuickMatch}
          onMatchFound={handleMatchFound}
        />
      )}
      {screen === SCREEN.Matchmaking && (
        <Matchmaking
          mode={matchMode}
          username={username}
          onBack={() => setScreen(SCREEN.Lobby)}
          onMatchFound={handleMatchFound}
        />
      )}
      {screen === SCREEN.Game && matchId && (
        <Board
          matchId={matchId}
          onExit={handleExitMatch}
          username={username}
        />
      )}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(180deg, #f4f4f4 0%, #ebebeb 100%)",
    padding: "24px",
    fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
    color: "#111111",
  },
}
