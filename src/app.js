<script>
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let D=null, K=null, P=null, EOFF=null;

/* ---------------- load ---------------- */
function b64bytes(b64){const b=atob(b64),n=b.length,a=new Uint8Array(n);
  for(let i=0;i<n;i++)a[i]=b.charCodeAt(i);return a;}
async function boot(){
  const inline=($('#payload')?.textContent||'').trim();
  let bytes;
  if(inline){ bytes=b64bytes(inline); }
  else {
    $('#lmsg').textContent='Downloading dataset…';
    const r=await fetch('payload.bin.gz');
    if(!r.ok) throw new Error(`Could not fetch payload.bin.gz (HTTP ${r.status}). This build has to be
      served over http:// — opening the file directly from disk will not work. Use the single-file
      H1B_Sponsor_Explorer.html for local use.`);
    bytes=new Uint8Array(await r.arrayBuffer());
  }
  $('#lmsg').textContent='Parsing dataset…';
  D = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  prepare();
  $('#loader').style.display='none'; $('#app').style.display='flex';
  init();
}
function prepare(){
  const I=a=>Int32Array.from(a);
  K={ e:I(D.K.e), s:I(D.K.s), t:Int16Array.from(D.K.t), c:I(D.K.c), j:I(D.K.j),
      p25:I(D.K.p25.map(v=>v*500)), p75:I(D.K.p75.map(v=>v*500)),
      pwr:I(D.K.pwr), ft:I(D.K.ft), N:D.K.e.length };
  const kd=D.P.kd, N=kd.length, k=new Int32Array(N);
  let acc=0; for(let i=0;i<N;i++){ acc = i===0 ? kd[0] : acc+kd[i]; k[i]=acc; }
  P={ N, k, q:Int8Array.from(D.P.q), n:I(D.P.n), w:I(D.P.w), nw:I(D.P.new), ct:I(D.P.cont),
      cert:I(D.P.cert), den:I(D.P.den), p50:I(D.P.p50.map(v=>v*500)), lvl:I(D.P.lvl) };
  // employer id per P row (hot path: avoids a double indirection in every loop)
  P.e=new Int32Array(N); P.s=new Int32Array(N); P.t=new Int16Array(N);
  for(let i=0;i<N;i++){const kk=k[i]; P.e[i]=K.e[kk]; P.s[i]=K.s[kk]; P.t[i]=K.t[kk];}
  // employer -> contiguous [start,end) range in P (K is sorted by e,s,t; P by k)
  const NE=D.emp.length;
  EOFF=new Int32Array(NE+1).fill(-1);
  for(let i=0;i<N;i++) if(EOFF[P.e[i]]===-1) EOFF[P.e[i]]=i;
  let last=N; for(let x=NE;x>=0;x--){ if(EOFF[x]===-1) EOFF[x]=last; else last=EOFF[x]; }
  EOFF[NE]=N;
  D.lawmap=new Map(); D.empmeta.lawix.forEach((ix,i)=>D.lawmap.set(ix,D.lawdict[D.empmeta.lawval[i]]));
  D.empLower=D.emp.map(x=>x.toLowerCase());
  D.socLower=D.soc.map(x=>x.toLowerCase());
  D.cityLower=D.city.map(x=>x.toLowerCase());
}

/* ---------------- helpers ---------------- */
const fmt=n=>n==null||!isFinite(n)?'—':Math.round(n).toLocaleString('en-US');
const money=n=>!n||!isFinite(n)?'—':'$'+Math.round(n).toLocaleString('en-US');
const moneyK=n=>!n||!isFinite(n)?'—':'$'+Math.round(n/1000)+'k';
const pct=n=>!isFinite(n)?'—':(n*100).toFixed(n*100<10?1:0)+'%';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const signed=n=>(n>=0?'+':'')+(n*100).toFixed(0)+'%';
function weightedMedian(vals,wts){
  const p=[]; for(let i=0;i<vals.length;i++) if(vals[i]>0) p.push([vals[i],wts[i]]);
  if(!p.length) return 0; if(p.length===1) return p[0][0];
  p.sort((a,b)=>a[0]-b[0]);
  const tot=p.reduce((s,x)=>s+x[1],0), half=tot/2; let run=0;
  for(let i=0;i<p.length;i++){
    const [v,w]=p[i], next=run+w;
    if(next>=half){
      if(i===p.length-1||next>half){
        const pv=i?p[i-1][0]:v, f=w?Math.min(1,Math.max(0,(half-run)/w)):0;
        return Math.round((pv+(v-pv)*Math.min(1,f+0.5))/500)*500;
      }
      return Math.round((v+p[i+1][0])/2/500)*500;
    }
    run=next;
  }
  return p[p.length-1][0];
}

