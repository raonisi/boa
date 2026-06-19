CREATE TABLE `customer_relationships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`primaryCustomerId` int NOT NULL,
	`relatedCustomerId` int NOT NULL,
	`relationshipType` enum('family_spouse','family_child','family_parent','family_sibling','referral','coworker','corporate_representative','corporate_employee','friend','other') NOT NULL,
	`relationshipLabel` varchar(50) NOT NULL,
	`direction` enum('outbound','inbound','mutual') NOT NULL DEFAULT 'mutual',
	`note` varchar(500),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdBy` int NOT NULL,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `customer_relationships_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_customer_relationship_pair_type` UNIQUE(`primaryCustomerId`,`relatedCustomerId`,`relationshipType`)
);
