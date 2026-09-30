import { Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import "@/index.css";
import { AppSidebar } from "@/components/app-sidebar";
import { ROUTES, DEFAULT_ROUTE } from "@/routes";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { isMac, isWindows } from "@/hooks/use-shortcuts";
import { Toaster } from "@/components/ui/sonner";
import { AskDialog } from "@/components/custom/ask-dialog";
import { WindowControls } from "@/components/custom/window-controls";
import { SecretDialog } from "@/components/custom/secret-dialog";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

// Window chrome, not a second navigation bar: a drag strip holding the sidebar
// toggle. No border and no fill — the sidebar's edge already separates the two
// panes, and a third horizontal rule above every page is what makes a desktop
// app read like a web page. Each screen's own PageHeader carries the hierarchy.
//
// Collapsed on macOS, the strip sits under the traffic lights, so the toggle
// steps aside to clear them.
function TitleBar() {
  const { open } = useSidebar();
  return (
    <header className="flex h-11 shrink-0 items-center px-2.5 [-webkit-app-region:drag] [--wails-draggable:drag]">
      <SidebarTrigger
        className={`text-muted-foreground hover:text-foreground ${isMac && !open ? "ml-16" : ""} [-webkit-app-region:no-drag] [--wails-draggable:no-drag]`}
      />
      {isWindows && <WindowControls />}
    </header>
  );
}

function Layout() {
  useShortcuts();

  return (
    <SidebarProvider className="h-svh overflow-hidden bg-sidebar">
      <AppSidebar />
      {/* The pane is a plate seated in the window canvas (the sidebar colour),
          with one warm wash in its top corner — the only gradient in the app,
          fixed to the pane so it never repaints on scroll. */}
      <SidebarInset className="min-h-0 overflow-hidden bg-background bg-[radial-gradient(70%_45%_at_100%_0%,color-mix(in_oklab,var(--accent)_7%,transparent),transparent)] md:peer-data-[variant=inset]:rounded-2xl md:peer-data-[variant=inset]:shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_7%,transparent),0_12px_40px_-24px_color-mix(in_oklab,var(--foreground)_35%,transparent)]">
        <TitleBar />
        {/* Gutters live on <Page>, not here: the chat wants a shallower
            bottom than a dashboard does. */}
        <main className="min-h-0 flex-1 overflow-auto">
          {/* Routes are code-split; the chunk is local so the gap is a frame or
              two, and a spinner there would flash more than it reassures. */}
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
      </SidebarInset>
      <Toaster position="top-center" richColors />
      <AskDialog />
      <SecretDialog />
    </SidebarProvider>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to={DEFAULT_ROUTE} replace />} />
        {ROUTES.map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
      </Route>
    </Routes>
  );
}

export default App;
