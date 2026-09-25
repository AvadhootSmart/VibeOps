# Security

VibeOps runs commands on your machine and your servers, so security reports
are the most welcome kind.

## Reporting

Report privately through **GitHub → Security → Report a vulnerability** on this
repository. Please don't open a public issue. You'll get an acknowledgement
within a few days.

## Scope

Especially interesting:

- A secret value (`$SECRET_…`, the sudo password, the OpenRouter key) reaching
  the model, the webview, logs or disk.
- A command running without the user's approval, on either agent path (AI SDK
  or the `vibeops mcp` harness path).
- Reading a credential store past the local shell sandbox (seatbelt on macOS,
  bubblewrap on Linux/WSL).
- The loopback ask listener accepting requests without its token.
- SSH host-key verification being bypassed.

Known limitations, not vulnerabilities, are listed in
[INSTALL.md](INSTALL.md#known-limitations).
