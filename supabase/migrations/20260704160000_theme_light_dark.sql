-- The theme picker collapsed from five color themes to a single blue brand
-- theme with light ('corporate-blue') and dark ('dark-mode') modes. Keep the
-- preferred_theme check constraint in sync with THEMES in useTheme.ts.

-- Remap any profile still on a removed theme to the light default.
update public.user_profiles
set preferred_theme = 'corporate-blue'
where preferred_theme not in ('corporate-blue', 'dark-mode');

alter table public.user_profiles
  drop constraint if exists user_profiles_preferred_theme_check;

alter table public.user_profiles
  add constraint user_profiles_preferred_theme_check
  check (preferred_theme in ('corporate-blue', 'dark-mode'));
