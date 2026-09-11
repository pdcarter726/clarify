CREATE DATABASE IF NOT EXISTS `sift`;
USE sift;

-- Users
CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recipes
CREATE TABLE recipes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  title       VARCHAR(255) NOT NULL,
  source_url  VARCHAR(2048),
  image_url   VARCHAR(2048),
  servings    VARCHAR(50),
  prep_time   VARCHAR(50),
  cook_time   VARCHAR(50),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_recipes_user_id (user_id)
);

-- Ingredients
CREATE TABLE ingredients (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  recipe_id  INT UNSIGNED NOT NULL,
  name       VARCHAR(255) NOT NULL,
  quantity   VARCHAR(50),
  unit       VARCHAR(50),
  position   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  INDEX idx_ingredients_recipe_id (recipe_id)
);

-- Instructions
CREATE TABLE instructions (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  recipe_id    INT UNSIGNED NOT NULL,
  step_number  SMALLINT UNSIGNED NOT NULL,
  text         TEXT NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  INDEX idx_instructions_recipe_id (recipe_id)
);

-- Tags (optional, for filtering/search later)
CREATE TABLE tags (
  id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE recipe_tags (
  recipe_id  INT UNSIGNED NOT NULL,
  tag_id     INT UNSIGNED NOT NULL,
  PRIMARY KEY (recipe_id, tag_id),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);