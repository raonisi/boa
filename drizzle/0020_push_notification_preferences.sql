CREATE TABLE `push_notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`followUpTodayEnabled` boolean NOT NULL DEFAULT true,
	`scheduleReminderEnabled` boolean NOT NULL DEFAULT true,
	`deleteRequestEnabled` boolean NOT NULL DEFAULT true,
	`testNotificationEnabled` boolean NOT NULL DEFAULT true,
	`quietHoursEnabled` boolean NOT NULL DEFAULT true,
	`quietHoursStart` varchar(5) NOT NULL DEFAULT '21:00',
	`quietHoursEnd` varchar(5) NOT NULL DEFAULT '08:00',
	`timezone` varchar(64) NOT NULL DEFAULT 'Asia/Seoul',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `push_notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_push_notification_preferences_user` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `push_notification_logs`
	MODIFY `status` enum(
		'sent',
		'skipped',
		'failed',
		'skipped_no_token',
		'skipped_disabled',
		'skipped_quiet_hours',
		'skipped_missing_config',
		'duplicate_skipped',
		'invalid_token_deactivated'
	) NOT NULL DEFAULT 'skipped';
