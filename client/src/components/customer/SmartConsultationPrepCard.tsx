import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPriorityLabel } from "@/components/StatusBadge";
import {
  buildMobilePrepSummaryLines,
  buildSmartConsultationPrepViewModel,
  type SmartConsultationPrepInput,
} from "@/lib/smartConsultationPrep";
import {
  CalendarPlus,
  ChevronDown,
  ClipboardCheck,
  Copy,
  GitBranch,
  History,
  MessageSquare,
  Network,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import React, { useMemo, useState } from "react";

export type SmartConsultationPrepCardProps = SmartConsultationPrepInput & {
  isMobile: boolean;
  onConsultRecord: () => void;
  onFollowUpCreate: () => void;
  onOpenTemplates: () => void;
  onOpenChecklist: () => void;
  onOpenTimeline: () => void;
  onOpenHandoff: () => void;
  onOpenRelationships?: () => void;
  onOpenReferrals?: () => void;
};

export function SmartConsultationPrepCard(props: SmartConsultationPrepCardProps) {
  const {
    isMobile,
    onConsultRecord,
    onFollowUpCreate,
    onOpenTemplates,
    onOpenChecklist,
    onOpenTimeline,
    onOpenHandoff,
    onOpenRelationships,
    onOpenReferrals,
    ...input
  } = props;

  const [expanded, setExpanded] = useState(!isMobile);

  const view = useMemo(
    () =>
      buildSmartConsultationPrepViewModel(input, {
        priorityLabel: value => getPriorityLabel(value ?? "unclassified"),
      }),
    [input]
  );

  const mobileSummary = buildMobilePrepSummaryLines(view);

  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Sparkles className="h-4 w-4 text-primary" />
              스마트 상담 준비 카드
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              상담 전 꼭 확인할 기준만 정리했습니다.
            </p>
          </div>
          {isMobile ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => setExpanded(value => !value)}
            >
              {expanded ? "요약 보기" : "자세히 보기"}
              <ChevronDown
                className={`ml-1 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </Button>
          ) : null}
        </div>

        {isMobile && !expanded ? (
          <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700">
            {mobileSummary.map(line => (
              <p key={line} className="line-clamp-1">
                {line}
              </p>
            ))}
          </div>
        ) : null}

        {(!isMobile || expanded) && (
          <div className="space-y-4">
            <section className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">1. 고객 현재 상태</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "상담상태", value: view.consultStatus },
                  { label: "우선순위", value: view.priorityLabel },
                  { label: "담당자", value: view.agentName },
                  { label: "다음 액션", value: view.nextAction },
                  { label: "마지막 상담일", value: view.lastConsultLabel },
                  { label: "다음 연락일", value: view.nextContactLabel },
                ].map(item => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2"
                  >
                    <p className="text-[11px] text-slate-500">{item.label}</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {view.customerTags.length > 0 ? (
                  view.customerTags.map(tag => (
                    <span
                      key={tag}
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    고객 성향 태그 없음
                  </span>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">
                2. 최근 이슈와 상담 목표
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[11px] text-slate-500">최근 상담기록</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-800">
                    {view.recentConsultSummary}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[11px] text-slate-500">최근 후속관리</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-800">
                    {view.recentFollowUpSummary}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[11px] text-slate-500">고객 경고/추천</p>
                  {view.warningSummaries.length > 0 ? (
                    <ul className="mt-1 space-y-1 text-sm text-slate-800">
                      {view.warningSummaries.map(warning => (
                        <li key={warning} className="line-clamp-2">
                          {warning}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      최근 경고 없음
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[11px] text-slate-500">인수인계 메모</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-800">
                    {view.handoffSummary}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-2">
                <p className="text-[11px] font-medium text-primary/80">
                  오늘 상담 목표
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {view.consultationGoal}
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">
                3. 추천 접근 / 피해야 할 말 / 바로 실행
              </p>
              <div className="grid gap-2 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[11px] font-medium text-slate-600">
                    추천 접근 방향
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-800">
                    {view.approachDirections.map(direction => (
                      <li key={direction} className="line-clamp-2">
                        · {direction}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-3">
                  <p className="text-[11px] font-medium text-amber-800">
                    피해야 할 말
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-amber-900">
                    {view.forbiddenPhrases.map(phrase => (
                      <li key={phrase}>· {phrase}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="min-h-10"
                  onClick={onConsultRecord}
                >
                  <MessageSquare className="mr-1 h-4 w-4" />
                  상담기록 작성
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  onClick={onFollowUpCreate}
                >
                  <CalendarPlus className="mr-1 h-4 w-4" />
                  후속관리 만들기
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  onClick={onOpenTemplates}
                >
                  <Copy className="mr-1 h-4 w-4" />
                  문구 템플릿
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  onClick={onOpenChecklist}
                >
                  <ClipboardCheck className="mr-1 h-4 w-4" />
                  상담 체크리스트
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  onClick={onOpenTimeline}
                >
                  <History className="mr-1 h-4 w-4" />
                  고객 히스토리
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  onClick={onOpenHandoff}
                >
                  <NotebookPen className="mr-1 h-4 w-4" />
                  인수인계 메모
                </Button>
                {input.hasRelationships && onOpenRelationships ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-10"
                    onClick={onOpenRelationships}
                  >
                    <Network className="mr-1 h-4 w-4" />
                    연결 고객
                  </Button>
                ) : null}
                {input.hasReferralFlows && onOpenReferrals ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-10"
                    onClick={onOpenReferrals}
                  >
                    <GitBranch className="mr-1 h-4 w-4" />
                    소개 흐름
                  </Button>
                ) : null}
              </div>
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
