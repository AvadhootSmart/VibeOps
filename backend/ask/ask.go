// Package ask lets the agent put a question to the user and wait for the answer.
//
// Every other tool runs wherever it is called and returns. This one needs the
// GUI, and the harness CLIs call tools through `<binary> mcp` — a separate
// process with no window. So the app opens a loopback listener at startup and
// hands its address and a token to the harness in the environment; the MCP
// child posts the question there and blocks on the reply.
//
// Loopback and a token rather than a bare port: anything else on the machine
// can reach 127.0.0.1, and a question carries the agent's own words and takes
// an answer that steers what it does next.
package ask

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// A question left unanswered blocks the agent's turn, so it gives up rather
// than hanging forever — the window may be closed, or the user simply gone.
// A var so tests need not wait it out.
var Timeout = 10 * time.Minute

type Question struct {
	ID       string `json:"id"`
	Question string `json:"question"`
	// Header is a short label for the dialog; the agent supplies it so several
	// questions in a row stay tellable apart.
	Header  string   `json:"header"`
	Options []string `json:"options"`
	// AllowOther lets the user type an answer that is not on the list. The agent
	// asks for it when its options may not cover the real answer.
	AllowOther bool `json:"allowOther"`
	// Command is shown verbatim in a code block: the approval gate's question
	// is about exactly this text, so it must not be reflowed as prose.
	Command string `json:"command,omitempty"`
}

type pending struct {
	Question
	answer chan string
}

var (
	mu      sync.Mutex
	waiting = map[string]*pending{}

	// How a question reaches the window. Behind a func so the Wails runtime
	// stays at the edge and the waiting logic can be tested without a webview.
	emit  func(name string, data any)
	addr  string
	token string
)

// SetEventCtx wires the Wails runtime context used to raise the dialog. Call
// from app.startup, as with the other streaming services.
func SetEventCtx(ctx context.Context) {
	emit = func(name string, data any) { runtime.EventsEmit(ctx, name, data) }
}

// Addr and Token are what the harness child needs to reach this app. Empty
// until Serve has run.
func Addr() string  { return addr }
func Token() string { return token }

// Serve opens the loopback listener. Failure is not fatal: the app runs
// without it and askQuestion is the only thing that stops working.
func Serve() error {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		listener.Close()
		return err
	}
	token = hex.EncodeToString(buf)
	addr = "http://" + listener.Addr().String()

	mux := http.NewServeMux()
	mux.HandleFunc("/ask", handleAsk)
	// No read/write timeout: the whole point is a request held open while a
	// person decides. Timeout is enforced per question instead.
	server := &http.Server{Handler: mux}
	go server.Serve(listener)
	return nil
}

func handleAsk(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "post only", http.StatusMethodNotAllowed)
		return
	}
	if subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Ask-Token")), []byte(token)) != 1 {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var q Question
	if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	answer, err := Raise(q)
	if err != nil {
		http.Error(w, err.Error(), http.StatusGatewayTimeout)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"answer": answer})
}

// Raise puts a question to the user and blocks until it is answered. Used by
// the loopback handler for the harness path; the OpenRouter path never reaches
// here, because that agent runs in the frontend and opens the dialog directly.
func Raise(q Question) (string, error) {
	if emit == nil {
		return "", errors.New("no window to ask in")
	}
	buf := make([]byte, 8)
	rand.Read(buf)
	q.ID = hex.EncodeToString(buf)

	p := &pending{Question: q, answer: make(chan string, 1)}
	mu.Lock()
	waiting[q.ID] = p
	mu.Unlock()
	defer func() {
		mu.Lock()
		delete(waiting, q.ID)
		mu.Unlock()
	}()

	emit("ask:question", q)

	select {
	case answer := <-p.answer:
		return answer, nil
	case <-time.After(Timeout):
		emit("ask:cancel", q.ID)
		return "", errors.New("the user did not answer in time")
	}
}

// Ask is the bound service: the frontend answers through it.
type Ask struct{}

func NewAsk() *Ask { return &Ask{} }

// Answer delivers the user's choice. Unknown ids are ignored rather than an
// error — a question that already timed out is not the frontend's fault.
func (a *Ask) Answer(id string, answer string) {
	mu.Lock()
	p := waiting[id]
	mu.Unlock()
	if p != nil {
		select {
		case p.answer <- answer:
		default:
		}
	}
}

// Pending re-lists questions still waiting, so a reloaded frontend gets its
// dialog back instead of leaving the agent blocked on a window that forgot.
func (a *Ask) Pending() []Question {
	mu.Lock()
	defer mu.Unlock()
	out := []Question{}
	for _, p := range waiting {
		out = append(out, p.Question)
	}
	return out
}
