package tools

import (
	"os"
	"strings"
	"testing"

	"VibeOps/backend/skills"
)

// The harnesses get useSkill over MCP; without the catalog in their prompt they
// have no way to know which names it accepts.
func TestHarnessPromptListsSkills(t *testing.T) {
	skills.Packaged = os.DirFS("../../.agents/skills")
	prompt := systemPrompt()
	for _, name := range []string{"cloudflare", "vercel", "neon", "supabase"} {
		if !strings.Contains(prompt, "\n- "+name+": ") {
			t.Errorf("harness prompt does not list the %s skill", name)
		}
	}
}
