import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { makeDesignDisplayId } from "@/lib/design-id";
import { legacyProductFromSettings, normalizeConfiguration } from "@/lib/catalog";
import { normalizeShopSettings } from "@/lib/shop-settings";
import type { CatalogProduct, SizeQuantity } from "@/lib/types";

type Payload={shopSlug:string;customer:{name:string;email:string;phone?:string};configuration:{productId:string;packageId:string;colorId:string;printLocation:string;sizes:SizeQuantity[];notes?:string};artwork:{filename:string;mimeType:string;sizeBytes:number}};
function jsonError(error:string,status=400){return NextResponse.json({error},{status});}
function safeExtension(filename:string){const ext=filename.split('.').pop()?.toLowerCase()||'bin';return /^[a-z0-9]{1,8}$/.test(ext)?ext:'bin';}
export async function POST(request:Request){try{
 const payload=(await request.json()) as Payload; const supabase=createSupabaseAdmin();
 const {data:shop}=await supabase.from('shops').select('*').eq('slug',payload.shopSlug).eq('active',true).single(); if(!shop)return jsonError('Shop not found.',404);
 const settings=normalizeShopSettings(shop.settings);
 const {data:rows}=await supabase.from('catalog_products').select('id,slug,name,description,active,configuration').eq('shop_id',shop.id).eq('active',true);
 const products:CatalogProduct[]=(rows||[]).map((r:any)=>({...r,configuration:normalizeConfiguration(r.configuration)})); if(!products.length)products.push(legacyProductFromSettings(settings));
 const activeProduct=products.find(x=>x.id===payload.configuration.productId); if(!activeProduct)return jsonError('Product is unavailable.');
 const selectedPackage=activeProduct.configuration.packages.find(x=>x.id===payload.configuration.packageId); const selectedColor=activeProduct.configuration.colors.find(x=>x.id===payload.configuration.colorId);
 if(!selectedPackage||!selectedColor)return jsonError('Selected product option is unavailable.'); if(!activeProduct.configuration.printLocations.includes(payload.configuration.printLocation))return jsonError('Print location is unavailable.');
 const sizes=Array.isArray(payload.configuration.sizes)?payload.configuration.sizes:[]; const total=sizes.reduce((sum,x)=>sum+Math.max(0,Number(x.quantity||0)),0); if(total!==selectedPackage.quantity)return jsonError(`Size quantities must total ${selectedPackage.quantity}.`);
 if(!payload.customer?.name?.trim()||!payload.customer?.email?.trim())return jsonError('Customer name and email are required.');
 if(payload.artwork.sizeBytes<=0||payload.artwork.sizeBytes>settings.upload.maxBytes)return jsonError('Artwork file is larger than this shop allows.'); if(!settings.upload.acceptedTypes.includes(payload.artwork.mimeType))return jsonError('Artwork file type is not accepted.');
 const supplierItems:any[]=[]; const supplier=activeProduct.configuration.supplier;
 if(supplier){
  for(const size of sizes.filter(x=>Number(x.quantity)>0)){const variant=supplier.variants.find(v=>v.colorName===selectedColor.name&&v.sizeName===size.size&&v.active!==false);if(!variant)return jsonError(`${selectedColor.name} / ${size.size} is unavailable from ${supplier.supplierName||supplier.provider}.`);supplierItems.push({provider:supplier.provider,supplierName:supplier.supplierName||supplier.provider,sourceMode:supplier.sourceMode||'live',sku:variant.sku,skuId:variant.skuId,gtin:variant.gtin,brandName:supplier.brandName,styleName:supplier.styleName,colorName:variant.colorName,sizeName:variant.sizeName,quantity:Number(size.quantity),unitCost:variant.customerPrice,inventorySnapshot:variant.quantity});}
 }
 const displayId=makeDesignDisplayId(); const originalPath=`${shop.id}/${displayId}/original.${safeExtension(payload.artwork.filename)}`; const previewPath=`${shop.id}/${displayId}/preview.png`;
 const {data:design,error:designError}=await supabase.from('designs').insert({organization_id:shop.organization_id,shop_id:shop.id,display_id:displayId,status:'draft',customer_name:payload.customer.name.trim(),customer_email:payload.customer.email.trim().toLowerCase(),customer_phone:payload.customer.phone?.trim()||null,catalog_product_id:activeProduct.id==='legacy-product'?null:activeProduct.id,product_name:activeProduct.name,package_id:selectedPackage.id,package_label:selectedPackage.label,package_quantity:selectedPackage.quantity,package_price:selectedPackage.price,shirt_color_id:selectedColor.id,shirt_color_name:selectedColor.name,print_location:payload.configuration.printLocation,size_breakdown:sizes,supplier_items:supplierItems,customer_notes:payload.configuration.notes?.trim()||null,original_artwork_path:originalPath,preview_path:previewPath,original_filename:payload.artwork.filename,original_mime_type:payload.artwork.mimeType,checkout_url:selectedPackage.checkoutUrl}).select('id,display_id').single();
 if(designError||!design)return jsonError(designError?.message||'Unable to create design session.',500);
 const [originalUpload,previewUpload]=await Promise.all([supabase.storage.from('artwork').createSignedUploadUrl(originalPath),supabase.storage.from('previews').createSignedUploadUrl(previewPath)]);if(originalUpload.error||previewUpload.error)return jsonError('Unable to prepare secure uploads.',500);
 return NextResponse.json({designId:design.id,displayId:design.display_id,uploads:{original:{bucket:'artwork',path:originalPath,token:originalUpload.data.token},preview:{bucket:'previews',path:previewPath,token:previewUpload.data.token}}});
 }catch(error){return jsonError(error instanceof Error?error.message:'Unexpected error.',500);}}
