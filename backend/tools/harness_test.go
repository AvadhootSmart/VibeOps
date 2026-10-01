package tools

import (
	"context"
	"os"
	"os/exec"
	"slices"
	"strings"
	"testing"

	"VibeOps/backend/skills"
)

// The harnesses get useSkill over MCP; without the catalog in their prompt they
// have no way to know which names it accepts.
func TestHarnessPromptListsSkills(t *testing.T) {
	skills.Packaged = os.DirFS("../../.agents/skills")
	prompt := systemPrompt()
	for _, name := range []string{"vibeops-cloudflare", "vibeops-vercel", "vibeops-neon", "vibeops-supabase", "vibeops-aws", "vibeops-azure", "vibeops-gcp", "vibeops-mongodb-atlas"} {
		if !strings.Contains(prompt, "\n- "+name+": ") {
			t.Errorf("harness prompt does not list the %s skill", name)
		}
	}
}

func TestParseClaudeCatalog(t *testing.T) {
	out := `id:"claude-3-5-haiku",family:"haiku",display_name:"Haiku 3.5"
id:"claude-haiku-4-5",family:"haiku",display_name:"Haiku 4.5"
id:"claude-mythos-5",family:"mythos",display_name:"Mythos 5"
id:"claude-opus-4-0",family:"opus",display_name:"Opus 4"
id:"claude-opus-5-5",family:"opus",display_name:"Opus 5.5"
id:"claude-opus-4-8",family:"opus",display_name:"Opus 4.8"
id:"claude-opus-5-5",family:"opus",display_name:"Opus 5.5"`
	got := parseClaudeCatalog(out)
	want := []Model{
		{"opus", "Latest Opus (5.5)"},
		{"haiku", "Latest Haiku (4.5)"},
		{"claude-opus-5-5", "Opus 5.5"},
		{"claude-opus-4-8", "Opus 4.8"},
		{"claude-haiku-4-5", "Haiku 4.5"},
		{"claude-opus-4-0", "Opus 4"},
	}
	if !slices.Equal(got, want) {
		t.Errorf("got %v\nwant %v", got, want)
	}
}

// Guards the scrape against a CLI update reshaping the bundled catalog.
func TestClaudeModelsFromInstalledCLI(t *testing.T) {
	if _, err := exec.LookPath("claude"); err != nil {
		t.Skip("claude CLI not installed")
	}
	models := claudeModels(context.Background())
	if len(models) < 5 || models[0].ID != "fable" && models[0].ID != "opus" {
		t.Errorf("unexpected catalog read from the installed claude: %v", models)
	}
}
