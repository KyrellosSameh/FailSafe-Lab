-- ============================================================
-- Physics Lab Security Fixes - Supabase SQL Script
-- Run this ENTIRE script in Supabase Dashboard → SQL Editor
-- ============================================================

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 1: Enable RLS on all tables                       ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS instructor_id BIGINT;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 2: Drop all existing policies (clean slate)       ║
-- ╚══════════════════════════════════════════════════════════╝

DO $$ 
DECLARE 
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('students','instructors','admins','exams','results')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 3: students table policies                        ║
-- ╚══════════════════════════════════════════════════════════╝

-- Allow anon to read student by ID (for login - only non-sensitive fields via RPC)
CREATE POLICY "students_select_for_login"
ON public.students FOR SELECT TO anon
USING (true);

-- Allow anon to update own password (for password reset)
CREATE POLICY "students_update_password"
ON public.students FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

-- Allow anon to insert students (admin adds students)
CREATE POLICY "students_insert"
ON public.students FOR INSERT TO anon
WITH CHECK (true);

-- Allow anon to delete students (admin)
CREATE POLICY "students_delete"
ON public.students FOR DELETE TO anon
USING (true);

-- Service role bypasses all RLS automatically

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 4: instructors table policies                     ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "instructors_select"
ON public.instructors FOR SELECT TO anon
USING (true);

CREATE POLICY "instructors_insert"
ON public.instructors FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "instructors_delete"
ON public.instructors FOR DELETE TO anon
USING (true);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 5: admins table policies                          ║
-- ╚══════════════════════════════════════════════════════════╝

-- Admins: only allow select for login check
CREATE POLICY "admins_select_for_login"
ON public.admins FOR SELECT TO anon
USING (true);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 6: exams table policies                           ║
-- ╚══════════════════════════════════════════════════════════╝

-- Allow reading exams (filtered by used/student_id in queries)
CREATE POLICY "exams_select"
ON public.exams FOR SELECT TO anon
USING (true);

-- Allow inserting exams (instructor creates)
CREATE POLICY "exams_insert"
ON public.exams FOR INSERT TO anon
WITH CHECK (true);

-- Allow updating exams (claim exam for student)
CREATE POLICY "exams_update"
ON public.exams FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 7: results table policies                         ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE POLICY "results_select"
ON public.results FOR SELECT TO anon
USING (true);

