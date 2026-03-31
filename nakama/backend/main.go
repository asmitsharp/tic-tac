package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"tictactoe_backend/game"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

const (
	defaultTickRate           = 1
	matchLabelApp             = "tictactoe"
	defaultTurnDuration int64 = 30
)

type MatchMode string

const (
	MatchModeClassic MatchMode = "classic"
	MatchModeTimed   MatchMode = "timed"
)

type createMatchRequest struct {
	Mode string `json:"mode"`
}

type createMatchResponse struct {
	MatchID  string `json:"match_id"`
	RoomCode string `json:"room_code"`
	Mode     string `json:"mode"`
}

type listRoomsRequest struct {
	Mode string `json:"mode"`
}

type roomSummary struct {
	MatchID     string `json:"match_id"`
	RoomCode    string `json:"room_code"`
	Mode        string `json:"mode"`
	PlayerCount int    `json:"player_count"`
}

type listRoomsResponse struct {
	Rooms []roomSummary `json:"rooms"`
}

type getMatchStateRequest struct {
	MatchID string `json:"match_id"`
}

type roomLabel struct {
	App      string `json:"app"`
	RoomCode string `json:"room_code"`
	Mode     string `json:"mode"`
}

type MatchHandler struct{}

type MatchState struct {
	GameState           *game.State
	Players             map[string]game.Marker
	PlayerNames         map[string]string
	RoomCode            string
	Mode                MatchMode
	Message             string
	TurnDurationSeconds int64
	TurnDeadlineUnix    int64
}

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

	if err := initializer.RegisterRpc("list_rooms", listRoomsRPC); err != nil {
		return err
	}

	if err := initializer.RegisterRpc("get_match_state", getMatchStateRPC); err != nil {
		return err
	}

	if err := initializer.RegisterMatchmakerOverride(matchmakerOverride); err != nil {
		return err
	}

	if err := initializer.RegisterMatchmakerMatched(matchmakerMatched); err != nil {
		return err
	}

	logger.Info("Tic-Tac-Toe module loaded successfully")
	return nil
}

func createMatchRPC(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	request := createMatchRequest{}
	if payload != "" {
		if err := json.Unmarshal([]byte(payload), &request); err != nil {
			return "", runtime.NewError("invalid create room payload", 3)
		}
	}

	mode := normalizeMode(request.Mode)
	params := newMatchParams(mode)

	matchID, err := nk.MatchCreate(ctx, "tictactoe", params)
	if err != nil {
		logger.Error("Failed to create match: %v", err)
		return "", runtime.NewError("unable to create match", 13)
	}

	response, err := json.Marshal(createMatchResponse{
		MatchID:  matchID,
		RoomCode: params["room_code"].(string),
		Mode:     string(mode),
	})
	if err != nil {
		logger.Error("Failed to marshal create match response: %v", err)
		return "", runtime.NewError("unable to encode response", 13)
	}

	return string(response), nil
}

func listRoomsRPC(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	request := listRoomsRequest{}
	if payload != "" {
		if err := json.Unmarshal([]byte(payload), &request); err != nil {
			return "", runtime.NewError("invalid room list payload", 3)
		}
	}

	matches, err := nk.MatchList(ctx, 50, true, "", nil, nil, "")
	if err != nil {
		logger.Error("Failed to list rooms: %v", err)
		return "", runtime.NewError("unable to list rooms", 13)
	}

	modeFilter := normalizeMode(request.Mode)
	rooms := make([]roomSummary, 0, len(matches))
	for _, match := range matches {
		if match.GetHandlerName() != "tictactoe" {
			continue
		}
		if match.GetSize() <= 0 || match.GetSize() >= 2 {
			continue
		}

		labelValue := match.GetLabel()
		if labelValue == nil {
			continue
		}

		label, ok := parseRoomLabel(labelValue.GetValue())
		if !ok || label.App != matchLabelApp {
			continue
		}

		if request.Mode != "" && label.Mode != string(modeFilter) {
			continue
		}

		rooms = append(rooms, roomSummary{
			MatchID:     match.GetMatchId(),
			RoomCode:    label.RoomCode,
			Mode:        label.Mode,
			PlayerCount: int(match.GetSize()),
		})
	}

	sort.Slice(rooms, func(i, j int) bool {
		return rooms[i].RoomCode < rooms[j].RoomCode
	})

	response, err := json.Marshal(listRoomsResponse{Rooms: rooms})
	if err != nil {
		logger.Error("Failed to marshal room list: %v", err)
		return "", runtime.NewError("unable to encode response", 13)
	}

	return string(response), nil
}

