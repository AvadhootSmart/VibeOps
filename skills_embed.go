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
//go:embed all:.agents/skills
var packagedSkills embed.FS

func init() {
	skills.Packaged, _ = fs.Sub(packagedSkills, ".agents/skills")
}
