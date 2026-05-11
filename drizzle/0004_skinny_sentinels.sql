CREATE TABLE `assignment_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`previousAgentId` int,
	`newAgentId` int NOT NULL,
	`assignedBy` int NOT NULL,
	`reason` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assignment_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contract_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`changedBy` int NOT NULL,
	`fieldName` varchar(100) NOT NULL,
	`beforeValue` text,
	`afterValue` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contract_history_id` PRIMARY KEY(`id`)
);
