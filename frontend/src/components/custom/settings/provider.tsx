import type { ReactNode } from "react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/custom/switch";
import { cn } from "@/lib/utils";
import { StageBadge, type Stage } from "@/components/custom/stage-badge";
import { experimentalWarning } from "@/lib/constants";

// One AI-provider row inside an <Accordion>. The header shows a status dot,
// name (+ optional version), and a one-line status; expanding it reveals the
// provider's inputs (children). The `active` toggle is a sibling of the
// trigger — never nested inside it (a button in a button is invalid) — so
// switching providers doesn't also collapse the accordion.
export function Provider({
  value,
  label,
  logo,
  version,
  available,
  status,
  active,
  showToggle,
  invertOnDark,
  stage,
  onToggle,
  children,
}: {
  value: string;
  label: string;
  logo?: string; //image url
  version?: string;
  available: boolean;
  status: string;
  active: boolean;
  onToggle: () => void;
  children: ReactNode;
  showToggle?: boolean;
  invertOnDark?: boolean;
  stage?: Stage;
}) {
  return (
    <AccordionItem
      value={value}
      className="border-t border-b-0 first:border-t-0"
    >
      <div className="flex items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {logo ? (
            <img
              src={logo}
              alt=""
              className={cn(
                "size-9 shrink-0 rounded-lg object-contain",
                available ? "" : "opacity-40 grayscale",
                invertOnDark ? "dark:invert" : "",
              )}
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
          ) : (
            <span className="size-9 shrink-0 rounded-lg bg-muted" />
          )}
          <AccordionTrigger className="min-w-0 flex-1 items-center hover:no-underline">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-item">
                {label}
                {version && (
                  <span className="font-mono text-meta text-muted-foreground">
                    v{version}
                  </span>
                )}
                {stage && <StageBadge stage={stage} reason={experimentalWarning(label)} />}
              </div>
              <div className="truncate text-meta font-normal text-muted-foreground">
                {status}
              </div>
            </div>
          </AccordionTrigger>
        </div>
        {showToggle && (
          <Switch
            checked={active}
            onCheckedChange={onToggle}
            label={`Use ${label}`}
          />
        )}
      </div>
      <AccordionContent className="space-y-4 px-5">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}
