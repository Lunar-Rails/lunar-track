-- Add notification_prefs to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL
  DEFAULT '{"checkin_reminders": true, "review_reminders": true}'::jsonb;

-- Create avatars storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket
CREATE POLICY "avatar_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatar_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatar_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');
