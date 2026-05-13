CREATE TABLE `user_device_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`platform` enum('android') NOT NULL DEFAULT 'android',
	`token` varchar(512) NOT NULL,
	`deviceId` varchar(128),
	`appVersion` varchar(50),
	`deviceModel` varchar(200),
	`osVersion` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`revokedAt` timestamp,
	CONSTRAINT `user_device_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_user_device_token` UNIQUE(`userId`,`token`)
);
