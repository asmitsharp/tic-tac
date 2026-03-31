import { useCallback, useState, type CSSProperties } from "react"
import Login from "./components/Login"
import Matchmaking from "./components/MatchMaking"
import Board from "./components/Board"

const SCREEN = {
  Login: "login",
  Matchmaking: "matchmaking",
  Game: "game",
} as const

type Screen = (typeof SCREEN)[keyof typeof SCREEN]

export default function App() {
  const [screen, setScreen] = useState<Screen>(SCREEN.Login)
  const [username, setUsername] = useState("")
  const [matchId, setMatchId] = useState<string | null>(null)

  const handleLoggedIn = useCallback((name: string) => {
    setUsername(name)
    setScreen(SCREEN.Matchmaking)
  }, [])

  const handleMatchFound = useCallback((id: string) => {
    setMatchId(id)
    setScreen(SCREEN.Game)
  }, [])

  return (
    <div style={styles.container}>
      {screen === SCREEN.Login && <Login onLogin={handleLoggedIn} />}
      {screen === SCREEN.Matchmaking && (
        <Matchmaking username={username} onMatchFound={handleMatchFound} />
      )}
      {screen === SCREEN.Game && matchId && (
        <Board matchId={matchId} username={username} />
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
    backgroundColor: "#1a1a2e",
    fontFamily: "sans-serif",
    color: "white",
  },
}
