


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_shop_status"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_online_count INT := 0;
  v_recently_online_count INT := 0;
  v_offline_count INT := 0;
BEGIN
  -- Get current timestamps for threshold checks
  -- 2 minutes grace period for "online" status
  -- 10 minutes before marking as "offline"
  
  -- Update shops to 'online' if last ping was within 2 minutes
  UPDATE shops
  SET display_status = 'online'
  WHERE last_ping_time > NOW() - INTERVAL '2 minutes'
  AND display_status != 'online';
  
  GET DIAGNOSTICS v_online_count = ROW_COUNT;

  -- Update shops to 'recently_online' if last ping was 2-10 minutes ago
  UPDATE shops
  SET display_status = 'recently_online'
  WHERE last_ping_time > NOW() - INTERVAL '10 minutes'
  AND last_ping_time <= NOW() - INTERVAL '2 minutes'
  AND display_status != 'recently_online';
  
  GET DIAGNOSTICS v_recently_online_count = ROW_COUNT;

  -- Update shops to 'offline' if last ping was more than 10 minutes ago or is null
  UPDATE shops
  SET display_status = 'offline'
  WHERE (last_ping_time IS NULL OR last_ping_time <= NOW() - INTERVAL '10 minutes')
  AND display_status != 'offline';
  
  GET DIAGNOSTICS v_offline_count = ROW_COUNT;

  -- Log the status check results
  RAISE NOTICE 'Shop status check completed - Online: %, Recently Online: %, Offline: %',
    v_online_count, v_recently_online_count, v_offline_count;
END;
$$;


