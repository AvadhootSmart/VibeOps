import { Switch } from "@/components/custom/switch";
import { PanelRow } from "@/components/custom/panel";

// One labelled row in a settings card. Controlled: the caller owns the value,
// because every real setting here is persisted somewhere.
export function Toggle({
  label,
  detail,
  checked,
  onCheckedChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <PanelRow>
      <div className="min-w-0">
        <div className="text-item">{label}</div>
        <div className="text-meta text-muted-foreground">{detail}</div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        label={label}
        className="ml-auto"
      />
    </PanelRow>
  );
}
