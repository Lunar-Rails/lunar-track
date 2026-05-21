-- ============================================================
-- 00010_org_structure.sql
-- Sets up the full Lunar Rails reporting hierarchy from the
-- General Report spreadsheet (2026-05-14).
-- ============================================================

-- ----------------------------------------------------------------
-- STEP 1: Update full_name on every profile to match the spreadsheet
-- ----------------------------------------------------------------
UPDATE profiles SET full_name = 'Agustin Krupka Buendia'          WHERE email = 'kenobi@lunarrails.io';
UPDATE profiles SET full_name = 'Alberto Manzaneque Garcia'        WHERE email = 'alberto@lunarrails.io';
UPDATE profiles SET full_name = 'Ali Elkerm'                       WHERE email = 'ali@lunarrails.io';
UPDATE profiles SET full_name = 'Anjali Surana'                    WHERE email = 'anjali@lunarrails.io';
UPDATE profiles SET full_name = 'Ashwini Sewa'                     WHERE email = 'ashwini@lunarrails.io';
UPDATE profiles SET full_name = 'Ben Cuddy'                        WHERE email = 'ben@lunarrails.io';
UPDATE profiles SET full_name = 'Callum Byrne'                     WHERE email = 'callum@lunarrails.io';
UPDATE profiles SET full_name = 'Chris Collins'                    WHERE email = 'chris@lunarrails.io';
UPDATE profiles SET full_name = 'Elton Lu'                         WHERE email = 'elton@lunarrails.io';
UPDATE profiles SET full_name = 'Faith M.'                         WHERE email = 'faith@lunarrails.io';
UPDATE profiles SET full_name = 'Francesco Vivoli'                 WHERE email = 'francesco@lunarrails.io';
UPDATE profiles SET full_name = 'Guido Verhoeff'                   WHERE email = 'guido@vroeff.nl';
UPDATE profiles SET full_name = 'Henrique Gomes'                   WHERE email = 'henrique@lunarrails.io';
UPDATE profiles SET full_name = 'Ivonne Bagus'                     WHERE email = 'ivonne@lunarrails.io';
UPDATE profiles SET full_name = 'Jenny Aquino'                     WHERE email = 'jenny@lunarrails.io';
UPDATE profiles SET full_name = 'Jose Antonio'                     WHERE email = 'jose@lunarrails.io';
UPDATE profiles SET full_name = 'Jyoti Das'                        WHERE email = 'jyoti@lunarrails.io';
UPDATE profiles SET full_name = 'Kallie Erasmus'                   WHERE email = 'kallie@lunarrails.io';
UPDATE profiles SET full_name = 'Karla Lissette Bernabel Avelar'   WHERE email = 'karla@40acres.pro';
UPDATE profiles SET full_name = 'Kevin Ayala'                      WHERE email = 'kevin@40acres.pro';
UPDATE profiles SET full_name = 'Lisa Halpern'                     WHERE email = 'lisa@lunarrails.io';
UPDATE profiles SET full_name = 'Lucy Brattan'                     WHERE email = 'lucy@lunarrails.io';
UPDATE profiles SET full_name = 'Mark Singh'                       WHERE email = 'mark@lunarrails.io';
UPDATE profiles SET full_name = 'Marthe Buffiere'                  WHERE email = 'marthe@lunarrails.io';
UPDATE profiles SET full_name = 'Max B.'                           WHERE email = 'max@lunarrails.io';
UPDATE profiles SET full_name = 'Nyashadzashe Mupfudze'            WHERE email = 'nyasha@lunarrails.io';
UPDATE profiles SET full_name = 'Olubunmi Bolaji-Owonifari'        WHERE email = 'olubunmi@lunarrails.io';
UPDATE profiles SET full_name = 'Pedro Gómez'                      WHERE email = 'pedro@lunarrails.io';
UPDATE profiles SET full_name = 'Randa Azzam'                      WHERE email = 'randa@lunarrails.io';
UPDATE profiles SET full_name = 'Rey Hersano'                      WHERE email = 'rey@lunarrails.io';
UPDATE profiles SET full_name = 'Riza Forrester'                   WHERE email = 'riza@lunarrails.io';
UPDATE profiles SET full_name = 'Robert Ramos'                     WHERE email = 'robert@lunarrails.io';
UPDATE profiles SET full_name = 'Ronnie David'                     WHERE email = 'ronnie@lunarrails.io';
UPDATE profiles SET full_name = 'Sara Osiris'                      WHERE email = 'sara@lunarrails.io';
UPDATE profiles SET full_name = 'Sherin John George'               WHERE email = 'sherin@lunarrails.io';
UPDATE profiles SET full_name = 'Shilpa Susain Thomas'             WHERE email = 'shilpa@lunarrails.io';
UPDATE profiles SET full_name = 'Sofia Driotez'                    WHERE email = 'sofia@40acres.pro';
UPDATE profiles SET full_name = 'Stanislav Kerimov'                WHERE email = 'stanislav@lunarrails.io';

-- ----------------------------------------------------------------
-- STEP 2: Clear all existing manager links (clean slate)
-- ----------------------------------------------------------------
UPDATE profiles SET manager_id = NULL, role = 'EMPLOYEE';

-- ----------------------------------------------------------------
-- STEP 3: Set roles for leaders
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
-- STEP 4: Set manager_id — direct reports to Mark Singh (CEO)
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
-- STEP 5: Rebuild org_closure from scratch
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
