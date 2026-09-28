import { FileWarning } from "lucide-react";
import { ShowErrorLog } from "@wails/go/main/App";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/custom/settings/section";
import { Panel, PanelRow, RowIcon } from "@/components/custom/panel";
import { notifyError } from "@/lib/notify";

export function ErrorLog() {
  return (
    <Section
      title="Troubleshooting"
      description="Errors from providers, connectors and the assistant are kept in error.log on this machine. Attach it when you report a bug. Secret values are removed before anything is written."
    >
      <Panel>
        <PanelRow>
          <RowIcon>
            <FileWarning className="size-5" strokeWidth={1.8} />
          </RowIcon>
          <div className="min-w-0">
            <div className="text-item">Error log</div>
            <div className="text-meta text-muted-foreground">
              Kept to about 2 MB, oldest entries dropped first.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() =>
              ShowErrorLog().catch((e) =>
                notifyError("Could not open the error log", e),
              )
            }
          >
            Show in folder
          </Button>
        </PanelRow>
      </Panel>
    </Section>
  );
}
