CREATE TABLE `onboarding_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`targetRole` enum('branch_admin','sub_branch_admin','team_leader','member') NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	`archivedBy` int,
	CONSTRAINT `onboarding_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `onboarding_template_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`category` varchar(100) NOT NULL,
	`required` boolean NOT NULL DEFAULT true,
	`requiresManagerApproval` boolean NOT NULL DEFAULT false,
	`practiceRequired` boolean NOT NULL DEFAULT false,
	`relatedMenu` varchar(200),
	`completionCriteria` text,
	`estimatedMinutes` int NOT NULL DEFAULT 10,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `onboarding_template_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_onboarding_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetUserId` int NOT NULL,
	`templateId` int NOT NULL,
	`assignedBy` int NOT NULL,
	`trainerUserId` int,
	`startedAt` timestamp NOT NULL,
	`dueAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`status` enum('assigned','in_progress','completed','overdue','archived') NOT NULL DEFAULT 'assigned',
	`progressPercent` int NOT NULL DEFAULT 0,
	`requiredPendingCount` int NOT NULL DEFAULT 0,
	`approvalPendingCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	`archivedBy` int,
	CONSTRAINT `user_onboarding_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_onboarding_item_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`itemId` int NOT NULL,
	`status` enum('pending','needs_approval','approved','rejected','skipped') NOT NULL DEFAULT 'pending',
	`completedAt` timestamp,
	`completedBy` int,
	`approvedAt` timestamp,
	`approvedBy` int,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_onboarding_item_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_onboarding_assignment_item` UNIQUE(`assignmentId`,`itemId`)
);
