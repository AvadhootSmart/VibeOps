import { RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  scope: string;
  serverNames: string[];
  generating: boolean;
  onRefresh: (scope: string) => void;
};

export function RefreshControl({
  scope,
  serverNames,
  generating,
  onRefresh,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Refresh overview"
        disabled={generating}
        className="cursor-pointer text-muted-foreground hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`size-4 ${generating ? "animate-spin" : ""}`} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={scope} onValueChange={onRefresh}>
          <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="vercel">Vercel</DropdownMenuRadioItem>
          {serverNames.map((name) => (
            <DropdownMenuRadioItem key={name} value={name}>
              {name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
