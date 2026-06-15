ALTER TABLE `branch_action_plans` ADD `monthlyRevenueTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `branch_action_plans` ADD `monthlyNewConsultationTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `branch_action_plans` ADD `monthlyContactTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `branch_action_plans` ADD `monthlyAnalysisTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `branch_action_plans` ADD `monthlyProposalTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `branch_action_plans` ADD `monthlyIntroductionRequestTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `branch_action_plans` ADD `primaryCustomerSegment` text;
--> statement-breakpoint
ALTER TABLE `branch_action_plans` ADD `monthlyPreparationStatus` text;
--> statement-breakpoint
ALTER TABLE `branch_action_plans` ADD `complianceCheckMemo` text;
--> statement-breakpoint
ALTER TABLE `branch_action_plans` ADD `privacyMinimizedConfirmed` boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `targetMonth` varchar(7);
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `weekNumber` int;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `targetCustomerSegment` text;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `targetCustomerReference` text;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `customerStage` varchar(50);
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `proposedProductCategory` varchar(100);
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `proposedCoverageArea` varchar(100);
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `proposalPurpose` text;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `preparationMaterials` text;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `weeklyRevenueTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `weeklyAnalysisTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `weeklyIntroductionRequestTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `weeklyReconnectTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `complianceRiskCheck` text;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `privacyMinimizedConfirmed` boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `weeklyReviewMemo` text;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `nextWeekImprovement` text;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD `coachingRequest` text;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `targetMonth` varchar(7);
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `weekNumber` int;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `targetCustomerSegment` text;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `targetCustomerReference` text;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `customerStage` varchar(50);
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `proposedProductCategory` varchar(100);
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `proposedCoverageArea` varchar(100);
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `proposalPurpose` text;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `preparationMaterials` text;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `dailyRevenueTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `newContactTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `analysisTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `introductionRequestTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `reconnectTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `contractTarget` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `actualNewContactCount` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `actualAnalysisCount` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `actualIntroductionRequestCount` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `actualReconnectCount` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `actualContractCount` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `complianceRiskCheck` text;
--> statement-breakpoint
ALTER TABLE `daily_action_plans` ADD `privacyMinimizedConfirmed` boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `weekly_action_plans` ADD CONSTRAINT `uq_weekly_user_month_weeknum` UNIQUE(`userId`,`targetMonth`,`weekNumber`);
