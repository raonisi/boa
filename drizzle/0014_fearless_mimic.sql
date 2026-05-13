CREATE TABLE `performance_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`targetType` enum('branch','sub_branch','team','user') NOT NULL,
	`targetId` int,
	`contractCountGoal` int NOT NULL DEFAULT 0,
	`monthlyPremiumGoal` int NOT NULL DEFAULT 0,
	`consultationGoal` int NOT NULL DEFAULT 0,
	`followUpGoal` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`updatedBy` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `performance_goals_id` PRIMARY KEY(`id`)
);
