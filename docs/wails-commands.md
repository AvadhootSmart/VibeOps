Bindings (regen wailsjs from Go)
wails generate module
Regen frontend/wailsjs/. Run after change Go bound methods. Note: wails dev + wails build auto-regen too.

Frontend only (no Go, fast UI loop)
cd frontend
bun install            # after add dep
bunx tsc --noEmit      # typecheck
bun run build          # tsc + vite build
bun run dev            # vite alone, localhost:5173 (Go bindings undefined — UI only)

Go checks
go build ./...   # compile all
go vet ./...     # static check
go test ./...    # tests (none yet)

Debug build (devtools + console, test real app)
wails build -debug
Binary → build/bin/VibeOps.app. Right-click DevTools work. Run:
open build/bin/VibeOps.app
# or direct binary for stdout logs:
./build/bin/VibeOps.app/Contents/MacOS/VibeOps
Run binary direct → see Go println/log in terminal.

Full release build (production, test final)
wails build
No devtools, optimized. Same build/bin/.

Your platform scripts (already in scripts/)
./scripts/build-macos-arm.sh        # apple silicon
./scripts/build-all.sh              # all platforms

Env check (bindings/tools broken?)
wails doctor

Typical test loop

wails generate module   # if Go methods changed
go build ./...          # Go compiles?
cd frontend && bunx tsc --noEmit && cd ..   # TS compiles?
wails build -debug      # real app + devtools
./build/bin/VibeOps.app/Contents/MacOS/VibeOps   # run, watch logs

