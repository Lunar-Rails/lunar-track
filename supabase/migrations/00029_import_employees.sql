-- ================================================================
-- CiaoBob: Import 113 employees from HiBob
-- Project: ftlxbyzeypaqelygkzhc (production)
-- Run in Supabase SQL Editor (uses service-role context)
-- Safe to re-run: INSERT ON CONFLICT + UPDATE are idempotent
-- Wrapped in DO block so the SQL editor runs it as a single statement
-- ================================================================

DO $body$
BEGIN

-- ----------------------------------------------------------------
-- 0. Remove all @gmail.com accounts (test/personal accounts cleanup)
-- ----------------------------------------------------------------
DELETE FROM profiles WHERE email LIKE '%@gmail.com';
DELETE FROM auth.users WHERE email LIKE '%@gmail.com';

-- ----------------------------------------------------------------
-- Staging table
-- ----------------------------------------------------------------
DROP TABLE IF EXISTS _emp;
CREATE TEMP TABLE _emp (
  email         TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL,
  manager_email TEXT
);

INSERT INTO _emp (email, full_name, role, manager_email) VALUES
  ('adri@clovrlabs.com', 'Adri', 'EMPLOYEE', 'pepe@clovrlabs.com'),
  ('kenobi@lunarrails.io', 'Agustin Krupka Buendia', 'EMPLOYEE', 'grafton@podproza.cz'),
  ('ajayi@chainlabs.ai', 'Ajayi Stephen Korede', 'EMPLOYEE', 'dimitar@chainlabs.ai'),
  ('alberto@lunarrails.io', 'Alberto Manzaneque Garcia', 'MANAGER', 'francesco@lunarrails.io'),
  ('alejandro@clovrlabs.com', 'Alejandro', 'EMPLOYEE', 'tamara@clovrlabs.com'),
  ('aleks@clovrlabs.com', 'Aleks', 'MANAGER', 'giacomo@clovrlabs.com'),
  ('am@chainlabs.ai', 'Alexanders Malchevskis', 'EMPLOYEE', 'tyron@chainlabs.ai'),
  ('ali@lunarrails.io', 'Ali Elkerm', 'EMPLOYEE', 'k.blatt@lunarrails.io'),
  ('andoni@clovrlabs.com', 'Andoni', 'EMPLOYEE', 'quim@clovrlabs.com'),
  ('anjali@lunarrails.io', 'Anjali Surana', 'MANAGER', 'faith@lunarrails.io'),
  ('ashwini@lunarrails.io', 'Ashwini Sewa', 'EMPLOYEE', 'jyoti@lunarrails.io'),
  ('ben@lunarrails.io', 'Ben Cuddy', 'MANAGER', 'max@lunarrails.io'),
  ('ben@podproza.cz', 'Ben Polasek', 'EMPLOYEE', 'matthieu@podproza.cz'),
  ('callum@lunarrails.io', 'Callum Byrne', 'EMPLOYEE', 'ben@lunarrails.io'),
  ('carme@clovrlabs.com', 'Carme', 'EMPLOYEE', 'giacomo@clovrlabs.com'),
  ('chris@lunarrails.io', 'Chris Collins', 'MANAGER', 'mark@lunarrails.io'),
  ('christopher@chainlabs.ai', 'Christopher Hurst', 'EMPLOYEE', 'tyron@chainlabs.ai'),
  ('dalila@clovrlabs.com', 'Dalila', 'EMPLOYEE', 'tamara@clovrlabs.com'),
  ('david@clovrlabs.com', 'David', 'EMPLOYEE', 'giacomo@clovrlabs.com'),
  ('david@podproza.cz', 'David Barkwith', 'MANAGER', 'francesco@lunarrails.io'),
  ('dr@chainlabs.ai', 'David Roberts', 'EMPLOYEE', 'martin@chainlabs.ai'),
  ('dimitar@chainlabs.ai', 'Dimitar Chaushev', 'MANAGER', 'lucy@lunarrails.io'),
  ('dusan@podproza.cz', 'Dusan Mrsic', 'EMPLOYEE', 'valerio@podproza.cz'),
  ('efe@chainlabs.ai', 'Efe Ersoysal', 'EMPLOYEE', 'dimitar@chainlabs.ai'),
  ('elton@lunarrails.io', 'Elton Lu', 'EMPLOYEE', 'chris@lunarrails.io'),
  ('endika@overe.io', 'Endika', 'EMPLOYEE', 'giacomo@clovrlabs.com'),
  ('faith@lunarrails.io', 'Faith M.', 'MANAGER', 'mark@lunarrails.io'),
  ('ferran@clovrlabs.com', 'Ferran', 'EMPLOYEE', 'giacomo@clovrlabs.com'),
  ('francesco@lunarrails.io', 'Francesco Vivoli', 'MANAGER', 'mark@lunarrails.io'),
  ('giacomo@clovrlabs.com', 'Giacomo', 'MANAGER', 'mark@lunarrails.io'),
  ('giuseppe@clovrlabs.com', 'Giuseppe', 'EMPLOYEE', 'tamara@clovrlabs.com'),
  ('grafton@podproza.cz', 'Grafton Clark', 'MANAGER', 'tom.b@podproza.cz'),
  ('greg@podproza.cz', 'Greg Schneider', 'EMPLOYEE', 'david@podproza.cz'),
  ('guido@vroeff.nl', 'Guido Verhoeff', 'EMPLOYEE', 'quim@clovrlabs.com'),
  ('guillaume@chainlabs.ai', 'Guillaume Donnet', 'EMPLOYEE', 'tyron@chainlabs.ai'),
  ('guillermo@clovrlabs.com', 'Guille', 'EMPLOYEE', 'pepe@clovrlabs.com'),
  ('guillem@clovrlabs.com', 'Guillem', 'EMPLOYEE', 'quim@clovrlabs.com'),
  ('henrique@lunarrails.io', 'Henrique Gomes', 'EMPLOYEE', 'ben@lunarrails.io'),
  ('ismael@clovrlabs.com', 'Ismael', 'EMPLOYEE', 'tamara@clovrlabs.com'),
  ('ivan@clovrlabs.com', 'Ivan', 'EMPLOYEE', 'quim@clovrlabs.com'),
  ('ivonne@lunarrails.io', 'Ivonne Bagus', 'EMPLOYEE', 'randa@lunarrails.io'),
  ('jagdish@chainlabs.ai', 'Jagdish Parmar', 'EMPLOYEE', 'tejas@chainlabs.ai'),
  ('jenny@lunarrails.io', 'Jenny Aquino', 'EMPLOYEE', 'faith@lunarrails.io'),
  ('jesse@chainlabs.ai', 'Jesse Buchanan', 'EMPLOYEE', 'martin@chainlabs.ai'),
  ('jiri@podproza.cz', 'Jiri Mares', 'EMPLOYEE', 'matthieu@podproza.cz'),
  ('jorge@chainlabs.ai', 'Jorge Perez', 'EMPLOYEE', 'dimitar@chainlabs.ai'),
  ('jose@lunarrails.io', 'Jose Antonio', 'EMPLOYEE', 'alberto@lunarrails.io'),
  ('julia@clovrlabs.com', 'Julia', 'EMPLOYEE', 'aleks@clovrlabs.com'),
  ('jyoti@lunarrails.io', 'Jyoti Das', 'MANAGER', 'mark@lunarrails.io'),
  ('kallie@lunarrails.io', 'Kallie Erasmus', 'EMPLOYEE', 'riza@lunarrails.io'),
  ('karel@podproza.cz', 'Karel Hovorka', 'EMPLOYEE', 'valerio@podproza.cz'),
  ('karla@40acres.pro', 'Karla Lissette Bernabel Avelar', 'EMPLOYEE', 'anjali@lunarrails.io'),
  ('kevin@40acres.pro', 'Kevin Ayala', 'EMPLOYEE', 'max@lunarrails.io'),
  ('k.blatt@lunarrails.io', 'Kevin Blatt', 'MANAGER', 'francesco@lunarrails.io'),
  ('kunal@chainlabs.ai', 'Kunal Kumar', 'EMPLOYEE', 'mally@chainlabs.ai'),
  ('lisa@lunarrails.io', 'Lisa Halpern', 'EMPLOYEE', 'max@lunarrails.io'),
  ('lucas@chainlabs.ai', 'Lucas Arenas', 'EMPLOYEE', 'mally@chainlabs.ai'),
  ('lucy@lunarrails.io', 'Lucy Brattan', 'MANAGER', 'tyron@chainlabs.ai'),
  ('lucia@clovrlabs.com', 'Lucía', 'MANAGER', 'aleks@clovrlabs.com'),
  ('mally@chainlabs.ai', 'Malcolm Kisubi -(Mally)', 'MANAGER', 'lucy@lunarrails.io'),
  ('manuel.m@clovrlabs.com', 'Manuel', 'EMPLOYEE', 'tamara@clovrlabs.com'),
  ('marcos@clovrlabs.com', 'Marcos', 'EMPLOYEE', 'tamara@clovrlabs.com'),
  ('mark@lunarrails.io', 'Mark Singh', 'HR_ADMIN', NULL),
  ('marthe@lunarrails.io', 'Marthe Buffiere', 'EMPLOYEE', 'max@lunarrails.io'),
  ('martin@chainlabs.ai', 'Martin Jofre', 'MANAGER', 'ziya@chainlabs.ai'),
  ('martins@podproza.cz', 'Martins Grunskis', 'EMPLOYEE', 'valerio@podproza.cz'),
  ('maria@elenpay.tech', 'María Graciela', 'EMPLOYEE', 'giacomo@clovrlabs.com'),
  ('matthieu@podproza.cz', 'Matthieu Bihan', 'MANAGER', 'david@podproza.cz'),
  ('max@lunarrails.io', 'Max B.', 'HR_ADMIN', 'francesco@lunarrails.io'),
  ('meet@chainlabs.ai', 'Meet Jayantilal Vaghasia', 'EMPLOYEE', 'tejas@chainlabs.ai'),
  ('melissa@chainlabs.ai', 'Melissa Ferguson', 'EMPLOYEE', 'tyron@chainlabs.ai'),
  ('miguel@clovrlabs.com', 'Miguel', 'EMPLOYEE', 'valerio@clovrlabs.com'),
  ('neven@clovrlabs.com', 'Neven', 'EMPLOYEE', 'tamara@clovrlabs.com'),
  ('noemie@podproza.cz', 'Noémie Ifergan', 'EMPLOYEE', 'matthieu@podproza.cz'),
  ('nyasha@lunarrails.io', 'Nyashadzashe Mupfudze', 'EMPLOYEE', 'faith@lunarrails.io'),
  ('olubunmi@lunarrails.io', 'Olubunmi Bolaji-Owonifari', 'EMPLOYEE', 'jyoti@lunarrails.io'),
  ('paola@clovrlabs.com', 'Paola', 'EMPLOYEE', 'tamara@clovrlabs.com'),
  ('patrick@chainlabs.ai', 'Patrick', 'EMPLOYEE', 'tyron@chainlabs.ai'),
  ('pedro@lunarrails.io', 'Pedro Gómez', 'EMPLOYEE', 'alberto@lunarrails.io'),
  ('pepe@clovrlabs.com', 'Pepe Gómez', 'MANAGER', 'alberto@lunarrails.io'),
  ('quim@clovrlabs.com', 'Quim', 'MANAGER', 'aleks@clovrlabs.com'),
  ('radi@clovrlabs.com', 'Radi', 'EMPLOYEE', 'aleks@clovrlabs.com'),
  ('randa@lunarrails.io', 'Randa Azzam', 'HR_ADMIN', 'mark@lunarrails.io'),
  ('rasmus@clovrlabs.com', 'Rasmus', 'EMPLOYEE', 'giacomo@clovrlabs.com'),
  ('rey@lunarrails.io', 'Rey Hersano', 'EMPLOYEE', 'anjali@lunarrails.io'),
  ('rhea@chainlabs.ai', 'Rhea Klansek', 'EMPLOYEE', 'tyron@chainlabs.ai'),
  ('ricardos@chainlabs.ai', 'Ricardos Abi Akar', 'EMPLOYEE', 'lucy@lunarrails.io'),
  ('riza@lunarrails.io', 'Riza Forrester', 'MANAGER', 'francesco@lunarrails.io'),
  ('robert@lunarrails.io', 'Robert Ramos', 'EMPLOYEE', 'francesco@lunarrails.io'),
  ('rodrigo@clovrlabs.com', 'Rodrigo', 'EMPLOYEE', 'tamara@clovrlabs.com'),
  ('romana@podproza.cz', 'Romana Patusova', 'EMPLOYEE', 'david@podproza.cz'),
  ('ronnie@lunarrails.io', 'Ronnie David', 'EMPLOYEE', 'max@lunarrails.io'),
  ('sara@lunarrails.io', 'Sara Osiris', 'EMPLOYEE', 'randa@lunarrails.io'),
  ('sebastien@clovrlabs.com', 'Sebastien', 'EMPLOYEE', 'valerio@clovrlabs.com'),
  ('sherin@lunarrails.io', 'Sherin John George', 'EMPLOYEE', 'jyoti@lunarrails.io'),
  ('shilpa@lunarrails.io', 'Shilpa Susain Thomas', 'EMPLOYEE', 'jyoti@lunarrails.io'),
  ('shivansh@chainlabs.ai', 'Shivansh Mittal', 'EMPLOYEE', 'tyron@chainlabs.ai'),
  ('sofia@40acres.pro', 'Sofia Driotez', 'EMPLOYEE', 'jyoti@lunarrails.io'),
  ('stanislav@lunarrails.io', 'Stanislav Kerimov', 'EMPLOYEE', 'alberto@lunarrails.io'),
  ('tamara@clovrlabs.com', 'Tamara', 'MANAGER', 'lucia@clovrlabs.com'),
  ('tejas@chainlabs.ai', 'Tejas Akadkar', 'MANAGER', 'tyron@chainlabs.ai'),
  ('thomas@chainlabs.ai', 'Thomas Fevre', 'EMPLOYEE', 'lucy@lunarrails.io'),
  ('tom.b@podproza.cz', 'Tom Benner', 'MANAGER', 'francesco@lunarrails.io'),
  ('tom@podproza.cz', 'Tom Komorous', 'EMPLOYEE', 'matthieu@podproza.cz'),
  ('tn@chainlabs.ai', 'Tom Neale', 'EMPLOYEE', 'tyron@chainlabs.ai'),
  ('tyron@chainlabs.ai', 'Tyron Fouche', 'MANAGER', 'francesco@lunarrails.io'),
  ('valerio@clovrlabs.com', 'Valerio', 'MANAGER', 'david@podproza.cz'),
  ('valerio@podproza.cz', 'Valerio Angelini', 'MANAGER', 'david@podproza.cz'),
  ('veronica@elenpay.tech', 'Verónica', 'EMPLOYEE', 'giacomo@clovrlabs.com'),
  ('vladimir@podproza.cz', 'Vladimir Zhdanovich', 'EMPLOYEE', 'matthieu@podproza.cz'),
  ('xavi@clovrlabs.com', 'Xavi', 'EMPLOYEE', 'pepe@clovrlabs.com'),
  ('yenni@chainlabs.ai', 'Yenni Chen', 'EMPLOYEE', 'dimitar@chainlabs.ai'),
  ('ziya@chainlabs.ai', 'Ziya', 'MANAGER', 'tyron@chainlabs.ai');

