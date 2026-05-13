CREATE TABLE `delete_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestType` enum('contract_delete') NOT NULL DEFAULT 'contract_delete',
	`targetType` enum('contract') NOT NULL DEFAULT 'contract',
	`targetId` int NOT NULL,
	`customerId` int NOT NULL,
	`requestedBy` int NOT NULL,
	`requestReason` varchar(100) NOT NULL,
	`requestMemo` text,
	`expectedImpact` enum('performance_exclusion') NOT NULL DEFAULT 'performance_exclusion',
	`status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewComment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delete_requests_id` PRIMARY KEY(`id`)
);
