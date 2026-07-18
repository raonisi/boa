import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  OPERATION_RISK_ACTION_LEVEL_LABELS,
  type OperationRiskActionLevel,
} from "@shared/operationRiskActionLevel";
import { AlertTriangle, User } from "lucide-react";
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
  actionLevel: OperationRiskActionLevel;
}

export default function AttentionUsers({ users }: { users: UserMetric[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          확인 필요 구성원
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {users.map(item => {
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
              <Card className="cursor-pointer transition-all hover:border-amber-300 hover:shadow-md">
                <CardContent className="flex flex-col items-center space-y-3 p-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {item.user.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {OPERATION_RISK_ACTION_LEVEL_LABELS[item.actionLevel]}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    {reasons.slice(0, 2).map(reason => (
                      <Badge
                        key={reason}
                        variant="outline"
                        className="px-1.5 py-0 text-xs"
                      >
                        {reason}
                      </Badge>
                    ))}
                    {reasons.length > 2 ? (
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 text-2xs text-muted-foreground"
                      >
                        +{reasons.length - 2}
                      </Badge>
                    ) : null}
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
