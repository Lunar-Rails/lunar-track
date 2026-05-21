-- ============================================================
-- 00010_org_structure.sql
-- Seeds auth.users + profiles for the org roster, then sets up
-- the full Lunar Rails reporting hierarchy from the General Report
-- spreadsheet (2026-05-14).
-- ============================================================

-- ----------------------------------------------------------------
-- STEP 0: Seed auth.users, profiles, and auth.identities
-- Confirmed emails let Google OAuth sign-in attach on first login.
-- auth.identities rows are required for GoTrue user lookup.
-- ----------------------------------------------------------------
WITH roster (email, full_name) AS (
  VALUES
    ('kenobi@lunarrails.io',         'Agustin Krupka Buendia'),
    ('alberto@lunarrails.io',        'Alberto Manzaneque Garcia'),
    ('ali@lunarrails.io',            'Ali Elkerm'),
    ('anjali@lunarrails.io',         'Anjali Surana'),
    ('ashwini@lunarrails.io',        'Ashwini Sewa'),
    ('ben@lunarrails.io',            'Ben Cuddy'),
    ('callum@lunarrails.io',         'Callum Byrne'),
    ('chris@lunarrails.io',          'Chris Collins'),
    ('elton@lunarrails.io',          'Elton Lu'),
    ('faith@lunarrails.io',          'Faith M.'),
    ('francesco@lunarrails.io',      'Francesco Vivoli'),
    ('guido@vroeff.nl',              'Guido Verhoeff'),
    ('henrique@lunarrails.io',       'Henrique Gomes'),
    ('ivonne@lunarrails.io',         'Ivonne Bagus'),
    ('jenny@lunarrails.io',          'Jenny Aquino'),
    ('jose@lunarrails.io',           'Jose Antonio'),
    ('jyoti@lunarrails.io',          'Jyoti Das'),
    ('kallie@lunarrails.io',         'Kallie Erasmus'),
    ('karla@40acres.pro',            'Karla Lissette Bernabel Avelar'),
    ('kevin@40acres.pro',            'Kevin Ayala'),
    ('lisa@lunarrails.io',           'Lisa Halpern'),
    ('lucy@lunarrails.io',           'Lucy Brattan'),
    ('mark@lunarrails.io',           'Mark Singh'),
    ('marthe@lunarrails.io',         'Marthe Buffiere'),
    ('max@lunarrails.io',            'Max B.'),
    ('nyasha@lunarrails.io',         'Nyashadzashe Mupfudze'),
    ('olubunmi@lunarrails.io',       'Olubunmi Bolaji-Owonifari'),
    ('pedro@lunarrails.io',          'Pedro Gómez'),
    ('randa@lunarrails.io',          'Randa Azzam'),
    ('rey@lunarrails.io',            'Rey Hersano'),
    ('riza@lunarrails.io',           'Riza Forrester'),
    ('robert@lunarrails.io',         'Robert Ramos'),
    ('ronnie@lunarrails.io',         'Ronnie David'),
    ('sara@lunarrails.io',           'Sara Osiris'),
    ('sherin@lunarrails.io',         'Sherin John George'),
    ('shilpa@lunarrails.io',         'Shilpa Susain Thomas'),
    ('sofia@40acres.pro',            'Sofia Driotez'),
    ('stanislav@lunarrails.io',      'Stanislav Kerimov')
)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  is_sso_user
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  r.email,
  '',
  now(),
  '{"provider":"google","providers":["google"]}'::jsonb,
  jsonb_build_object('full_name', r.full_name, 'email', r.email),
  now(),
  now(),
  '',
  '',
  '',
  '',
  false
FROM roster r
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(r.email)
);

