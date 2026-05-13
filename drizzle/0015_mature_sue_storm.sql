CREATE TABLE `consultation_check_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`checklistId` int NOT NULL,
	`consultationId` int,
	`checked` boolean NOT NULL DEFAULT false,
	`checkedAt` timestamp,
	`checkedBy` int,
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultation_check_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultation_checklists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`phase` enum('before','during','after') NOT NULL,
	`category` enum('basic','needs','coverage','premium','family','follow_up','compliance') NOT NULL DEFAULT 'basic',
	`sortOrder` int NOT NULL DEFAULT 0,
	`isRequired` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`updatedBy` int,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultation_checklists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `message_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`situation` enum('missed_call','proposal_follow_up','pre_contract_check','post_contract_care','long_unmanaged','birthday','follow_up_schedule','document_request','after_consultation','general_check') NOT NULL,
	`channel` enum('kakao','sms','both') NOT NULL DEFAULT 'both',
	`body` text NOT NULL,
	`complianceNote` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`updatedBy` int,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `message_templates_id` PRIMARY KEY(`id`)
);
