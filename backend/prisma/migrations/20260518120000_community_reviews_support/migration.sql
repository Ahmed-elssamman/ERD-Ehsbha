-- CreateEnum
CREATE TYPE "CommunityCategory" AS ENUM (
  'BEST_APPS',
  'EXPERIENCE_UBER',
  'EXPERIENCE_INDRIVE',
  'EXPERIENCE_DIDI',
  'EXPERIENCE_OTHER',
  'FUEL_SAVING',
  'BEST_HOURS',
  'MAINTENANCE_ADVICE',
  'EFFICIENCY_TIPS',
  'OPERATIONAL_MISTAKES',
  'WEEKLY_LESSON',
  'SAFETY_ADVICE',
  'GENERAL'
);

-- CreateEnum
CREATE TYPE "ReactionKind" AS ENUM ('LIKE', 'DISLIKE');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('BUG', 'FEATURE_REQUEST', 'IMPROVEMENT', 'QUESTION', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "community_posts" (
  "id" TEXT NOT NULL,
  "driver_id" TEXT NOT NULL,
  "category" "CommunityCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "like_count" INTEGER NOT NULL DEFAULT 0,
  "dislike_count" INTEGER NOT NULL DEFAULT 0,
  "trending_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "is_hidden" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_reactions" (
  "post_id" TEXT NOT NULL,
  "driver_id" TEXT NOT NULL,
  "kind" "ReactionKind" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "community_reactions_pkey" PRIMARY KEY ("post_id","driver_id")
);

-- CreateTable
CREATE TABLE "platform_reviews" (
  "id" TEXT NOT NULL,
  "driver_id" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "is_featured" BOOLEAN NOT NULL DEFAULT false,
  "is_approved" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "platform_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "category" "TicketCategory" NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "admin_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_posts_category_created_at_idx" ON "community_posts" ("category", "created_at" DESC);
CREATE INDEX "community_posts_driver_id_created_at_idx" ON "community_posts" ("driver_id", "created_at" DESC);
CREATE INDEX "community_posts_trending_score_idx" ON "community_posts" ("trending_score" DESC);
CREATE INDEX "community_posts_like_count_idx" ON "community_posts" ("like_count" DESC);
CREATE INDEX "community_posts_created_at_idx" ON "community_posts" ("created_at" DESC);

-- CreateIndex
CREATE INDEX "community_reactions_driver_id_idx" ON "community_reactions" ("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_reviews_driver_id_key" ON "platform_reviews" ("driver_id");
CREATE INDEX "platform_reviews_is_approved_created_at_idx" ON "platform_reviews" ("is_approved", "created_at" DESC);
CREATE INDEX "platform_reviews_is_featured_is_approved_rating_idx" ON "platform_reviews" ("is_featured", "is_approved", "rating" DESC);
CREATE INDEX "platform_reviews_rating_created_at_idx" ON "platform_reviews" ("rating" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "support_tickets_user_id_created_at_idx" ON "support_tickets" ("user_id", "created_at" DESC);
CREATE INDEX "support_tickets_status_created_at_idx" ON "support_tickets" ("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_reviews" ADD CONSTRAINT "platform_reviews_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
