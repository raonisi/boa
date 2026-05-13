import { useAuth } from "@/_core/hooks/useAuth";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Database,
  Download,
  FileText,
  GitMerge,
  Home,
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
};

const primaryItems: MobileMenuItem[] = [
  { icon: Home, label: "대시보드", path: "/" },
  { icon: Users, label: "내 고객", path: "/customers" },
  { icon: CalendarDays, label: "일정", path: "/calendar" },
  { icon: Bell, label: "알림", path: "/notifications" },
];

const moreItems: MobileMenuItem[] = [
  { icon: FileText, label: "계약관리", path: "/contracts" },
  { icon: BarChart3, label: "실적관리", path: "/performance" },
  { icon: Target, label: "목표관리", path: "/performance/goals" },
  { icon: Upload, label: "고객 일괄 등록", path: "/customers/bulk-import" },
  { icon: GitMerge, label: "중복 고객 관리", path: "/customers/merge", roles: ["branch_admin"] },
  { icon: Database, label: "DB 배정", path: "/customers/assign", roles: ["branch_admin", "sub_branch_admin", "team_leader"] },
  { icon: Users, label: "사용자 관리", path: "/users", roles: ["branch_admin"] },
  { icon: Network, label: "조직 구조", path: "/organization", roles: ["branch_admin", "sub_branch_admin", "team_leader"] },
  { icon: ArrowRightLeft, label: "인수인계 관리", path: "/users/handoff", roles: ["branch_admin"] },
  { icon: Users, label: "팀 관리", path: "/teams", roles: ["branch_admin"] },
  { icon: ShieldCheck, label: "운영 점검", path: "/admin-audit", roles: ["branch_admin"] },
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
    (item) => !item.roles || item.roles.includes(user?.role ?? "")
  );

  const goTo = (path: string) => {
    setLocation(path);
    setMoreOpen(false);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800/80 bg-slate-950/96 text-white shadow-[0_-16px_36px_rgba(15,23,42,0.22)] backdrop-blur md:hidden">
        <div className="grid h-16 grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
          {primaryItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            const isNotif = item.path === "/notifications";
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => goTo(item.path)}
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors ${
                  isActive ? "text-amber-300" : "text-slate-300"
                }`}
              >
                <span className={`relative rounded-xl p-1.5 ${isActive ? "bg-amber-300/12" : ""}`}>
                  <item.icon className="h-5 w-5" />
                  {isNotif && unreadCount && unreadCount > 0 ? (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </span>
                <span className="w-full truncate text-center">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors ${
              moreOpen ? "text-amber-300" : "text-slate-300"
            }`}
          >
            <span className={`rounded-xl p-1.5 ${moreOpen ? "bg-amber-300/12" : ""}`}>
              <Menu className="h-5 w-5" />
            </span>
            <span className="w-full truncate text-center">더보기</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[82vh] rounded-t-3xl border-slate-200 bg-slate-50 pb-5 pt-3 md:hidden">
          <SheetHeader className="text-left">
            <SheetTitle className="text-base">더보기</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-2 overflow-y-auto pb-4">
            {visibleMoreItems.map((item) => {
              const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
              return (
                <SheetClose asChild key={item.path}>
                  <button
                    type="button"
                    onClick={() => goTo(item.path)}
                    className={`flex min-h-14 items-center gap-3 rounded-2xl border px-3 text-left text-sm font-medium transition-colors ${
                      isActive ? "border-amber-300 bg-amber-50 text-slate-950" : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
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
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-red-100 bg-white px-3 text-left text-sm font-medium text-red-600"
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
