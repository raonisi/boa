CREATE TABLE `oauth_state_nonces` (
	`nonceDigest` varchar(64) NOT NULL,
	`purpose` enum('login','google_calendar') NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oauth_state_nonces_nonceDigest` PRIMARY KEY(`nonceDigest`),
	INDEX `idx_oauth_state_nonces_expires_at` (`expiresAt`)
);
