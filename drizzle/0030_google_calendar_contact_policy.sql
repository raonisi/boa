CREATE TABLE `google_calendar_org_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationScope` int NOT NULL DEFAULT 1,
	`includeCustomerContactForActorCalendar` boolean NOT NULL DEFAULT false,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_calendar_org_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_google_calendar_org_settings_scope` UNIQUE(`organizationScope`)
);
--> statement-breakpoint
CREATE TABLE `google_calendar_personal_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`personalCalendarId` varchar(255),
	`contactDisplayConsent` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_calendar_personal_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_google_calendar_personal_settings_user` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `google_calendar_event_syncs` DROP INDEX `uq_google_calendar_event_sync`;
--> statement-breakpoint
ALTER TABLE `google_calendar_event_syncs` ADD `syncTargetType` enum('shared_calendar','actor_personal_calendar') NOT NULL DEFAULT 'shared_calendar';
--> statement-breakpoint
ALTER TABLE `google_calendar_event_syncs` ADD `targetUserId` int NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `google_calendar_event_syncs` ADD `includeContactInDescription` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `google_calendar_event_syncs` ADD `contactIncluded` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `google_calendar_event_syncs` ADD CONSTRAINT `uq_google_calendar_event_sync_target` UNIQUE(`boaEventType`,`boaEventId`,`syncTargetType`,`targetUserId`);
