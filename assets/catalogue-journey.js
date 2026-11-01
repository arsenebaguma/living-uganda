if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.body.classList.add('journey-motion');const stages=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('arrived');stages.unobserve(entry.target)}})},{threshold:.05});document.querySelectorAll('.stage-intro,.collage,.knowledge-layout').forEach(el=>stages.observe(el));}
document.querySelectorAll('.index-chapters a').forEach(link=>link.addEventListener('click',()=>document.querySelector('#site-index').close()));

// Only the entrance has depth; native scrolling and catalogue controls stay intact.
(()=>{
  const opening=document.querySelector('.atlas-opening');
  if(!opening)return;
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  let pending=false;
  function paint(){
    pending=false;
    const offset=Math.max(0,Math.min(opening.offsetHeight,window.scrollY-opening.offsetTop));
    opening.style.setProperty('--entrance-scroll',preference.matches?'0px':`${offset}px`);
    opening.classList.toggle('entrance-depth',!preference.matches);
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(paint)}}
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  preference.addEventListener('change',schedule);
  paint();
})();
