import { useState } from "react";
import { notifyError } from "@/lib/notify";
import { AllowServer } from "@wails/go/settings/Settings";
import { ChooseKeyFile } from "@wails/go/main/App";
import { settings } from "@wails/go/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const EMPTY = { name: "", ipAddress: "", port: "22", user: "", keyPath: "" };

// AddServerDialog owns the add-server form: name, IP, port (default 22), user,
// and an SSH key chosen via the native file picker. On success it calls onAdded
// so the parent can refresh its list.
export function AddServerDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<typeof EMPTY>) =>
    setForm((f) => ({ ...f, ...patch }));

  async function pickKey() {
    try {
      const path = await ChooseKeyFile();
      if (path) set({ keyPath: path });
    } catch (e) {
      notifyError("Could not open the file picker", e);
    }
  }

  async function submit() {
    if (
      !form.name.trim() ||
      !form.ipAddress.trim() ||
      !form.user.trim() ||
      !form.keyPath
    ) {
      notifyError("Name, IP, user, and key are required.");
      return;
    }
    setSaving(true);
    try {
      await AllowServer(
        settings.Server.createFrom({
          id: crypto.randomUUID(),
          name: form.name.trim(),
          ipAddress: form.ipAddress.trim(),
          port: form.port.trim() || "22",
          user: form.user.trim(),
          keyPath: form.keyPath,
        }),
      );
      onAdded();
      setForm(EMPTY);
      setOpen(false);
    } catch (e) {
      notifyError("Failed to add server", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="ml-auto">
          Add server
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a server</DialogTitle>
          <DialogDescription>
            VibeOps connects over SSH using a private key you choose.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="srv-name">Name</Label>
            <Input
              id="srv-name"
              placeholder="production-db"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-[1fr_88px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="srv-ip">IP address</Label>
              <Input
                id="srv-ip"
                placeholder="1.2.3.4"
                className="font-mono"
                value={form.ipAddress}
                onChange={(e) => set({ ipAddress: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="srv-port">Port</Label>
              <Input
                id="srv-port"
                className="font-mono"
                value={form.port}
                onChange={(e) => set({ port: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="srv-user">User</Label>
            <Input
              id="srv-user"
              placeholder="root"
              className="font-mono"
              value={form.user}
              onChange={(e) => set({ user: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>SSH key</Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={pickKey}>
                Browse…
              </Button>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                {form.keyPath || "No key selected"}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Adding..." : "Add server"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
