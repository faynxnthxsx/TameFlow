-- Added Spanish ('es') as a supported locale alongside en/th/ja. Keep the
-- preferred_language check constraint in sync with SUPPORTED_LOCALES in
-- useLocalePreference.ts.

alter table public.user_profiles
  drop constraint if exists user_profiles_preferred_language_check;

alter table public.user_profiles
  add constraint user_profiles_preferred_language_check
  check (preferred_language in ('en', 'th', 'ja', 'es'));
