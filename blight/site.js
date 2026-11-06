(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const ease=t=>1-Math.pow(1-t,3);
document.documentElement.classList.add('js');

// menu
const burg=$('.burg');
if(burg)burg.addEventListener('click',()=>{const o=document.body.classList.toggle('nav-open');burg.setAttribute('aria-expanded',o);});
$$('nav.top ul a').forEach(a=>a.addEventListener('click',()=>document.body.classList.remove('nav-open')));

// lichten aan bij laden
const lampImgs=$$('.hero img');let n=0;
const go=()=>document.body.classList.add('lit');
if(!lampImgs.length)go();else{lampImgs.forEach(i=>{if(i.complete)n++;else{i.addEventListener('load',()=>{if(++n>=lampImgs.length)go();});i.addEventListener('error',()=>{if(++n>=lampImgs.length)go();});}});if(n>=lampImgs.length)go();setTimeout(go,1800);}

// reveal
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -10% 0px'});
$$('.rv').forEach(e=>io.observe(e));

// statement: woorden als gloeidraad
const say=$('#say');let words=[];
if(say){const walk=node=>[...node.childNodes].forEach(c=>{if(c.nodeType===3){const f=document.createDocumentFragment();c.textContent.split(/(\s+)/).forEach(p=>{if(!p)return;if(/^\s+$/.test(p)){f.appendChild(document.createTextNode(p));return;}const s=document.createElement('span');s.className='wd'+(node.classList&&node.classList.contains('hl')?' hl':'');s.textContent=p;f.appendChild(s);});c.replaceWith(f);}else if(c.nodeType===1)walk(c);});walk(say);
 $$('#say .hl').forEach(h=>h.replaceWith(...h.childNodes));words=$$('#say .wd');}

// diensten: groepenkast
const brs=$$('.br'),pns=$$('.pn');let cur=0;
function setSvc(i){if(i===cur)return;cur=i;brs.forEach((b,k)=>{b.classList.toggle('on',k<=i&&isPinned()?true:k===i);b.setAttribute('aria-selected',k===i);});pns.forEach((p,k)=>p.classList.toggle('on',k===i));}
const isPinned=()=>innerWidth>980&&!reduce;
brs.forEach((b,k)=>b.addEventListener('click',()=>{
  if(isPinned()){const s=$('.svc'),r=s.offsetHeight-innerHeight;scrollTo({top:s.offsetTop+r*((k+.5)/brs.length),behavior:'smooth'});}
  cur=-1;setSvc(k);}));
brs.forEach((b,k)=>b.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const j=(k+(e.key==='ArrowRight'?1:-1)+brs.length)%brs.length;brs[j].focus();brs[j].click();}}));

if(reduce){words.forEach(w=>w.classList.add('on'));$$('.tile').forEach(t=>t.classList.add('on'));$$('.step').forEach(s=>s.classList.add('on'));return;}

// spotlight
const spot=$('.spot');
if(spot&&matchMedia('(pointer:fine)').matches){let x=0,y=0,tx=0,ty=0,run=false;
 addEventListener('mousemove',e=>{tx=e.clientX;ty=e.clientY;spot.style.opacity=1;if(!run){run=true;requestAnimationFrame(f);}},{passive:true});
 function f(){x+=(tx-x)*.15;y+=(ty-y)*.15;spot.style.transform=`translate3d(${x}px,${y}px,0)`;if(Math.abs(tx-x)+Math.abs(ty-y)>.5)requestAnimationFrame(f);else run=false;}}

const hero=$('.hero'),bg=$('.hero .bg'),copy=$('.hero .copy'),lamp=$('.hero .lamp'),mich=$('.hero .michel'),beam=$('.hero .beam'),two=$('.hero .two'),cue=$('.hero .scroll');
const svc=$('.svc'),work=$('.work'),track=$('.work .track'),tiles=$$('.tile'),dot=$('.work .level i');
const pool=$('.pool'),pimg=$('.pool img'),night=$('.pool .night'),lbl=$('.pool .lbl');
const how=$('.how'),live=$('.cable .live'),steps=$$('.step'),nav=$('nav.top');
let L=0;if(live){L=live.getTotalLength();live.style.strokeDasharray=L;live.style.strokeDashoffset=L;}
const prog=(el)=>{const r=el.getBoundingClientRect();return clamp(-r.top/(el.offsetHeight-innerHeight));};
let t0=performance.now(),tk=false;

