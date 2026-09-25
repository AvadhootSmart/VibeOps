import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type Stage = "beta" | "experimental";

// Marks a surface that is newer or riskier than the rest. The stage is a static
// prop at each call site: nothing about it is configurable or stored.
export function StageBadge({ stage, reason }: { stage: Stage; reason?: string }) {
  if (stage === "beta") {
    return (
      <Badge variant="outline" className="px-1.5 py-0 text-micro text-muted-foreground">
        Beta
      </Badge>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="bg-warn-soft px-1.5 py-0 text-micro text-warn">Experimental</Badge>
        </TooltipTrigger>
        {reason && <TooltipContent className="max-w-64">{reason}</TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  );
}
