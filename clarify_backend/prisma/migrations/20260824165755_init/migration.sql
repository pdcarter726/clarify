-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recipes` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `source_url` VARCHAR(2048) NULL,
    `image_url` VARCHAR(2048) NULL,
    `servings` VARCHAR(50) NULL,
    `prep_time` VARCHAR(50) NULL,
    `cook_time` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_recipes_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ingredients` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `recipe_id` INTEGER UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `quantity` VARCHAR(50) NULL,
    `unit` VARCHAR(50) NULL,
    `position` SMALLINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `idx_ingredients_recipe_id`(`recipe_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `instructions` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `recipe_id` INTEGER UNSIGNED NOT NULL,
    `step_number` SMALLINT UNSIGNED NOT NULL,
    `text` TEXT NOT NULL,

    INDEX `idx_instructions_recipe_id`(`recipe_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `tags_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recipe_tags` (
    `recipe_id` INTEGER UNSIGNED NOT NULL,
    `tag_id` INTEGER UNSIGNED NOT NULL,

    INDEX `tag_id`(`tag_id`),
    PRIMARY KEY (`recipe_id`, `tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `recipes` ADD CONSTRAINT `recipes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingredients` ADD CONSTRAINT `ingredients_recipe_id_fkey` FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `instructions` ADD CONSTRAINT `instructions_recipe_id_fkey` FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recipe_tags` ADD CONSTRAINT `recipe_tags_recipe_id_fkey` FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recipe_tags` ADD CONSTRAINT `recipe_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

