-- =====================================================
-- FLASHY MIGRATION 006: Student auth provisioning by name + ID
-- Run in Supabase SQL Editor after 005_flashy_teacher_profile_sync.sql
-- =====================================================

CREATE OR REPLACE FUNCTION public.flashy_normalize_student_id(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    regexp_replace(COALESCE(value, ''), '^\s*id\s*[:#-]?\s*', '', 'i'),
    '\s+',
    '',
    'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.flashy_normalize_student_name(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        lower(regexp_replace(COALESCE(value, ''), '\s*\(.*\)\s*$', '', 'g')),
        '\s+[a-c][12]\s*$',
        '',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.flashy_prepare_student_auth(
  login_name TEXT,
  login_student_id TEXT
)
RETURNS TABLE (
  email TEXT,
  password TEXT,
  teacher_id UUID,
  student_name TEXT,
  student_id TEXT,
  user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
#variable_conflict use_column
DECLARE
  normalized_login_id TEXT := public.flashy_normalize_student_id(login_student_id);
  normalized_login_name TEXT := public.flashy_normalize_student_name(login_name);
  matched_teacher_id UUID;
  matched_student_name TEXT;
  matched_student_id TEXT;
  internal_key TEXT;
  internal_email TEXT;
  internal_password TEXT;
  target_user auth.users%ROWTYPE;
  target_user_id UUID;
BEGIN
  IF normalized_login_id = '' OR normalized_login_name = '' THEN
    RAISE EXCEPTION 'Name and student ID are required.';
  END IF;

  SELECT
    backups.user_id,
    COALESCE(
      NULLIF(BTRIM(student ->> 'name'), ''),
      NULLIF(BTRIM(student ->> 'displayName'), ''),
      NULLIF(BTRIM(student ->> 'fullName'), ''),
      BTRIM(login_name)
    ),
    COALESCE(NULLIF(BTRIM(student ->> 'id'), ''), normalized_login_id)
  INTO matched_teacher_id, matched_student_name, matched_student_id
  FROM public.lesson_manager_backups AS backups
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(COALESCE(backups.snapshot -> 'tutorData' -> 'students', backups.snapshot -> 'students', '[]'::jsonb)) = 'array'
        THEN COALESCE(backups.snapshot -> 'tutorData' -> 'students', backups.snapshot -> 'students')
      ELSE '[]'::jsonb
    END
  ) AS student
  WHERE public.flashy_normalize_student_id(COALESCE(student ->> 'id', '')) = normalized_login_id
    AND public.flashy_normalize_student_name(
      COALESCE(student ->> 'name', student ->> 'displayName', student ->> 'fullName', '')
    ) = normalized_login_name
  ORDER BY COALESCE(backups.updated_at, backups.exported_at) DESC NULLS LAST
  LIMIT 1;

  IF matched_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Student not found. Check your name and ID.';
  END IF;

  internal_key := regexp_replace(
    lower(matched_teacher_id::TEXT || '-' || normalized_login_id),
    '[^a-z0-9]+',
    '-',
    'g'
  );
  internal_key := regexp_replace(internal_key, '(^-+|-+$)', '', 'g');
  internal_email := LEFT('student-' || internal_key, 52) || '@flashyapp.com';
  internal_password := 'Flashy!' || SUBSTRING(md5('flashy:' || matched_teacher_id::TEXT || ':' || normalized_login_id) FROM 1 FOR 24);

  SELECT *
  INTO target_user
  FROM auth.users
  WHERE email = internal_email
     OR (
       raw_user_meta_data ->> 'flashy_role' = 'student'
       AND raw_user_meta_data ->> 'teacher_id' = matched_teacher_id::TEXT
       AND raw_user_meta_data ->> 'student_id' = normalized_login_id
     )
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_user.id IS NULL THEN
    target_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      email_change_confirm_status,
      reauthentication_token,
      is_super_admin,
      is_sso_user,
      is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      target_user_id,
      'authenticated',
      'authenticated',
      internal_email,
      crypt(internal_password, gen_salt('bf')),
      NOW(),
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object(
        'display_name', matched_student_name,
        'flashy_role', 'student',
        'teacher_id', matched_teacher_id::TEXT,
        'student_id', normalized_login_id
      ),
      NOW(),
      NOW(),
      '',
      '',
      '',
      '',
      '',
      0,
      '',
      FALSE,
      FALSE,
      FALSE
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      target_user_id,
      jsonb_build_object(
        'sub', target_user_id::TEXT,
        'email', internal_email,
        'email_verified', TRUE
      ),
      'email',
      internal_email,
      NOW(),
      NOW(),
      NOW()
    );
  ELSE
    target_user_id := target_user.id;

    UPDATE auth.users
    SET
      email = internal_email,
      encrypted_password = crypt(internal_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      last_sign_in_at = NOW(),
      raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'display_name', matched_student_name,
        'flashy_role', 'student',
        'teacher_id', matched_teacher_id::TEXT,
        'student_id', normalized_login_id
      ),
      updated_at = NOW(),
      is_anonymous = FALSE
    WHERE id = target_user_id;

    IF EXISTS (
      SELECT 1
      FROM auth.identities
      WHERE user_id = target_user_id
        AND provider = 'email'
    ) THEN
      UPDATE auth.identities
      SET
        provider_id = internal_email,
        identity_data = jsonb_build_object(
          'sub', target_user_id::TEXT,
          'email', internal_email,
          'email_verified', TRUE
        ),
        last_sign_in_at = NOW(),
        updated_at = NOW()
      WHERE user_id = target_user_id
        AND provider = 'email';
    ELSE
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        target_user_id,
        jsonb_build_object(
          'sub', target_user_id::TEXT,
          'email', internal_email,
          'email_verified', TRUE
        ),
        'email',
        internal_email,
        NOW(),
        NOW(),
        NOW()
      );
    END IF;
  END IF;

  -- Auto-create / update the student's flashy_profiles row
  INSERT INTO public.flashy_profiles (id, role, teacher_id, email, display_name)
  VALUES (target_user_id, 'student', matched_teacher_id, internal_email, matched_student_name)
  ON CONFLICT (id) DO UPDATE SET
    role = 'student',
    teacher_id = EXCLUDED.teacher_id,
    display_name = EXCLUDED.display_name,
    updated_at = NOW();

  RETURN QUERY
  SELECT
    internal_email,
    internal_password,
    matched_teacher_id,
    matched_student_name,
    normalized_login_id,
    target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flashy_prepare_student_auth(TEXT, TEXT) TO anon, authenticated;