ALTER FUNCTION "public"."check_shop_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_chats"() RETURNS TABLE("deleted_count" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM temporary_chats
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN QUERY SELECT v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_chats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_world_chats"() RETURNS TABLE("deleted_count" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM world_chat_messages
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN QUERY SELECT v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_world_chats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_today_bookings"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  delete from bookings
  where booking_date::date = current_date;
end;
$$;


ALTER FUNCTION "public"."delete_today_bookings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shop_chats"("p_shop_id" "text", "p_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "shop_id" "text", "user_name" "text", "user_email" "text", "user_id" "text", "message" "text", "created_at" timestamp with time zone, "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT temporary_chats.id, temporary_chats.shop_id, temporary_chats.user_name, temporary_chats.user_email, temporary_chats.user_id, temporary_chats.message, temporary_chats.created_at, temporary_chats.expires_at
  FROM temporary_chats
  WHERE temporary_chats.shop_id = p_shop_id
    AND expires_at > now()
  ORDER BY temporary_chats.created_at DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_shop_chats"("p_shop_id" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_shop_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE shops
  SET
    average_rating = (
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM reviews
      WHERE shop_id = COALESCE(NEW.shop_id, OLD.shop_id)
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM reviews
      WHERE shop_id = COALESCE(NEW.shop_id, OLD.shop_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.shop_id, OLD.shop_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_shop_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_devices_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_devices_timestamp"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."alert_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_name" "text" NOT NULL,
    "token_number" integer NOT NULL,
    "user_name" "text" NOT NULL,
    "time_slot" "text" NOT NULL,
    "booking_date" "date" NOT NULL,
    "reminder_time" "text" NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "timezone_offset_hours" numeric(4,2) NOT NULL,
    "sent" boolean DEFAULT false,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."alert_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_updates" (
    "id" bigint NOT NULL,
    "current_version" character varying(50) NOT NULL,
    "latest_version" character varying(50) NOT NULL,
    "update_enabled" boolean DEFAULT false,
    "apk_url" "text",
    "update_message" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."app_updates" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."app_updates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."app_updates_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."app_updates_id_seq" OWNED BY "public"."app_updates"."id";



CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "service_name" "text" NOT NULL,
    "service_price" "text" NOT NULL,
    "time_slot" "text" NOT NULL,
    "token_number" integer NOT NULL,
    "user_name" "text" NOT NULL,
    "user_phone" "text" NOT NULL,
    "booking_date" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "text"
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "total_recipients" integer DEFAULT 0,
    "total_sent" integer DEFAULT 0,
    "total_delivered" integer DEFAULT 0,
    "total_opened" integer DEFAULT 0,
    "total_failed" integer DEFAULT 0,
    "delivery_rate" numeric(5,2) DEFAULT 0,
    "open_rate" numeric(5,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaign_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "onesignal_notification_id" "text",
    "status" "text" DEFAULT 'sent'::"text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "delivered_at" timestamp with time zone,
    "opened_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaign_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_matched_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "matched_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaign_matched_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "country" "text" NOT NULL,
    "state" "text",
    "district" "text",
    "village" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaign_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "scheduled_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "image_url" "text"
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "icon" "text" DEFAULT ''::"text",
    "description" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "video_id" "uuid" NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "uploader_name" character varying(255) NOT NULL,
    "uploader_image_url" "text",
    "comment_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."featured_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "image_url" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."featured_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."khata_book_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "customer_name" character varying(255) NOT NULL,
    "phone_number" character varying(20),
    "total_amount_to_collect" numeric(10,2) NOT NULL,
    "remaining_amount" numeric(10,2) NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."khata_book_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."khata_book_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "shop_id" "text" NOT NULL,
    "amount_paid" numeric(10,2) NOT NULL,
    "payment_date" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."khata_book_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."native_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "email" "text",
    "player_id" "text",
    "device_type" "text" DEFAULT 'native'::"text",
    "last_active" timestamp without time zone DEFAULT "now"(),
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."native_devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."native_shop_owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "player_id" "text",
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auto_start_foreground_service" boolean DEFAULT false
);


ALTER TABLE "public"."native_shop_owners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" NOT NULL,
    "shop_id" "text" NOT NULL,
    "customer_id" "text" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "order_amount" numeric(10,2) NOT NULL,
    "status" "text",
    "rejection_notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "accepted_at" timestamp without time zone,
    "rejected_at" timestamp without time zone,
    "ready_at" timestamp without time zone,
    "collected_at" timestamp without time zone,
    "expires_at" timestamp without time zone,
    "order_description" "text",
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'ready_for_collection'::"text", 'collected'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "razorpay_payment_id" "text",
    "razorpay_order_id" "text" NOT NULL,
    "amount" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_method" "text",
    "upi_id" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "error_message" "text",
    "notes" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'failed'::"text", 'captured'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "features" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_user_id" "text" NOT NULL,
    "sender_name" "text" NOT NULL,
    "sender_email" "text",
    "sender_id" "text",
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profile_chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "shop_id" "text" NOT NULL,
    "owner_id" "text" NOT NULL,
    "reply_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."review_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "user_email" "text",
    "user_name" "text",
    "rating" integer NOT NULL,
    "title" "text",
    "review_text" "text" NOT NULL,
    "image_url" "text",
    "is_verified_customer" boolean DEFAULT false,
    "helpful_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "booking_id" "text" NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_name" "text" NOT NULL,
    "token_number" integer NOT NULL,
    "user_name" "text" NOT NULL,
    "time_slot" "text" NOT NULL,
    "booking_date" "text" NOT NULL,
    "reminder_time" "text" NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "timezone_offset_hours" double precision DEFAULT 0,
    "sent" boolean DEFAULT false,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scheduled_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_customizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "background_color" "text" DEFAULT '#ffffff'::"text",
    "primary_color" "text" DEFAULT '#3b82f6'::"text",
    "text_color" "text" DEFAULT '#1f2937'::"text",
    "border_radius" "text" DEFAULT 'md'::"text",
    "layout_style" "text" DEFAULT 'spacious'::"text",
    "card_style" "text" DEFAULT 'elevated'::"text",
    "show_team" boolean DEFAULT true,
    "show_about" boolean DEFAULT true,
    "show_chats" boolean DEFAULT true,
    "show_reviews" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "button_shape" "text" DEFAULT 'rounded'::"text",
    "button_color" "text" DEFAULT '#3b82f6'::"text",
    "button_text_color" "text" DEFAULT '#ffffff'::"text",
    "button_size" "text" DEFAULT 'md'::"text",
    "button_position" "text" DEFAULT 'bottom'::"text",
    "last_updated" bigint
);


ALTER TABLE "public"."shop_customizations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shop_customizations"."button_shape" IS 'Button shape: square, rounded, or pill (full round)';



COMMENT ON COLUMN "public"."shop_customizations"."button_color" IS 'Button background color in hex format (e.g., #3b82f6)';



COMMENT ON COLUMN "public"."shop_customizations"."button_text_color" IS 'Button text color in hex format (e.g., #ffffff)';



COMMENT ON COLUMN "public"."shop_customizations"."button_size" IS 'Button size: sm (small), md (medium), or lg (large)';



COMMENT ON COLUMN "public"."shop_customizations"."button_position" IS 'Button position on page: top, bottom, or floating (fixed position)';



COMMENT ON COLUMN "public"."shop_customizations"."last_updated" IS 'Timestamp when customization was last updated (milliseconds since epoch)';



CREATE TABLE IF NOT EXISTS "public"."shop_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "image_url" "text",
    "discount_percentage" numeric(5,2),
    "discount_amount" numeric(10,2),
    "valid_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_until" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shop_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_owner_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "plan_name" character varying(50) NOT NULL,
    "plan_price" integer NOT NULL,
    "razorpay_order_id" character varying(255),
    "razorpay_payment_id" character varying(255),
    "razorpay_signature" character varying(255),
    "payment_status" character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    "shop_id" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_free_plan" boolean DEFAULT false
);


ALTER TABLE "public"."shop_owner_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "email" "text",
    "player_id" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."shop_owners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_websites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_name" "text" NOT NULL,
    "layout_json" "jsonb" DEFAULT '{"components": []}'::"jsonb" NOT NULL,
    "is_published" boolean DEFAULT false,
    "published_at" timestamp with time zone,
    "views_count" integer DEFAULT 0,
    "custom_domain" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "vercel_deployment_id" "text",
    "vercel_url" "text",
    "custom_subdomain" "text"
);


ALTER TABLE "public"."shop_websites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shops" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "location" "text" NOT NULL,
    "owner_name" "text" NOT NULL,
    "owner_email" "text" NOT NULL,
    "owner_phone" "text" NOT NULL,
    "about" "text",
    "shop_image_url" "text",
    "location_image_url" "text",
    "location_map_link" "text",
    "password" "text" NOT NULL,
    "barber_members" "jsonb" DEFAULT '[]'::"jsonb",
    "services" "jsonb" DEFAULT '[]'::"jsonb",
    "is_open" boolean DEFAULT true,
    "token_booking_paused" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category" "text" DEFAULT 'salon'::"text" NOT NULL,
    "opening_time" "text" DEFAULT '09:00'::"text",
    "closing_time" "text" DEFAULT '18:00'::"text",
    "last_ping_time" timestamp with time zone,
    "display_status" "text" DEFAULT 'offline'::"text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "address" "text",
    "district" "text",
    "state" "text",
    "country" "text",
    "village" "text",
    "average_rating" numeric(3,2) DEFAULT 0,
    "total_reviews" integer DEFAULT 0,
    "category_id" "uuid",
    "is_pinned" boolean DEFAULT false,
    "pin_order" integer DEFAULT 999,
    "shop_interior_video_url" "text",
    "is_website_builder_enabled" boolean DEFAULT false,
    CONSTRAINT "category_check" CHECK ((("category" <> ''::"text") AND ("category" IS NOT NULL))),
    CONSTRAINT "valid_display_status" CHECK (("display_status" = ANY (ARRAY['online'::"text", 'recently_online'::"text", 'offline'::"text"])))
);


ALTER TABLE "public"."shops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."temporary_chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "user_email" "text",
    "user_id" "text",
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval)
);


