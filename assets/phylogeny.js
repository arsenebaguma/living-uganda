(() => {
  const svg=document.querySelector('#bird-tree'), scene=document.querySelector('#bird-scene'), detail=document.querySelector('#bird-detail');
  const coverage=document.querySelector('#bird-coverage'), search=document.querySelector('#bird-search'), announcement=document.querySelector('#bird-announcement');
  const groups=['Birds','Mammals','Plants','Fish','Reptiles','Amphibians','Insects','Fungi','Other invertebrates','Other organisms'];const requestedGroup=new URL(location.href).searchParams.get('group');const group=groups.includes(requestedGroup)?requestedGroup:'Birds';const slug=group.toLowerCase().replaceAll(' ','-');
  const ns='http://www.w3.org/2000/svg', nodes=new Map(), expanded=new Set();
  let root, viewRoot, phylogeny, records=[], selected, visible=[], positions=new Map(), scale=1, tx=0, ty=0, dragging=null;
  const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  function element(tag,text,cls){const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;}
  function vector(tag,attributes={}){const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);return node;}
  function sorted(node){return [...node.children.values()];}
  function build(data){
    const byId=new Map(data.map(r=>[r.id,r]));
    function hydrate(raw,parent=null){const n={...raw,parent,children:new Map(),record:raw.recordId?byId.get(raw.recordId):null};nodes.set(n.key,n);
      for(const child of raw.children){const c=hydrate(child,n);n.children.set(c.key,c);}
      if(n.rank==='family'&&!phylogeny.tipMode)for(const id of n.ids){const r=byId.get(id);if(!r)continue;const genus=r.taxonomy?.genus||'Genus not recorded',key=n.key+'/'+genus;
        if(!n.children.has(key)){const g={key,label:genus,rank:'genus',classification:true,ids:[],parent:n,children:new Map()};n.children.set(key,g);nodes.set(key,g);}
        const g=n.children.get(key);g.ids.push(id);const leaf={key:key+'/'+id,label:r.commonName||r.scientificName,rank:'species',classification:true,record:r,ids:[id],parent:g,children:new Map()};g.children.set(leaf.key,leaf);nodes.set(leaf.key,leaf);
      }return n;
    }
    const result=hydrate(phylogeny.tree);
    for(const id of phylogeny.unplacedIds){const r=byId.get(id);if(r)nodes.set('pending/'+id,{key:'pending/'+id,label:r.commonName||r.scientificName,rank:'species',record:r,classification:true,ids:[id],parent:null,children:new Map()});}
    return result;
  }
  function layout(){let leaf=0;visible=[];positions=new Map();
    // Parent coordinates use the same world units as their children.
    function visitFixed(node,depth){const children=depth<2?sorted(node):[];let y;if(children.length){const ys=children.map(child=>visitFixed(child,depth+1));y=ys.reduce((a,b)=>a+b,0)/ys.length;}else y=40+leaf++*44;positions.set(node.key,{x:80+depth*300,y});visible.push(node);return y;}
    visitFixed(viewRoot,0);
  }
  function draw(){
    layout();scene.replaceChildren();
    for(const node of visible){if(!node.parent||!positions.has(node.parent.key))continue;const a=positions.get(node.parent.key),b=positions.get(node.key),mid=(a.x+b.x)/2;scene.append(vector('path',{d:`M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`,class:'bird-tree-link','stroke-dasharray':node.classification?'4 4':''}));}
    for(const node of visible){const p=positions.get(node.key),group=vector('g',{class:'bird-node'+(expanded.has(node.key)?' expanded':'')+(selected?.key===node.key?' selected':''),transform:`translate(${p.x},${p.y})`,tabindex:'0',role:'button','data-key':node.key,'aria-label':node.rank+': '+node.label+(node.children.size?', explore this branch':', read species')});
      if(node.children.size)group.setAttribute('aria-expanded',String(expanded.has(node.key)));
      const title=vector('title');title.textContent=node.label;group.append(title,vector('rect',{class:'node-label-bg',rx:3}),vector('circle',{class:'node-dot'}));
      const text=vector('text',{class:'node-label'});text.textContent=node.label.length>29?node.label.slice(0,27)+'…':node.label;group.append(text);
      const rank=vector('text',{class:'node-rank'});rank.textContent=node.rank;group.append(rank);
      group.addEventListener('click',()=>activate(node));group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate(node);}else if(event.key==='ArrowRight'&&node.children.size){event.preventDefault();setView(node);}else if(event.key==='ArrowLeft'&&node.parent){event.preventDefault();setView(node.parent);}});scene.append(group);
    }transform();
  }
  function transform(){
    scene.setAttribute('transform',`translate(${tx},${ty}) scale(${scale})`);
    scene.querySelectorAll('.bird-tree-link').forEach(path=>path.setAttribute('stroke-width',1.2/scale));
    scene.querySelectorAll('.bird-node').forEach(group=>{
      const node=nodes.get(group.getAttribute('data-key')),left=node.children.size&&visible.some(n=>n.parent===node),offset=left?-13/scale:13/scale;
      const text=group.querySelector('.node-label'),rank=group.querySelector('.node-rank'),dot=group.querySelector('.node-dot'),bg=group.querySelector('.node-label-bg');
      const font=Math.min(14/scale,34),small=Math.min(9/scale,23);text.setAttribute('font-size',font);text.setAttribute('x',offset);text.setAttribute('y',4/scale);text.setAttribute('text-anchor',left?'end':'start');rank.setAttribute('font-size',small);rank.setAttribute('x',offset);rank.setAttribute('y',18/scale);rank.setAttribute('text-anchor',left?'end':'start');rank.style.display=selected?.key===node.key?'':'none';dot.setAttribute('r',5/scale);dot.setAttribute('stroke-width',1.5/scale);
      const box=text.getBBox();bg.setAttribute('x',box.x-4/scale);bg.setAttribute('y',box.y-2/scale);bg.setAttribute('width',box.width+8/scale);bg.setAttribute('height',box.height+17/scale);
    });
  }
  function fit(){if(!positions.size)return;const points=[...positions.values()],minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y)),maxX=Math.max(...points.map(p=>p.x));scale=Math.max(.2,Math.min(1.4,(svg.clientWidth-60)/(maxX+220),(svg.clientHeight-60)/(maxY-minY+60)));
    for(let i=0;i<8;i++){transform();const box=scene.getBBox(),factor=Math.min(1,(svg.clientWidth-36)/(box.width*scale),(svg.clientHeight-48)/(box.height*scale));if(factor>.99)break;scale=Math.max(.15,scale*factor);}
    transform();const box=scene.getBBox();tx=(svg.clientWidth-box.width*scale)/2-box.x*scale;ty=(svg.clientHeight-box.height*scale)/2-box.y*scale;transform();}
  function focus(node){const p=positions.get(node.key);if(!p)return;tx=svg.clientWidth*.38-p.x*scale;ty=svg.clientHeight*.5-p.y*scale;transform();const g=[...scene.querySelectorAll('.bird-node')].find(g=>g.getAttribute('data-key')===node.key);g?.focus({preventScroll:true});}
  function setView(node,historyMode='push'){viewRoot=node.record?(node.parent||root):node;selected=node;draw();inspect(node);fit();breadcrumbs();announcement.textContent=node.label+' selected.';
    if(historyMode){const url=new URL(location.href);if(node===root)url.searchParams.delete('branch');else url.searchParams.set('branch',node.key);if(historyMode==='replace'||url.href!==location.href)history[historyMode==='replace'?'replaceState':'pushState']({birdBranch:node.key},'',url);}
  }
  addEventListener('popstate',()=>{if(!root)return;const node=nodes.get(new URL(location.href).searchParams.get('branch'))||root;search.value=node.record?(node.record.commonName||node.record.scientificName):'';setView(node,false);});
  function activate(node){setView(node);}
  function reveal(node){setView(node);}
  function breadcrumbs(){const trail=[];let n=selected;while(n){trail.unshift(n);n=n.parent;}const nav=document.querySelector('#bird-breadcrumbs');nav.replaceChildren();if(!trail.includes(root))trail.unshift(root);for(const item of trail){const b=element('button',item.label==='Shared branch'?'Ancestor':item.label);b.type='button';b.addEventListener('click',()=>setView(item));if(item===selected)b.setAttribute('aria-current','location');nav.append(b);}document.querySelector('#bird-up').disabled=!(selected?.parent);}
  function inspect(node){
    document.querySelector('#bird-mode').textContent=node.classification||(node.rank==='family'&&!phylogeny.tipMode)?'RECORDED CLASSIFICATION':'SOURCED EVOLUTIONARY BRANCHING';document.querySelector('#bird-evidence').textContent=node.classification||(node.rank==='family'&&!phylogeny.tipMode)?'Dashed connections show taxonomy-based placements. Evolutionary relationships are still to be resolved for these connections.':phylogeny.citation+'. Solid connections have study support; dashed connections rely on taxonomy. Lengths show layout, not time or genetic distance.';detail.replaceChildren();detail.append(element('span',node.rank.toUpperCase(),'bird-kicker'),element('h2',node.label==='Shared branch'?'A shared ancestor':node.label));
    const path=[];let ancestor=node.parent;while(ancestor){path.unshift(ancestor.label);ancestor=ancestor.parent;}if(path.length)detail.append(element('p',path.join(' → '),'bird-path'));
    if(node.record){const r=node.record;if(r.commonName)detail.append(element('p',r.scientificName,'bird-path'));
      for(const [key,label] of [['description',''],['distribution','Recorded distribution'],['habitat','Habitat'],['feeding','Feeding'],['behaviour','Behaviour'],['breeding','Breeding'],['conservation','Conservation']])if(r[key])detail.append(element('p',(label?label+': ':'')+r[key]));
      if(!r.description)detail.append(element('p','Explore its recorded name and classification in the catalogue.'));
      for(const name of r.localNames||[])detail.append(element('p',name.name+' · '+name.language+(name.region?' · '+name.region:'')));
      const link=element('a','Open catalogue entry ↗','bird-detail-link');link.href='species.html?group='+encodeURIComponent(group)+'&q='+encodeURIComponent(r.scientificName)+'&v=20261004-birds-preview#species-results';detail.append(link);
    }else{
      detail.append(element('p',node.classification||(node.rank==='family'&&!phylogeny.tipMode)?'Browse the recorded names in this branch.':'These branches share the ancestor shown at their junction. Choose a branch to look closer.'));if(node.orders?.length&&node.orders.length<=5)detail.append(element('p',node.orders.join(' · '),'bird-path'));if(node.studySupport?.length){const link=element('a','Branch evidence ↗','bird-path');link.href='https://tree.opentreeoflife.org/opentree/'+encodeURIComponent(phylogeny.synthId)+'@'+encodeURIComponent(node.sourceNode);link.target='_blank';link.rel='noopener';detail.append(link);}
      const list=element('div','','bird-child-list');sorted(node).forEach(child=>{const button=element('button',child.label==='Shared branch'?'Shared ancestor':child.label);button.type='button';if(child.rank==='species'&&child.record?.commonName)button.append(element('small',child.record.scientificName));button.addEventListener('click',()=>reveal(child));list.append(button);});detail.append(list);
    }
  }
  function zoom(factor,x=svg.clientWidth/2,y=svg.clientHeight/2){const next=Math.max(.15,Math.min(3.5,scale*factor));tx=x-(x-tx)*next/scale;ty=y-(y-ty)*next/scale;scale=next;transform();}
  document.querySelector('#bird-zoom-in').addEventListener('click',()=>zoom(1.25));document.querySelector('#bird-zoom-out').addEventListener('click',()=>zoom(.8));document.querySelector('#bird-fit').addEventListener('click',fit);
  document.querySelector('#bird-reset').addEventListener('click',()=>{search.value='';setView(root);});
  svg.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();const rect=svg.getBoundingClientRect();zoom(event.deltaY<0?1.1:.9,event.clientX-rect.left,event.clientY-rect.top);},{passive:false});
  svg.addEventListener('pointerdown',event=>{if(event.target.closest('.bird-node'))return;dragging={x:event.clientX,y:event.clientY,tx,ty};svg.setPointerCapture(event.pointerId);});svg.addEventListener('pointermove',event=>{if(dragging){tx=dragging.tx+event.clientX-dragging.x;ty=dragging.ty+event.clientY-dragging.y;transform();}});for(const type of ['pointerup','pointercancel'])svg.addEventListener(type,()=>{dragging=null;});
  document.querySelector('#bird-search-form').addEventListener('submit',event=>{event.preventDefault();const query=normalize(search.value);if(!query)return;
    const exact=records.filter(r=>[r.scientificName,r.commonName,...(r.aliases||[]),...(r.localNames||[]).map(n=>n.name)].some(n=>normalize(n)===query));
    const matches=exact.length?exact:records.filter(r=>normalize([r.scientificName,r.commonName,...(r.aliases||[])].join(' ')).includes(query));
    if(matches.length===1){reveal([...nodes.values()].find(n=>n.record&&(n.record.id===matches[0].id||n.ids.includes(matches[0].id))));announcement.textContent='Found '+matches[0].scientificName;}
    else{detail.replaceChildren();detail.append(element('span','FIND A NAME','bird-kicker'),element('h2',matches.length?'Choose a name.':'No matching entry.'),element('p',matches.length?'Select a name to find its branch.':'Try another common or scientific name. This catalogue is still growing.'));const list=element('div','','bird-child-list');matches.slice(0,15).forEach(r=>{const button=element('button',r.commonName||r.scientificName);button.type='button';button.addEventListener('click',()=>reveal([...nodes.values()].find(n=>n.record&&(n.record.id===r.id||n.ids.includes(r.id)))));list.append(button);});detail.append(list);}
  });
  let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(fit,120);});
  document.querySelector('#bird-up').addEventListener('click',()=>{if(selected.parent)setView(selected.parent);});
  document.querySelector('#bird-pending').addEventListener('click',()=>{detail.replaceChildren();detail.append(element('span','PLACEMENT PENDING','bird-kicker'),element('h2','Still to place.'),element('p','These entries do not yet have a verified placement in the reference tree. You can still open their catalogue information.'));const list=element('div','','bird-child-list');for(const id of phylogeny.unplacedIds){const n=nodes.get('pending/'+id);if(!n)continue;const b=element('button',n.label);b.type='button';b.append(element('small',n.record.taxonomy?.family||n.record.scientificName));b.addEventListener('click',()=>setView(n));list.append(b);}detail.append(list);});
  const choice=document.querySelector('#group-choice');for(const g of groups){const option=element('option',g);option.value=g;option.selected=g===group;choice.append(option);}choice.addEventListener('change',()=>{location.href='phylogeny.html?group='+encodeURIComponent(choice.value);});
  const images={'Birds':['atlas-bird-plate.jpg','Historical illustration of African starlings'],'Mammals':['kidepo-lion-portrait.jpg','Male lion in Kidepo, Uganda'],'Plants':['collection-botanical-art.jpg','Historical botanical illustration'],'Fish':['collection-fish-drawing.jpg','Scientific fish illustration'],'Reptiles':['collection-chameleon.jpg','Chameleon photograph'],'Amphibians':['collection-frog-reference.jpg','Tree frog reference photograph from DR Congo'],'Insects':['ruspolia-differens.jpg','Ruspolia differens in Uganda'],'Fungi':['fungi.jpg','Fungi at Kibale']};const picture=images[group];const hero=document.querySelector('#group-illustration');if(picture){hero.src='assets/images/'+picture[0];hero.alt=picture[1];document.querySelector('#group-image-caption').textContent=picture[1];}else hero.closest('figure').hidden=true;
  document.title=group+' — Branches of life | Living Uganda';document.querySelector('#group-eyebrow').textContent='UGANDA / '+group.toUpperCase();document.querySelector('#group-intro').textContent='Follow the connections. Explore '+group.toLowerCase()+' in our Uganda catalogue.';document.querySelector('#bird-search').placeholder='Find a common or scientific name';
  const PLATE_GROUPS=['Fish','Mammals','Amphibians','Birds'];
  function startPlate(){
    const embed=document.querySelector('#plate-embed');
    document.body.classList.add('plate-mode');
    embed.hidden=false;
    fetch('data/plates/'+slug+'.json').then(r=>{if(!r.ok)throw Error('Plate unavailable');return r.json();}).then(data=>{
      coverage.textContent=data.summary.catalogue+' species currently in this catalogue';
      const summary=data.summary;
      document.querySelector('#plate-summary').textContent=
        summary.total
          ? summary.recorded+' of '+summary.total+' '+data.noun.many+' recorded in Uganda'
          : summary.recorded+' '+data.noun.many+' recorded in Uganda';
      const browse=document.querySelector('#plate-browse');
      browse.href='species.html?group='+encodeURIComponent(group)+'#browse';
      browse.textContent='Browse '+group.toLowerCase()+' ↗';
      const source=document.querySelector('#plate-source');
      if(data.source){source.href=data.source.url;source.title=data.source.label;}
      window.mountPhylogenyPlate(document.querySelector('#plate'),data);
    }).catch(()=>{coverage.textContent='The plate could not be loaded.';});
  }
  if(PLATE_GROUPS.includes(group)){startPlate();return;}
  Promise.all(['data/species.json','data/phylogenies/'+slug+'.json'].map(url=>fetch(url).then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json();}))).then(([data,source])=>{
    phylogeny=source;records=data.records.filter(r=>r.group===group);const placedIds=new Set(source.tree.ids);source.unplacedIds=records.filter(r=>!placedIds.has(r.id)).map(r=>r.id);document.querySelector('#tree-source').href=source.sourceURL;root=build(records);viewRoot=root;selected=root;coverage.textContent=records.length+' species currently in this catalogue';document.querySelector('#bird-pending').hidden=!phylogeny.unplacedIds.length;if(!records.length){detail.textContent='No entries in this group yet. New records can be added through the local inventory app.';document.querySelector('#bird-mode').textContent='READY FOR NEW ENTRIES';}const names=document.querySelector('#bird-names');for(const record of records){const option=element('option');option.value=record.commonName||record.scientificName;names.append(option);}setView(nodes.get(new URL(location.href).searchParams.get('branch'))||root,'replace');if(!records.length){detail.replaceChildren(element('h2',group),element('p','No entries in this group yet. The explorer will populate when records are added.'));}
  }).catch(error=>{console.error(error);coverage.textContent='The tree could not load. Use the list browser or reload this page.';svg.setAttribute('aria-label','Bird catalogue unavailable');});
})();


