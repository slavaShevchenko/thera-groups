-- Articles: bilingual long-form editorial content, written by admins and published under
-- /[locale]/articles.
--
-- Two tables rather than one because the copy is per-locale while the identity is not: a
-- slug, a status, an author and a publication date describe the article, whereas a title and
-- a body describe one language's version of it. Publishing is gated on both translations
-- existing (see server/services/articleService.ts), and against this shape that gate is a row
-- count over "ArticleTranslation" — not a comparison between two nullable column pairs that a
-- third language would turn into a migration.

CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT,
    "authorName" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleTranslation" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleTranslation_pkey" PRIMARY KEY ("id")
);

-- ==========================================
-- Constraints
-- ==========================================

-- A published article is listed, sitemapped and rendered with a date in its byline and in its
-- JSON-LD, so "published with no publication date" is a row every reader would have to defend
-- against. Enforced here rather than only in the service, because the service is one of two
-- writers: an admin panel bug or a hand-run UPDATE should not be able to produce it either.
ALTER TABLE "Article"
  ADD CONSTRAINT "Article_published_requires_date_check"
  CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);

-- The byline is either a linked organizer profile or a free-text name for a contributor who
-- has no profile. Both at once would leave every page that renders the author to pick one,
-- and the two would drift apart the moment the profile is renamed.
ALTER TABLE "Article"
  ADD CONSTRAINT "Article_author_single_source_check"
  CHECK ("authorId" IS NULL OR "authorName" IS NULL);

-- Same vocabulary as "User"."preferredLocale" and "EmailEvent"."locale".
ALTER TABLE "ArticleTranslation"
  ADD CONSTRAINT "ArticleTranslation_locale_check"
  CHECK ("locale" IN ('ua', 'en'));

-- ==========================================
-- Indexes
-- ==========================================

CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- The public list is `WHERE status = 'PUBLISHED' ORDER BY "publishedAt" DESC`, which this
-- serves without a sort.
CREATE INDEX "Article_status_publishedAt_idx" ON "Article"("status", "publishedAt");

-- Probed by the ON DELETE SET NULL below, and by an author's own article list.
CREATE INDEX "Article_authorId_idx" ON "Article"("authorId");

-- One row per (article, language). Also the lookup path for the nested filter the public list
-- runs — walk "Article" by status and date, then probe this pair — so no index on "locale"
-- alone is needed and none is created.
CREATE UNIQUE INDEX "ArticleTranslation_articleId_locale_key" ON "ArticleTranslation"("articleId", "locale");

-- ==========================================
-- Foreign keys
-- ==========================================

-- SET NULL, not CASCADE: an organizer profile being deleted does not retract an article that
-- was published under their name, it just leaves the byline unlinked.
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "OrganizerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Article" ADD CONSTRAINT "Article_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CASCADE: a translation has no meaning without its article, and the delete path in
-- articleService removes the parent row.
ALTER TABLE "ArticleTranslation" ADD CONSTRAINT "ArticleTranslation_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================
-- Row Level Security
-- ==========================================

-- The flag and nothing else: no policies and no grants, exactly like every other table here.
-- tests/integration/rls.test.ts fails on a new public table created without it, which is what
-- happened to "GroupCoOrganizer" once. See docs/security.md §10 for why this is a posture
-- rather than a control.
ALTER TABLE "Article" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArticleTranslation" ENABLE ROW LEVEL SECURITY;
