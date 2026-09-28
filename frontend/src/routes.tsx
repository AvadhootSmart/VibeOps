import { lazy, type ReactNode } from "react";
import {
  LayoutGrid,
  Sparkles,
  Settings2,
  type LucideIcon,
} from "lucide-react";

// Split per route. Overview is the landing page and needs none of the chat
// stack — Streamdown, shiki, motion, the markdown pipeline — which is most of
// the bundle. Eagerly importing every page meant parsing all of it before the
// first paint. App.tsx wraps the <Outlet> in the <Suspense> these need.
const Overview = lazy(() => import("@/pages/overview"));
const Assistant = lazy(() => import("@/pages/assistant"));
const Settings = lazy(() => import("@/pages/settings"));

// Single source of truth for pages. App.tsx renders these as <Route>s and
// app-sidebar renders them as nav links, so they can never drift. Add a page:
// create it under pages/, then add one entry here.
export interface RouteItem {
  path: string;
  title: string;
  icon: LucideIcon;
  element: ReactNode;
  section: "main" | "footer";
}

export const ROUTES: RouteItem[] = [
  {
    path: "/overview",
    title: "Overview",
    icon: LayoutGrid,
    element: <Overview />,
    section: "main",
  },
  {
    path: "/assistant",
    title: "Assistant",
    icon: Sparkles,
    element: <Assistant />,
    section: "main",
  },
  {
    path: "/settings",
    title: "Settings",
    icon: Settings2,
    element: <Settings />,
    section: "footer",
  },
];

// Default landing route.
export const DEFAULT_ROUTE = "/overview";
