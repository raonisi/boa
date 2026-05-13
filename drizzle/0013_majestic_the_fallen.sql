CREATE TABLE `handoff_histories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceUserId` int NOT NULL,
	`targetUserId` int NOT NULL,
	`executedBy` int NOT NULL,
	`reason` varchar(300) NOT NULL,
	`transferredCustomerCount` int NOT NULL DEFAULT 0,
	`transferredContractCount` int NOT NULL DEFAULT 0,
	`transferredFollowUpCount` int NOT NULL DEFAULT 0,
	`transferredScheduleCount` int NOT NULL DEFAULT 0,
	`transferredNotificationCount` int NOT NULL DEFAULT 0,
	`sourceAccountStatusBefore` enum('active','inactive','resigned') NOT NULL,
	`sourceAccountStatusAfter` enum('active','inactive','resigned') NOT NULL,
	`forceLogoutSource` boolean NOT NULL DEFAULT false,
	`resetOAuthSource` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `handoff_histories_id` PRIMARY KEY(`id`)
);
