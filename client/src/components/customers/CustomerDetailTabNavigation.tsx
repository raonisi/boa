import {
  CalendarDays,
  FileText,
  History,
  LayoutDashboard,
  MessagesSquare,
} from "lucide-react";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CustomerDetailTab } from "@/lib/customerDetailTabs";

type CustomerDetailTabNavigationProps = {
  consultationCount: number;
  contractCount: number;
  scheduleCount: number;
  historyCount: number;
};

const items: Array<{
  value: CustomerDetailTab;
  label: string;
  icon: typeof LayoutDashboard;
  count?: keyof CustomerDetailTabNavigationProps;
}> = [
  { value: "summary", label: "요약", icon: LayoutDashboard },
  {
    value: "consultation",
    label: "상담·후속관리",
    icon: MessagesSquare,
    count: "consultationCount",
  },
  {
    value: "contracts",
    label: "계약",
    icon: FileText,
    count: "contractCount",
  },
  {
    value: "schedule",
    label: "일정·알림",
    icon: CalendarDays,
    count: "scheduleCount",
  },
  {
    value: "history",
    label: "히스토리·인수인계",
    icon: History,
    count: "historyCount",
  },
];

export function CustomerDetailTabNavigation(
  props: CustomerDetailTabNavigationProps
) {
  return (
    <TabsList
      aria-label="고객 상세 업무 영역"
      data-testid="customer-detail-mobile-tabs"
      className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-md border border-slate-200 bg-white p-1 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:grid-cols-5 [&::-webkit-scrollbar]:hidden"
    >
      {items.map(item => {
        const Icon = item.icon;
        const count = item.count ? props[item.count] : undefined;

        return (
          <TabsTrigger
            key={item.value}
            value={item.value}
            data-testid="customer-detail-mobile-tab"
            className="min-h-11 shrink-0 gap-1.5 px-3 text-xs sm:text-sm md:min-w-0"
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            <span>{item.label}</span>
            {count !== undefined ? (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-2xs tabular-nums text-slate-600 data-[state=active]:bg-primary/10">
                {count}
              </span>
            ) : null}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
