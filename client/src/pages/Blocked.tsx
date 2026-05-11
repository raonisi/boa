import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";

export default function Blocked() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm p-8">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">접근이 차단되었습니다</h1>
          <p className="text-sm text-muted-foreground mt-2">
            계정이 비활성화되어 시스템에 접근할 수 없습니다.
            <br />
            관리자에게 문의하세요.
          </p>
        </div>
        <Button variant="outline" onClick={logout}>로그아웃</Button>
      </div>
    </div>
  );
}