function frame(now){tk=false;const vh=innerHeight,vw=innerWidth;
 nav.classList.toggle('s',scrollY>40);
 // hero
 if(hero){const r=hero.getBoundingClientRect();if(r.bottom>0){const p=prog(hero);
  bg.style.transform=`scale(${1.1-p*.1}) translate3d(0,${p*-3}%,0)`;
  if(mich)mich.style.transform=`translate3d(0,${p*-7}vh,0) scale(${1+p*.04})`;
  const a=clamp((p-.18)/.3);copy.style.transform=`translate3d(0,${-a*90}px,0) scale(${1-a*.06})`;copy.style.opacity=1-a;
  const sw=Math.sin((now-t0)/1400)*1.6;lamp.style.transform=`translate3d(0,${p*-38}vh,0) rotate(${sw}deg) scale(${1+p*.25})`;
  const b=clamp((p-.32)/.22);beam.style.transform=`scaleX(${ease(b)})`;beam.style.opacity=b>0&&b<1?1:(b>=1?clamp(1-(p-.54)/.12):0);
  const c=clamp((p-.46)/.2);two.style.opacity=c;two.style.transform=`translate3d(0,${(1-c)*30}px,0)`;
  cue.style.opacity=1-clamp(p/.1);}}
 // statement
 if(words.length){const r=say.getBoundingClientRect();const p=clamp((vh*.85-r.top)/(r.height+vh*.35));const k=Math.round(p*words.length);words.forEach((w,i)=>w.classList.toggle('on',i<k));}
 // diensten
 if(isPinned()&&svc){const r=svc.getBoundingClientRect();if(r.top<vh&&r.bottom>0){const p=prog(svc);const i=Math.min(brs.length-1,Math.floor(p*brs.length*0.999));if(i!==cur){cur=i;brs.forEach((b,k)=>{b.classList.toggle('on',k<=i);b.setAttribute('aria-selected',k===i);});pns.forEach((pn,k)=>pn.classList.toggle('on',k===i));}}}
 // werk: horizontaal + lampen aan
 if(work){const r=work.getBoundingClientRect();if(r.top<vh&&r.bottom>0){const p=prog(work);const max=track.scrollWidth-vw;track.style.transform=`translate3d(${-p*max}px,0,0)`;
  const cx=vw/2;tiles.forEach(t=>{const tr=t.getBoundingClientRect();if(!t.classList.contains('on')&&tr.left<cx+20)t.classList.add('on');});}}
 // tuin: lichtcirkel
 if(pool){const r=pool.getBoundingClientRect();if(r.top<vh&&r.bottom>0){const p=clamp((vh-r.top)/(r.height));const rad=ease(clamp((p-.25)/.55))*Math.hypot(vw,vh);night.style.setProperty('--r',rad+'px');pimg.style.transform=`scale(${1.12-p*.12})`;lbl.style.opacity=clamp((p-.55)/.2);}}
 // werkwijze: kabel
 if(how&&L){const r=how.getBoundingClientRect();if(r.top<vh&&r.bottom>0){const p=clamp((vh*.75-r.top)/(r.height*.6));live.style.strokeDashoffset=L*(1-p);steps.forEach((s,k)=>s.classList.toggle('on',p>=(k+.3)/4));}}
 if(hero&&hero.getBoundingClientRect().bottom>0)req(); // lamp blijft zachtjes slingeren
}
function req(){if(!tk){tk=true;requestAnimationFrame(frame);}}
addEventListener('scroll',req,{passive:true});addEventListener('resize',req);req();
})();

// formulieren
(()=>{const SHEET='https://script.google.com/macros/s/AKfycbxG9pz7vDGvQl-2hTOpTVDqITL8vdDhSrhvsLWKBK3a9t-1doEG5wv0FV1XNFgQx6p6/exec';
const slug=t=>(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30);
document.querySelectorAll('form[data-k]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();
 if(!f.checkValidity()){f.reportValidity();return;}
 const d=new FormData(f);const rows=[];for(const [k,v] of d.entries())if(typeof v==='string'&&v)rows.push(['Formulier',k,v.slice(0,2000)]);
 rows.push(['Status','Status','aangevraagd']);
 try{fetch(SHEET,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify({klant:f.dataset.k+'-'+slug(d.get('naam')),pct:100,rows})});}catch(_){}
 f.classList.add('sent');}));
const q=new URLSearchParams(location.search).get('d');if(q){const i=document.querySelector(`input[name="werk"][value="${CSS.escape(q)}"]`);if(i)i.checked=true;}
})();
