-- AlterTable
ALTER TABLE "OrganizerProfile" ADD COLUMN "avatarUrl" TEXT;

-- Create Supabase Storage bucket for organizer avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('organizer-avatars', 'organizer-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy for organizer avatars
CREATE POLICY "organizer-avatars-public-read"
ON storage.objects FOR SELECT
USING (bucket_id = 'organizer-avatars');
