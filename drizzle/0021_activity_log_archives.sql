CREATE TABLE `activity_log_archives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`archiveMonth` varchar(7) NOT NULL,
	`totalLogs` int NOT NULL,
	`archivedBy` int NOT NULL,
	`archiveType` enum('monthly','manual') NOT NULL DEFAULT 'manual',
	`dateFrom` timestamp NOT NULL,
	`dateTo` timestamp NOT NULL,
	`fileName` varchar(255),
	`status` enum('completed','failed') NOT NULL DEFAULT 'completed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_archives_id` PRIMARY KEY(`id`)
);
