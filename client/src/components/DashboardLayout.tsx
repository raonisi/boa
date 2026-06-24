import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrlResult } from "@/const";
import { useFcmDeviceTokenRegistration } from "@/hooks/useFcmDeviceTokenRegistration";
import { trpc } from "@/lib/trpc";
import {
  getUnreadBadgeAriaLabel,
  getUnreadBadgeLabel,
} from "@/lib/unreadBadge";
import { LogOut, Moon, Bell, Sun } from "lucide-react";
import { BrandedLogin } from "./BrandedLogin";
import { BrandLogo } from "./BrandLogo";
import { MobileNav } from "./MobileNav";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "./ui/button";
import { getRoleLabel } from "@/lib/userRole";
import {
  filterNavGroups,
  getPageTitle,
  sidebarNavGroups,
} from "@/lib/navigationConfig";
import {
  getNavigationBreadcrumb,
  isNavGroupActive,
  resolveActiveNavItem,
} from "@/lib/navigationMatch";
import { NavigationBreadcrumb } from "./NavigationBreadcrumb";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH_KEY = "crm-sidebar-width";
const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 180;
const MAX_WIDTH = 300;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [loginConfigMessage, setLoginConfigMessage] = useState<string | null>(
    null
  );
  useFcmDeviceTokenRegistration(user);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    const handleLogin = () => {
      const loginUrl = getLoginUrlResult();
      if (loginUrl.ok) {
        window.location.href = loginUrl.url;
        return;
      }

      setLoginConfigMessage(loginUrl.message);
    };

    return (
      <BrandedLogin
        onLogin={handleLogin}
        loginConfigMessage={loginConfigMessage}
      />
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const { theme, toggleTheme } = useTheme();

  const {
    data: unreadCount,
    isLoading: isUnreadLoading,
    isError: isUnreadError,
  } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const unreadBadgeInput = {
    count: unreadCount,
    isLoading: isUnreadLoading,
    isError: isUnreadError,
  };
  const unreadBadgeLabel = getUnreadBadgeLabel(unreadBadgeInput);
  const unreadBadgeAriaLabel = getUnreadBadgeAriaLabel(unreadBadgeInput);
  const navGroups = filterNavGroups(sidebarNavGroups, user);
  const activeNav = resolveActiveNavItem(navGroups, location);
  const pageTitle = getPageTitle(location);
  const breadcrumb = getNavigationBreadcrumb(location, navGroups, pageTitle);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - left;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH)
        setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const focusMainContent = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    mainContentRef.current?.focus({ preventScroll: true });
    mainContentRef.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
        >
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border/80">
            {!isCollapsed ? (
              <div className="flex min-w-0 items-center gap-2 px-2">
                <BrandLogo
                  mark
                  className="h-10 w-10 shrink-0 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-sidebar-primary/25"
                  imageClassName="drop-shadow-sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
                    BOA CRM
                  </p>
                  <p className="truncate text-xs font-medium text-sidebar-primary/90">
                    지점관리 CRM
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center px-2">
                <BrandLogo
                  mark
                  className="h-9 w-9 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-sidebar-primary/25"
                  imageClassName="drop-shadow-sm"
                />
              </div>
            )}
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2">
            {navGroups.map((group, gi) => {
              const groupActive = isNavGroupActive(group, location, navGroups);
              return (
                <div key={group.label}>
                  {gi > 0 && (
                    <div className="mx-3 my-1.5 border-t border-sidebar-border/40" />
                  )}
                  {!isCollapsed && (
                    <div className="px-4 pt-0.5">
                      <p
                        className={cn(
                          "mb-0.5 select-none text-xs font-semibold tracking-wide",
                          groupActive
                            ? "text-sidebar-primary"
                            : "text-sidebar-foreground/50"
                        )}
                      >
                        {group.label}
                      </p>
                      {group.description ? (
                        <p className="mb-1 text-xs leading-snug text-sidebar-foreground/40">
                          {group.description}
                        </p>
                      ) : null}
                    </div>
                  )}
                  <SidebarMenu className="gap-0.5 px-2">
                    {group.items.map(item => {
                      const isActive = activeNav?.item.path === item.path;
                      const isNotif = item.path === "/notifications";
                      return (
                        <SidebarMenuItem
                          key={`${group.label}-${item.label}-${item.path}`}
                        >
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => setLocation(item.path)}
                            tooltip={
                              item.description
                                ? `${item.label} — ${item.description}`
                                : item.label
                            }
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                              "relative min-h-11 rounded-lg text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground sm:min-h-10",
                              isActive &&
                                "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:left-0 before:top-2 before:h-6 before:w-1 before:rounded-r before:bg-sidebar-primary",
                              item.emphasis === "risk" &&
                                !isActive &&
                                "border border-amber-500/20 bg-amber-500/[0.04]"
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="text-sm">{item.label}</span>
                            {isNotif && unreadBadgeLabel ? (
                              <Badge
                                className="ml-auto h-5 min-w-5 border-0 bg-destructive px-1 text-xs text-destructive-foreground"
                                aria-label={unreadBadgeAriaLabel}
                              >
                                {unreadBadgeLabel}
                              </Badge>
                            ) : null}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </div>
              );
            })}
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border/80 p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-sidebar-border/80 bg-sidebar-accent/40 px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-semibold text-sidebar-foreground">
                        {user?.name ?? "-"}
                      </p>
                      <p className="truncate text-xs text-sidebar-primary/85">
                        {getRoleLabel(user?.role)}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getRoleLabel(user?.role)}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        {!isCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-50"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </div>

      <SidebarInset>
        <a
          href="#main-content"
          onClick={focusMainContent}
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          본문으로 바로가기
        </a>
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/90 bg-background/92 px-4 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/78">
          <SidebarTrigger className="h-9 w-9 shrink-0 rounded-lg border border-transparent hover:bg-muted/70" />
          <BrandLogo
            mark
            className="hidden h-8 w-8 shrink-0 rounded-lg bg-card p-1.5 shadow-sm ring-1 ring-border sm:flex"
          />
          <div className="min-w-0 flex-1">
            <NavigationBreadcrumb
              groupLabel={breadcrumb.groupLabel}
              pageTitle={breadcrumb.pageTitle}
              onNavigateHome={() => setLocation("/")}
            />
            <p className="mt-0.5 hidden text-xs text-muted-foreground tabular-nums sm:block">
              {new Date().toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </p>
          </div>
          <div className="flex-1" />
          {toggleTheme ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-lg border-border bg-card shadow-sm"
                  onClick={toggleTheme}
                  aria-label={
                    theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"
                  }
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                {theme === "dark" ? "라이트 모드" : "다크 모드"}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <button
            onClick={() => setLocation("/notifications")}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted/60"
            aria-label={unreadBadgeAriaLabel}
          >
            <Bell className="h-4 w-4" />
            {unreadBadgeLabel ? (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unreadBadgeLabel}
              </span>
            ) : null}
          </button>
        </header>
        <main
          id="main-content"
          ref={mainContentRef}
          tabIndex={-1}
          className="boa-page min-h-[calc(100vh-4rem)] flex-1 scroll-mt-16 p-3 pb-24 outline-none sm:p-4 sm:pb-20 md:p-7 md:pb-7"
        >
          {children}
        </main>
        <MobileNav />
      </SidebarInset>
    </>
  );
}
