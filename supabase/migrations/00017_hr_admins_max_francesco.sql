-- Grant HR Admin access to Max and Francesco
UPDATE profiles
SET role = 'HR_ADMIN'
WHERE email IN (
  'max@lunarrails.io',
  'francesco@lunarrails.io'
);
