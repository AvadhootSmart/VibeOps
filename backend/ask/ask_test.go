package ask

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"
	"time"
)

// raise the dialog into a channel instead of a webview
func capture(t *testing.T) chan Question {
	t.Helper()
	seen := make(chan Question, 4)
	emit = func(name string, data any) {
		if name == "ask:question" {
			seen <- data.(Question)
		}
	}
	t.Cleanup(func() { emit = nil })
	return seen
}

func TestRaiseBlocksUntilAnswered(t *testing.T) {
	seen := capture(t)

	got := make(chan string, 1)
	go func() {
		answer, err := Raise(Question{Question: "which one?", Options: []string{"a", "b"}})
		if err != nil {
			t.Error(err)
		}
		got <- answer
	}()

	q := <-seen
	if q.ID == "" {
		t.Fatal("the dialog needs an id to answer against")
	}
	select {
	case a := <-got:
		t.Fatalf("Raise returned %q before anyone answered", a)
	case <-time.After(50 * time.Millisecond):
	}

	NewAsk().Answer(q.ID, "b")
	if a := <-got; a != "b" {
		t.Errorf("answer = %q, want b", a)
	}
}

// The agent should not hang forever on a window nobody is looking at.
func TestRaiseTimesOut(t *testing.T) {
	capture(t)
	old := Timeout
	Timeout = 20 * time.Millisecond
	defer func() { Timeout = old }()

	if _, err := Raise(Question{Question: "anyone there?"}); err == nil {
		t.Error("want a timeout error")
	}
}

// A question that already timed out must not panic the frontend's late reply.
func TestAnswerUnknownIDIsIgnored(t *testing.T) {
	NewAsk().Answer("no-such-id", "hello")
}

// A reload loses the events already emitted while the agent is still blocked.
func TestPendingListsOutstandingQuestions(t *testing.T) {
	seen := capture(t)
	go Raise(Question{Question: "still waiting?"})
	q := <-seen

	open := NewAsk().Pending()
	if len(open) != 1 || open[0].ID != q.ID {
		t.Fatalf("Pending = %+v", open)
	}
	NewAsk().Answer(q.ID, "done")
}

func TestRaiseWithoutAWindowFails(t *testing.T) {
	emit = nil
	if _, err := Raise(Question{Question: "hello?"}); err == nil {
		t.Error("want an error when there is no window to ask in")
	}
}

// The listener is on 127.0.0.1, which anything on the machine can reach, and an
// answer steers what the agent does next.
func TestListenerRequiresTheToken(t *testing.T) {
	if err := Serve(); err != nil {
		t.Fatal(err)
	}
	seen := capture(t)

	body, _ := json.Marshal(Question{Question: "who goes there?"})
	post := func(tok string) *http.Response {
		req, err := http.NewRequest("POST", Addr()+"/ask", bytes.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("X-Ask-Token", tok)
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return res
	}

	res := post("wrong-token")
	res.Body.Close()
	if res.StatusCode != http.StatusForbidden {
		t.Errorf("status = %d, want 403", res.StatusCode)
	}
	select {
	case q := <-seen:
		t.Fatalf("an unauthenticated request raised a dialog: %+v", q)
	case <-time.After(30 * time.Millisecond):
	}

	// and the real token gets through, answer and all
	done := make(chan string, 1)
	go func() {
		res := post(Token())
		defer res.Body.Close()
		var out struct {
			Answer string `json:"answer"`
		}
		json.NewDecoder(res.Body).Decode(&out)
		done <- out.Answer
	}()

	q := <-seen
	NewAsk().Answer(q.ID, "friend")
	if a := <-done; a != "friend" {
		t.Errorf("round trip answer = %q, want friend", a)
	}
}