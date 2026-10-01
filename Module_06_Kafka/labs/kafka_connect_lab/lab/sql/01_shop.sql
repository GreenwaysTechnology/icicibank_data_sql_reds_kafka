-- ---------------------------------------------------------------------------
--  Runs once, when the postgres container starts with an empty data volume.
--  Database "shop": the users table the JDBC source connector reads (Lab 5).
--  Database "analytics": where the JDBC sink connector writes.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    name        TEXT         NOT NULL,
    email       TEXT         NOT NULL,
    country     TEXT         NOT NULL,
    updated_at  TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- keep updated_at current on every UPDATE, so the connector notices changed rows
CREATE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_touch BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

INSERT INTO users (name, email, country) VALUES
    ('ana', 'ana@example.com', 'PT'),
    ('raj', 'raj@example.com', 'IN'),
    ('li',  'li@example.com',  'CN'),
    ('sam', 'sam@example.com', 'US');

CREATE DATABASE analytics;
