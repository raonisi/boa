CREATE TABLE `google_calendar_oauth_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationScope` int NOT NULL DEFAULT 1,
	`provider` varchar(32) NOT NULL DEFAULT 'google_calendar',
	`refreshTokenEnc` text NOT NULL,
	`tokenScope` varchar(500),
	`connectedBy` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastTestedAt` timestamp,
	`lastTestResult` varchar(32),
	`lastTestErrorSafe` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_calendar_oauth_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_google_calendar_oauth_org` UNIQUE(`organizationScope`,`provider`)
);
--> statement-breakpoint
CREATE TABLE `google_calendar_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationScope` int NOT NULL DEFAULT 1,
	`provider` varchar(32) NOT NULL DEFAULT 'google_calendar',
	`calendarType` enum('branch_common','consultation_followup','admin') NOT NULL,
	`googleCalendarId` varchar(255) NOT NULL,
	`displayName` varchar(200) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastTestedAt` timestamp,
	`lastTestResult` varchar(32),
	`lastTestErrorSafe` varchar(500),
	`createdBy` int NOT NULL,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_calendar_integrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_google_calendar_integration_type` UNIQUE(`organizationScope`,`calendarType`)
);
--> statement-breakpoint
CREATE TABLE `google_calendar_event_syncs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boaEventType` enum('calendar_event','follow_up','consultation','meeting','education','admin') NOT NULL,
	`boaEventId` int NOT NULL,
	`googleCalendarId` varchar(255) NOT NULL,
	`googleEventId` varchar(255),
	`calendarType` enum('branch_common','consultation_followup','admin') NOT NULL,
	`syncStatus` enum('pending','synced','failed','deleted','skipped') NOT NULL DEFAULT 'pending',
	`lastSyncedAt` timestamp,
	`lastErrorCode` varchar(64),
	`lastErrorMessageSafe` varchar(500),
	`retryCount` int NOT NULL DEFAULT 0,
	`ownerUserId` int,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_calendar_event_syncs_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_google_calendar_event_sync` UNIQUE(`boaEventType`,`boaEventId`)
);
