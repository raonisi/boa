import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { BarChart3, Bell, CalendarDays, Home, Users } from "lucide-react";
import { useLocation } from "wouter";

const navItems = [
  { icon: Home, label: "홈", path: "/" },
  { icon: Users, label: "고객", path: "/customers" },
  { icon: CalendarDays, label: "일정", path: "/calendar" },
  { icon: Bell, label: "알림", path: "/notifications" },
  { icon: BarChart3, label: "실적", path: "/performance" },
];

export function MobileNav() {
  const [location, setLocation] = useLocation();
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden">
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) => {
          const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
          const isNotif = item.path === "/notifications";
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors relative ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {isNotif && unreadCount && unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-[8px] text-white flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