ALTER TABLE "public"."temporary_chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_campaign_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "shop_id" "text",
    "campaign_title" "text" NOT NULL,
    "campaign_message" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "read_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval)
);


ALTER TABLE "public"."user_campaign_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "email" "text",
    "player_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "password" character varying(255) DEFAULT ''::character varying NOT NULL,
    "is_available" boolean DEFAULT true,
    "is_online" boolean DEFAULT false
);


ALTER TABLE "public"."user_devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "sender_name" "text" NOT NULL,
    "sender_email" "text" NOT NULL,
    "sender_phone" "text",
    "message" "text" NOT NULL,
    "message_type" "text" DEFAULT 'thought'::"text" NOT NULL,
    "admin_reply" "text",
    "admin_reply_by" "text",
    "is_read" boolean DEFAULT false,
    "reply_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "image_url" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "address" "text",
    "state" "text",
    "country" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "village" "text",
    "district" "text",
    "profile_name" "text"
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text",
    "phone" "text",
    "password" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "email_or_phone_check" CHECK ((("email" IS NOT NULL) OR ("phone" IS NOT NULL)))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "uploader_name" "text" NOT NULL,
    "uploader_type" "text" NOT NULL,
    "uploader_id" "text" NOT NULL,
    "video_url" "text" NOT NULL,
    "duration" integer NOT NULL,
    "caption" "text",
    "likes" integer DEFAULT 0,
    "liked_by" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "videos_duration_check" CHECK ((("duration" >= 0) AND ("duration" <= 60))),
    CONSTRAINT "videos_likes_check" CHECK (("likes" >= 0)),
    CONSTRAINT "videos_uploader_name_check" CHECK ((("char_length"("btrim"("uploader_name")) >= 3) AND ("char_length"("btrim"("uploader_name")) <= 50))),
    CONSTRAINT "videos_uploader_type_check" CHECK (("uploader_type" = ANY (ARRAY['shop'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."videos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."world_chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_name" "text" NOT NULL,
    "user_email" "text",
    "user_id" "text",
    "message" "text" NOT NULL,
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval)
);


ALTER TABLE "public"."world_chat_messages" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_updates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."app_updates_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."alert_reminders"
    ADD CONSTRAINT "alert_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_updates"
    ADD CONSTRAINT "app_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_analytics"
    ADD CONSTRAINT "campaign_analytics_campaign_id_key" UNIQUE ("campaign_id");



ALTER TABLE ONLY "public"."campaign_analytics"
    ADD CONSTRAINT "campaign_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_logs"
    ADD CONSTRAINT "campaign_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_matched_users"
    ADD CONSTRAINT "campaign_matched_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_targets"
    ADD CONSTRAINT "campaign_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."featured_products"
    ADD CONSTRAINT "featured_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."khata_book_customers"
    ADD CONSTRAINT "khata_book_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."khata_book_payments"
    ADD CONSTRAINT "khata_book_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."native_devices"
    ADD CONSTRAINT "native_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."native_shop_owners"
    ADD CONSTRAINT "native_shop_owners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."native_shop_owners"
    ADD CONSTRAINT "native_shop_owners_user_shop_unique" UNIQUE ("user_id", "shop_id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_razorpay_payment_id_key" UNIQUE ("razorpay_payment_id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_chat_messages"
    ADD CONSTRAINT "profile_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_shop_id_user_id_key" UNIQUE ("shop_id", "user_id");



ALTER TABLE ONLY "public"."scheduled_reminders"
    ADD CONSTRAINT "scheduled_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_customizations"
    ADD CONSTRAINT "shop_customizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_customizations"
    ADD CONSTRAINT "shop_customizations_shop_id_key" UNIQUE ("shop_id");



ALTER TABLE ONLY "public"."shop_offers"
    ADD CONSTRAINT "shop_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_owner_plans"
    ADD CONSTRAINT "shop_owner_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_owners"
    ADD CONSTRAINT "shop_owners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_owners"
    ADD CONSTRAINT "shop_owners_user_id_shop_id_key" UNIQUE ("user_id", "shop_id");



ALTER TABLE ONLY "public"."shop_websites"
    ADD CONSTRAINT "shop_websites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_websites"
    ADD CONSTRAINT "shop_websites_shop_id_key" UNIQUE ("shop_id");



ALTER TABLE ONLY "public"."shop_websites"
    ADD CONSTRAINT "shop_websites_shop_name_key" UNIQUE ("shop_name");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."temporary_chats"
    ADD CONSTRAINT "temporary_chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."native_devices"
    ADD CONSTRAINT "unique_native_devices_user_id" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_campaign_alerts"
    ADD CONSTRAINT "user_campaign_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_messages"
    ADD CONSTRAINT "user_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_profile_name_key" UNIQUE ("profile_name");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."world_chat_messages"
    ADD CONSTRAINT "world_chat_messages_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_alert_reminders_sent_scheduled_for" ON "public"."alert_reminders" USING "btree" ("sent", "scheduled_for");



CREATE INDEX "idx_alert_reminders_user_id" ON "public"."alert_reminders" USING "btree" ("user_id");



CREATE INDEX "idx_bookings_booking_date" ON "public"."bookings" USING "btree" ("booking_date");



CREATE INDEX "idx_bookings_shop_id" ON "public"."bookings" USING "btree" ("shop_id");



CREATE INDEX "idx_bookings_user_id" ON "public"."bookings" USING "btree" ("user_id");



CREATE INDEX "idx_campaign_analytics_campaign_id" ON "public"."campaign_analytics" USING "btree" ("campaign_id");



CREATE INDEX "idx_campaign_logs_analytics" ON "public"."campaign_logs" USING "btree" ("campaign_id", "status", "sent_at");



CREATE INDEX "idx_campaign_logs_campaign_id" ON "public"."campaign_logs" USING "btree" ("campaign_id");



CREATE INDEX "idx_campaign_logs_status" ON "public"."campaign_logs" USING "btree" ("status");



CREATE INDEX "idx_campaign_logs_user_id" ON "public"."campaign_logs" USING "btree" ("user_id");



CREATE INDEX "idx_campaign_matched_users_campaign_count" ON "public"."campaign_matched_users" USING "btree" ("campaign_id", "user_id");



CREATE INDEX "idx_campaign_matched_users_campaign_id" ON "public"."campaign_matched_users" USING "btree" ("campaign_id");



CREATE INDEX "idx_campaign_matched_users_user_id" ON "public"."campaign_matched_users" USING "btree" ("user_id");



CREATE INDEX "idx_campaign_matched_users_user_id_idx" ON "public"."campaign_matched_users" USING "btree" ("user_id");



CREATE INDEX "idx_campaign_targets_campaign_id" ON "public"."campaign_targets" USING "btree" ("campaign_id");



CREATE INDEX "idx_campaign_targets_location" ON "public"."campaign_targets" USING "btree" ("country", "state", "district", "village");



CREATE INDEX "idx_campaigns_scheduled" ON "public"."campaigns" USING "btree" ("scheduled_at") WHERE ("status" = 'scheduled'::"text");



CREATE INDEX "idx_campaigns_shop_id" ON "public"."campaigns" USING "btree" ("shop_id");



CREATE INDEX "idx_campaigns_status" ON "public"."campaigns" USING "btree" ("status");



CREATE INDEX "idx_categories_slug" ON "public"."categories" USING "btree" ("slug");



CREATE INDEX "idx_comments_created_at" ON "public"."comments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_comments_video_id" ON "public"."comments" USING "btree" ("video_id");



CREATE INDEX "idx_featured_products_is_active" ON "public"."featured_products" USING "btree" ("is_active");



CREATE INDEX "idx_featured_products_shop_id" ON "public"."featured_products" USING "btree" ("shop_id");



CREATE INDEX "idx_khata_book_customers_shop_id" ON "public"."khata_book_customers" USING "btree" ("shop_id");



CREATE INDEX "idx_khata_book_customers_shop_status" ON "public"."khata_book_customers" USING "btree" ("shop_id", "status");



CREATE INDEX "idx_khata_book_payments_customer_id" ON "public"."khata_book_payments" USING "btree" ("customer_id");



CREATE INDEX "idx_khata_book_payments_payment_date" ON "public"."khata_book_payments" USING "btree" ("payment_date");



CREATE INDEX "idx_khata_book_payments_shop_id" ON "public"."khata_book_payments" USING "btree" ("shop_id");



CREATE INDEX "idx_native_devices_player_id" ON "public"."native_devices" USING "btree" ("player_id");



CREATE INDEX "idx_native_devices_user_id" ON "public"."native_devices" USING "btree" ("user_id");



CREATE INDEX "idx_native_devices_user_player" ON "public"."native_devices" USING "btree" ("user_id", "player_id");



CREATE INDEX "idx_native_shop_owners_player_id" ON "public"."native_shop_owners" USING "btree" ("player_id");



CREATE INDEX "idx_native_shop_owners_shop_id" ON "public"."native_shop_owners" USING "btree" ("shop_id");



CREATE INDEX "idx_native_shop_owners_user_id" ON "public"."native_shop_owners" USING "btree" ("user_id");



CREATE INDEX "idx_payments_order_id" ON "public"."payments" USING "btree" ("razorpay_order_id");



CREATE INDEX "idx_payments_payment_id" ON "public"."payments" USING "btree" ("razorpay_payment_id");



CREATE INDEX "idx_payments_status" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "idx_payments_user_id" ON "public"."payments" USING "btree" ("user_id");



CREATE INDEX "idx_plans_name" ON "public"."plans" USING "btree" ("name");



CREATE INDEX "idx_profile_chat_created_at" ON "public"."profile_chat_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_profile_chat_user_created" ON "public"."profile_chat_messages" USING "btree" ("profile_user_id", "created_at" DESC);



CREATE INDEX "idx_profile_chat_user_id" ON "public"."profile_chat_messages" USING "btree" ("profile_user_id");



CREATE INDEX "idx_review_replies_review_id" ON "public"."review_replies" USING "btree" ("review_id");



CREATE INDEX "idx_review_replies_shop_id" ON "public"."review_replies" USING "btree" ("shop_id");



CREATE INDEX "idx_reviews_created_at" ON "public"."reviews" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_reviews_shop_id" ON "public"."reviews" USING "btree" ("shop_id");



CREATE INDEX "idx_reviews_user_id" ON "public"."reviews" USING "btree" ("user_id");



CREATE INDEX "idx_scheduled_reminders_booking" ON "public"."scheduled_reminders" USING "btree" ("booking_id");



CREATE INDEX "idx_scheduled_reminders_pending" ON "public"."scheduled_reminders" USING "btree" ("sent", "scheduled_for") WHERE ("sent" = false);



CREATE INDEX "idx_scheduled_reminders_user" ON "public"."scheduled_reminders" USING "btree" ("user_id");



CREATE INDEX "idx_shop_customizations_shop_id" ON "public"."shop_customizations" USING "btree" ("shop_id");



CREATE INDEX "idx_shop_customizations_updated" ON "public"."shop_customizations" USING "btree" ("last_updated" DESC);



CREATE INDEX "idx_shop_owner_plans_email" ON "public"."shop_owner_plans" USING "btree" ("email");



CREATE INDEX "idx_shop_owner_plans_is_free" ON "public"."shop_owner_plans" USING "btree" ("is_free_plan");



CREATE INDEX "idx_shop_owner_plans_order_id" ON "public"."shop_owner_plans" USING "btree" ("razorpay_order_id");



CREATE INDEX "idx_shop_owner_plans_plan" ON "public"."shop_owner_plans" USING "btree" ("plan_name");



CREATE INDEX "idx_shop_owner_plans_status" ON "public"."shop_owner_plans" USING "btree" ("payment_status");



CREATE INDEX "idx_shop_owners_shop_id" ON "public"."shop_owners" USING "btree" ("shop_id");



CREATE INDEX "idx_shop_owners_user_id" ON "public"."shop_owners" USING "btree" ("user_id");



CREATE INDEX "idx_shop_websites_is_published" ON "public"."shop_websites" USING "btree" ("is_published");



CREATE INDEX "idx_shop_websites_netlify_id" ON "public"."shop_websites" USING "btree" ("vercel_deployment_id");



CREATE INDEX "idx_shop_websites_shop_id" ON "public"."shop_websites" USING "btree" ("shop_id");



CREATE INDEX "idx_shop_websites_shop_name" ON "public"."shop_websites" USING "btree" ("shop_name");



CREATE INDEX "idx_shops_category" ON "public"."shops" USING "btree" ("category");



CREATE INDEX "idx_shops_category_id" ON "public"."shops" USING "btree" ("category_id");



CREATE INDEX "idx_shops_is_pinned" ON "public"."shops" USING "btree" ("is_pinned" DESC, "pin_order");



CREATE INDEX "idx_shops_latitude_longitude" ON "public"."shops" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_temporary_chats_created_at" ON "public"."temporary_chats" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_temporary_chats_expires_at" ON "public"."temporary_chats" USING "btree" ("expires_at");



CREATE INDEX "idx_temporary_chats_shop_id" ON "public"."temporary_chats" USING "btree" ("shop_id");



CREATE INDEX "idx_temporary_chats_user_id" ON "public"."temporary_chats" USING "btree" ("user_id");



CREATE INDEX "idx_user_campaign_alerts_created_at" ON "public"."user_campaign_alerts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_campaign_alerts_expires_at" ON "public"."user_campaign_alerts" USING "btree" ("expires_at");



CREATE INDEX "idx_user_campaign_alerts_user_created" ON "public"."user_campaign_alerts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_campaign_alerts_user_id" ON "public"."user_campaign_alerts" USING "btree" ("user_id");



CREATE INDEX "idx_user_devices_email" ON "public"."user_devices" USING "btree" ("email");



CREATE INDEX "idx_user_devices_email_password" ON "public"."user_devices" USING "btree" ("email", "password");



CREATE INDEX "idx_user_devices_player_id" ON "public"."user_devices" USING "btree" ("player_id");



CREATE INDEX "idx_user_devices_user_id" ON "public"."user_devices" USING "btree" ("user_id");



CREATE INDEX "idx_user_devices_user_player" ON "public"."user_devices" USING "btree" ("user_id", "player_id");



CREATE INDEX "idx_user_messages_created_at" ON "public"."user_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_messages_is_read" ON "public"."user_messages" USING "btree" ("is_read");



CREATE INDEX "idx_user_messages_user_id" ON "public"."user_messages" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_profile_name_lower" ON "public"."user_profiles" USING "btree" ("lower"("profile_name"));



CREATE INDEX "idx_user_profiles_user_id" ON "public"."user_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_videos_created_at" ON "public"."videos" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_videos_liked_by_gin" ON "public"."videos" USING "gin" ("liked_by");



CREATE INDEX "idx_videos_uploader_id" ON "public"."videos" USING "btree" ("uploader_id");



CREATE INDEX "idx_videos_uploader_name_lower" ON "public"."videos" USING "btree" ("lower"("uploader_name"));



CREATE INDEX "idx_world_chat_created_at" ON "public"."world_chat_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_world_chat_expires_at" ON "public"."world_chat_messages" USING "btree" ("expires_at");



CREATE INDEX "shop_offers_is_active_idx" ON "public"."shop_offers" USING "btree" ("is_active");



CREATE INDEX "shop_offers_shop_id_active_valid_idx" ON "public"."shop_offers" USING "btree" ("shop_id", "is_active", "valid_until");



CREATE INDEX "shop_offers_shop_id_idx" ON "public"."shop_offers" USING "btree" ("shop_id");



CREATE INDEX "shop_offers_shop_id_is_active_idx" ON "public"."shop_offers" USING "btree" ("shop_id", "is_active");



CREATE INDEX "shop_offers_valid_until_idx" ON "public"."shop_offers" USING "btree" ("valid_until");



CREATE INDEX "shops_created_at_idx" ON "public"."shops" USING "btree" ("created_at" DESC);



CREATE INDEX "shops_display_status_idx" ON "public"."shops" USING "btree" ("display_status");



CREATE INDEX "shops_last_ping_time_idx" ON "public"."shops" USING "btree" ("last_ping_time" DESC NULLS LAST);



CREATE OR REPLACE TRIGGER "trigger_update_shop_rating_on_review_delete" AFTER DELETE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_shop_rating"();



CREATE OR REPLACE TRIGGER "trigger_update_shop_rating_on_review_insert" AFTER INSERT ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_shop_rating"();



CREATE OR REPLACE TRIGGER "trigger_update_shop_rating_on_review_update" AFTER UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_shop_rating"();



CREATE OR REPLACE TRIGGER "user_devices_update_timestamp" BEFORE UPDATE ON "public"."user_devices" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_devices_timestamp"();



ALTER TABLE ONLY "public"."campaign_analytics"
    ADD CONSTRAINT "campaign_analytics_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_logs"
    ADD CONSTRAINT "campaign_logs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_matched_users"
    ADD CONSTRAINT "campaign_matched_users_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_targets"
    ADD CONSTRAINT "campaign_targets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."featured_products"
    ADD CONSTRAINT "featured_products_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_offers"
    ADD CONSTRAINT "fk_shop_id" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."khata_book_customers"
    ADD CONSTRAINT "khata_book_customers_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."khata_book_payments"
    ADD CONSTRAINT "khata_book_payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."khata_book_customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."khata_book_payments"
    ADD CONSTRAINT "khata_book_payments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_websites"
    ADD CONSTRAINT "shop_websites_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."temporary_chats"
    ADD CONSTRAINT "temporary_chats_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_campaign_alerts"
    ADD CONSTRAINT "user_campaign_alerts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



CREATE POLICY "Allow all to read app_updates" ON "public"."app_updates" FOR SELECT USING (true);



CREATE POLICY "Allow anon inserts" ON "public"."shop_owners" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow anon reads" ON "public"."shop_owners" FOR SELECT USING (true);



CREATE POLICY "Allow anon updates" ON "public"."shop_owners" FOR UPDATE USING (true);



CREATE POLICY "Allow authenticated delete user profiles" ON "public"."user_profiles" FOR DELETE USING (true);



CREATE POLICY "Allow authenticated insert user profiles" ON "public"."user_profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow authenticated update user profiles" ON "public"."user_profiles" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to delete customizations" ON "public"."shop_customizations" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to insert campaign alerts" ON "public"."user_campaign_alerts" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to insert customizations" ON "public"."shop_customizations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to update customizations" ON "public"."shop_customizations" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Allow public insert" ON "public"."bookings" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read access" ON "public"."bookings" FOR SELECT USING (true);



CREATE POLICY "Allow public read user profiles" ON "public"."user_profiles" FOR SELECT USING (true);



CREATE POLICY "Allow public update" ON "public"."bookings" FOR UPDATE USING (true);



CREATE POLICY "Allow users to delete their own alerts" ON "public"."user_campaign_alerts" FOR DELETE USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Anyone can insert profile chat messages" ON "public"."profile_chat_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert temporary chats" ON "public"."temporary_chats" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert world chat messages" ON "public"."world_chat_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view active featured products" ON "public"."featured_products" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active shop offers" ON "public"."shop_offers" FOR SELECT USING ((("is_active" = true) AND ("valid_until" > "now"())));



CREATE POLICY "Anyone can view profile chat messages" ON "public"."profile_chat_messages" FOR SELECT USING (true);



CREATE POLICY "Anyone can view shop customizations" ON "public"."shop_customizations" FOR SELECT USING (true);



CREATE POLICY "Anyone can view temporary chats for a shop" ON "public"."temporary_chats" FOR SELECT USING (("expires_at" > "now"()));



CREATE POLICY "Anyone can view world chat messages" ON "public"."world_chat_messages" FOR SELECT USING (("expires_at" > "now"()));



CREATE POLICY "Enable insert access for all" ON "public"."user_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable read access for all" ON "public"."user_messages" FOR SELECT USING (true);



CREATE POLICY "Enable update access for all" ON "public"."user_messages" FOR UPDATE USING (true);



CREATE POLICY "Plans are publicly readable" ON "public"."plans" FOR SELECT USING (true);



CREATE POLICY "Public access for server" ON "public"."users" USING (true) WITH CHECK (true);



CREATE POLICY "Public full access to app_updates table" ON "public"."app_updates" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage campaign logs" ON "public"."campaign_logs" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage matched users" ON "public"."campaign_matched_users" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage native devices" ON "public"."native_devices" USING (true);



CREATE POLICY "Shop owner can manage their featured products" ON "public"."featured_products" USING (("shop_id" IN ( SELECT "shops"."id"
   FROM "public"."shops"
  WHERE ("shops"."owner_email" = "auth"."email"()))));



CREATE POLICY "Shop owners can create campaigns" ON "public"."campaigns" FOR INSERT WITH CHECK (("shop_id" = ("auth"."uid"())::"text"));



CREATE POLICY "Shop owners can create offers" ON "public"."shop_offers" FOR INSERT WITH CHECK (("shop_id" IN ( SELECT "shop_owners"."shop_id"
   FROM "public"."shop_owners"
  WHERE ("shop_owners"."user_id" = ("auth"."uid"())::"text"))));



CREATE POLICY "Shop owners can delete their own campaigns" ON "public"."campaigns" FOR DELETE USING (("shop_id" = ("auth"."uid"())::"text"));



CREATE POLICY "Shop owners can delete their own offers" ON "public"."shop_offers" FOR DELETE USING (("shop_id" IN ( SELECT "shop_owners"."shop_id"
   FROM "public"."shop_owners"
  WHERE ("shop_owners"."user_id" = ("auth"."uid"())::"text"))));



CREATE POLICY "Shop owners can update their own campaigns" ON "public"."campaigns" FOR UPDATE USING (("shop_id" = ("auth"."uid"())::"text"));



CREATE POLICY "Shop owners can update their own offers" ON "public"."shop_offers" FOR UPDATE USING (("shop_id" IN ( SELECT "shop_owners"."shop_id"
   FROM "public"."shop_owners"
  WHERE ("shop_owners"."user_id" = ("auth"."uid"())::"text")))) WITH CHECK (("shop_id" IN ( SELECT "shop_owners"."shop_id"
   FROM "public"."shop_owners"
  WHERE ("shop_owners"."user_id" = ("auth"."uid"())::"text"))));



CREATE POLICY "Shop owners can view their own campaigns" ON "public"."campaigns" FOR SELECT USING (("shop_id" = ("auth"."uid"())::"text"));



CREATE POLICY "Shop owners can view their own offers" ON "public"."shop_offers" FOR SELECT USING (("shop_id" IN ( SELECT "shop_owners"."shop_id"
   FROM "public"."shop_owners"
  WHERE ("shop_owners"."user_id" = ("auth"."uid"())::"text"))));



CREATE POLICY "System can update payments" ON "public"."payments" FOR UPDATE USING (true);



CREATE POLICY "Users can create targets for their campaigns" ON "public"."campaign_targets" FOR INSERT WITH CHECK (("campaign_id" IN ( SELECT "campaigns"."id"
   FROM "public"."campaigns"
  WHERE ("campaigns"."shop_id" = ("auth"."uid"())::"text"))));



CREATE POLICY "Users can insert payments" ON "public"."payments" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can insert their own device records" ON "public"."user_devices" FOR INSERT WITH CHECK (("user_id" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can insert their own shop owner records" ON "public"."shop_owners" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can read their own device records" ON "public"."user_devices" FOR SELECT USING (("user_id" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can update their own campaign alerts" ON "public"."user_campaign_alerts" FOR UPDATE USING ((("auth"."uid"())::"text" = "user_id")) WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can update their own device records" ON "public"."user_devices" FOR UPDATE USING (("user_id" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can update their own shop owner records" ON "public"."shop_owners" FOR UPDATE USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can view analytics for their campaigns" ON "public"."campaign_analytics" FOR SELECT USING (("campaign_id" IN ( SELECT "campaigns"."id"
   FROM "public"."campaigns"
  WHERE ("campaigns"."shop_id" = ("auth"."uid"())::"text"))));



CREATE POLICY "Users can view campaign targets for their campaigns" ON "public"."campaign_targets" FOR SELECT USING (("campaign_id" IN ( SELECT "campaigns"."id"
   FROM "public"."campaigns"
  WHERE ("campaigns"."shop_id" = ("auth"."uid"())::"text"))));



CREATE POLICY "Users can view campaigns that targeted them" ON "public"."campaign_matched_users" FOR SELECT USING (("user_id" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can view own payments" ON "public"."payments" FOR SELECT USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can view their own campaign alerts" ON "public"."user_campaign_alerts" FOR SELECT USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can view their own shop owner records" ON "public"."shop_owners" FOR SELECT USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "alert_reminders_delete_policy" ON "public"."alert_reminders" FOR DELETE USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "alert_reminders_insert_policy" ON "public"."alert_reminders" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "alert_reminders_select_policy" ON "public"."alert_reminders" FOR SELECT USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "alert_reminders_service_role_policy" ON "public"."alert_reminders" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "alert_reminders_update_policy" ON "public"."alert_reminders" FOR UPDATE USING ((("auth"."uid"())::"text" = "user_id")) WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "allow_all_delete" ON "public"."videos" FOR DELETE USING (true);



CREATE POLICY "allow_all_insert" ON "public"."videos" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_all_read" ON "public"."videos" FOR SELECT USING (true);



CREATE POLICY "allow_all_update" ON "public"."videos" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "anyone_view_published" ON "public"."shop_websites" FOR SELECT USING (("is_published" = true));



ALTER TABLE "public"."app_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bypass_all" ON "public"."shop_websites" USING (true) WITH CHECK (true);



ALTER TABLE "public"."campaign_matched_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete_all" ON "public"."shops" FOR DELETE USING (true);



CREATE POLICY "insert_all" ON "public"."shops" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."native_devices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read_all" ON "public"."shops" FOR SELECT USING (true);



CREATE POLICY "review_replies_delete_any" ON "public"."review_replies" FOR DELETE USING (true);



CREATE POLICY "review_replies_insert_any" ON "public"."review_replies" FOR INSERT WITH CHECK (true);



CREATE POLICY "review_replies_read_public" ON "public"."review_replies" FOR SELECT USING (true);



CREATE POLICY "review_replies_update_any" ON "public"."review_replies" FOR UPDATE USING (true);



CREATE POLICY "reviews_delete_own" ON "public"."reviews" FOR DELETE USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "reviews_insert_own" ON "public"."reviews" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "reviews_read_public" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "reviews_update_own" ON "public"."reviews" FOR UPDATE USING ((("auth"."uid"())::"text" = "user_id"));



ALTER TABLE "public"."shop_websites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shops" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shops_allow_delete" ON "public"."shops" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "shops_allow_insert" ON "public"."shops" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "shops_allow_read_all" ON "public"."shops" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "shops_allow_update" ON "public"."shops" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."temporary_chats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update_all" ON "public"."shops" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "public"."user_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."videos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."world_chat_messages" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";












GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_shop_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_shop_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_shop_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_chats"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_chats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_chats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_world_chats"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_world_chats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_world_chats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_today_bookings"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_today_bookings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_today_bookings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shop_chats"("p_shop_id" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_shop_chats"("p_shop_id" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shop_chats"("p_shop_id" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "postgres";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "anon";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "postgres";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "postgres";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_shop_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_shop_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shop_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_devices_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_devices_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_devices_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "service_role";
























GRANT ALL ON TABLE "public"."alert_reminders" TO "anon";
GRANT ALL ON TABLE "public"."alert_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."alert_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."app_updates" TO "anon";
GRANT ALL ON TABLE "public"."app_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."app_updates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."app_updates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."app_updates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."app_updates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_analytics" TO "anon";
GRANT ALL ON TABLE "public"."campaign_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_logs" TO "anon";
GRANT ALL ON TABLE "public"."campaign_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_logs" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_matched_users" TO "anon";
GRANT ALL ON TABLE "public"."campaign_matched_users" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_matched_users" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_targets" TO "anon";
GRANT ALL ON TABLE "public"."campaign_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_targets" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."featured_products" TO "anon";
GRANT ALL ON TABLE "public"."featured_products" TO "authenticated";
GRANT ALL ON TABLE "public"."featured_products" TO "service_role";



GRANT ALL ON TABLE "public"."khata_book_customers" TO "anon";
GRANT ALL ON TABLE "public"."khata_book_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."khata_book_customers" TO "service_role";



GRANT ALL ON TABLE "public"."khata_book_payments" TO "anon";
GRANT ALL ON TABLE "public"."khata_book_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."khata_book_payments" TO "service_role";



GRANT ALL ON TABLE "public"."native_devices" TO "anon";
GRANT ALL ON TABLE "public"."native_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."native_devices" TO "service_role";



GRANT ALL ON TABLE "public"."native_shop_owners" TO "anon";
GRANT ALL ON TABLE "public"."native_shop_owners" TO "authenticated";
GRANT ALL ON TABLE "public"."native_shop_owners" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."profile_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."profile_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."review_replies" TO "anon";
GRANT ALL ON TABLE "public"."review_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."review_replies" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_reminders" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."shop_customizations" TO "anon";
GRANT ALL ON TABLE "public"."shop_customizations" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_customizations" TO "service_role";



GRANT ALL ON TABLE "public"."shop_offers" TO "anon";
GRANT ALL ON TABLE "public"."shop_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_offers" TO "service_role";



GRANT ALL ON TABLE "public"."shop_owner_plans" TO "anon";
GRANT ALL ON TABLE "public"."shop_owner_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_owner_plans" TO "service_role";



GRANT ALL ON TABLE "public"."shop_owners" TO "anon";
GRANT ALL ON TABLE "public"."shop_owners" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_owners" TO "service_role";



GRANT ALL ON TABLE "public"."shop_websites" TO "anon";
GRANT ALL ON TABLE "public"."shop_websites" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_websites" TO "service_role";



GRANT ALL ON TABLE "public"."shops" TO "anon";
GRANT ALL ON TABLE "public"."shops" TO "authenticated";
GRANT ALL ON TABLE "public"."shops" TO "service_role";



GRANT ALL ON TABLE "public"."temporary_chats" TO "anon";
GRANT ALL ON TABLE "public"."temporary_chats" TO "authenticated";
GRANT ALL ON TABLE "public"."temporary_chats" TO "service_role";



GRANT ALL ON TABLE "public"."user_campaign_alerts" TO "anon";
GRANT ALL ON TABLE "public"."user_campaign_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_campaign_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."user_devices" TO "anon";
GRANT ALL ON TABLE "public"."user_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."user_devices" TO "service_role";



GRANT ALL ON TABLE "public"."user_messages" TO "anon";
GRANT ALL ON TABLE "public"."user_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."user_messages" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."videos" TO "anon";
GRANT ALL ON TABLE "public"."videos" TO "authenticated";
GRANT ALL ON TABLE "public"."videos" TO "service_role";



GRANT ALL ON TABLE "public"."world_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."world_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."world_chat_messages" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































