CREATE TABLE `import_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`importBatchId` varchar(100) NOT NULL,
	`fileName` varchar(255),
	`uploadedBy` int NOT NULL,
	`totalRows` int NOT NULL DEFAULT 0,
	`successRows` int NOT NULL DEFAULT 0,
	`failedRows` int NOT NULL DEFAULT 0,
	`duplicateRows` int NOT NULL DEFAULT 0,
	`blockedForbiddenColumn` boolean NOT NULL DEFAULT false,
	`status` enum('active','cancelled','partially_cancelled','failed') NOT NULL DEFAULT 'active',
	`cancelledBy` int,
	`cancelledAt` timestamp,
	`cancelReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `import_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `import_batches_importBatchId_unique` UNIQUE(`importBatchId`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `importBatchId` varchar(100);--> statement-breakpoint
ALTER TABLE `customers` ADD `importedBy` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `importedAt` timestamp;