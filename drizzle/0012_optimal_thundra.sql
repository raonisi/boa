ALTER TABLE `customers` ADD `mergedIntoCustomerId` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `mergedAt` timestamp;--> statement-breakpoint
ALTER TABLE `customers` ADD `mergedBy` int;