export async function GET(request: Request) {
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  ).replace(/\/+$/, "");

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
    frame.loading='eager';
    frame.setAttribute('fetchpriority','high');
    frame.setAttribute('scrolling','no');
    frame.style.cssText='display:block;width:100%;height:900px;min-height:0;border:0;background:transparent;overflow:hidden;';

    if(!current.parentNode){
      console.error('PrintFlow: embed script needs a parent element');
      return;
    }

    current.parentNode.insertBefore(frame,current.nextSibling);

    var printflowOrigin=new URL('${appUrl}').origin;
    var activePage='';
    var lastAppliedHeight=900;
    var resizeFrame=0;

    function normalizedHeight(value){
      var next=Math.ceil(Number(value)||0);
      if(!Number.isFinite(next)||next<=0)return 0;
      return Math.max(1,Math.min(next,18000));
    }

    function setHeight(value){
      var next=normalizedHeight(value);
      if(!next||Math.abs(next-lastAppliedHeight)<2)return;
      lastAppliedHeight=next;
      frame.style.height=next+'px';
    }

    function stickyHeaderOffset(){
      var configured=current.getAttribute('data-scroll-offset');
      if(configured!==null&&configured!==''){
        var explicit=Number(configured);
        if(Number.isFinite(explicit))return Math.max(0,explicit);
      }

      var offset=0;
      var candidates=document.querySelectorAll('header,nav,[role="banner"],[data-printflow-sticky-header]');
      candidates.forEach(function(element){
        var style=window.getComputedStyle(element);
        var rect=element.getBoundingClientRect();
        if((style.position==='fixed'||style.position==='sticky')&&rect.top<=1&&rect.bottom>0){
          offset=Math.max(offset,rect.bottom);
        }
      });
      return offset?Math.ceil(offset+8):0;
    }

    function scrollFrameToTop(){
      var offset=stickyHeaderOffset();
      var top=window.scrollY+frame.getBoundingClientRect().top-offset;
      window.scrollTo(0,Math.max(0,top));
    }

    window.addEventListener('message',function(event){
      if(event.origin!==printflowOrigin||event.source!==frame.contentWindow||!event.data)return;

      var data=event.data;
      if(data.type==='printflow:page'){
        var nextPage=typeof data.page==='string'?data.page:'';
        var changed=Boolean(nextPage&&activePage&&nextPage!==activePage);
        if(nextPage)activePage=nextPage;
        setHeight(data.height);

        if(changed){
          if(resizeFrame)cancelAnimationFrame(resizeFrame);
          resizeFrame=requestAnimationFrame(function(){
            resizeFrame=0;
            scrollFrameToTop();
          });
        }
        return;
      }

      if(data.type==='printflow:view'||data.type==='printflow:resize'){
        setHeight(data.height);
      }
    });
  })();`;

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
