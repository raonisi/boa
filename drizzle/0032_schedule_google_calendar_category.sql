ALTER TABLE `schedules` ADD `calendarCategory` enum('branch_common','consultation_followup','admin');
--> statement-breakpoint
UPDATE `schedules` SET `calendarCategory` = 'consultation_followup' WHERE `type` IN ('고객상담','재통화','계약예정','보장분석','해지방어') AND `calendarCategory` IS NULL;
--> statement-breakpoint
UPDATE `schedules` SET `calendarCategory` = 'consultation_followup' WHERE `type` = '외근' AND `customerId` IS NOT NULL AND `calendarCategory` IS NULL;
--> statement-breakpoint
UPDATE `schedules` SET `calendarCategory` = 'branch_common' WHERE `type` IN ('교육','팀회의','휴무','기타') AND `calendarCategory` IS NULL;
--> statement-breakpoint
UPDATE `schedules` SET `calendarCategory` = 'branch_common' WHERE `type` = '외근' AND `customerId` IS NULL AND `calendarCategory` IS NULL;
