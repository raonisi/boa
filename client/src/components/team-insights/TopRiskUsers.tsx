import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

interface UserMetric {
  user: {
    id: number;
    name: string;
    role: string;
  };
  metrics: {
    unconsultedDbCount: number;
    overdueFollowUpsCount: number;
    incompleteSchedulesCount: number;
    longUnmanagedCount: number;
    priorityAUnmanagedCount: number;
    postContractUnmanagedCount: number;
  };
  riskScore: number;
}

export default function TopRiskUsers({ users }: { users: UserMetric[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          우선 조치 필요 팀원 TOP 5
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {users.map((item, index) => {
          const reasons = [];
          if (item.metrics.overdueFollowUpsCount > 0) reasons.push("후속지연");
          if (item.metrics.priorityAUnmanagedCount > 0)
            reasons.push("A등급방치");
          if (item.metrics.longUnmanagedCount > 0) reasons.push("장기미관리");
          if (item.metrics.incompleteSchedulesCount > 0)
            reasons.push("일정미완료");
          if (item.metrics.unconsultedDbCount > 0) reasons.push("미상담DB");
          if (item.metrics.postContractUnmanagedCount > 0)
            reasons.push("계약후방치");

          return (
            <Link
              key={item.user.id}
              href={`/customers?agentId=${item.user.id}`}
            >
              <Card className="cursor-pointer transition-all hover:border-destructive/50 hover:shadow-md">
                <CardContent className="p-4 flex flex-col items-center text-center space-y-3">
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                      <User className="h-6 w-6" />
                    </div>
                    <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white shadow-sm ring-2 ring-white">
                      {index + 1}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {item.user.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.riskScore}점
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    {reasons.slice(0, 2).map((r, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-xs px-1.5 py-0"
                      >
                        {r}
                      </Badge>
                    ))}
                    {reasons.length > 2 && (
                      <Badge
                        variant="outline"
                        className="text-2xs px-1.5 py-0 text-muted-foreground"
                      >
                        +{reasons.length - 2}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
