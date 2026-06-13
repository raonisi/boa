import { Button } from "@/components/ui/button";
import { Home, SearchX } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/8 ring-1 ring-primary/15">
          <SearchX className="h-9 w-9 text-primary/70" />
        </div>
        <div className="space-y-2">
          <p className="text-5xl font-bold tabular-nums text-foreground">404</p>
          <h1 className="text-lg font-semibold text-foreground">
            페이지를 찾을 수 없습니다
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            요청하신 페이지가 존재하지 않거나 삭제되었습니다.
            <br />
            주소를 다시 확인하거나 홈으로 돌아가세요.
          </p>
        </div>
        <Button onClick={() => setLocation("/")} className="gap-2">
          <Home className="h-4 w-4" />
          홈으로 돌아가기
        </Button>
      </div>
    </div>
  );
}
