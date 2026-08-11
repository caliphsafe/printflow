-- PrintFlow product configuration data repair
-- No schema change is required because catalog_products.configuration is JSON/JSONB.
-- This backfills defaultColorId and synchronizes mockupImageUrl for existing products.

update catalog_products
set configuration =
  jsonb_set(
    jsonb_set(
      configuration::jsonb,
      '{defaultColorId}',
      to_jsonb(
        coalesce(
          (
            select c->>'id'
            from jsonb_array_elements(configuration::jsonb->'colors') with ordinality as color_rows(c, ordinality)
            where coalesce((c->>'active')::boolean, true) = true
            order by ordinality
            limit 1
          ),
          configuration::jsonb->'colors'->0->>'id'
        )
      ),
      true
    ),
    '{mockupImageUrl}',
    to_jsonb(
      coalesce(
        (
          select nullif(c->>'frontImageUrl', '')
          from jsonb_array_elements(configuration::jsonb->'colors') with ordinality as color_rows(c, ordinality)
          where coalesce((c->>'active')::boolean, true) = true
          order by ordinality
          limit 1
        ),
        ''
      )
    ),
    true
  )
where jsonb_typeof(configuration::jsonb->'colors') = 'array'
  and jsonb_array_length(configuration::jsonb->'colors') > 0;
