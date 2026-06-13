export const CUSTOMER_BULK_IMPORT_PERMISSION = "customers.bulk_import";

type PermissionedUser = {
  role?: string | null;
  permissions?: string[] | null;
};

export function hasCustomerBulkImportAccess(
  user: PermissionedUser | null | undefined
) {
  if (!user) return false;
  if (user.role === "branch_admin") return true;
  if (user.role !== "sub_branch_admin" && user.role !== "team_leader")
    return false;
  return (
    Array.isArray(user.permissions) &&
    user.permissions.includes(CUSTOMER_BULK_IMPORT_PERMISSION)
  );
}
