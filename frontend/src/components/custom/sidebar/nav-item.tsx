import { NavLink, useLocation } from "react-router-dom";
import { Command } from "lucide-react";
import type { RouteItem } from "@/routes";
import { isMac, shortcutKey } from "@/hooks/use-shortcuts";
import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// The active row is cut from the same plate as the content pane beside it,
// and takes the accent on its icon — the one place the accent means "you are
// here" (docs/DESIGN.md). Shared with the chat rows so both lists agree.
export const SIDEBAR_ROW =
  "h-9 gap-2.5 rounded-lg px-2.5 text-sidebar-foreground/70 transition-[background-color,color,box-shadow] duration-300 ease-(--ease-spring) hover:bg-sidebar-accent/70 hover:text-sidebar-foreground data-[active=true]:bg-background data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_7%,transparent),0_1px_2px_color-mix(in_oklab,var(--foreground)_8%,transparent)] data-[active=true]:hover:bg-background data-[active=true]:[&>svg]:text-accent";

// A route as a sidebar link. asChild makes the button *be* the NavLink (one
// interactive element, valid HTML); active state comes from the URL. The
// shortcut is a hint for people already reaching for it, so it only surfaces
// on hover rather than printing a column of key caps down the nav.
export function NavItem({ item }: { item: RouteItem }) {
  const { pathname } = useLocation();
  const shortcut = shortcutKey(item.path);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={SIDEBAR_ROW}
        isActive={pathname === item.path}
        tooltip={item.title}
      >
        <NavLink to={item.path}>
          <item.icon />
          <span>{item.title}</span>
        </NavLink>
      </SidebarMenuButton>
      {shortcut && (
        <SidebarMenuBadge className="top-2! gap-0.5 rounded-md font-mono text-micro text-muted-foreground opacity-0 transition-opacity duration-300 group-hover/menu-item:opacity-100">
          {isMac ? <Command className="size-3" /> : "Ctrl+"}
          {shortcut}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}
