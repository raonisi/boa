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
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  FileText,
  Home,
  LogOut,
  Settings,
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
  { icon: Upload, label: "고객 일괄 등록", path: "/customers/bulk-import", roles: ["branch_admin"] },
  { icon: UserSquare2, label: "DB 배정", path: "/customers/assign", roles: ["branch_admin", "sub_branch_admin"] }, // 부지점장도 접근 가능
  { icon: FileText, label: "계약관리", path: "/contracts" },
  { icon: BarChart3, label: "실적관리", path: "/performance" },
  { icon: CalendarDays, label: "일정 캘린더", path: "/calendar" },
  { icon: Bell, label: "알림센터", path: "/notifications" },
  { icon: BookOpen, label: "사용자 관리", path: "/users", roles: ["branch_admin"] },
  { icon: Users, label: "팀 관리", path: "/teams", roles: ["branch_admin"] },
  { icon: Activity, label: "활동 로그", path: "/logs", roles: ["branch_admin", "sub_branch_admin", "team_leader"] },
  { icon: BookOpen, label: "데이터 다운로드", path: "/download", roles: ["branch_admin"] },
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full">
          <Building2 className="h-12 w-12 text-primary" />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">보험 영업 사내 전산</h1>
            <p className="text-sm text-muted-foreground mt-2">로그인이 필요합니다.</p>
          </div>
          <Button onClick={() => { window.location.href = getLoginUrl(); }} size="lg" className="w-full">
            로그인
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
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
          <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-2">
              <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="text-sm font-bold text-sidebar-foreground truncate">보험 CRM</p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">사내 전산 시스템</p>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2">
            <SidebarMenu className="px-2 gap-0.5">
              {visibleItems.map((item) => {
                const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                const isNotif = item.path === "/notifications";
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-9 relative"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm">{item.label}</span>
                      {isNotif && unreadCount && unreadCount > 0 ? (
                        <Badge className="ml-auto h-4 min-w-4 px-1 text-[10px] bg-red-500 text-white">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-2 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-left focus:outline-none">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs font-semibold bg-sidebar-primary text-sidebar-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.name ?? "-"}</p>
                      <p className="text-[10px] text-sidebar-foreground/60 truncate">
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
        <header className="flex h-14 items-center gap-2 border-b bg-background/95 backdrop-blur px-4 sticky top-0 z-40">
          <SidebarTrigger className="h-8 w-8" />
          <div className="flex-1" />
          <button
            onClick={() => setLocation("/notifications")}
            className="relative h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unreadCount && unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6 bg-background min-h-[calc(100vh-3.5rem)] pb-20 md:pb-6">
          {children}
        </main>
        <MobileNav />
      </SidebarInset>
    </>
  );
}
