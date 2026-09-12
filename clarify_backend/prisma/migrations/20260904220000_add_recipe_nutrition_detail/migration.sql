-- AlterTable
ALTER TABLE `recipes`
    ADD COLUMN `saturated_fat_grams` DOUBLE NULL,
    ADD COLUMN `trans_fat_grams` DOUBLE NULL,
    ADD COLUMN `cholesterol_mg` DOUBLE NULL,
    ADD COLUMN `sodium_mg` DOUBLE NULL,
    ADD COLUMN `fiber_grams` DOUBLE NULL,
    ADD COLUMN `sugar_grams` DOUBLE NULL,
    ADD COLUMN `vitamin_d_mcg` DOUBLE NULL,
    ADD COLUMN `calcium_mg` DOUBLE NULL,
    ADD COLUMN `iron_mg` DOUBLE NULL,
    ADD COLUMN `potassium_mg` DOUBLE NULL;
