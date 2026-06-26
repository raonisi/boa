import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { User, ChevronRight } from "lucide-react";

interface UserMetric {
  user: {
    id: number;
    name: string;
    role: string;
    teamId: number | null;
    subBranchAdminId: number | null;
  };
  metrics: {
    unconsultedDbCount: number;
    overdueFollowUpsCount: number;
    todayFollowUpsCount: number;
    incompleteSchedulesCount: number;
    longUnmanagedCount: number;
    priorityAUnmanagedCount: number;
    postContractUnmanagedCount: number;
    unreadNotificationsCount: number;
    todayConsultationsCount: number;
    todayContractsCount: number;
  };
  riskScore: number;
}

export default function InsightTable({ metrics }: { metrics: UserMetric[] }) {
  if (metrics.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">소속된 팀원이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[180px]">팀원</TableHead>
            <TableHead className="text-center">위험도</TableHead>
            <TableHead className="text-center text-muted-foreground">
              미상담DB
            </TableHead>
            <TableHead className="text-center text-muted-foreground">
              후속지연
            </TableHead>
            <TableHead className="text-center text-muted-foreground">
              오늘미완료
            </TableHead>
            <TableHead className="text-center text-muted-foreground">
              장기미관리
            </TableHead>
            <TableHead className="text-center text-muted-foreground">
              A등급방치
            </TableHead>
            <TableHead className="text-center text-muted-foreground">
              계약후방치
            </TableHead>
            <TableHead className="text-center text-muted-foreground">
              오늘상담
            </TableHead>
            <TableHead className="text-right">상세보기</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.map(item => (
            <TableRow key={item.user.id} className="group">
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm">{item.user.name}</p>
                    <p className="text-2xs text-muted-foreground">
                      {item.user.role === "team_leader" ? "팀장" : "팀원"}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center">
                {item.riskScore > 0 ? (
                  <Badge
                    variant={
                      item.riskScore >= 30
                        ? "destructive"
                        : item.riskScore >= 10
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {item.riskScore}점
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">안정</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {item.metrics.unconsultedDbCount > 0 ? (
                  <span className="font-medium text-amber-600">
                    {item.metrics.unconsultedDbCount}
                  </span>
                ) : (
                  <span className="text-muted-foreground/30">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {item.metrics.overdueFollowUpsCount > 0 ? (
                  <span className="font-bold text-destructive">
                    {item.metrics.overdueFollowUpsCount}
                  </span>
                ) : (
                  <span className="text-muted-foreground/30">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {item.metrics.incompleteSchedulesCount > 0 ? (
                  <span className="font-medium text-amber-600">
                    {item.metrics.incompleteSchedulesCount}
                  </span>
                ) : (
                  <span className="text-muted-foreground/30">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {item.metrics.longUnmanagedCount > 0 ? (
                  <span className="font-medium text-destructive">
                    {item.metrics.longUnmanagedCount}
                  </span>
                ) : (
                  <span className="text-muted-foreground/30">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {item.metrics.priorityAUnmanagedCount > 0 ? (
                  <span className="font-medium text-destructive">
                    {item.metrics.priorityAUnmanagedCount}
                  </span>
                ) : (
                  <span className="text-muted-foreground/30">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {item.metrics.postContractUnmanagedCount > 0 ? (
                  <span className="font-medium text-amber-600">
                    {item.metrics.postContractUnmanagedCount}
                  </span>
                ) : (
                  <span className="text-muted-foreground/30">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <span className="font-medium text-primary">
                  {item.metrics.todayConsultationsCount}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/customers?agentId=${item.user.id}`}>
                  <button className="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
                    고객 보기 <ChevronRight className="ml-1 h-3 w-3" />
                  </button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
