DROP FUNCTION IF EXISTS public.get_image_generation_quota(uuid);
DROP FUNCTION IF EXISTS public.consume_image_generation_quota(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.release_image_generation_quota(uuid);
DROP TABLE IF EXISTS image_generation_usage;
