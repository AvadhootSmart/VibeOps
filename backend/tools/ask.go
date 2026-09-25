package tools

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"

	"VibeOps/backend/ask"
)

// The address and token the app's ask listener is on. Set in the harness child's
// environment by Harness.Run, and inherited by the `vibeops mcp` grandchild it
// spawns — which is the process that actually runs this.
const (
	AskAddrEnv  = "VIBEOPS_ASK_ADDR"
	AskTokenEnv = "VIBEOPS_ASK_TOKEN"
)

// AskQuestion puts a question to the user and blocks until they answer.
//
// Two processes can be running this. In the app itself the dialog is raised
// directly; in the `vibeops mcp` child — which has no window — it is posted to
// the app over the loopback listener whose address arrived in the environment.
// Both end in the same dialog and return the same string.
func (t *Tool) AskQuestion(question string, header string, optionsJSON string) (string, error) {
	question = strings.TrimSpace(question)
	if question == "" {
		return "", errors.New("question required")
	}

	q := ask.Question{Question: question, Header: strings.TrimSpace(header), AllowOther: true}
	// Options arrive as a JSON array because the manifest schema is shared with
	// the MCP path, where every argument reaches Go as a plain string.
	if optionsJSON = strings.TrimSpace(optionsJSON); optionsJSON != "" {
		if err := json.Unmarshal([]byte(optionsJSON), &q.Options); err != nil {
			return "", errors.New("options must be a JSON array of strings")
		}
	}
	return askUser(q)
}

// askUser is the transport under AskQuestion and the command approval gate. In
// the app it raises the dialog directly; in the `vibeops mcp` child it posts to
// the app over the loopback listener whose address arrived in the environment.
func askUser(q ask.Question) (string, error) {
	addr := os.Getenv(AskAddrEnv)
	if addr == "" {
		return ask.Raise(q)
	}

	body, err := json.Marshal(q)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequest("POST", addr+"/ask", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Ask-Token", os.Getenv(AskTokenEnv))

	// No client timeout: the request is held open while a person decides, and
	// the app gives up on its own after ask.Timeout.
	res, err := (&http.Client{}).Do(req)
	if err != nil {
		return "", errors.New("cannot reach the app to ask: " + err.Error())
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	if res.StatusCode != http.StatusOK {
		return "", errors.New(strings.TrimSpace(string(raw)))
	}
	var out struct {
		Answer string `json:"answer"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", err
	}
	return out.Answer, nil
}
