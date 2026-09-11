-- AlterTable
ALTER TABLE `recipes`
    ADD COLUMN `calories` DOUBLE NULL,
    ADD COLUMN `protein_grams` DOUBLE NULL,
    ADD COLUMN `fat_grams` DOUBLE NULL,
    ADD COLUMN `carb_grams` DOUBLE NULL;
