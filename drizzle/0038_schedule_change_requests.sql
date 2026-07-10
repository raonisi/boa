ALTER TABLE `schedules` ADD `location` varchar(200);
--> statement-breakpoint
CREATE TABLE `schedule_change_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestType` enum('create','update','delete') NOT NULL,
	`scheduleId` int,
	`requesterId` int NOT NULL,
	`targetUserId` int NOT NULL,
	`status` enum('pending','approved','rejected','cancelled','conflict','failed') NOT NULL DEFAULT 'pending',
	`reason` varchar(500) NOT NULL,
	`requestedPayload` json NOT NULL,
	`beforeSnapshot` json,
	`baseScheduleUpdatedAt` timestamp,
	`pendingKey` varchar(100),
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewComment` varchar(500),
	`appliedAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schedule_change_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_schedule_change_requests_pending_key` UNIQUE(`pendingKey`),
	INDEX `idx_scr_status_created` (`status`,`createdAt`),
	INDEX `idx_scr_requester_status` (`requesterId`,`status`),
	INDEX `idx_scr_target_status` (`targetUserId`,`status`),
	INDEX `idx_scr_schedule_status` (`scheduleId`,`status`),
	INDEX `idx_scr_reviewer_reviewed` (`reviewedBy`,`reviewedAt`)
);
