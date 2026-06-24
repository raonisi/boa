import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMemberQuickActions } from "@/lib/roleOperationalDashboard";
import {
  CalendarDays,
  MessageSquarePlus,
  Phone,
  Search,
  UserRound,
  Zap,
} from "lucide-react";
import type { ElementType } from "react";
import { useLocation } from "wouter";

const actionIcons: Record<string, ElementType> = {
  "today-contact": Phone,
  "overdue-followup": Zap,
  "quick-followup": MessageSquarePlus,
  "quick-consult": MessageSquarePlus,
  "priority-contact": Phone,
  "my-customers": UserRound,
  "customer-search": Search,
  calendar: CalendarDays,
};

export function MemberQuickExecutionSection() {
  const [, setLocation] = useLocation();
  const actions = getMemberQuickActions();

  return (
    <Card className="crm-dashboard-card border-primary/15 md:hidden">
      <CardHeader className="border-b border-border/70 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Search className="h-4 w-4 text-primary" aria-hidden="true" />
          빠른 실행
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 p-4">
        {actions.map(action => {
          const Icon = actionIcons[action.id] ?? UserRound;
          return (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              className="min-h-14 h-auto flex-col items-start gap-1 px-3 py-3 text-left"
              onClick={() => setLocation(action.path)}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {action.label}
              </span>
              <span className="text-xs font-normal leading-snug text-muted-foreground">
                {action.hint}
              </span>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
