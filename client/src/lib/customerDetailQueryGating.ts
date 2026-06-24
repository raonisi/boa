export type CustomerDetailAccessState = {
  customerId: number;
  customer: { id: number } | null | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching?: boolean;
};

export function isValidCustomerDetailId(customerId: number): boolean {
  return Number.isFinite(customerId) && customerId > 0;
}

export function canLoadCustomerDetailDependencies(
  state: CustomerDetailAccessState
): boolean {
  if (!isValidCustomerDetailId(state.customerId)) return false;
  if (state.isLoading || state.isError) return false;
  if (!state.customer) return false;
  if (state.customer.id !== state.customerId) return false;
  return true;
}

export function shouldShowCustomerDetailLoadingShell(
  state: CustomerDetailAccessState
): boolean {
  if (!isValidCustomerDetailId(state.customerId)) return false;
  if (state.isLoading) return true;
  if (state.customer && state.customer.id !== state.customerId) return true;
  if (state.isFetching && state.customer?.id !== state.customerId) return true;
  return false;
}

export function shouldShowCustomerDetailUnavailable(
  state: CustomerDetailAccessState
): boolean {
  if (!isValidCustomerDetailId(state.customerId)) return true;
  if (shouldShowCustomerDetailLoadingShell(state)) return false;
  return state.isError || !state.customer;
}
