CREATE TABLE `google_calendar_misclassified_resync_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executeToken` varchar(64) NOT NULL,
	`status` enum('dry_run','executing','completed','expired') NOT NULL DEFAULT 'dry_run',
	`fromCalendarType` enum('branch_common','consultation_followup','admin') NOT NULL,
	`toCalendarType` enum('branch_common','consultation_followup','admin') NOT NULL,
	`summaryJson` text NOT NULL,
	`candidateIdsJson` text NOT NULL,
	`resultJson` text,
	`actorId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`executedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_calendar_misclassified_resync_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_google_calendar_misclassified_resync_token` UNIQUE(`executeToken`)
);