/* ---------------- filter state ---------------- */
const F={q:'',pers:new Set(),grps:new Set(),socs:new Set(),st:'',city:'',wage:0,lvl:0,
         onlyNew:false,noDep:false,above:false,min3:false};
let VIEW='emp', MASK=null;
let SORT={emp:{k:'n',d:-1},role:{k:'n',d:-1},loc:{k:'n',d:-1},raw:{k:'n',d:-1},trend:{k:'b',d:-1}};
const allPeriods=()=>F.pers.size===0||F.pers.size===D.periods.length;
function narrowed(){ return !!(F.grps.size||F.socs.size||F.st||F.city||F.wage||F.lvl||
  F.onlyNew||F.above||F.min3||F.q||!allPeriods()); }

let MCACHE={};
const clearMaskCache=()=>{MCACHE={};};
function computeMask(opt={}){
  // when the corresponding filter is inactive, the "skip" variant IS the full mask
  const sg=opt.skipGroups&&F.grps.size, sp=opt.skipPeriods&&!allPeriods();
  const key=(sg?'G':'')+(sp?'P':'');
  if(MCACHE[key]) return MCACHE[key];
  const m=new Uint8Array(P.N);
  const stIx=F.st?D.st.indexOf(F.st):-1;
  const cityIx=F.city?D.city.indexOf(F.city):-1;
  const socIx=new Set([...F.socs].map(s=>D.soc.indexOf(s)).filter(i=>i>=0));
  const qq=F.q.trim().toLowerCase();
  const dep=D.empmeta.dep;
  let grpOk=null;
  if(!sg&&F.grps.size){ grpOk=new Uint8Array(D.soc.length);
    for(let i=0;i<D.soc.length;i++) grpOk[i]=F.grps.has(D.socgrp[i])?1:0; }
  let perOk=null;
  if(!sp&&!allPeriods()){ perOk=new Uint8Array(D.periods.length);
    F.pers.forEach(p=>perOk[p]=1); }
  for(let i=0;i<P.N;i++){
    if(perOk&&!perOk[P.q[i]]) continue;
    if(grpOk&&!grpOk[P.s[i]]) continue;
    if(stIx>=0&&P.t[i]!==stIx) continue;
    if(socIx.size&&!socIx.has(P.s[i])) continue;
    const kk=P.k[i];
    if(cityIx>=0&&K.c[kk]!==cityIx) continue;
    if(F.wage&&P.p50[i]<F.wage) continue;
    if(F.lvl){const L=P.lvl[i]/10; if(L<F.lvl-0.5||L>=F.lvl+0.5) continue;}
    if(F.onlyNew&&P.nw[i]<=0) continue;
    if(F.above&&K.pwr[kk]<=100) continue;
    if(F.min3&&P.n[i]<3) continue;
    if(F.noDep&&dep[P.e[i]]>=50) continue;
    if(qq){const e=P.e[i];
      if(!(D.empLower[e].includes(qq)||D.socLower[P.s[i]].includes(qq)||
           D.cityLower[K.c[kk]].includes(qq))) continue;}
    m[i]=1;
  }
  return MCACHE[key]=m;
}
const buildMask=()=>{MASK=computeMask();};
function facet(keyFn,len,opt){
  const fm=computeMask(opt), c=new Float64Array(len);
  for(let i=0;i<P.N;i++) if(fm[i]) c[keyFn(i)]+=P.n[i];
  return c;
}

/* ---------------- rollups ---------------- */
function rollup(keyFn,nKeys,mask){
  const M=mask||MASK;
  const n=new Float64Array(nKeys),w=new Float64Array(nKeys),nw=new Float64Array(nKeys),
        ct=new Float64Array(nKeys),den=new Float64Array(nKeys),cert=new Float64Array(nKeys),
        lv=new Float64Array(nKeys),lw=new Float64Array(nKeys),
        pw=new Float64Array(nKeys),pww=new Float64Array(nKeys);
  const wv=new Array(nKeys).fill(null), ww=new Array(nKeys).fill(null);
  const seen=new Uint8Array(nKeys);
  for(let i=0;i<P.N;i++){
    if(!M[i]) continue;
    const k=keyFn(i); if(k<0) continue;
    seen[k]=1; n[k]+=P.n[i]; w[k]+=P.w[i]; nw[k]+=P.nw[i]; ct[k]+=P.ct[i];
    den[k]+=P.den[i]; cert[k]+=P.cert[i];
    if(P.p50[i]>0){ (wv[k]||(wv[k]=[])).push(P.p50[i]); (ww[k]||(ww[k]=[])).push(P.n[i]); }
    if(P.lvl[i]>0){ lv[k]+=P.lvl[i]*P.n[i]; lw[k]+=P.n[i]; }
    const pr=K.pwr[P.k[i]];
    if(pr>0){ pw[k]+=pr*P.n[i]; pww[k]+=P.n[i]; }
  }
  const out=[];
  for(let k=0;k<nKeys;k++) if(seen[k]) out.push({k,n:n[k],w:w[k],nw:nw[k],ct:ct[k],den:den[k],cert:cert[k],
    med:wv[k]?weightedMedian(wv[k],ww[k]):0,
    lvl:lw[k]?lv[k]/lw[k]/10:0, pwr:pww[k]?pw[k]/pww[k]/100:0,
    newr:(nw[k]+ct[k])>0?nw[k]/(nw[k]+ct[k]):0,
    denr:(den[k]+cert[k])>0?den[k]/(den[k]+cert[k]):0});
  return out;
}
const rollEmp=()=>{const r=rollup(i=>P.e[i],D.emp.length);
  if(!narrowed()) r.forEach(x=>{const v=D.empwage.p50[x.k]*500; if(v){x.med=v;x.exact=1;}}); return r;};
