package tools

import "encoding/json"

// Manifest is the shared tool definition list, embedded from
// frontend/src/lib/ai/tools/manifest.json by main and set here at init. It is
// the one place a tool's name, description and input schema are written: the
// AI-SDK path imports the same file directly, backend/mcp serves it verbatim
// as tools/list, and Names() below builds the --allowedTools list for the
// Claude Code CLI. Previously all three were maintained by hand, and they had
// already drifted — three tools were missing from the MCP path and the sudo
// guidance contradicted itself between the two.
var Manifest []json.RawMessage

// SetManifest decodes the embedded manifest. Called from main's init, before
// either agent path can run.
func SetManifest(b []byte) error { return json.Unmarshal(b, &Manifest) }

// Names lists every tool in the manifest, in manifest order.
func Names() []string {
	names := make([]string, 0, len(Manifest))
	for _, raw := range Manifest {
		var d struct {
			Name string `json:"name"`
		}
		if json.Unmarshal(raw, &d) == nil && d.Name != "" {
			names = append(names, d.Name)
		}
	}
	return names
}