func getMatchStateRPC(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	request := getMatchStateRequest{}
	if payload == "" {
		return "", runtime.NewError("match id is required", 3)
	}
	if err := json.Unmarshal([]byte(payload), &request); err != nil {
		return "", runtime.NewError("invalid match state payload", 3)
	}
	if strings.TrimSpace(request.MatchID) == "" {
		return "", runtime.NewError("match id is required", 3)
	}

	response, err := nk.MatchSignal(ctx, request.MatchID, "state")
	if err != nil {
		logger.Error("Failed to fetch match state: %v", err)
		return "", runtime.NewError("unable to fetch match state", 13)
	}

	return response, nil
}

func matchmakerOverride(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, candidateMatches [][]runtime.MatchmakerEntry) [][]runtime.MatchmakerEntry {
	filtered := make([][]runtime.MatchmakerEntry, 0, len(candidateMatches))
	for _, candidate := range candidateMatches {
		if len(candidate) == 0 {
			continue
		}

		mode := modeFromProperties(candidate[0].GetProperties())
		valid := true
		for _, entry := range candidate[1:] {
			if modeFromProperties(entry.GetProperties()) != mode {
				valid = false
				break
			}
		}

		if valid {
			filtered = append(filtered, candidate)
		}
	}

	return filtered
}

func matchmakerMatched(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, entries []runtime.MatchmakerEntry) (string, error) {
	mode := MatchModeClassic
	if len(entries) > 0 {
		mode = modeFromProperties(entries[0].GetProperties())
	}

	params := newMatchParams(mode)
	matchID, err := nk.MatchCreate(ctx, "tictactoe", params)
	if err != nil {
		logger.Error("Failed to create matchmaker match: %v", err)
		return "", err
	}

	logger.Info("Created authoritative match %s for %d matched players", matchID, len(entries))
	return matchID, nil
}

func (m *MatchHandler) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	mode := normalizeMode(stringParam(params, "mode"))
	roomCode := stringParam(params, "room_code")
	if roomCode == "" {
		roomCode = generateRoomCode()
	}

	labelJSON, _ := json.Marshal(roomLabel{
		App:      matchLabelApp,
		RoomCode: roomCode,
		Mode:     string(mode),
	})

	state := &MatchState{
		GameState:           game.NewState(),
		Players:             make(map[string]game.Marker),
		PlayerNames:         make(map[string]string),
		RoomCode:            roomCode,
		Mode:                mode,
		Message:             "Waiting for an opponent...",
		TurnDurationSeconds: turnDurationForMode(mode),
	}

	logger.Info("Match created")
	return state, defaultTickRate, string(labelJSON)
}

func (m *MatchHandler) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	ms := state.(*MatchState)

	if _, exists := ms.Players[presence.GetUserId()]; exists {
		return ms, false, "player is already in this match"
	}
	if len(ms.Players) >= 2 {
		return ms, false, "match is full"
	}

	return ms, true, ""
}

