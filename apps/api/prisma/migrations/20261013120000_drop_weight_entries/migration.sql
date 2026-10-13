-- Refuse to drop the deprecated table while any weigh-in has no matching WEIGHT measurement.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "weight_entries" w
    WHERE NOT EXISTS (
      SELECT 1 FROM "measurements" m
      WHERE m."user_id" = w."user_id" AND m."kind" = 'WEIGHT' AND m."local_date" = w."local_date"
    )
  ) THEN
    RAISE EXCEPTION 'weight_entries has rows with no matching WEIGHT measurement (user_id, local_date) — refusing to drop';
  END IF;
END $$;

-- DropTable
DROP TABLE "weight_entries";
