-- =====================================================
-- FLASHY MIGRATION 022: Preserve explicit student roles
-- =====================================================
-- Prevents TutPro teacher-profile sync from reclassifying
-- student-marked auth users back to Flashy teachers.
-- =====================================================

CREATE OR REPLACE FUNCTION public.ensure_teacher_profile_for_user(raw_user_id uuid, raw_email text default null)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  profile_email text;
  profile_username text;
  flashy_role text;
BEGIN
  IF raw_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    lower(trim(coalesce(u.email, ''))),
    lower(trim(coalesce(u.raw_user_meta_data ->> 'flashy_role', '')))
  INTO profile_email, flashy_role
  FROM auth.users u
  WHERE u.id = raw_user_id
  LIMIT 1;

  IF flashy_role = 'student' THEN
    DELETE FROM public.teacher_profiles
    WHERE user_id = raw_user_id;
    RETURN;
  END IF;

  profile_email := lower(trim(coalesce(profile_email, raw_email, '')));

  IF profile_email = '' THEN
    SELECT lower(trim(coalesce(u.email, '')))
    INTO profile_email
    FROM auth.users u
    WHERE u.id = raw_user_id
    LIMIT 1;
  END IF;

  IF profile_email = '' THEN
    profile_email := 'user+' || substring(replace(raw_user_id::text, '-', '') from 1 for 8) || '@local.invalid';
  END IF;

  profile_username := public.build_teacher_username_from_email(profile_email, raw_user_id);

  INSERT INTO public.teacher_profiles (user_id, username, email, created_at, updated_at)
  VALUES (raw_user_id, profile_username, profile_email, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET email = excluded.email,
        username = CASE
          WHEN coalesce(trim(public.teacher_profiles.username::text), '') = '' THEN excluded.username
          ELSE public.teacher_profiles.username
        END,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.flashy_sync_teacher_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  auth_flashy_role text := '';
  auth_teacher_id uuid;
  auth_display_name text;
BEGIN
  SELECT
    lower(trim(coalesce(u.raw_user_meta_data ->> 'flashy_role', ''))),
    CASE
      WHEN coalesce(u.raw_user_meta_data ->> 'teacher_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (u.raw_user_meta_data ->> 'teacher_id')::uuid
      ELSE NULL
    END,
    NULLIF(BTRIM(COALESCE(u.raw_user_meta_data ->> 'display_name', '')), '')
  INTO auth_flashy_role, auth_teacher_id, auth_display_name
  FROM auth.users u
  WHERE u.id = NEW.user_id
  LIMIT 1;

  IF auth_flashy_role = 'student' THEN
    INSERT INTO public.flashy_profiles (
      id,
      role,
      teacher_id,
      display_name,
      email
    )
    VALUES (
      NEW.user_id,
      'student',
      auth_teacher_id,
      COALESCE(auth_display_name, NULLIF(TRIM(NEW.display_name), ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
      COALESCE(NEW.email, '')
    )
    ON CONFLICT (id) DO UPDATE
      SET role = 'student',
          teacher_id = COALESCE(EXCLUDED.teacher_id, flashy_profiles.teacher_id),
          display_name = COALESCE(NULLIF(TRIM(EXCLUDED.display_name), ''), flashy_profiles.display_name),
          email = COALESCE(NULLIF(TRIM(EXCLUDED.email), ''), flashy_profiles.email),
          updated_at = NOW();

    RETURN NEW;
  END IF;

  INSERT INTO public.flashy_profiles (
    id,
    role,
    teacher_id,
    display_name,
    email
  )
  VALUES (
    NEW.user_id,
    'teacher',
    NULL,
    COALESCE(NULLIF(TRIM(NEW.display_name), ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO UPDATE
    SET role = 'teacher',
        teacher_id = NULL,
        display_name = COALESCE(NULLIF(TRIM(EXCLUDED.display_name), ''), flashy_profiles.display_name),
        email = COALESCE(NULLIF(TRIM(EXCLUDED.email), ''), flashy_profiles.email),
        updated_at = NOW();

  RETURN NEW;
END;
$$;

DELETE FROM public.teacher_profiles tp
USING auth.users u
WHERE u.id = tp.user_id
  AND lower(trim(coalesce(u.raw_user_meta_data ->> 'flashy_role', ''))) = 'student';

INSERT INTO public.flashy_profiles (
  id,
  role,
  teacher_id,
  display_name,
  email
)
SELECT
  u.id,
  'student',
  CASE
    WHEN coalesce(u.raw_user_meta_data ->> 'teacher_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (u.raw_user_meta_data ->> 'teacher_id')::uuid
    ELSE NULL
  END,
  COALESCE(
    NULLIF(BTRIM(COALESCE(u.raw_user_meta_data ->> 'display_name', '')), ''),
    NULLIF(BTRIM(COALESCE(fp.display_name, '')), ''),
    split_part(COALESCE(u.email, ''), '@', 1)
  ),
  COALESCE(NULLIF(BTRIM(COALESCE(u.email, '')), ''), COALESCE(fp.email, ''))
FROM auth.users u
LEFT JOIN public.flashy_profiles fp
  ON fp.id = u.id
WHERE lower(trim(coalesce(u.raw_user_meta_data ->> 'flashy_role', ''))) = 'student'
ON CONFLICT (id) DO UPDATE
  SET role = 'student',
      teacher_id = COALESCE(EXCLUDED.teacher_id, flashy_profiles.teacher_id),
      display_name = COALESCE(NULLIF(TRIM(EXCLUDED.display_name), ''), flashy_profiles.display_name),
      email = COALESCE(NULLIF(TRIM(EXCLUDED.email), ''), flashy_profiles.email),
      updated_at = NOW();