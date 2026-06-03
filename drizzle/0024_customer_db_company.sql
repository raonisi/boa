SET @customer_db_company_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
    AND COLUMN_NAME = 'dbCompany'
);
--> statement-breakpoint
SET @customer_db_company_ddl := IF(
  @customer_db_company_exists = 0,
  'ALTER TABLE `customers` ADD `dbCompany` varchar(100)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE customer_db_company_stmt FROM @customer_db_company_ddl;
--> statement-breakpoint
EXECUTE customer_db_company_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE customer_db_company_stmt;