func (m *MatchHandler) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	ms := state.(*MatchState)

	for _, p := range presences {
		if _, exists := ms.Players[p.GetUserId()]; exists {
			continue
		}

		marker := nextMarker(ms)
		ms.Players[p.GetUserId()] = marker
		ms.PlayerNames[p.GetUserId()] = p.GetUsername()
		logger.Info("Player joined as %s: %s", marker, p.GetUserId())
	}

	if len(ms.Players) < 2 {
		ms.Message = "Waiting for an opponent..."
		ms.TurnDeadlineUnix = 0
	} else {
		resetTurnDeadline(ms)
		ms.Message = fmt.Sprintf("%s starts the match", playerNameForMarker(ms, game.X))
	}

	m.broadcastState(dispatcher, ms)
	return ms
}

func (m *MatchHandler) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	ms := state.(*MatchState)
	leftNames := make([]string, 0, len(presences))

	for _, p := range presences {
		if name, exists := ms.PlayerNames[p.GetUserId()]; exists {
			leftNames = append(leftNames, name)
		}
		delete(ms.Players, p.GetUserId())
		delete(ms.PlayerNames, p.GetUserId())
		logger.Info("Player left: %s", p.GetUserId())
	}

	ms.TurnDeadlineUnix = 0
	if len(ms.Players) == 0 {
		ms.GameState.GameOver = true
		ms.Message = "Match closed."
		return ms
	}

	if !ms.GameState.GameOver {
		ms.GameState.GameOver = true
		ms.GameState.Winner = remainingMarker(ms)
	}

	if len(leftNames) > 0 {
		ms.Message = fmt.Sprintf("%s disconnected. Match ended.", strings.Join(leftNames, ", "))
	} else {
		ms.Message = "A player disconnected. Match ended."
	}

	m.broadcastState(dispatcher, ms)
	return ms
}

func (m *MatchHandler) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	ms := state.(*MatchState)
	if ms.GameState.GameOver && len(ms.Players) < 2 {
		logger.Info("Match ending due to an incomplete player roster")
		return nil
	}

	stateChanged := false
	for _, msg := range messages {
		if msg.GetOpCode() != 1 || ms.GameState.GameOver {
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

		stateChanged = true
		if ms.GameState.GameOver {
			ms.TurnDeadlineUnix = 0
			switch {
			case ms.GameState.Draw:
				ms.Message = "The game ended in a draw."
			case ms.GameState.Winner != game.Empty:
				ms.Message = fmt.Sprintf("%s wins the game.", playerNameForMarker(ms, ms.GameState.Winner))
			}
			continue
		}

		resetTurnDeadline(ms)
		ms.Message = fmt.Sprintf("%s to move", playerNameForMarker(ms, ms.GameState.Turn))
	}

	if !ms.GameState.GameOver && ms.Mode == MatchModeTimed && len(ms.Players) == 2 && ms.TurnDeadlineUnix > 0 && time.Now().Unix() >= ms.TurnDeadlineUnix {
		timedOutMarker := ms.GameState.Turn
		ms.GameState.Winner = oppositeMarker(timedOutMarker)
		ms.GameState.GameOver = true
		ms.TurnDeadlineUnix = 0
		ms.Message = fmt.Sprintf("%s ran out of time.", playerNameForMarker(ms, timedOutMarker))
		stateChanged = true
	}

	if stateChanged || (ms.Mode == MatchModeTimed && len(ms.Players) == 2 && !ms.GameState.GameOver) {
		m.broadcastState(dispatcher, ms)
	}

	return ms
}

func (m *MatchHandler) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	logger.Info("Match terminated")
	return state
}

func (m *MatchHandler) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	ms := state.(*MatchState)
	if data == "state" {
		return ms, serializeMatchState(ms)
	}
	return ms, ""
}

func (m *MatchHandler) broadcastState(dispatcher runtime.MatchDispatcher, ms *MatchState) {
	data := serializeMatchState(ms)
	if data == "" {
		return
	}
	dispatcher.BroadcastMessage(2, []byte(data), nil, nil, true)
}

