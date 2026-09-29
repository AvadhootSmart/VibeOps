package main

import (
	"strings"
	"testing"
)

func TestInstallTarget(t *testing.T) {
	target, err := installTarget("/Applications/VibeOps.app")
	if err != nil || target != "/Applications/VibeOps.app" {
		t.Fatalf("normal run should swap in place, got %q (%v)", target, err)
	}
	translocated := "/private/var/folders/kw/T/AppTranslocation/C17D58F0-1C25-4EA9-8766-F4CD9225A239/d/VibeOps.app"
	target, err = installTarget(translocated)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(target, "AppTranslocation") || !strings.HasSuffix(target, "/Applications/VibeOps.app") {
		t.Fatalf("translocated run should install to ~/Applications, got %q", target)
	}
}
