import { useEffect, useState } from "react";
import {
  NavLink,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { MessageSquare, Trash2 } from "lucide-react";
import { Delete, List } from "@wails/go/sessions/Sessions";
import type { sessions } from "@wails/go/models";
import { useChatStore } from "@/lib/stores/chat";
import { useGenerationStore } from "@/lib/stores/generation";
import { ConfirmDialog } from "@/components/custom/confirm-dialog";
import { SIDEBAR_ROW } from "@/components/custom/sidebar/nav-item";
import { groupByRecency } from "@/components/custom/sidebar/recency";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function ChatList() {
  // Saved chats. The Assistant fires "sessions-changed" after each save, so
  // the list stays current without polling.
  const [chats, setChats] = useState<sessions.SessionMeta[]>([]);
  const [pendingDelete, setPendingDelete] =
    useState<sessions.SessionMeta | null>(null);
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeChat =
    pathname === "/assistant" ? searchParams.get("session") : null;
  // A run outlives the screen, so a chat still being answered is worth
  // marking here — it's the only place you can see it from elsewhere.
  const runs = useGenerationStore((s) => s.runs);

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
    if (activeChat === id) navigate("/assistant");
  }

  if (chats.length === 0) {
    return (
      <div className="mx-2 mt-2 rounded-xl border border-dashed border-sidebar-border px-3 py-4 text-center">
        <MessageSquare className="mx-auto size-4 text-muted-foreground" />
        <p className="mt-2 text-meta text-muted-foreground">
          Chats with the agent are saved here.
        </p>
      </div>
    );
  }

  return (
    <>
      {groupByRecency(chats).map((group) => (
        <SidebarGroup key={group.label} className="py-1">
          <SidebarGroupLabel className="h-7 text-micro font-medium text-muted-foreground/80">
            {group.label}
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {group.chats.map((chat) => {
              const running = chat.id in runs && !runs[chat.id].error;
              return (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    asChild
                    className={SIDEBAR_ROW}
                    isActive={activeChat === chat.id}
                    tooltip={chat.name}
                  >
                    <NavLink to={`/assistant?session=${chat.id}`}>
                      <span className="truncate">{chat.name}</span>
                    </NavLink>
                  </SidebarMenuButton>
                  {running ? (
                    <span
                      title="The agent is still working"
                      className="pointer-events-none absolute top-1/2 right-3 size-1.5 -translate-y-1/2 animate-pulse rounded-full bg-accent motion-reduce:animate-none"
                    />
                  ) : (
                    <SidebarMenuAction
                      showOnHover
                      onClick={() => setPendingDelete(chat)}
                      aria-label={`Delete ${chat.name}`}
                      className="top-1.5 rounded-full hover:bg-transparent hover:text-err"
                    >
                      <Trash2 />
                    </SidebarMenuAction>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}

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
    </>
  );
}
