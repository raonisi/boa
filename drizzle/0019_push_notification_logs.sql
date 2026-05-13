CREATE TABLE `push_notification_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(80) NOT NULL,
	`userId` int NOT NULL,
	`sourceType` varchar(50),
	`sourceId` int,
	`dedupeKey` varchar(200) NOT NULL,
	`status` enum('sent','skipped','failed') NOT NULL DEFAULT 'skipped',
	`errorCode` varchar(100),
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_notification_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_push_notification_dedupe` UNIQUE(`dedupeKey`)
);