-- ----------------------------------------------------------------
-- 1. Create auth.users for anyone not already registered
-- ----------------------------------------------------------------
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_super_admin, is_sso_user, is_anonymous
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  e.email,
  '',
  now(),
  '{"provider":"email","providers":["google"]}',
  jsonb_build_object('full_name', e.full_name),
  now(), now(), false, false, false
FROM _emp e
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = e.email);

-- ----------------------------------------------------------------
-- 2. Upsert profiles (role + full_name + mark onboarded)
-- ----------------------------------------------------------------
INSERT INTO profiles (id, email, full_name, role, is_onboarded)
SELECT
  u.id,
  e.email,
  e.full_name,
  e.role::user_role,
  true
FROM _emp e
JOIN auth.users u ON u.email = e.email
ON CONFLICT (id) DO UPDATE SET
  full_name    = EXCLUDED.full_name,
  role         = EXCLUDED.role,
  is_onboarded = true,
  email        = EXCLUDED.email;

-- ----------------------------------------------------------------
-- 3. Wire manager_id relationships
-- ----------------------------------------------------------------
UPDATE profiles p
SET manager_id = mgr.id
FROM _emp e
JOIN auth.users u    ON u.email    = e.email
JOIN auth.users mu   ON mu.email   = e.manager_email
JOIN profiles   mgr  ON mgr.id     = mu.id
WHERE p.id = u.id
  AND e.manager_email IS NOT NULL;

DROP TABLE _emp;

END $body$;

-- ----------------------------------------------------------------
-- Verify (runs after the DO block completes)
-- ----------------------------------------------------------------
SELECT role, count(*) FROM profiles GROUP BY role ORDER BY role;
SELECT count(*) AS total_with_manager FROM profiles WHERE manager_id IS NOT NULL;
