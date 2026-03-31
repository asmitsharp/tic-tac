package game

// marker represents cell value : X, O, or empty
type Marker string

const (
	Empty Marker = ""
	X     Marker = "X"
	O     Marker = "O"
)

// game state
type State struct {
	Board    [9]Marker `json:"board"`
	Turn     Marker    `json:"turn"`
	Winner   Marker    `json:"winner"`
	Draw     bool      `json:"draw"`
	GameOver bool      `json:"game_over"`
}

func NewState() *State {
	return &State{
		Board: [9]Marker{},
		Turn:  X,
	}
}

func MakeMove(s *State, index int, marker Marker) (string, bool) {
	if s.GameOver {
		return "game is over", false
	}

	if s.Turn != marker {
		return "not your turn", false
	}

	if index < 0 || index > 8 {
		return "invalid cell index", false
	}

	if s.Board[index] != Empty {
		return "cell already occupied", false
	}

	s.Board[index] = marker

	// check if the move wins the game
	if checkWinner(s.Board, marker) {
		s.Winner = marker
		s.GameOver = true
		return "", true
	}

	// draw
	if checkDraw(s.Board) {
		s.Draw = true
		s.GameOver = true
		return "", true
	}

	if marker == X {
		s.Turn = O
	} else {
		s.Turn = X
	}

	return "", true
}

func checkWinner(board [9]Marker, marker Marker) bool {
	winningLines := [8][3]int{
		{0, 1, 2},
		{3, 4, 5},
		{6, 7, 8},
		{0, 3, 6},
		{1, 4, 7},
		{2, 5, 8},
		{0, 4, 8},
		{2, 4, 6},
	}

	for _, line := range winningLines {
		if board[line[0]] == marker &&
			board[line[1]] == marker &&
			board[line[2]] == marker {
			return true
		}
	}

	return false
}

func checkDraw(board [9]Marker) bool {
	for _, cell := range board {
		if cell == Empty {
			return false
		}
	}

	if checkWinner(board, X) || checkWinner(board, O) {
		return false
	}

	return true
}
