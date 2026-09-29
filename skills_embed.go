package main

import (
	"embed"
	"io/fs"

	"VibeOps/backend/skills"
)

// The skills ship inside the binary: a packaged build has no repo checkout to
// read .agents/skills from, and connecting a connector installs its skill into
// the user's own ~/.agents/skills. `all:` keeps the dot-prefixed path.
//
// Only the vibeops- skills ship. The rest of .agents/skills (ai-elements) is
// for developing VibeOps itself, installed there by the skills CLI.
//
//go:embed all:.agents/skills/vibeops-*
var packagedSkills embed.FS

func init() {
	skills.Packaged, _ = fs.Sub(packagedSkills, ".agents/skills")
}
