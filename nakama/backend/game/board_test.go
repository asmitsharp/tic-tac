package game

import "testing"

func TestNewGame(t *testing.T) {
	s := NewState()

	if s.Turn != X {
		t.Errorf("expected X to go first, got %s", s.Turn)
	}
}

func TestValidMove(t *testing.T) {
	s := NewState()
	_, ok := MakeMove(s, 0, X)
	if !ok {
		t.Error("expected valid move to succed")
	}

	if s.Turn != O {
		t.Errorf("expected O's turn after X moved but got %s", s.Turn)
	}
}

func TestWrongTurn(t *testing.T) {
	s := NewState()

	errMsg, ok := MakeMove(s, 0, O)
	if ok {
		t.Error("expected move to fail because its not O's turn")
	}

	if errMsg != "not your turn" {
		t.Errorf("unexpected error message: %s", errMsg)
	}
}

func TestWinDetection(t *testing.T) {
	s := NewState()
	// x wins by filling the top row
	MakeMove(s, 0, X)
	MakeMove(s, 3, O)
	MakeMove(s, 1, X)
	MakeMove(s, 4, O)
	MakeMove(s, 2, X)

	if s.Winner != X {
		t.Errorf("expected X to win, got '%s'", s.Winner)
	}
	if !s.GameOver {
		t.Error("expected game to be over after X wins")
	}
}

func TestDrawDetection(t *testing.T) {
	s := NewState()

	moves := []struct {
		index  int
		marker Marker
	}{
		{0, X}, {1, O},
		{2, X}, {4, O},
		{3, X}, {5, O},
		{7, X}, {6, O},
		{8, X},
	}

	for _, m := range moves {
		MakeMove(s, m.index, m.marker)
	}

	if !s.Draw {
		t.Error("expected draw")
	}
	if !s.GameOver {
		t.Error("expected game over on draw")
	}
}

func TestCheckDrawRejectsWinningBoard(t *testing.T) {
	board := [9]Marker{
		X, O, X,
		O, X, O,
		O, X, X,
	}

	if checkDraw(board) {
		t.Error("expected full winning board not to be a draw")
	}
}
