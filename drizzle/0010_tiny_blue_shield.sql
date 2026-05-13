ALTER TABLE `consultations` ADD `consultationType` varchar(100);--> statement-breakpoint
ALTER TABLE `consultations` ADD `customerNeed` varchar(100);--> statement-breakpoint
ALTER TABLE `consultations` ADD `nextAction` varchar(100);--> statement-breakpoint
ALTER TABLE `consultations` ADD `summary` varchar(200);--> statement-breakpoint
ALTER TABLE `customers` ADD `priority` enum('A','B','C','D','unclassified') DEFAULT 'unclassified' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `customerTags` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `nextAction` varchar(100);