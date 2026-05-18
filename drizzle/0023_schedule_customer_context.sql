SET @schedule_customer_id_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'schedules'
    AND COLUMN_NAME = 'customerId'
);
--> statement-breakpoint
SET @schedule_customer_id_ddl := IF(
  @schedule_customer_id_exists = 0,
  'ALTER TABLE `schedules` ADD `customerId` int',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE schedule_customer_id_stmt FROM @schedule_customer_id_ddl;
--> statement-breakpoint
EXECUTE schedule_customer_id_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE schedule_customer_id_stmt;
