/* RUN ONCE AFTER THE COMMERCE FOUNDATION IF THE ESPIRITO SANTO STOREFRONT IS NOT YET SEEDED.
   This seed contains only the products/prices visible on the current public multi-step Wix form.
   Add any additional hidden-step uniform items before final cutover. */

DO $$
DECLARE
  v_org uuid := 'decf4fd9-fbf7-48dc-a447-0234e73e991e';
  v_shop uuid := '1fb2131a-3e33-4986-a66b-de70ea6c7b6b';
  v_storefront uuid;
BEGIN
  INSERT INTO public.storefronts (organization_id,shop_id,name,slug,storefront_type,description,active,settings)
  VALUES (v_org,v_shop,'Uniform Order Form – Espirito Santo School','espirito-santo','school','Approved Espirito Santo School uniforms. Tops include the school logo on the left chest unless otherwise noted.',true,
    jsonb_build_object('languages',jsonb_build_array('en','pt'),'logoPlacement','left_chest','adultExtendedSizes','contact'))
  ON CONFLICT (shop_id,slug) DO UPDATE SET name=excluded.name,description=excluded.description,active=true,settings=excluded.settings,updated_at=now()
  RETURNING id INTO v_storefront;

  IF v_storefront IS NULL THEN SELECT id INTO v_storefront FROM public.storefronts WHERE shop_id=v_shop AND slug='espirito-santo'; END IF;

  INSERT INTO public.catalog_products (organization_id,shop_id,slug,name,description,active,configuration)
  VALUES
  (v_org,v_shop,'espirito-youth-red-short-polo','Espirito Santo Youth Short Sleeve Polo','Port Authority Y500 · Red · school logo left chest',true,'{"sizes":["XS","S","M","L","XL"],"colors":[{"id":"red","name":"Red","hex":"#b51e2e","active":true}],"defaultColorId":"red","manualUnitCost":0,"printLocations":["Left Chest"],"customization":{"category":"School Uniform","decorationMethods":["Embroidery"],"minimumQuantity":1}}'::jsonb),
  (v_org,v_shop,'espirito-adult-red-short-polo','Espirito Santo Adult Short Sleeve Polo','Port Authority K500 · Red · school logo left chest',true,'{"sizes":["S","M","L","XL"],"colors":[{"id":"red","name":"Red","hex":"#b51e2e","active":true}],"defaultColorId":"red","manualUnitCost":0,"printLocations":["Left Chest"],"customization":{"category":"School Uniform","decorationMethods":["Embroidery"],"minimumQuantity":1}}'::jsonb),
  (v_org,v_shop,'espirito-youth-red-long-polo','Espirito Santo Youth Long Sleeve Polo','Port Authority Y500LS · Red · school logo left chest',true,'{"sizes":["XS","S","M","L","XL"],"colors":[{"id":"red","name":"Red","hex":"#b51e2e","active":true}],"defaultColorId":"red","manualUnitCost":0,"printLocations":["Left Chest"],"customization":{"category":"School Uniform","decorationMethods":["Embroidery"],"minimumQuantity":1}}'::jsonb),
  (v_org,v_shop,'espirito-adult-red-long-polo','Espirito Santo Adult Long Sleeve Polo','Port Authority K500LS · Red · school logo left chest',true,'{"sizes":["S","M","L","XL"],"colors":[{"id":"red","name":"Red","hex":"#b51e2e","active":true}],"defaultColorId":"red","manualUnitCost":0,"printLocations":["Left Chest"],"customization":{"category":"School Uniform","decorationMethods":["Embroidery"],"minimumQuantity":1}}'::jsonb),
  (v_org,v_shop,'espirito-youth-navy-tee','Espirito Santo Youth Short Sleeve T-Shirt','Jerzees 29B · Navy · school logo left chest',true,'{"sizes":["XS","S","M","L","XL"],"colors":[{"id":"navy","name":"Navy","hex":"#162947","active":true}],"defaultColorId":"navy","manualUnitCost":0,"printLocations":["Left Chest"],"customization":{"category":"School Uniform","decorationMethods":["Screen Print"],"minimumQuantity":1}}'::jsonb),
  (v_org,v_shop,'espirito-adult-navy-tee','Espirito Santo Adult Short Sleeve T-Shirt','Jerzees 29M · Navy · school logo left chest',true,'{"sizes":["S","M","L","XL"],"colors":[{"id":"navy","name":"Navy","hex":"#162947","active":true}],"defaultColorId":"navy","manualUnitCost":0,"printLocations":["Left Chest"],"customization":{"category":"School Uniform","decorationMethods":["Screen Print"],"minimumQuantity":1}}'::jsonb)
  ON CONFLICT (shop_id,slug) DO UPDATE SET name=excluded.name,description=excluded.description,active=true,configuration=excluded.configuration,updated_at=now();

  INSERT INTO public.storefront_products (organization_id,shop_id,storefront_id,catalog_product_id,name_override,description_override,price,configuration,active,sort_order)
  SELECT v_org,v_shop,v_storefront,p.id,
    CASE p.slug
      WHEN 'espirito-youth-red-short-polo' THEN 'Short Sleeve Polo – Red – Youth'
      WHEN 'espirito-adult-red-short-polo' THEN 'Short Sleeve Polo – Red – Adult'
      WHEN 'espirito-youth-red-long-polo' THEN 'Long Sleeve Polo – Red – Youth'
      WHEN 'espirito-adult-red-long-polo' THEN 'Long Sleeve Polo – Red – Adult'
      WHEN 'espirito-youth-navy-tee' THEN 'Short Sleeve T-Shirt – Navy – Youth'
      ELSE 'Short Sleeve T-Shirt – Navy – Adult' END,
    p.description,
    CASE p.slug
      WHEN 'espirito-youth-red-short-polo' THEN 23
      WHEN 'espirito-adult-red-short-polo' THEN 25
      WHEN 'espirito-youth-red-long-polo' THEN 27
      WHEN 'espirito-adult-red-long-polo' THEN 29
      WHEN 'espirito-youth-navy-tee' THEN 14
      ELSE 16 END,
    jsonb_build_object('locked',true,'schoolLogo',true,'logoPlacement','left_chest','sizes',p.configuration->'sizes'),true,
    CASE p.slug WHEN 'espirito-youth-red-short-polo' THEN 10 WHEN 'espirito-adult-red-short-polo' THEN 20 WHEN 'espirito-youth-red-long-polo' THEN 30 WHEN 'espirito-adult-red-long-polo' THEN 40 WHEN 'espirito-youth-navy-tee' THEN 50 ELSE 60 END
  FROM public.catalog_products p
  WHERE p.shop_id=v_shop AND p.slug IN ('espirito-youth-red-short-polo','espirito-adult-red-short-polo','espirito-youth-red-long-polo','espirito-adult-red-long-polo','espirito-youth-navy-tee','espirito-adult-navy-tee')
  ON CONFLICT (storefront_id,catalog_product_id) DO UPDATE SET name_override=excluded.name_override,description_override=excluded.description_override,price=excluded.price,configuration=excluded.configuration,active=true,sort_order=excluded.sort_order,updated_at=now();
END $$;
