export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const script = `(function(){
    var current=document.currentScript;
    var shop=current&&current.dataset.shop;
    if(!shop){console.error('PrintFlow: missing data-shop');return;}
    var frame=document.createElement('iframe');
    frame.src='${appUrl}/s/'+encodeURIComponent(shop);
    frame.title='Custom apparel designer';
    frame.style.cssText='display:block;width:100%;min-height:1200px;border:0;background:transparent;';
    current.parentNode.insertBefore(frame,current.nextSibling);
    window.addEventListener('message',function(event){
      if(event.origin!=='${appUrl}'||!event.data||event.data.type!=='printflow:resize')return;
      frame.style.height=Math.max(800,Number(event.data.height)||1200)+'px';
    });
  })();`;
  return new Response(script,{headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'public, max-age=300'}});
}
