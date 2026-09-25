package tools

import (
	"errors"
	"fmt"
	"os"
	"sync"

	"VibeOps/backend/ask"
)

// Human approval for every command the agent runs, enforced here rather than in
// the system prompt: ShellAccess and RunRemote are the only ways either agent
// path reaches a shell, so a prompt injection in a cloned README can talk the
// model into anything but still cannot get past this.
//
// The state is per process. In the app it is cleared at the start of each
// OpenRouter turn (ClearRunSecrets); on the harness path the gate runs in the
// `vibeops mcp` child, which lives for one turn, so it starts clean on its own.

const (
	optRun  = "Run"
	optAll  = "Run everything this turn"
	optDeny = "Deny"

	// ApprovedEnv tells a harness turn's mcp child that the user already
	// approved this turn from a plan card, so its commands skip the prompt.
	ApprovedEnv = "VIBEOPS_APPROVED"
)

var errDeclined = errors.New("The user declined to run this command. Do not retry it; ask what they want instead, or take a different approach.")

var (
	approvalMu sync.Mutex
	allowAll   = os.Getenv(ApprovedEnv) == "1"
	// Set by ApproveNextTurn, consumed when the next turn starts. The plan
	// card's go-ahead sends a new message, and a new turn clears allowAll, so
	// the approval has to be carried across that boundary.
	approvedNext bool

	// Swapped in tests; the real one needs a window.
	confirm = askUser
)

// approve blocks until the user lets command run. command is the text as the
// model wrote it, before $SECRET_ substitution, so no value is ever shown.
func approve(header, command string) error {
	approvalMu.Lock()
	all := allowAll
	approvalMu.Unlock()
	if all {
		return nil
	}

	answer, err := confirm(ask.Question{
		Header:   header,
		Question: "The agent wants to run this command.",
		Command:  command,
		Options:  []string{optRun, optAll, optDeny},
	})
	if err != nil {
		return fmt.Errorf("could not get the user's approval, so the command did not run: %w", err)
	}
	switch answer {
	case optRun:
		return nil
	case optAll:
		approvalMu.Lock()
		allowAll = true
		approvalMu.Unlock()
		return nil
	case optDeny:
		return errDeclined
	default:
		// Typed into the dialog's free-text box: a refusal with instructions.
		return fmt.Errorf("The user declined to run this command and said: %s", answer)
	}
}

// startTurn resets approval for a new turn, applying a pending plan approval.
func startTurn() bool {
	approvalMu.Lock()
	defer approvalMu.Unlock()
	allowAll, approvedNext = approvedNext, false
	return allowAll
}

// ApproveNextTurn is called by the plan card's go-ahead button just before it
// sends the approval message, so the approved plan runs without a prompt per
// step.
func (t *Tool) ApproveNextTurn() {
	approvalMu.Lock()
	approvedNext = true
	approvalMu.Unlock()
}
