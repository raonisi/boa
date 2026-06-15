ALTER TABLE `google_calendar_org_settings` ADD `syncRawTitleToGoogleCalendar` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `google_calendar_org_settings` ADD `syncRawDescriptionToGoogleCalendar` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `google_calendar_org_settings` ADD `allowCustomerNameInGoogleCalendar` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `google_calendar_org_settings` ADD `allowCustomerContactInGoogleCalendar` boolean NOT NULL DEFAULT false;
