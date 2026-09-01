-- Migrate legacy language codes (UA, EN, RU) to ISO 639-1 (uk, en, ru)
UPDATE "OrganizerProfile"
SET languages = (
  SELECT array(
    SELECT CASE l
      WHEN 'UA' THEN 'uk'
      WHEN 'EN' THEN 'en'
      WHEN 'RU' THEN 'ru'
      ELSE lower(l)
    END
    FROM unnest(languages) AS l
  )
);
