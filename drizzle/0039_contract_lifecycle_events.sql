CREATE TABLE `contract_lifecycle_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`customerId` int NOT NULL,
	`eventType` enum('created','updated','deletion_requested','deletion_rejected','deleted','restored') NOT NULL,
	`effectiveAt` timestamp NOT NULL,
	`reason` text,
	`monthlyPremiumSnapshot` int,
	`actorId` int NOT NULL,
	`sourceType` enum('contract','delete_request','restore_action') NOT NULL,
	`sourceId` int,
	`dedupeKey` varchar(191),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contract_lifecycle_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_contract_lifecycle_dedupe` UNIQUE(`dedupeKey`),
	INDEX `idx_contract_lifecycle_contract_effective` (`contractId`,`effectiveAt`),
	INDEX `idx_contract_lifecycle_customer_effective` (`customerId`,`effectiveAt`)
);
