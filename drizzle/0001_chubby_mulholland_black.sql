CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`targetType` varchar(50),
	`targetId` int,
	`details` text,
	`ipAddress` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`agentId` int NOT NULL,
	`status` enum('미상담','부재','통화완료','상담예정','설계중','계약','보류','거절','해지관리','재상담필요') NOT NULL,
	`content` text,
	`nextContactAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`agentId` int NOT NULL,
	`company` varchar(100),
	`productName` varchar(200),
	`productGroup` varchar(100),
	`contractDate` date,
	`monthlyPremium` int,
	`paymentStatus` enum('정상','미납','실효','해지') DEFAULT '정상',
	`contractStatus` enum('청약','성립','철회','유지','해지') DEFAULT '청약',
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`phone` varchar(20),
	`birthDate` date,
	`gender` enum('male','female','other'),
	`region` varchar(100),
	`expectedPremium` int,
	`availableTime` varchar(100),
	`source` varchar(100),
	`agentId` int,
	`assignedAt` timestamp,
	`privacyConsent` boolean DEFAULT false,
	`marketingConsent` boolean DEFAULT false,
	`memo` text,
	`consultStatus` enum('미상담','부재','통화완료','상담예정','설계중','계약','보류','거절','해지관리','재상담필요') NOT NULL DEFAULT '미상담',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('contract_90','contract_180','contract_365','birthday','uncontacted_3days','long_unmanaged_90','reconsult','unpaid_lapse','schedule_1day','schedule_today','schedule_1hour','schedule_incomplete') NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`relatedType` varchar(50),
	`relatedId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`type` enum('고객상담','재통화','계약예정','보장분석','해지방어','팀회의','교육','외근','휴무','기타') NOT NULL DEFAULT '기타',
	`status` enum('예정','완료','취소','변경','노쇼','보류') NOT NULL DEFAULT '예정',
	`startTime` timestamp NOT NULL,
	`endTime` timestamp,
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`managerId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','manager','agent','inactive') NOT NULL DEFAULT 'agent';--> statement-breakpoint
ALTER TABLE `users` ADD `teamId` int;