func serializeMatchState(ms *MatchState) string {
	payload := map[string]interface{}{
		"board":                 ms.GameState.Board,
		"turn":                  ms.GameState.Turn,
		"winner":                ms.GameState.Winner,
		"draw":                  ms.GameState.Draw,
		"game_over":             ms.GameState.GameOver,
		"players":               ms.Players,
		"player_names":          ms.PlayerNames,
		"player_count":          len(ms.Players),
		"room_code":             ms.RoomCode,
		"mode":                  string(ms.Mode),
		"message":               ms.Message,
		"status":                matchStatus(ms),
		"turn_duration_seconds": ms.TurnDurationSeconds,
		"turn_deadline_unix":    ms.TurnDeadlineUnix,
		"countdown_seconds":     countdownSeconds(ms),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return ""
	}
	return string(data)
}

func normalizeMode(value string) MatchMode {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case string(MatchModeTimed):
		return MatchModeTimed
	default:
		return MatchModeClassic
	}
}

func modeFromProperties(properties map[string]interface{}) MatchMode {
	raw, ok := properties["mode"]
	if !ok {
		return MatchModeClassic
	}
	mode, ok := raw.(string)
	if !ok {
		return MatchModeClassic
	}
	return normalizeMode(mode)
}

func newMatchParams(mode MatchMode) map[string]interface{} {
	return map[string]interface{}{
		"mode":      string(mode),
		"room_code": generateRoomCode(),
	}
}

func stringParam(params map[string]interface{}, key string) string {
	value, ok := params[key]
	if !ok {
		return ""
	}
	stringValue, ok := value.(string)
	if !ok {
		return ""
	}
	return stringValue
}

func parseRoomLabel(raw string) (roomLabel, bool) {
	label := roomLabel{}
	if err := json.Unmarshal([]byte(raw), &label); err != nil {
		return roomLabel{}, false
	}
	return label, true
}

func generateRoomCode() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	bytes := make([]byte, 6)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	}

	builder := strings.Builder{}
	builder.Grow(len(bytes))
	for _, value := range bytes {
		builder.WriteByte(alphabet[int(value)%len(alphabet)])
	}

	return builder.String()
}

func nextMarker(ms *MatchState) game.Marker {
	if len(ms.Players) == 0 {
		return game.X
	}
	return game.O
}

func resetTurnDeadline(ms *MatchState) {
	if ms.Mode != MatchModeTimed || len(ms.Players) < 2 || ms.GameState.GameOver {
		ms.TurnDeadlineUnix = 0
		return
	}
	ms.TurnDeadlineUnix = time.Now().Unix() + ms.TurnDurationSeconds
}

func turnDurationForMode(mode MatchMode) int64 {
	if mode == MatchModeTimed {
		return defaultTurnDuration
	}
	return 0
}

func oppositeMarker(marker game.Marker) game.Marker {
	switch marker {
	case game.X:
		return game.O
	case game.O:
		return game.X
	default:
		return game.Empty
	}
}

func remainingMarker(ms *MatchState) game.Marker {
	for _, marker := range ms.Players {
		return marker
	}
	return game.Empty
}

func playerNameForMarker(ms *MatchState, marker game.Marker) string {
	for userID, currentMarker := range ms.Players {
		if currentMarker == marker {
			if name, ok := ms.PlayerNames[userID]; ok && name != "" {
				return name
			}
			return string(marker)
		}
	}
	return string(marker)
}

func matchStatus(ms *MatchState) string {
	switch {
	case ms.GameState.GameOver && len(ms.Players) < 2:
		return "abandoned"
	case ms.GameState.GameOver:
		return "finished"
	case len(ms.Players) < 2:
		return "waiting"
	default:
		return "active"
	}
}

func countdownSeconds(ms *MatchState) int64 {
	if ms.TurnDeadlineUnix <= 0 || ms.GameState.GameOver {
		return 0
	}

	remaining := ms.TurnDeadlineUnix - time.Now().Unix()
	if remaining < 0 {
		return 0
	}
	return remaining
}
