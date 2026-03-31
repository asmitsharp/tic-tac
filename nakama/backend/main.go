package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"tictactoe_backend/game"

	"github.com/heroiclabs/nakama-common/runtime"
)

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	err := initializer.RegisterMatch("tictactoe", func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
		return &MatchHandler{}, nil
	})
	if err != nil {
		return err
	}

	if err := initializer.RegisterRpc("create_match", createMatchRPC); err != nil {
		return err
	}

	if err := initializer.RegisterMatchmakerMatched(matchmakerMatched); err != nil {
		return err
	}

	logger.Info("Tic-Tac-Toe module loaded successfully")
	return nil
}

func matchmakerMatched(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, entries []runtime.MatchmakerEntry) (string, error) {
	matchID, err := nk.MatchCreate(ctx, "tictactoe", map[string]interface{}{})
	if err != nil {
		logger.Error("Failed to create matchmaker match: %v", err)
		return "", err
	}

	logger.Info("Created authoritative match %s for %d matched players", matchID, len(entries))
	return matchID, nil
}

func createMatchRPC(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	matchID, err := nk.MatchCreate(ctx, "tictactoe", map[string]interface{}{})
	if err != nil {
		logger.Error("Failed to create match: %v", err)
		return "", runtime.NewError("unable to create match", 13)
	}

	response, err := json.Marshal(map[string]string{
		"match_id": matchID,
	})
	if err != nil {
		logger.Error("Failed to marshal create match response: %v", err)
		return "", runtime.NewError("unable to encode response", 13)
	}

	return string(response), nil
}

type MatchHandler struct{}

type MatchState struct {
	GameState *game.State
	Players   map[string]game.Marker
}

func (m *MatchHandler) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	state := &MatchState{
		GameState: game.NewState(),
		Players:   make(map[string]game.Marker),
	}

	tickRate := 10
	label := "tictactoe"

	logger.Info("Match created")
	return state, tickRate, label
}

func (m *MatchHandler) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	ms := state.(*MatchState)

	if len(ms.Players) >= 2 {
		return ms, false, "match is full"
	}

	return ms, true, ""
}

func (m *MatchHandler) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	ms := state.(*MatchState)

	for _, p := range presences {
		if len(ms.Players) == 0 {
			ms.Players[p.GetUserId()] = game.X // First player gets X
			logger.Info("Player joined as X: %s", p.GetUserId())
		} else {
			ms.Players[p.GetUserId()] = game.O // Second player gets O
			logger.Info("Player joined as O: %s", p.GetUserId())
		}
	}

	if len(ms.Players) == 2 {
		m.broadcastState(dispatcher, ms)
	}

	return ms
}

func (m *MatchHandler) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	ms := state.(*MatchState)

	for _, p := range presences {
		delete(ms.Players, p.GetUserId())
		logger.Info("Player left: %s", p.GetUserId())
	}

	ms.GameState.GameOver = true

	return ms
}

func (m *MatchHandler) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	ms := state.(*MatchState)
	if ms.GameState.GameOver && len(ms.Players) < 2 {
		logger.Info("Match ending — player left")
		return nil
	}

	for _, msg := range messages {
		if msg.GetOpCode() != 1 {
			continue
		}

		var moveMsg struct {
			Index int `json:"index"`
		}
		if err := json.Unmarshal(msg.GetData(), &moveMsg); err != nil {
			logger.Error("Failed to parse move message: %v", err)
			continue
		}

		marker, exists := ms.Players[msg.GetUserId()]
		if !exists {
			logger.Warn("Move from unknown player: %s", msg.GetUserId())
			continue
		}

		errMsg, ok := game.MakeMove(ms.GameState, moveMsg.Index, marker)
		if !ok {
			logger.Warn("Invalid move from %s: %s", msg.GetUserId(), errMsg)
			continue
		}

		m.broadcastState(dispatcher, ms)

		if ms.GameState.GameOver {
			return ms
		}
	}

	return ms
}

func (m *MatchHandler) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	logger.Info("Match terminated")
	return state
}

func (m *MatchHandler) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, ""
}

func (m *MatchHandler) broadcastState(dispatcher runtime.MatchDispatcher, ms *MatchState) {
	payload := map[string]interface{}{
		"board":     ms.GameState.Board,
		"turn":      ms.GameState.Turn,
		"winner":    ms.GameState.Winner,
		"draw":      ms.GameState.Draw,
		"game_over": ms.GameState.GameOver,
		"players":   ms.Players,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	dispatcher.BroadcastMessage(2, data, nil, nil, true)
}
