-- Rate limiting for tasks and task_comments

-- 1. Tasks Rate Limit (max 20 per minute per user)
CREATE OR REPLACE FUNCTION public.check_tasks_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_count integer;
BEGIN
  SELECT count(*)
  INTO task_count
  FROM public.tasks
  WHERE created_by = NEW.created_by
    AND created_at >= (now() - interval '1 minute');

  IF task_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: You can only create 20 tasks per minute.' USING ERRCODE = '42900';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_tasks_rate_limit
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_tasks_rate_limit();

-- 2. Task Comments Rate Limit (max 20 per minute per user)
CREATE OR REPLACE FUNCTION public.check_task_comments_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  comment_count integer;
BEGIN
  SELECT count(*)
  INTO comment_count
  FROM public.task_comments
  WHERE author_id = NEW.author_id
    AND created_at >= (now() - interval '1 minute');

  IF comment_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: You can only send 20 comments per minute.' USING ERRCODE = '42900';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_task_comments_rate_limit
  BEFORE INSERT ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_task_comments_rate_limit();
