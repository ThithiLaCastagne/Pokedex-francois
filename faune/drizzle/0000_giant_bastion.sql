CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`observation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`observation_id`) REFERENCES `observations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_comments_observation` ON `comments` (`observation_id`,`created`);--> statement-breakpoint
CREATE TABLE `friends` (
	`user_id` text NOT NULL,
	`friend_id` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`user_id`, `friend_id`),
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`friend_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `likes` (
	`observation_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`observation_id`, `user_id`),
	FOREIGN KEY (`observation_id`) REFERENCES `observations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`species` text NOT NULL,
	`photos` text NOT NULL,
	`date` text NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`sensitive` integer DEFAULT 0 NOT NULL,
	`lat` real,
	`lng` real,
	`favorite` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_observations_user_date` ON `observations` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_photos_user` ON `photos` (`user_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`code` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_code_unique` ON `profiles` (`code`);--> statement-breakpoint
CREATE TABLE `requests` (
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`sender`, `recipient`),
	FOREIGN KEY (`sender`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_requests_recipient` ON `requests` (`recipient`);