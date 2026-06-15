import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPLIANCE_RISK_OPTIONS,
  COVERAGE_AREA_OPTIONS,
  CUSTOMER_STAGE_OPTIONS,
  EXPECTED_BARRIER_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
  SUPPORT_REQUEST_OPTIONS,
} from "@shared/actionPlanDirectUpload";

export function PrivacyConfirmField({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={v => onChange(v === true)}
        className="mt-0.5"
      />
      <span>
        개인정보 최소화 확인 — 고객 실명·연락처·증권번호·질병명 등 식별정보를
        입력하지 않았습니다.
      </span>
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        className="min-h-11"
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Textarea
        className="min-h-[88px]"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="min-h-11">
          <SelectValue placeholder="선택" />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const PR21_SELECT_OPTIONS = {
  customerStage: CUSTOMER_STAGE_OPTIONS,
  productCategory: PRODUCT_CATEGORY_OPTIONS,
  coverageArea: COVERAGE_AREA_OPTIONS,
  supportRequest: SUPPORT_REQUEST_OPTIONS,
  expectedBarrier: EXPECTED_BARRIER_OPTIONS,
  complianceRisk: COMPLIANCE_RISK_OPTIONS,
};
