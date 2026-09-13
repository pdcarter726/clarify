-- Run while connected to an existing database, e.g.:
--   CREATE DATABASE clarify;
--   \c clarify

-- Users
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Recipes
CREATE TABLE recipes (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               VARCHAR(255) NOT NULL,
  source_url          VARCHAR(2048),
  image_url           VARCHAR(2048),
  servings            VARCHAR(50),
  prep_time           VARCHAR(50),
  cook_time           VARCHAR(50),
  calories            DOUBLE PRECISION,
  protein_grams       DOUBLE PRECISION,
  fat_grams           DOUBLE PRECISION,
  saturated_fat_grams DOUBLE PRECISION,
  trans_fat_grams     DOUBLE PRECISION,
  cholesterol_mg      DOUBLE PRECISION,
  sodium_mg           DOUBLE PRECISION,
  carb_grams          DOUBLE PRECISION,
  fiber_grams         DOUBLE PRECISION,
  sugar_grams         DOUBLE PRECISION,
  vitamin_d_mcg       DOUBLE PRECISION,
  calcium_mg          DOUBLE PRECISION,
  iron_mg             DOUBLE PRECISION,
  potassium_mg        DOUBLE PRECISION,
  -- Postgres has no ON UPDATE; Prisma's @updatedAt sets this on writes.
  created_at          TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_recipes_user_id ON recipes (user_id);

-- Ingredients
CREATE TABLE ingredients (
  id         SERIAL PRIMARY KEY,
  recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  quantity   VARCHAR(50),
  unit       VARCHAR(50),
  position   SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_ingredients_recipe_id ON ingredients (recipe_id);

-- Instructions
CREATE TABLE instructions (
  id           SERIAL PRIMARY KEY,
  recipe_id    INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_number  SMALLINT NOT NULL,
  text         TEXT NOT NULL
);
CREATE INDEX idx_instructions_recipe_id ON instructions (recipe_id);

-- Tags
CREATE TABLE tags (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE recipe_tags (
  recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);
CREATE INDEX idx_recipe_tags_tag_id ON recipe_tags (tag_id);
