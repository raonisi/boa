import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";
import { useState } from "react";

/** 원본은 `client/public/brand/boa.ai` (일러스트). 웹 표시용으로 `boa-logo.svg` 또는 `boa-logo.png`를 같은 폴더에 두면 자동 적용됩니다. */
const LOGO_WEB = ["/brand/boa-logo.png", "/brand/boa-logo.svg"] as const;

type BranchMarkProps = {
  className?: string;
  /** 아이콘 폴백 시 lucide 크기 */
  iconClassName?: string;
};

export function BranchMark({ className, iconClassName }: BranchMarkProps) {
  const [step, setStep] = useState(0);

  if (step >= LOGO_WEB.length) {
    return (
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-300 text-slate-950 shadow-sm", className)}>
        <Building2 className={cn("h-4 w-4", iconClassName)} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/95 shadow-sm ring-1 ring-white/20",
        className
      )}
    >
      <img
        src={LOGO_WEB[step]}
        alt="BOA"
        className="h-full w-full object-contain p-0.5"
        draggable={false}
        onError={() => setStep((s) => s + 1)}
      />
    </div>
  );
}
