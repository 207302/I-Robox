-- Populate and maintain products.search_vector for FTS (word/lexeme matching).
-- Vector covers: name, brand, category, short_description, description, sku.

CREATE OR REPLACE FUNCTION products_build_search_vector(
  p_name text,
  p_short_description text,
  p_description text,
  p_sku text,
  p_brand_id uuid,
  p_category_id uuid
) RETURNS tsvector
LANGUAGE sql
STABLE
AS $$
  SELECT to_tsvector(
    'english',
    coalesce(p_name, '') || ' ' ||
    coalesce((SELECT b.name FROM brands b WHERE b.id = p_brand_id), '') || ' ' ||
    coalesce((SELECT c.name FROM categories c WHERE c.id = p_category_id), '') || ' ' ||
    coalesce(p_short_description, '') || ' ' ||
    coalesce(p_description, '') || ' ' ||
    coalesce(p_sku, '')
  );
$$;

CREATE OR REPLACE FUNCTION products_search_vector_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := products_build_search_vector(
    NEW.name,
    NEW.short_description,
    NEW.description,
    NEW.sku,
    NEW.brand_id,
    NEW.category_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_search_vector ON products;
CREATE TRIGGER trg_products_search_vector
  BEFORE INSERT OR UPDATE OF name, short_description, description, sku, brand_id, category_id
  ON products
  FOR EACH ROW
  EXECUTE PROCEDURE products_search_vector_trigger();

-- Keep product vectors in sync when brand/category display names change.
CREATE OR REPLACE FUNCTION brands_refresh_product_search_vector() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name THEN
    RETURN NEW;
  END IF;
  UPDATE products p
  SET search_vector = products_build_search_vector(
    p.name, p.short_description, p.description, p.sku, p.brand_id, p.category_id
  )
  WHERE p.brand_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brands_refresh_product_search_vector ON brands;
CREATE TRIGGER trg_brands_refresh_product_search_vector
  AFTER UPDATE OF name ON brands
  FOR EACH ROW
  EXECUTE PROCEDURE brands_refresh_product_search_vector();

CREATE OR REPLACE FUNCTION categories_refresh_product_search_vector() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name THEN
    RETURN NEW;
  END IF;
  UPDATE products p
  SET search_vector = products_build_search_vector(
    p.name, p.short_description, p.description, p.sku, p.brand_id, p.category_id
  )
  WHERE p.category_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_refresh_product_search_vector ON categories;
CREATE TRIGGER trg_categories_refresh_product_search_vector
  AFTER UPDATE OF name ON categories
  FOR EACH ROW
  EXECUTE PROCEDURE categories_refresh_product_search_vector();

-- Backfill all existing products.
UPDATE products p
SET search_vector = products_build_search_vector(
  p.name, p.short_description, p.description, p.sku, p.brand_id, p.category_id
);