WITH roster (email, full_name) AS (
  VALUES
    ('kenobi@lunarrails.io',         'Agustin Krupka Buendia'),
    ('alberto@lunarrails.io',        'Alberto Manzaneque Garcia'),
    ('ali@lunarrails.io',            'Ali Elkerm'),
    ('anjali@lunarrails.io',         'Anjali Surana'),
    ('ashwini@lunarrails.io',        'Ashwini Sewa'),
    ('ben@lunarrails.io',            'Ben Cuddy'),
    ('callum@lunarrails.io',         'Callum Byrne'),
    ('chris@lunarrails.io',          'Chris Collins'),
    ('elton@lunarrails.io',          'Elton Lu'),
    ('faith@lunarrails.io',          'Faith M.'),
    ('francesco@lunarrails.io',      'Francesco Vivoli'),
    ('guido@vroeff.nl',              'Guido Verhoeff'),
    ('henrique@lunarrails.io',       'Henrique Gomes'),
    ('ivonne@lunarrails.io',         'Ivonne Bagus'),
    ('jenny@lunarrails.io',          'Jenny Aquino'),
    ('jose@lunarrails.io',           'Jose Antonio'),
    ('jyoti@lunarrails.io',          'Jyoti Das'),
    ('kallie@lunarrails.io',         'Kallie Erasmus'),
    ('karla@40acres.pro',            'Karla Lissette Bernabel Avelar'),
    ('kevin@40acres.pro',            'Kevin Ayala'),
    ('lisa@lunarrails.io',           'Lisa Halpern'),
    ('lucy@lunarrails.io',           'Lucy Brattan'),
    ('mark@lunarrails.io',           'Mark Singh'),
    ('marthe@lunarrails.io',         'Marthe Buffiere'),
    ('max@lunarrails.io',            'Max B.'),
    ('nyasha@lunarrails.io',         'Nyashadzashe Mupfudze'),
    ('olubunmi@lunarrails.io',       'Olubunmi Bolaji-Owonifari'),
    ('pedro@lunarrails.io',          'Pedro Gómez'),
    ('randa@lunarrails.io',          'Randa Azzam'),
    ('rey@lunarrails.io',            'Rey Hersano'),
    ('riza@lunarrails.io',           'Riza Forrester'),
    ('robert@lunarrails.io',         'Robert Ramos'),
    ('ronnie@lunarrails.io',         'Ronnie David'),
    ('sara@lunarrails.io',           'Sara Osiris'),
    ('sherin@lunarrails.io',         'Sherin John George'),
    ('shilpa@lunarrails.io',         'Shilpa Susain Thomas'),
    ('sofia@40acres.pro',            'Sofia Driotez'),
    ('stanislav@lunarrails.io',      'Stanislav Kerimov')
)
INSERT INTO profiles (id, email, full_name)
SELECT u.id, r.email, r.full_name
FROM roster r
JOIN auth.users u ON lower(u.email) = lower(r.email)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  updated_at = now();

WITH roster (email) AS (
  VALUES
    ('kenobi@lunarrails.io'),
    ('alberto@lunarrails.io'),
    ('ali@lunarrails.io'),
    ('anjali@lunarrails.io'),
    ('ashwini@lunarrails.io'),
    ('ben@lunarrails.io'),
    ('callum@lunarrails.io'),
    ('chris@lunarrails.io'),
    ('elton@lunarrails.io'),
    ('faith@lunarrails.io'),
    ('francesco@lunarrails.io'),
    ('guido@vroeff.nl'),
    ('henrique@lunarrails.io'),
    ('ivonne@lunarrails.io'),
    ('jenny@lunarrails.io'),
    ('jose@lunarrails.io'),
    ('jyoti@lunarrails.io'),
    ('kallie@lunarrails.io'),
    ('karla@40acres.pro'),
    ('kevin@40acres.pro'),
    ('lisa@lunarrails.io'),
    ('lucy@lunarrails.io'),
    ('mark@lunarrails.io'),
    ('marthe@lunarrails.io'),
    ('max@lunarrails.io'),
    ('nyasha@lunarrails.io'),
    ('olubunmi@lunarrails.io'),
    ('pedro@lunarrails.io'),
    ('randa@lunarrails.io'),
    ('rey@lunarrails.io'),
    ('riza@lunarrails.io'),
    ('robert@lunarrails.io'),
    ('ronnie@lunarrails.io'),
    ('sara@lunarrails.io'),
    ('sherin@lunarrails.io'),
    ('shilpa@lunarrails.io'),
    ('sofia@40acres.pro'),
    ('stanislav@lunarrails.io')
)
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  u.id::text,
  'email',
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  NULL,
  u.created_at,
  u.created_at
