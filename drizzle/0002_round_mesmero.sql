CREATE TABLE `consent_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`changedBy` int NOT NULL,
	`consentType` enum('privacy','marketing') NOT NULL,
	`previousValue` boolean,
	`newValue` boolean NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consent_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('contract_90','contract_180','contract_365','birthday','uncontacted_3days','long_unmanaged_90','reconsult','unpaid_lapse','schedule_1day','schedule_today','schedule_1hour','schedule_incomplete') NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`relatedType` varchar(50),
	`relatedId` int,
	`dueAt` timestamp,
	`isRead` boolean NOT NULL DEFAULT false,
	`isSent` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reminders_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_reminder` UNIQUE(`userId`,`type`,`relatedType`,`relatedId`,`dueAt`)
);
--> statement-breakpoint
CREATE TABLE `status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`changedBy` int NOT NULL,
	`previousStatus` varchar(50),
	`newStatus` varchar(50) NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `type` enum('contract_90','contract_180','contract_365','birthday','uncontacted_3days','long_unmanaged_90','reconsult','unpaid_lapse','schedule_1day','schedule_today','schedule_1hour','schedule_incomplete','customer_assigned','general') NOT NULL;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD `userAgent` varchar(300);--> statement-breakpoint
ALTER TABLE `consultations` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `consultations` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `contracts` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `contracts` ADD `createdBy` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `assignedTeamId` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `notifications` ADD `dueAt` timestamp;--> statement-breakpoint
ALTER TABLE `schedules` ADD `teamId` int;--> statement-breakpoint
ALTER TABLE `schedules` ADD `description` text;--> statement-breakpoint
ALTER TABLE `schedules` ADD `completedAt` timestamp;--> statement-breakpoint
ALTER TABLE `schedules` ADD `reminderDayBefore` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `schedules` ADD `reminderSameDay` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `schedules` ADD `reminderOneHourBefore` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `schedules` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `schedules` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `schedules` ADD `createdBy` int;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `uq_notification` UNIQUE(`userId`,`type`,`relatedType`,`relatedId`,`dueAt`);