const rollSoc=()=>{const r=rollup(i=>P.s[i],D.soc.length);
  if(!narrowed()) r.forEach(x=>{const v=D.socbench.p50[x.k]*500; if(v){x.med=v;x.exact=1;}}); return r;};
const rollSt=()=>rollup(i=>P.t[i],D.st.length);
const rollCity=()=>rollup(i=>K.c[P.k[i]],D.city.length);
function distinct(keyFn){
  const s=new Map();
  for(let i=0;i<P.N;i++){ if(!MASK[i])continue; const k=keyFn(i);
    if(!s.has(k)) s.set(k,new Set()); s.get(k).add(P.e[i]); }
  return s;
}
// petitions per period for the current filters (period filter itself ignored)
function periodSeries(mask){
  const M=mask||computeMask({skipPeriods:true}), c=new Float64Array(D.periods.length);
  for(let i=0;i<P.N;i++) if(M[i]) c[P.q[i]]+=P.n[i];
  return c;
}

/* ---------------- charts ---------------- */
function hidpi(cv,h){const dpr=devicePixelRatio||1,w=cv.parentElement.clientWidth-26;
  cv.width=w*dpr;cv.height=h*dpr;cv.style.height=h+'px';
  const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return{x,w,h};}
function hbar(cv,items,opt={}){
  if(!items.length){cv.style.height='0';return;}
  const {x,w}=hidpi(cv,opt.height||(items.length*22+8));
  const max=Math.max(...items.map(d=>d.v),1), lw=opt.labelW||168;
  x.font='600 11.5px ui-sans-serif,system-ui';
  const vw=Math.ceil(Math.max(...items.map(d=>x.measureText(opt.f?opt.f(d.v):fmt(d.v)).width),10))+12;
  items.forEach((d,i)=>{
    const y=i*22+4, bw=Math.max(2,(w-lw-vw)*(d.v/max));
    x.fillStyle='#8b98a9';x.font='11.5px ui-sans-serif,system-ui';x.textAlign='right';
    let lab=d.l;
    if(x.measureText(lab).width>lw-8){
      while(lab.length>3&&x.measureText(lab+'…').width>lw-8) lab=lab.slice(0,-1); lab+='…';}
    x.fillText(lab,lw-6,y+12);
    const g=x.createLinearGradient(lw,0,lw+bw,0);
    g.addColorStop(0,opt.c1||'#1f6feb');g.addColorStop(1,opt.c2||'#39c5cf');
    x.fillStyle=g;x.beginPath();x.roundRect(lw,y+2,bw,14,3);x.fill();
    x.fillStyle='#e6edf3';x.textAlign='left';x.font='600 11.5px ui-sans-serif,system-ui';
    x.fillText(opt.f?opt.f(d.v):fmt(d.v),lw+bw+7,y+12);
  });
}
function histogram(cv,vals,wts){
  const {x,w,h}=hidpi(cv,150);
  const BIN=20000,MAXW=320000,nb=MAXW/BIN,bins=new Float64Array(nb+1);
  for(let i=0;i<vals.length;i++){if(vals[i]<=0)continue;bins[Math.min(nb,Math.floor(vals[i]/BIN))]+=wts[i];}
  const max=Math.max(...bins,1),bw=w/(nb+1);
  for(let i=0;i<=nb;i++){const bh=(h-24)*(bins[i]/max);
    const g=x.createLinearGradient(0,h-24-bh,0,h-24);
    g.addColorStop(0,'#58a6ff');g.addColorStop(1,'rgba(88,166,255,.25)');
    x.fillStyle=g;x.beginPath();x.roundRect(i*bw+1,h-24-bh,bw-2,bh,[2,2,0,0]);x.fill();}
  x.fillStyle='#64748b';x.font='10px ui-sans-serif,system-ui';x.textAlign='center';
  for(let i=0;i<nb-1;i+=3)x.fillText('$'+(i*BIN/1000)+'k',i*bw+bw/2,h-8);
  x.textAlign='right';x.fillText('$'+(MAXW/1000)+'k+',w-2,h-8);
}
function barSeries(cv,vals,labels,opt={}){
  const {x,w,h}=hidpi(cv,opt.height||160);
  const pad={l:46,r:8,t:10,b:24}, max=Math.max(...vals,1);
  const iw=(w-pad.l-pad.r)/vals.length;
  x.strokeStyle='#252e3b';x.lineWidth=1;
  for(let k=0;k<=3;k++){const y=pad.t+(h-pad.t-pad.b)*k/3;
    x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();
    x.fillStyle='#64748b';x.font='10px ui-sans-serif,system-ui';x.textAlign='right';
    x.fillText(fmt(max*(1-k/3)),pad.l-6,y+3);}
  vals.forEach((v,i)=>{
    const bh=(h-pad.t-pad.b)*(v/max), bx=pad.l+i*iw+iw*0.16, bw=iw*0.68;
    const g=x.createLinearGradient(0,h-pad.b-bh,0,h-pad.b);
    const on=opt.sel?opt.sel(i):true;
    g.addColorStop(0,on?'#58a6ff':'#334054');g.addColorStop(1,on?'rgba(88,166,255,.3)':'rgba(51,64,84,.3)');
    x.fillStyle=g;x.beginPath();x.roundRect(bx,h-pad.b-bh,bw,bh,[3,3,0,0]);x.fill();
    x.fillStyle=on?'#e6edf3':'#64748b';x.font='600 10px ui-sans-serif,system-ui';x.textAlign='center';
    if(bh>16) x.fillText(v>=1000?(v/1000).toFixed(0)+'k':fmt(v),bx+bw/2,h-pad.b-bh+12);
    x.fillStyle='#64748b';x.font='10px ui-sans-serif,system-ui';
    x.fillText(labels[i],bx+bw/2,h-8);
  });
}
function sparkline(vals,w=70,h=17){
  const max=Math.max(...vals,1);
  const pts=vals.map((v,i)=>`${(i/(Math.max(1,vals.length-1)))*w},${h-(v/max)*(h-2)-1}`).join(' ');
  return `<svg class="mini" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}"
    fill="none" stroke="#58a6ff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
const TILE={AK:[1,1],ME:[1,11],VT:[2,10],NH:[2,11],
 WA:[3,1],ID:[3,2],MT:[3,3],ND:[3,4],MN:[3,5],IL:[3,6],WI:[3,7],MI:[3,8],NY:[3,9],RI:[3,10],MA:[3,11],
 OR:[4,1],NV:[4,2],WY:[4,3],SD:[4,4],IA:[4,5],IN:[4,6],OH:[4,7],PA:[4,8],NJ:[4,9],CT:[4,10],
 CA:[5,1],UT:[5,2],CO:[5,3],NE:[5,4],MO:[5,5],KY:[5,6],WV:[5,7],VA:[5,8],MD:[5,9],DE:[5,10],
 AZ:[6,2],NM:[6,3],KS:[6,4],AR:[6,5],TN:[6,6],NC:[6,7],SC:[6,8],DC:[6,9],
 OK:[7,3],LA:[7,4],MS:[7,5],AL:[7,6],GA:[7,7],
 HI:[8,1],TX:[8,3],FL:[8,8],PR:[8,10],VI:[8,11],GU:[1,2],MP:[2,2]};
function tilemap(el,rows){
  const by=new Map(rows.map(r=>[D.st[r.k],r])), max=Math.max(...rows.map(r=>r.n),1);
  el.innerHTML=Object.entries(TILE).map(([ab,[r,c]])=>{
    const d=by.get(ab), v=d?d.n:0;
    const a=v?0.16+0.84*Math.pow(v/max,.42):0.05;
    return `<div class="tile${F.st===ab?' sel':''}" data-st="${ab}"
      style="background:rgba(88,166,255,${a.toFixed(3)});grid-row:${r};grid-column:${c}"
      data-tip="${ab} · ${fmt(v)} petitions${d?' · med '+money(d.med):''}">
      ${ab}<small>${v?(v>=1000?(v/1000).toFixed(v>=10000?0:1)+'k':v):''}</small></div>`;}).join('');
  el.querySelectorAll('.tile').forEach(t=>t.onclick=()=>{
    F.st=F.st===t.dataset.st?'':t.dataset.st; $('#fst').value=F.st; refresh();});
}
