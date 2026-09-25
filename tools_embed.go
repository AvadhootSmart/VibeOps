package main

import (
	_ "embed"

	"VibeOps/backend/tools"
)

// The tool manifest is the shared contract between the two agent modes: the
// AI-SDK path imports this exact file through Vite, and the Go side embeds it
// so `vibeops mcp` can serve the same definitions without a second copy. It
// lives under frontend/src because that is where the import has to be
// zero-config; the embed is what makes it available on this side.
//
//go:embed frontend/src/lib/ai/tools/manifest.json
var toolManifest []byte

func init() {
	tools.SetManifest(toolManifest)
}

// The sudo/secrets policy is shared with the OpenRouter path the same way, so
// both harnesses state the same rules in the same words.
//
//go:embed frontend/src/lib/ai/policy.md
var toolPolicy string

func init() {
	tools.SetPolicy(toolPolicy)
}
