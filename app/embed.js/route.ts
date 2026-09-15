export async function GET(request: Request) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  const script = `(function(){
    var current=document.currentScript;
    var shop=current&&current.dataset.shop;

    if(!shop){
      console.error('PrintFlow: missing data-shop');
      return;
    }

    var frame=document.createElement('iframe');
    var src=new URL('${appUrl}/s/'+encodeURIComponent(shop));
    src.searchParams.set('embed','1');

    frame.src=src.toString();
    frame.title='Custom apparel designer';
    frame.setAttribute('scrolling','no');
    frame.style.cssText='display:block;width:100%;height:1200px;min-height:900px;border:0;background:transparent;overflow:hidden;';

    current.parentNode.insertBefore(frame,current.nextSibling);

    var lastHeight=1200;
    var pendingHeight=0;
    var raf=0;

    function commitHeight(){
      raf=0;
      var next=Math.ceil(Number(pendingHeight)||0);
      if(!Number.isFinite(next)||next<=0)return;

      next=Math.max(800,Math.min(next,16000));

      if(Math.abs(next-lastHeight)<3)return;

      lastHeight=next;
      frame.style.height=next+'px';
    }

    window.addEventListener('message',function(event){
      if(event.origin!=='${appUrl}'||event.source!==frame.contentWindow||!event.data||event.data.type!=='printflow:resize')return;

      pendingHeight=event.data.height;

      if(raf)return;
      raf=requestAnimationFrame(commitHeight);
    });
  })();`;

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
