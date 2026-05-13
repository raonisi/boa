CREATE TABLE `follow_ups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`assignedAgentId` int,
	`teamId` int,
	`subBranchAdminId` int,
	`nextContactDate` timestamp NOT NULL,
	`reason` varchar(200) NOT NULL,
	`nextAction` enum('전화','카톡','문자','방문','설계안 발송','계약 확인','보장분석','사후관리','기타') NOT NULL DEFAULT '전화',
	`status` enum('scheduled','completed','postponed','cancelled') NOT NULL DEFAULT 'scheduled',
	`memo` text,
	`completedAt` timestamp,
	`completedBy` int,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `follow_ups_id` PRIMARY KEY(`id`)
);
