package ask

import (
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// The real path: a separate `<binary> mcp` process, with no window, calling
// askQuestion and getting an answer back from this app.
func TestMCPChildAsksThroughTheListener(t *testing.T) {
	// The built app, which `go test` sees from this package's directory.
	// VIBEOPS_BIN overrides it; a missing build skips rather than fails,
	// since the binary is not a build artifact of the test itself.
	bin := os.Getenv("VIBEOPS_BIN")
	if bin == "" {
		bin, _ = filepath.Abs("../../build/bin/VibeOps.app/Contents/MacOS/VibeOps")
	}
	if _, err := os.Stat(bin); err != nil {
		t.Skipf("no built app at %s — run `wails build`", bin)
	}
	if err := Serve(); err != nil {
		t.Fatal(err)
	}
	seen := make(chan Question, 1)
	emit = func(name string, data any) {
		if name == "ask:question" {
			seen <- data.(Question)
		}
	}

	cmd := exec.Command(bin, "mcp")
	cmd.Env = append(os.Environ(),
		"VIBEOPS_ASK_ADDR="+Addr(), "VIBEOPS_ASK_TOKEN="+Token())
	cmd.Stdin = strings.NewReader(
		`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"p","version":"1"}}}` + "\n" +
			`{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"askQuestion","arguments":{"question":"ship it?","header":"Deploy","options":"[\"yes\",\"no\"]"}}}` + "\n")

	t.Logf("listener at %s", Addr())
	var errBuf strings.Builder
	cmd.Stderr = &errBuf
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	out := make(chan []byte, 1)
	go func() {
		b, _ := io.ReadAll(stdout)
		cmd.Wait()
		out <- b
	}()
	defer func() {
		if errBuf.Len() > 0 {
			t.Logf("child stderr: %s", errBuf.String())
		}
	}()

	select {
	case q := <-seen:
		if q.Question != "ship it?" || q.Header != "Deploy" || len(q.Options) != 2 {
			t.Fatalf("question arrived as %+v", q)
		}
		NewAsk().Answer(q.ID, "yes")
	case <-time.After(20 * time.Second):
		t.Fatal("the mcp child never reached the listener")
	}

	select {
	case b := <-out:
		for _, line := range strings.Split(string(b), "\n") {
			var m map[string]any
			if json.Unmarshal([]byte(line), &m) != nil || m["id"] == nil {
				continue
			}
			if id, _ := m["id"].(float64); id == 2 {
				res := m["result"].(map[string]any)
				text := res["content"].([]any)[0].(map[string]any)["text"]
				if text != "yes" {
					t.Fatalf("the child got %q back, want yes", text)
				}
				if res["isError"] == true {
					t.Fatal("reported as an error")
				}
				t.Logf("mcp child received: %q", text)
				return
			}
		}
		t.Fatal("no reply to the tools/call")
	case <-time.After(20 * time.Second):
		t.Fatal("child did not exit")
	}
}