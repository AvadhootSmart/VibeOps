import { Fragment, useEffect, useState } from "react";
import {
  NavLink,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Command, Plus, Rocket, Trash2 } from "lucide-react";
import { ROUTES, type RouteItem } from "@/routes";
import { Delete, List } from "@wails/go/sessions/Sessions";
import { useChatStore } from "@/lib/stores/chat";
import { ConfirmDialog } from "@/components/custom/confirm-dialog";
import { DeploymentDialog } from "@/components/custom/deployment-dialog";
import { VersionChip } from "@/components/custom/version-chip";
import { SidebarBrand } from "@/components/custom/sidebar/brand";
import { isMac, shortcutKey } from "@/hooks/use-shortcuts";
import type { sessions } from "@wails/go/models";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

// Roomier than the shadcn default (h-8): this is a desktop window, not a
// cramped web dashboard. The active row is cut from the same plate as the
// content pane beside it, and takes the roast accent on its icon — the one
// place the accent means "you are here" (docs/DESIGN.md).
const ITEM =
  "h-9 gap-2.5 rounded-lg px-2.5 text-sidebar-foreground/75 transition-[background-color,color,box-shadow] duration-300 ease-(--ease-spring) hover:text-sidebar-foreground data-[active=true]:bg-background data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_7%,transparent),0_1px_2px_color-mix(in_oklab,var(--foreground)_8%,transparent)] data-[active=true]:[&>svg]:text-accent";

// Render a route as a sidebar link. asChild makes the button *be* the NavLink
// (one interactive element, valid HTML); active state comes from the URL.
function NavItem({ item }: { item: RouteItem }) {
  const { pathname } = useLocation();
  const shortcut = shortcutKey(item.path);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={ITEM}
        isActive={pathname === item.path}
        tooltip={item.title}
      >
        <NavLink to={item.path}>
          <item.icon />
          <span>{item.title}</span>
        </NavLink>
      </SidebarMenuButton>
      {shortcut && (
        <SidebarMenuBadge className="top-2 gap-0.5 font-mono text-micro tracking-tight text-muted-foreground/70 peer-hover/menu-button:text-muted-foreground peer-data-[active=true]/menu-button:text-muted-foreground">
          {isMac ? <Command className="size-3" /> : "Ctrl+"}
          {shortcut}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const mainItems = ROUTES.filter((r) => r.section === "main");
  const footerItems = ROUTES.filter((r) => r.section === "footer");

  // Saved chats. The playground fires "sessions-changed" after each save, so
  // the list stays current without polling.
  const [chats, setChats] = useState<sessions.SessionMeta[]>([]);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeChat =
    pathname === "/assistant" ? searchParams.get("session") : null;
  // The chat pending deletion (drives the confirm dialog), or null.
  const [pendingDelete, setPendingDelete] =
    useState<sessions.SessionMeta | null>(null);
  const [deployOpen, setDeployOpen] = useState(false);

  useEffect(() => {
    const load = () =>
      List()
        .then(setChats)
        .catch(() => setChats([]));
    load();
    window.addEventListener("sessions-changed", load);
    return () => window.removeEventListener("sessions-changed", load);
  }, []);

  async function deleteChat(id: string) {
    await Delete(id);
    setChats((c) => c.filter((chat) => chat.id !== id));
    useChatStore.getState().forget(id);
    // If we're viewing the chat we just deleted, drop back to a blank one.
    if (activeChat === id) navigate("/assistant");
  }

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="p-0">
        <SidebarBrand />
      </SidebarHeader>

      <SidebarContent className="gap-1">
        <SidebarGroup className="py-2">
          <SidebarMenu>
            {mainItems.map((item) => (
              <Fragment key={item.path}>
                <NavItem item={item} />
                {item.path === "/overview" && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className={ITEM}
                      tooltip="Deploy"
                      onClick={() => setDeployOpen(true)}
                    >
                      <Rocket />
                      <span>Deploy</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </Fragment>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="py-0">
          <SidebarGroupLabel className="eyebrow text-muted-foreground/80">
            Chats
          </SidebarGroupLabel>
          <SidebarGroupAction
            title="New chat"
            aria-label="New chat"
            onClick={() => navigate("/assistant")}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus />
          </SidebarGroupAction>
          <SidebarMenu>
            {chats.length === 0 && (
              <p className="px-2.5 py-1 text-meta text-muted-foreground/70">
                Nothing saved yet.
              </p>
            )}
            {chats.map((chat) => (
              <SidebarMenuItem key={chat.id}>
                <SidebarMenuButton
                  asChild
                  className={ITEM}
                  isActive={activeChat === chat.id}
                  tooltip={chat.name}
                >
                  <NavLink to={`/assistant?session=${chat.id}`}>
                    <span className="truncate">{chat.name}</span>
                  </NavLink>
                </SidebarMenuButton>
                <SidebarMenuAction
                  showOnHover
                  onClick={() => setPendingDelete(chat)}
                  aria-label={`Delete ${chat.name}`}
                  className="top-2 hover:bg-transparent hover:text-err"
                >
                  <Trash2 />
                </SidebarMenuAction>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-1">
        <SidebarMenu>
          {footerItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </SidebarMenu>
        {/* App-level metadata belongs next to the app's name, not in the
            window chrome above whichever screen happens to be open. */}
        <div className="px-2.5 pb-0.5">
          <VersionChip />
        </div>
      </SidebarFooter>
      <SidebarRail />

      <DeploymentDialog open={deployOpen} onOpenChange={setDeployOpen} />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete chat?"
        description={
          <>
            “{pendingDelete?.name}” will be permanently deleted. This can't be
            undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pendingDelete) return deleteChat(pendingDelete.id);
        }}
      />
    </Sidebar>
  );
}