FROM roster r
JOIN auth.users u ON lower(u.email) = lower(r.email)
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i
  WHERE i.user_id = u.id AND i.provider = 'email'
)
ON CONFLICT (provider_id, provider) DO NOTHING;

-- ----------------------------------------------------------------
-- STEP 1: Clear all existing manager links (clean slate)
-- ----------------------------------------------------------------
UPDATE profiles SET manager_id = NULL, role = 'EMPLOYEE';

-- ----------------------------------------------------------------
-- STEP 2: Set roles for leaders
-- ----------------------------------------------------------------
UPDATE profiles SET role = 'HR_ADMIN' WHERE email IN (
  'mark@lunarrails.io',
  'randa@lunarrails.io'
);

UPDATE profiles SET role = 'MANAGER' WHERE email IN (
  'francesco@lunarrails.io',   -- CPTO
  'max@lunarrails.io',         -- Director of Operations
  'ben@lunarrails.io',         -- Enterprise Manager
  'kevin@40acres.pro',         -- Head of Operations
  'faith@lunarrails.io',       -- Finance Controller
  'anjali@lunarrails.io',      -- Finance Team Lead
  'jyoti@lunarrails.io',       -- Compliance Officer
  'ali@lunarrails.io',         -- Head of Business Development
  'jose@lunarrails.io',        -- Lead Researcher
  'lucy@lunarrails.io'         -- Head of Operations
);

-- ----------------------------------------------------------------
-- STEP 3: Set manager_id — direct reports to Mark Singh (CEO)
-- ----------------------------------------------------------------
UPDATE profiles
SET manager_id = (SELECT id FROM profiles WHERE email = 'mark@lunarrails.io')
WHERE email IN (
  'francesco@lunarrails.io',   -- CPTO
  'chris@lunarrails.io',       -- Finance, Consulting
  'faith@lunarrails.io',       -- Finance Controller
  'jyoti@lunarrails.io',       -- Compliance Officer
  'randa@lunarrails.io',       -- Head of HR
  'ali@lunarrails.io',         -- Head of Business Development
  'lucy@lunarrails.io',        -- Head of Operations
  'jose@lunarrails.io',        -- Lead Researcher
  'guido@vroeff.nl'            -- Information Security Officer
);

-- ----------------------------------------------------------------
-- Direct reports to Francesco Vivoli (CPTO)
-- ----------------------------------------------------------------
UPDATE profiles
SET manager_id = (SELECT id FROM profiles WHERE email = 'francesco@lunarrails.io')
WHERE email IN (
  'alberto@lunarrails.io',     -- Lead Architect
  'max@lunarrails.io',         -- Director of Operations
  'riza@lunarrails.io',        -- Senior Product Manager
  'robert@lunarrails.io'       -- Lead Designer
);

-- ----------------------------------------------------------------
-- Direct reports to Max B. (Director of Operations)
-- ----------------------------------------------------------------
UPDATE profiles
SET manager_id = (SELECT id FROM profiles WHERE email = 'max@lunarrails.io')
WHERE email IN (
  'ben@lunarrails.io',         -- Enterprise Manager
  'kevin@40acres.pro',         -- Head of Operations
  'lisa@lunarrails.io',        -- Regional Operations Team Lead
  'marthe@lunarrails.io',      -- Program Manager
  'ronnie@lunarrails.io'       -- Trading Operations Supervisor
);

-- ----------------------------------------------------------------
-- Direct reports to Ben Cuddy (Enterprise Manager)
-- ----------------------------------------------------------------
UPDATE profiles
SET manager_id = (SELECT id FROM profiles WHERE email = 'ben@lunarrails.io')
WHERE email IN (
  'callum@lunarrails.io',      -- IT Support Specialist
  'henrique@lunarrails.io'     -- Technical Business Analyst
);

