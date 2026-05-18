import { useAuth } from "@/_core/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import { hasCustomerBulkImportAccess } from "@shared/permissions";
import {
  Activity,
  ArrowRightLeft,
  BarChart2,
  BarChart3,
  Bell,
  BellRing,
  CalendarDays,
  ClipboardCheck,
  Database,
  Download,
  FileText,
  GitMerge,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Network,
  RotateCcw,
  Settings,
  ShieldCheck,
  Target,
  Upload,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

type MobileMenuItem = {
  icon: React.ElementType;
  label: string;
  path: string;
  roles?: string[];
  canAccess?: (user: any) => boolean;
};

const primaryItems: MobileMenuItem[] = [
  { icon: Home, label: "대시보드", path: "/" },
  { icon: Users, label: "내 고객", path: "/customers" },
  { icon: CalendarDays, label: "일정", path: "/calendar" },
  { icon: Bell, label: "알림", path: "/notifications" },
];

const moreItems: MobileMenuItem[] = [
  { icon: BarChart2, label: "영업 분석", path: "/analytics" },
  { icon: LayoutGrid, label: "세일즈 파이프라인", path: "/sales-pipeline" },
  { icon: BellRing, label: "앱 알림 설정", path: "/notification-preferences" },
  { icon: FileText, label: "계약관리", path: "/contracts" },
  { icon: BarChart3, label: "실적관리", path: "/performance" },
  { icon: Target, label: "목표관리", path: "/performance/goals" },
  { icon: Upload, label: "고객 일괄 등록", path: "/customers/bulk-import", canAccess: hasCustomerBulkImportAccess },
  { icon: GitMerge, label: "중복 고객 관리", path: "/customers/merge", roles: ["branch_admin"] },
  { icon: Database, label: "DB 배정", path: "/customers/assign", roles: ["branch_admin", "sub_branch_admin", "team_leader"] },
  { icon: Users, label: "사용자 관리", path: "/users", roles: ["branch_admin"] },
  { icon: Network, label: "조직 구조", path: "/organization", roles: ["branch_admin", "sub_branch_admin", "team_leader"] },
  { icon: ArrowRightLeft, label: "인수인계 관리", path: "/users/handoff", roles: ["branch_admin"] },
  { icon: Users, label: "팀 관리", path: "/teams", roles: ["branch_admin"] },
  { icon: ShieldCheck, label: "운영 리스크", path: "/operation-risk", roles: ["branch_admin", "sub_branch_admin", "team_leader"] },
  { icon: BellRing, label: "푸시 알림 운영", path: "/push-notifications", roles: ["branch_admin"] },
  { icon: RotateCcw, label: "삭제 데이터 관리", path: "/deleted-data", roles: ["branch_admin"] },
  { icon: RotateCcw, label: "업로드 이력 관리", path: "/customers/import-batches", roles: ["branch_admin"] },
  { icon: Activity, label: "활동 로그", path: "/logs", roles: ["branch_admin", "sub_branch_admin", "team_leader"] },
  { icon: Download, label: "데이터 다운로드", path: "/download", roles: ["branch_admin"] },
  { icon: ClipboardCheck, label: "상담 도구 관리", path: "/consultation-tools", roles: ["branch_admin"] },
  { icon: Settings, label: "설정 관리", path: "/settings", roles: ["branch_admin"] },
];

export function MobileNav() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const visibleMoreItems = moreItems.filter(
    (item) => item.canAccess?.(user) ?? (!item.roles || item.roles.includes(user?.role ?? ""))
  );

  const goTo = (path: string) => {
    setLocation(path);
    setMoreOpen(false);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar/98 text-sidebar-foreground shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md md:hidden dark:shadow-[0_-8px_28px_rgba(0,0,0,0.35)]">
        <div className="grid min-h-[64px] grid-cols-5 px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5">
          {primaryItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            const isNotif = item.path === "/notifications";
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => goTo(item.path)}
                className={`relative flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold transition-colors ${
                  isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70"
                }`}
              >
                <span
                  className={`relative flex h-10 w-10 items-center justify-center rounded-lg ${
                    isActive ? "bg-sidebar-primary/12 ring-1 ring-sidebar-primary/25" : ""
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {isNotif && unreadCount && unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </span>
                <span className="w-full truncate text-center leading-tight">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold transition-colors ${
              moreOpen ? "text-sidebar-primary" : "text-sidebar-foreground/70"
            }`}
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                moreOpen ? "bg-sidebar-primary/12 ring-1 ring-sidebar-primary/25" : ""
              }`}
            >
              <Menu className="h-5 w-5" />
            </span>
            <span className="w-full truncate text-center leading-tight">더보기</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[min(86vh,42rem)] rounded-t-2xl border-border bg-card pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:hidden">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-3 text-base font-semibold">
              <BrandLogo className="h-9 w-24 justify-start" />
              <span>더보기</span>
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid max-h-[calc(86vh-7rem)] grid-cols-2 gap-2 overflow-y-auto overscroll-contain pb-4">
            {visibleMoreItems.map((item) => {
              const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
              return (
                <SheetClose asChild key={item.path}>
                  <button
                    type="button"
                    onClick={() => goTo(item.path)}
                    className={`flex min-h-[52px] items-center gap-3 rounded-lg border px-3 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? "border-sidebar-primary/50 bg-sidebar-primary/10 text-foreground"
                        : "border-border bg-muted/30 text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.label}</span>
                  </button>
                </SheetClose>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                logout();
              }}
              className="flex min-h-[52px] items-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 text-left text-sm font-medium text-destructive"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>로그아웃</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
