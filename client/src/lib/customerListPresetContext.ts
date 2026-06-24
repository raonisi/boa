import {
  getCustomerListUrlPresetMeta,
  type CustomerListUrlPresetId,
} from "@/components/customers/customerListUrlPresets";

export function buildCustomerListPresetContext(
  preset: CustomerListUrlPresetId,
  hasExtraFilters: boolean
) {
  const meta = getCustomerListUrlPresetMeta(preset);
  return {
    title: `현재 보기: ${meta.title}`,
    description: hasExtraFilters
      ? `${meta.description} 추가 필터가 함께 적용되어 표시 결과가 달라질 수 있습니다.`
      : meta.description,
  };
}
