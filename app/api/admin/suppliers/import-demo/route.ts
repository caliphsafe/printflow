import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { DEFAULT_CONFIGURATION, slugify } from "@/lib/catalog";
export async function POST(request:Request){
 const {supabase,membership,shop}=await getAdminContext(); if(!membership||!shop)return NextResponse.json({error:'No shop configured.'},{status:403});
 const body=await request.json(); const styleId=String(body.styleId||''); const selectedColors=new Set(Array.isArray(body.selectedColors)?body.selectedColors.map(String):[]);
 const {data:style,error}=await supabase.from('supplier_catalog_styles').select('*,supplier_catalog_variants(*)').eq('id',styleId).single();
 if(error||!style)return NextResponse.json({error:'Supplier style not found.'},{status:404});
 const variants=(style.supplier_catalog_variants||[]).filter((v:any)=>selectedColors.has(String(v.color_name)));
 if(!variants.length)return NextResponse.json({error:'Select at least one color.'},{status:400});
 const colors=Array.from(new Map(variants.map((v:any)=>[v.color_name,{id:slugify(v.color_name),name:v.color_name,hex:v.color_hex||'#777777',frontImageUrl:v.image_front_url||style.image_front_url,backImageUrl:v.image_back_url||style.image_back_url,swatchImageUrl:v.swatch_image_url||undefined,active:true}])).values());
 const sizes=Array.from(new Set(variants.map((v:any)=>String(v.size_name))));
 const supplierVariants=variants.map((v:any)=>({sku:String(v.sku),skuId:v.external_variant_id||undefined,gtin:v.gtin||undefined,colorName:String(v.color_name),sizeName:String(v.size_name),customerPrice:Number(v.wholesale_price||0),quantity:Number(v.inventory_quantity||0),active:true}));
 let slug=slugify(`${style.brand_name}-${style.style_name}`),base=slug,n=2; while((await supabase.from('catalog_products').select('id').eq('shop_id',shop.id).eq('slug',slug).maybeSingle()).data)slug=`${base}-${n++}`;
 const configuration={...DEFAULT_CONFIGURATION,sizes,colors,mockupImageUrl:style.image_front_url,supplier:{provider:String(style.provider),supplierName:String(style.supplier_name),styleId:String(style.external_style_id),brandName:String(style.brand_name),styleName:String(style.style_name),partNumber:style.part_number||undefined,importedAt:new Date().toISOString(),sourceMode:style.source_mode,variants:supplierVariants}};
 const {data,error:insertError}=await supabase.from('catalog_products').insert({organization_id:membership.organization_id,shop_id:shop.id,slug,name:`${style.brand_name} ${style.style_name}`,description:style.description||style.title,active:true,configuration}).select('*').single();
 if(insertError)return NextResponse.json({error:insertError.message},{status:400}); return NextResponse.json({product:data});
}
