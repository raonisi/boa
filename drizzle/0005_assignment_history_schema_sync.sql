ALTER TABLE `assignment_history` ADD `previousSubBranchAdminId` int;
--> statement-breakpoint
ALTER TABLE `assignment_history` ADD `newSubBranchAdminId` int;
--> statement-breakpoint
ALTER TABLE `assignment_history` ADD `previousTeamId` int;
--> statement-breakpoint
ALTER TABLE `assignment_history` ADD `newTeamId` int;
--> statement-breakpoint
ALTER TABLE `assignment_history` MODIFY COLUMN `newAgentId` int;
--> statement-breakpoint
ALTER TABLE `assignment_history` ADD `assignmentType` enum('branch_to_sub_branch','sub_branch_to_agent','branch_to_agent','reassignment');
--> statement-breakpoint
ALTER TABLE `assignment_history` ADD `assignmentReason` varchar(300);
--> statement-breakpoint
ALTER TABLE `assignment_history` DROP COLUMN `reason`;
