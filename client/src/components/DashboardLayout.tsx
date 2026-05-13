import { useAuth } from "@/_core/hooks/useAuth";
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
  Activity,
  ArrowRightLeft,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  Building2,
  CalendarDays,
  FileText,
  GitMerge,
  Home,
  LogOut,
  Network,
  RotateCcw,
  Settings,
  ShieldCheck,
  ClipboardCheck,
  Target,
  Upload,
  Users,
  UserSquare2,
} from "lucide-react";
import { MobileNav } from "./MobileNav";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

type NavItem = {
  icon: React.ElementType;
  label: string;
  path: string;
  roles?: string[];
};

const menuItems: NavItem[] = [
  { icon: Home, label: "대시보드", path: "/" },
  { icon: Users, label: "고객 DB", path: "/customers" },
  { icon: Upload, label: "고객 일괄 등록", path: "/customers/bulk-import" },
  { icon: RotateCcw, label: "업로드 이력 관리", path: "/customers/import-batches", roles: ["branch_admin"] },
  { icon: GitMerge, label: "중복 고객 관리", path: "/customers/merge", roles: ["branch_admin"] },
  { icon: UserSquare2, label: "DB 배정", path: "/customers/assign", roles: ["branch_admin", "sub_branch_admin", "team_leader"] },
  { icon: FileText, label: "계약관리", path: "/contracts" },
  { icon: BarChart3, label: "실적관리", path: "/performance" },
  { icon: Target, label: "목표관리", path: "/performance/goals" },
  { icon: CalendarDays, label: "일정 캘린더", path: "/calendar" },
  { icon: Bell, label: "알림센터", path: "/notifications" },
  { icon: BellRing, label: "앱 알림 설정", path: "/notification-preferences" },
  { icon: BookOpen, label: "사용자 관리", path: "/users", roles: ["branch_admin"] },
  { icon: Network, label: "조직 구조", path: "/organization", roles: ["branch_admin", "sub_branch_admin", "team_leader"] },
  { icon: ArrowRightLeft, label: "인수인계 관리", path: "/users/handoff", roles: ["branch_admin"] },
  { icon: Users, label: "팀 관리", path: "/teams", roles: ["branch_admin"] },
  { icon: ShieldCheck, label: "운영 점검", path: "/admin-audit", roles: ["branch_admin"] },
  { icon: BellRing, label: "푸시 알림 운영", path: "/push-notifications", roles: ["branch_admin"] },
  { icon: Activity, label: "활동 로그", path: "/logs", roles: ["branch_admin", "sub_branch_admin", "team_leader"] },
  { icon: RotateCcw, label: "삭제 데이터 관리", path: "/deleted-data", roles: ["branch_admin"] },
  { icon: BookOpen, label: "데이터 다운로드", path: "/download", roles: ["branch_admin"] },
  { icon: ClipboardCheck, label: "상담 도구 관리", path: "/consultation-tools", roles: ["branch_admin"] },
  { icon: Settings, label: "설정 관리", path: "/settings", roles: ["branch_admin"] },
];
const SIDEBAR_WIDTH_KEY = "crm-sidebar-width";
const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 180;
const MAX_WIDTH = 300;

const roleLabel: Record<string, string> = {
  branch_admin: "지점장",
  sub_branch_admin: "부지점장",
  team_leader: "팀장",
  member: "팀원",
};

const pageTitles: Array<{ prefix: string; title: string }> = [
  { prefix: "/customers/assign", title: "DB 배정" },
  { prefix: "/customers/bulk-import", title: "고객 일괄 등록" },
  { prefix: "/customers/import-batches", title: "업로드 이력 관리" },
  { prefix: "/customers/merge", title: "중복 고객 관리" },
  { prefix: "/customers", title: "고객 DB" },
  { prefix: "/contracts", title: "계약관리" },
  { prefix: "/performance/goals", title: "목표관리" },
  { prefix: "/performance", title: "실적관리" },
  { prefix: "/notifications", title: "알림센터" },
  { prefix: "/notification-preferences", title: "앱 알림 설정" },
  { prefix: "/push-notifications", title: "푸시 알림 운영" },
  { prefix: "/calendar", title: "일정 캘린더" },
  { prefix: "/users/handoff", title: "인수인계 관리" },
  { prefix: "/organization", title: "조직 구조 관리" },
  { prefix: "/users", title: "사용자 관리" },
  { prefix: "/teams", title: "팀 관리" },
  { prefix: "/admin-audit", title: "운영 점검" },
  { prefix: "/logs", title: "활동 로그" },
  { prefix: "/deleted-data", title: "삭제 데이터 관리" },
  { prefix: "/download", title: "데이터 다운로드" },
  { prefix: "/consultation-tools", title: "상담 도구 관리" },
  { prefix: "/settings", title: "설정 관리" },
];

function getPageTitle(path: string) {
  if (path === "/") return "대시보드";
  return pageTitles.find((item) => path.startsWith(item.prefix))?.title ?? "BOA CRM";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [loginConfigMessage, setLoginConfigMessage] = useState<string | null>(null);
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full">
          <Building2 className="h-12 w-12 text-primary" />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">蹂댄뿕 ?곸뾽 ?щ궡 ?꾩궛</h1>
            <p className="text-sm text-muted-foreground mt-2">濡쒓렇?몄씠 ?꾩슂?⑸땲??</p>
          </div>
          {loginConfigMessage ? (
            <p className="text-sm text-destructive text-center">{loginConfigMessage}</p>
          ) : null}
          <Button onClick={handleLogin} size="lg" className="w-full">
            濡쒓렇??
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
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

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - left;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
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

  const visibleItems = menuItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role ?? "")
  );

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-slate-800/80 bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="h-16 justify-center border-b border-white/10">
            <div className="flex items-center gap-2 px-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-300 text-slate-950 shadow-sm">
                <Building2 className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold tracking-tight text-white">BOA 지점관리</p>
                  <p className="truncate text-[11px] font-medium text-amber-200/80">Premium CRM</p>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-3">
            <SidebarMenu className="gap-1 px-2">
              {visibleItems.map((item) => {
                const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                const isNotif = item.path === "/notifications";
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`relative h-10 rounded-xl text-sidebar-foreground/80 hover:bg-white/10 hover:text-white ${
                        isActive ? "bg-white/10 text-white before:absolute before:left-0 before:top-2 before:h-6 before:w-1 before:rounded-r-full before:bg-amber-300" : ""
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm">{item.label}</span>
                      {isNotif && unreadCount && unreadCount > 0 ? (
                        <Badge className="ml-auto h-4 min-w-4 border-0 bg-red-500 px-1 text-[10px] text-white">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-white/10 p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-2 py-2 text-left transition-colors hover:bg-white/10 focus:outline-none">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-amber-300 text-xs font-bold text-slate-950">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-semibold text-white">{user?.name ?? "-"}</p>
                      <p className="truncate text-[10px] text-amber-200/75">
                        {roleLabel[user?.role ?? "member"]}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{roleLabel[user?.role ?? "member"]}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
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
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 shadow-sm backdrop-blur">
          <SidebarTrigger className="h-8 w-8" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">{getPageTitle(location)}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
            </p>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setLocation("/notifications")}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-accent"
          >
            <Bell className="h-4 w-4" />
            {unreadCount && unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
        </header>
        <main className="boa-page min-h-[calc(100vh-4rem)] flex-1 p-4 pb-20 md:p-7 md:pb-7">
          {children}
        </main>
        <MobileNav />
      </SidebarInset>
    </>
  );
}