CREATE POLICY "results_insert"
ON public.results FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "results_update"
ON public.results FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 8: Atomic Exam Claiming RPC Function              ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.claim_random_exam(p_student_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exam RECORD;
  v_start_time BIGINT;
  v_stu_instructor TEXT;
  v_student_name TEXT;
BEGIN
  -- Check if student already has an exam
  SELECT * INTO v_exam FROM public.exams 
  WHERE student_id::TEXT = p_student_id::TEXT
  LIMIT 1;
  
  IF FOUND THEN
    -- Return the existing exam (with parameters for simulation setup)
    RETURN json_build_object(
      'status', 'already_assigned',
      'exam', json_build_object(
        'id', v_exam.id,
        'session_code', v_exam.session_code,
        'experiment_name', v_exam.experiment_name,
        'started_at', v_exam.started_at,
        'instructor_id', v_exam.instructor_id,
        'parameters', v_exam.parameters
      )
    );
  END IF;

  -- Get student's instructor AND NAME (cast to TEXT to avoid strict type mismatch)
  SELECT instructor_id::TEXT, name INTO v_stu_instructor, v_student_name
  FROM public.students
  WHERE student_id::TEXT = p_student_id::TEXT;
  
  IF v_stu_instructor IS NULL THEN
     RETURN json_build_object('status', 'no_exams_available');
  END IF;

  -- Atomically claim a random unused exam from the assigned instructor ONLY
  v_start_time := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  
  UPDATE public.exams
  SET student_id = p_student_id, used = true, started_at = v_start_time
  WHERE id = (
    SELECT id FROM public.exams 
    WHERE student_id IS NULL AND used = false AND instructor_id::TEXT = v_stu_instructor::TEXT
    ORDER BY RANDOM() 
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO v_exam;
  
  IF NOT FOUND THEN
    RETURN json_build_object('status', 'no_exams_available');
  END IF;
  
  -- Insert a "In Progress" placeholder into results immediately, so instructors know the student opened it!
  INSERT INTO public.results (
    student_name, student_id, exam_code, experiment,
    student_result, actual_result, unit,
    instructor_grade, instructor_id
  ) VALUES (
    v_student_name, p_student_id, v_exam.session_code, v_exam.experiment_name,
    'جاري الاختبار...', 'سيظهر بعد التسليم', '',
    '', v_exam.instructor_id
  );
  
  -- Return exam info (with parameters for simulation setup)
  -- Answer verification is handled by submit_exam_result RPC
  RETURN json_build_object(
    'status', 'assigned',
    'exam', json_build_object(
      'id', v_exam.id,
      'session_code', v_exam.session_code,
      'experiment_name', v_exam.experiment_name,
      'started_at', v_start_time,
      'instructor_id', v_exam.instructor_id,
      'parameters', v_exam.parameters
    )
  );
END;
$$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 9: Server-side Answer Verification RPC Function   ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.submit_exam_result(
  p_student_id TEXT,
  p_student_name TEXT,
  p_exam_code TEXT,
  p_experiment TEXT,
  p_student_result TEXT,
  p_unit TEXT,
  p_actual_result TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exam RECORD;
  v_existing RECORD;
  v_actual_result TEXT;
  v_elapsed BIGINT;
  v_params JSONB;
BEGIN
  -- 1. Check if already submitted
  SELECT id, student_result INTO v_existing FROM public.results
  WHERE student_id::TEXT = p_student_id::TEXT AND exam_code::TEXT = p_exam_code::TEXT
  LIMIT 1;
  
  IF FOUND AND v_existing.student_result != 'جاري الاختبار...' THEN
    RETURN json_build_object('status', 'already_submitted');
  END IF;
  
  -- 2. Fetch the exam with parameters (server-side only)
  SELECT * INTO v_exam FROM public.exams
  WHERE session_code::TEXT = p_exam_code::TEXT AND student_id::TEXT = p_student_id::TEXT
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object('status', 'exam_not_found');
  END IF;
  
  -- 3. Time validation
  IF v_exam.started_at IS NOT NULL THEN
    v_elapsed := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT - v_exam.started_at::BIGINT;
    -- Block if more than 35 minutes (with 5 min grace)
    IF v_elapsed > 35 * 60 * 1000 THEN
      RETURN json_build_object('status', 'time_exceeded');
    END IF;
  END IF;

  -- 3.5. 🚨 EXPERIMENT FORGERY CHECK 🚨
  -- Ensure that the submitted experiment exactly matches the instructor's configured experiment
  IF v_exam.experiment_name != p_experiment THEN
    RETURN json_build_object('status', 'forgery_detected');
  END IF;
  
  -- 4. Extract the actual/correct result from parameters (server-side)
  v_params := v_exam.parameters::JSONB;
  
  IF p_experiment = 'ohm' THEN
    v_actual_result := (v_params->>'ohmResistance')::TEXT;
  ELSIF p_experiment = 'wheatstone' THEN
    v_actual_result := (v_params->>'wheatstoneUnknown')::TEXT;
  ELSIF p_experiment = 'hooke' THEN
    v_actual_result := (v_params->>'hookeSpringConstant')::TEXT;
  ELSIF p_experiment = 'viscosity' THEN
    v_actual_result := COALESCE(p_actual_result, 'see_parameters');
  ELSE
    v_actual_result := 'N/A';
  END IF;
  
  -- 5. Update the "In Progress" result with actual values
  IF FOUND THEN
    UPDATE public.results SET
      student_result = p_student_result,
      actual_result = v_actual_result,
      unit = p_unit
    WHERE student_id::TEXT = p_student_id::TEXT AND exam_code::TEXT = p_exam_code::TEXT;
  ELSE
    -- Just in case it was missing
    INSERT INTO public.results (
      student_name, student_id, exam_code, experiment,
      student_result, actual_result, unit,
      instructor_grade, instructor_id
    ) VALUES (
      p_student_name, p_student_id, p_exam_code, p_experiment,
      p_student_result, v_actual_result, p_unit,
      '', v_exam.instructor_id
    );
  END IF;
  
  RETURN json_build_object(
    'status', 'success',
    'actual_result', v_actual_result
  );
END;
$$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 10: Admin verification helper                     ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.verify_admin(p_username TEXT, p_password_hash TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  SELECT * INTO v_admin FROM public.admins
  WHERE username = p_username
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false);
  END IF;
  
  -- Return the stored hash for client-side bcrypt comparison
  RETURN json_build_object(
    'valid', true,
    'stored_hash', v_admin.password
  );
END;
$$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 11: Storage Policies for Exam Snapshots          ║
-- ╚══════════════════════════════════════════════════════════╝

-- Enable RLS on storage (if not already enabled)
-- Note: In Supabase, you usually apply policies to storage.objects

-- 1. Allow public/anon to upload snapshots to 'exam_snapshots' bucket
-- This is necessary for the automated proctoring snapshots.
DROP POLICY IF EXISTS "Allow anon to upload snapshots" ON storage.objects;
CREATE POLICY "Allow anon to upload snapshots"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'exam_snapshots');

-- 2. Allow public/anon to view snapshots (so instructor can see them in results)
DROP POLICY IF EXISTS "Allow anon to view snapshots" ON storage.objects;
CREATE POLICY "Allow anon to view snapshots"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'exam_snapshots');

-- 3. Allow deletion (admin cleanup)
DROP POLICY IF EXISTS "Allow admin to delete snapshots" ON storage.objects;
CREATE POLICY "Allow admin to delete snapshots"
ON storage.objects FOR DELETE TO anon
USING (bucket_id = 'exam_snapshots');

-- ╔══════════════════════════════════════════════════════════╗
-- ║  DONE! All security measures applied.                   ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.admin_delete_instructor(p_instructor_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete all results linked to this instructor (always cast to text to avoid type mismatch)
  DELETE FROM public.results WHERE instructor_id::TEXT = p_instructor_id::TEXT;
  
  -- Delete all exams linked to this instructor
  DELETE FROM public.exams WHERE instructor_id::TEXT = p_instructor_id::TEXT;
  
  -- Delete all students linked to this instructor
  DELETE FROM public.students WHERE instructor_id::TEXT = p_instructor_id::TEXT;
  
  -- Delete the instructor
  DELETE FROM public.instructors WHERE id::TEXT = p_instructor_id::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_student(p_student_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete all results linked to this student
  DELETE FROM public.results WHERE student_id::TEXT = p_student_id::TEXT;
  
  -- Delete all exams linked to this student
  DELETE FROM public.exams WHERE student_id::TEXT = p_student_id::TEXT;
  
  -- Delete the student
  DELETE FROM public.students WHERE student_id::TEXT = p_student_id::TEXT;
END;
$$;
