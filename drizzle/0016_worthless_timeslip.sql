CREATE TABLE `consultation_scripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`category` enum('first_call','missed_call','premium_burden','coverage_concern','family_responsibility','surrender_risk','proposal_follow_up','post_contract_care','long_unmanaged','general_check') NOT NULL,
	`scriptBody` text NOT NULL,
	`complianceNote` text,
	`tags` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`updatedBy` int,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultation_scripts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_handoff_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`noteType` enum('handoff','caution','approach','avoid','relationship','next_action') NOT NULL DEFAULT 'handoff',
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`visibility` enum('internal') NOT NULL DEFAULT 'internal',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`updatedBy` int,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_handoff_notes_id` PRIMARY KEY(`id`)
);
