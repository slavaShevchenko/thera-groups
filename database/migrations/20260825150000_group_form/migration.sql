-- Добавляем поле options для вариантов ответа в SINGLE_CHOICE/MULTIPLE_CHOICE
ALTER TABLE "ApplicationQuestion" ADD COLUMN "options" TEXT[] DEFAULT '{}';

-- Меняем дефолт валюты с RUB на UAH
ALTER TABLE "Group" ALTER COLUMN "currency" SET DEFAULT 'UAH';

-- Обновляем существующие группы (на случай если уже есть DRAFT-группы с RUB)
UPDATE "Group" SET "currency" = 'UAH' WHERE "currency" = 'RUB';