-- ----------------------------------------------------------------
-- Direct reports to Kevin Ayala (Head of Operations)
-- ----------------------------------------------------------------
UPDATE profiles
SET manager_id = (SELECT id FROM profiles WHERE email = 'kevin@40acres.pro')
WHERE email IN (
  'kallie@lunarrails.io'       -- Junior Product Owner
);

-- ----------------------------------------------------------------
-- Direct reports to Faith M. (Finance Controller)
-- ----------------------------------------------------------------
UPDATE profiles
SET manager_id = (SELECT id FROM profiles WHERE email = 'faith@lunarrails.io')
WHERE email IN (
  'anjali@lunarrails.io'       -- Finance Team Lead
);

-- ----------------------------------------------------------------
-- Direct reports to Anjali Surana (Finance Team Lead)
-- ----------------------------------------------------------------
UPDATE profiles
SET manager_id = (SELECT id FROM profiles WHERE email = 'anjali@lunarrails.io')
WHERE email IN (
  'elton@lunarrails.io',       -- Head of Distribution
  'jenny@lunarrails.io',       -- Accountant
  'nyasha@lunarrails.io',      -- Accountant
  'rey@lunarrails.io',         -- Accountant
  'karla@40acres.pro'          -- Accountant
);

-- ----------------------------------------------------------------
-- Direct reports to Jyoti Das (Compliance Officer)
-- ----------------------------------------------------------------
UPDATE profiles
SET manager_id = (SELECT id FROM profiles WHERE email = 'jyoti@lunarrails.io')
WHERE email IN (
  'ashwini@lunarrails.io',     -- Senior Compliance Analyst
  'olubunmi@lunarrails.io',    -- Legal and Risk Specialist
  'sherin@lunarrails.io',      -- Compliance Analyst
  'shilpa@lunarrails.io',      -- Compliance Analyst
  'sofia@40acres.pro'          -- Compliance Officer
);

-- ----------------------------------------------------------------
-- Direct reports to Randa Azzam (Head of HR)
-- ----------------------------------------------------------------
UPDATE profiles
SET manager_id = (SELECT id FROM profiles WHERE email = 'randa@lunarrails.io')
WHERE email IN (
  'ivonne@lunarrails.io',      -- Administrative Assistant
  'sara@lunarrails.io'         -- HR Business Partner
);

-- ----------------------------------------------------------------
-- Direct reports to Ali Elkerm (Head of Business Development)
-- ----------------------------------------------------------------
UPDATE profiles
SET manager_id = (SELECT id FROM profiles WHERE email = 'ali@lunarrails.io')
WHERE email IN (
  'kenobi@lunarrails.io'       -- Senior Business Analyst
);

-- ----------------------------------------------------------------
-- Direct reports to Jose Antonio (Lead Researcher / Engineering)
-- ----------------------------------------------------------------
UPDATE profiles
SET manager_id = (SELECT id FROM profiles WHERE email = 'jose@lunarrails.io')
WHERE email IN (
  'pedro@lunarrails.io',       -- Software Engineer
  'stanislav@lunarrails.io'    -- Software Engineer
);

-- ----------------------------------------------------------------
-- STEP 4: Rebuild org_closure from scratch
-- ----------------------------------------------------------------
TRUNCATE org_closure;

-- Self-references (every person is their own ancestor at depth 0)
INSERT INTO org_closure (ancestor_id, descendant_id, depth)
SELECT id, id, 0 FROM profiles;

-- Build transitive closure recursively
WITH RECURSIVE closure AS (
  -- Direct manager → report (depth 1)
  SELECT manager_id AS ancestor_id, id AS descendant_id, 1 AS depth
  FROM profiles
  WHERE manager_id IS NOT NULL

  UNION ALL

  -- Walk further up the tree
  SELECT c.ancestor_id, p.id AS descendant_id, c.depth + 1
  FROM closure c
  JOIN profiles p ON p.manager_id = c.descendant_id
)
INSERT INTO org_closure (ancestor_id, descendant_id, depth)
SELECT DISTINCT ancestor_id, descendant_id, depth
FROM closure
ON CONFLICT (ancestor_id, descendant_id)
  DO UPDATE SET depth = EXCLUDED.depth;
