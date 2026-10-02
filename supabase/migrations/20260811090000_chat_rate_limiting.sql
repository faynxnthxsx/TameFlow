-- Function to check rate limit for chat messages (max 20 per minute per user)
CREATE OR REPLACE FUNCTION public.check_chat_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  message_count integer;
BEGIN
  -- Count how many messages this user has sent in the last 1 minute
  SELECT count(*)
  INTO message_count
  FROM public.chat_messages
  WHERE user_id = NEW.user_id
    AND created_at >= (now() - interval '1 minute');

  -- If the user already sent 20 or more messages in the last minute, reject this one
  IF message_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: You can only send 20 messages per minute.' USING ERRCODE = '42900';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to execute the rate limit check before every insert on chat_messages
CREATE TRIGGER enforce_chat_rate_limit
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_chat_rate_limit();
