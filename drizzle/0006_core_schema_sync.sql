CREATE TABLE `settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(50) NOT NULL,
	`value` varchar(200) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('branch_admin','sub_branch_admin','team_leader','member') NOT NULL DEFAULT 'member';--> statement-breakpoint
ALTER TABLE `customers` ADD `subBranchAdminId` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `assignmentStatus` enum('unassigned','assigned_to_sub_branch','assigned_to_agent') DEFAULT 'unassigned' NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `description` text;--> statement-breakpoint
ALTER TABLE `teams` ADD `subBranchAdminId` int;--> statement-breakpoint
ALTER TABLE `teams` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `accountStatus` enum('active','inactive','resigned') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `loginStatus` enum('invited','linked') DEFAULT 'linked';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `memo` text;--> statement-breakpoint
ALTER TABLE `users` ADD `subBranchAdminId` int;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);