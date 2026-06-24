import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type NavigationBreadcrumbProps = {
  groupLabel: string | null;
  pageTitle: string;
  onNavigateHome?: () => void;
};

export function NavigationBreadcrumb({
  groupLabel,
  pageTitle,
  onNavigateHome,
}: NavigationBreadcrumbProps) {
  const showGroup = Boolean(groupLabel && groupLabel !== pageTitle);

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap text-xs sm:text-sm">
        {onNavigateHome ? (
          <>
            <BreadcrumbItem className="hidden sm:inline-flex">
              <BreadcrumbLink
                className="cursor-pointer"
                onClick={event => {
                  event.preventDefault();
                  onNavigateHome();
                }}
              >
                BOA CRM
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:inline-flex" />
          </>
        ) : null}
        {showGroup ? (
          <>
            <BreadcrumbItem className="hidden max-w-[8rem] truncate md:inline-flex">
              <span className="text-muted-foreground">{groupLabel}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:inline-flex" />
          </>
        ) : null}
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate font-semibold text-foreground">
            {pageTitle}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
