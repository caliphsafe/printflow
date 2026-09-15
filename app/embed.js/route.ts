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
    frame.style.cssText='display:block;width:100%;height:1200px;min-height:0;border:0;background:transparent;overflow:hidden;';

    current.parentNode.insertBefore(frame,current.nextSibling);

    var view='products';
    var lastContentHeight=1200;
    var lastAppliedHeight=1200;
    var pendingHeight=0;
    var raf=0;
    var desktop=window.matchMedia('(min-width:1041px)');

    function viewportHeight(){
      var visual=window.visualViewport&&window.visualViewport.height;
      var available=Number(visual||window.innerHeight||900);
      return Math.max(640,Math.min(900,Math.floor(available-120)));
    }

    function fixedCustomizer(){
      return view==='customize'&&desktop.matches;
    }

    function setHeight(next){
      next=Math.ceil(Number(next)||0);
      if(!Number.isFinite(next)||next<=0)return;

      next=Math.max(620,Math.min(next,16000));

      if(Math.abs(next-lastAppliedHeight)<3)return;

      lastAppliedHeight=next;
      frame.style.height=next+'px';
    }

    function applyMode(){
      if(fixedCustomizer()){
        frame.setAttribute('scrolling','no');
        frame.style.overflow='hidden';
        setHeight(viewportHeight());
        return;
      }

      frame.setAttribute('scrolling','no');
      frame.style.overflow='hidden';
      setHeight(lastContentHeight||1200);
    }

    function commitHeight(){
      raf=0;

      if(fixedCustomizer())return;

      var next=Math.ceil(Number(pendingHeight)||0);
      if(!Number.isFinite(next)||next<=0)return;

      lastContentHeight=Math.max(620,Math.min(next,16000));
      applyMode();
    }

    window.addEventListener('message',function(event){
      if(event.origin!=='${appUrl}'||event.source!==frame.contentWindow||!event.data)return;

      if(event.data.type==='printflow:view'){
        if(event.data.view==='products'||event.data.view==='customize'){
          view=event.data.view;
        }

        var reported=Math.ceil(Number(event.data.height)||0);
        if(reported>0&&!fixedCustomizer()){
          lastContentHeight=Math.max(620,Math.min(reported,16000));
        }

        applyMode();
        return;
      }

      if(event.data.type!=='printflow:resize')return;

      pendingHeight=event.data.height;

      if(fixedCustomizer())return;
      if(raf)return;

      raf=requestAnimationFrame(commitHeight);
    });

    window.addEventListener('resize',applyMode);

    if(desktop.addEventListener){
      desktop.addEventListener('change',applyMode);
    }else if(desktop.addListener){
      desktop.addListener(applyMode);
    }
  })();`;

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
