import { useEffect, useState } from "react";
import { HardDrive, Trash2 } from "lucide-react";
import { GetAllowedServers, RemoveServer } from "@wails/go/settings/Settings";
import { settings } from "@wails/go/models";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/custom/settings/section";
import { Panel, PanelRow, RowIcon } from "@/components/custom/panel";
import { AddServerDialog } from "@/components/custom/settings/add-server-dialog";
import { notifyError } from "@/lib/notify";

// The machines VibeOps manages. Self-contained: it owns the list, the refresh
// after an add or remove, and its own errors.
export function Servers() {
  const [servers, setServers] = useState<settings.Server[]>([]);

  const refresh = () =>
    GetAllowedServers()
      .then((s) => setServers(s ?? []))
      .catch((e) => notifyError("Failed to load servers", e));

  useEffect(() => {
    refresh();
  }, []);

  async function remove(id: string) {
    try {
      await RemoveServer(id);
      await refresh();
    } catch (e) {
      notifyError("Failed to remove server", e);
    }
  }

  return (
    <Section
      title="Servers"
      description="The machines VibeOps manages for you."
    >
      {servers.length === 0 ? (
        <Panel className="flex items-center gap-4 px-5 py-4">
          <RowIcon className="size-10">
            <HardDrive className="size-5" strokeWidth={1.8} />
          </RowIcon>
          <div className="min-w-0">
            <div className="text-item">No server connected</div>
            <div className="text-meta text-muted-foreground">
              Connect a VPS over SSH and VibeOps takes it from there.
            </div>
          </div>
          <div className="ml-auto shrink-0">
            <AddServerDialog onAdded={refresh} />
          </div>
        </Panel>
      ) : (
        <div className="space-y-3">
          <Panel>
            {servers.map((srv) => (
              <PanelRow key={srv.id}>
                <RowIcon className="size-10">
                  <HardDrive className="size-5" strokeWidth={1.8} />
                </RowIcon>
                <div className="min-w-0">
                  <div className="text-item">{srv.name}</div>
                  <div className="truncate font-mono text-meta text-muted-foreground">
                    {srv.user}@{srv.ipAddress}:{srv.port} ·{" "}
                    {srv.keyPath.split("/").pop()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto text-muted-foreground hover:text-err"
                  onClick={() => remove(srv.id)}
                  aria-label={`Remove ${srv.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </PanelRow>
            ))}
          </Panel>
          <AddServerDialog onAdded={refresh} />
        </div>
      )}
    </Section>
  );
}
