// Package skills loads Anthropic-style SKILL.md files so the VibeOps agent
// (OpenRouter path) gets the same progressive-disclosure skills Claude Code
// does. Skills live in .agents/skills/<name>/SKILL.md — the repo's source of
// truth, which .claude/skills symlinks into, so a skill written once serves
// both VibeOps and Claude Code.
package skills

import (
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
)

type Skill struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Path        string `json:"path"` // relative to the source FS, not the disk
}

// Packaged is the same tree embedded into the binary, set by main. A packaged
// build has no repo checkout under its working directory, so this is the only
// copy it has.
var Packaged fs.FS

// skillsDir is the repo's .agents/skills, resolved from the working directory.
func skillsDir() string {
	wd, _ := os.Getwd()
	return filepath.Join(wd, ".agents", "skills")
}

// source prefers the checkout so `wails dev` picks up skill edits without a
// rebuild, and falls back to the embedded copy everywhere else.
func source() fs.FS {
	if entries, err := os.ReadDir(skillsDir()); err == nil && len(entries) > 0 {
		return os.DirFS(skillsDir())
	}
	return Packaged
}

type Skills struct{}

func NewSkills() *Skills { return &Skills{} }

// List returns every skill's name + description (not the body) for the prompt.
// Non-nil even when empty: a nil slice crosses the Wails bridge as JSON `null`,
// and the frontend reads `.length` off it.
func (s *Skills) List() []Skill {
	out := []Skill{}
	src := source()
	if src == nil {
		return out
	}
	entries, _ := fs.ReadDir(src, ".")
	for _, e := range entries {
		p := path.Join(e.Name(), "SKILL.md")
		body, err := fs.ReadFile(src, p)
		if err != nil {
			continue
		}
		name, desc := frontmatter(string(body))
		if name == "" {
			name = e.Name()
		}
		out = append(out, Skill{Name: name, Description: desc, Path: p})
	}
	return out
}

// Catalog is the skill list both agent paths append to their system prompt:
// names and descriptions only, so the model calls useSkill for a full body on
// demand. Built once here so the OpenRouter and harness prompts can't drift.
func (s *Skills) Catalog() string {
	list := s.List()
	if len(list) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("AVAILABLE SKILLS — call the useSkill tool with the name to load full instructions BEFORE doing a task a skill covers:")
	for _, sk := range list {
		b.WriteString("\n- " + sk.Name + ": " + sk.Description)
	}
	return b.String()
}

// Read returns the full SKILL.md body for a named skill, or "" if not found.
func (s *Skills) Read(name string) string {
	src := source()
	for _, sk := range s.List() {
		if sk.Name == name {
			b, _ := fs.ReadFile(src, sk.Path)
			return string(b)
		}
	}
	return ""
}

// InstallDir is where a skill goes so coding harnesses find it outside VibeOps.
func InstallDir(dir string) string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".agents", "skills", dir)
}

// Install copies one skill directory out to ~/.agents/skills/<dir>, overwriting
// what is there so a VibeOps upgrade also upgrades the skill. `dir` is the
// directory name under .agents/skills, which is not always the skill's `name:`.
func Install(dir string) error {
	src := source()
	if src == nil {
		return fmt.Errorf("no skills bundled")
	}
	sub, err := fs.Sub(src, dir)
	if err != nil {
		return err
	}
	if _, err := fs.Stat(sub, "SKILL.md"); err != nil {
		return fmt.Errorf("no skill named %q", dir)
	}
	dest := InstallDir(dir)
	// The checkout may still symlink this path in (that was the old layout);
	// removing it first replaces the link rather than writing through it.
	if err := os.RemoveAll(dest); err != nil {
		return err
	}
	return fs.WalkDir(sub, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		target := filepath.Join(dest, filepath.FromSlash(p))
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		b, err := fs.ReadFile(sub, p)
		if err != nil {
			return err
		}
		return os.WriteFile(target, b, 0o644)
	})
}

// frontmatter pulls name/description out of a leading --- YAML block. Two
// fields, so a manual scan beats pulling in a YAML dep.
// ponytail: line-level parse; swap for yaml.v3 only if skills need nested keys.
func frontmatter(md string) (name, desc string) {
	if !strings.HasPrefix(md, "---") {
		return
	}
	end := strings.Index(md[3:], "---")
	if end < 0 {
		return
	}
	for _, line := range strings.Split(md[3:3+end], "\n") {
		k, v, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		switch strings.TrimSpace(k) {
		case "name":
			name = strings.TrimSpace(v)
		case "description":
			desc = strings.TrimSpace(v)
		}
	}
	return
}
