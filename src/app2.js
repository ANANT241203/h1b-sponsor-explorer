
/* ---------------- table ---------------- */
const GTAG=['t-b','t-p','t-g','t-a','t-r','t-c','t-y','t-p','t-a','t-g','t-n'];
let ROWS=[];
const rowH=()=>VIEW==='raw'?34:40;
function topSocFor(e){let b=-1,bn=-1;
  for(let i=EOFF[e];i<EOFF[e+1];i++) if(MASK[i]&&P.n[i]>bn){bn=P.n[i];b=P.s[i];}
  return b>=0?D.soc[b]:'';}
const COLS={
 emp:[
  {k:'name',t:'Employer',w:'2.5fr',sortv:r=>D.emp[r.k],csv:r=>D.emp[r.k],
   csv2:['Headquarters',r=>D.empmeta.hq[r.k]||''],
   get:r=>`<div class="nm">${esc(D.emp[r.k])}</div><div class="sub">${esc(D.empmeta.hq[r.k]||'')}</div>`},
  {k:'n',t:'Petitions',w:'.85fr',num:1,get:r=>fmt(r.n),csv:r=>r.n},
  {k:'nw',t:'New pos.',w:'.85fr',num:1,csv:r=>r.nw,csv2:['New pos. %',r=>(r.newr*100).toFixed(1)],
   get:r=>`${fmt(r.nw)} <span class="sub">${pct(r.newr)}</span>`},
  {k:'w',t:'Workers',w:'.9fr',num:1,csv:r=>r.w,csv2:['Positions per LCA',r=>r.n?(r.w/r.n).toFixed(1):''],
   get:r=>{const x=r.n?r.w/r.n:0;return fmt(r.w)+(x>=10?` <span class="tag t-a" data-tip="Blanket filings — ${x.toFixed(0)} positions per LCA (file median is 1). Typical of staffing agencies; read as capacity, not hires.">${x.toFixed(0)}×</span>`:'');}},
  {k:'med',t:'Median wage',w:'1fr',num:1,csv:r=>Math.round(r.med)||'',
   csv2:['Median is exact',r=>r.exact?'yes':'estimated'],
   get:r=>`${money(r.med)}${r.exact?'':'<span class="sub" title="estimated from filtered subset">≈</span>'}`},
  {k:'lvl',t:'Avg level',w:'.7fr',num:1,get:r=>r.lvl?r.lvl.toFixed(1):'—',csv:r=>r.lvl?r.lvl.toFixed(2):''},
  {k:'pwr',t:'vs prevailing',w:'.9fr',num:1,csv:r=>r.pwr?(r.pwr*100).toFixed(0):'',
   get:r=>r.pwr?`<span class="tag ${r.pwr>=1.15?'t-g':r.pwr>=1.02?'t-b':'t-a'}">${(r.pwr*100).toFixed(0)}%</span>`:'—'},
  {k:'top',t:'Top role',w:'1.4fr',nosort:1,get:r=>esc(topSocFor(r.k)),csv:r=>topSocFor(r.k)},
  {k:'dep',t:'Dep.',w:'.55fr',num:1,sortv:r=>D.empmeta.dep[r.k],csv:r=>D.empmeta.dep[r.k]>=50?'yes':'no',
   get:r=>D.empmeta.dep[r.k]>=50?'<span class="tag t-a">Yes</span>':'<span class="sub">No</span>'},
 ],
 role:[
  {k:'name',t:'Occupation (SOC)',w:'2.3fr',sortv:r=>D.soc[r.k],csv:r=>D.soc[r.k],
   get:r=>`<div class="nm">${esc(D.soc[r.k])}</div>`},
  {k:'grp',t:'Group',w:'1.3fr',sortv:r=>D.grp[D.socgrp[r.k]],csv:r=>D.grp[D.socgrp[r.k]],
   get:r=>`<span class="tag ${GTAG[D.socgrp[r.k]]}">${esc(D.grp[D.socgrp[r.k]])}</span>`},
  {k:'emps',t:'Employers',w:'.9fr',num:1,get:r=>fmt(r.emps),csv:r=>r.emps},
  {k:'n',t:'Petitions',w:'.9fr',num:1,get:r=>fmt(r.n),csv:r=>r.n},
  {k:'nw',t:'New pos.',w:'.85fr',num:1,get:r=>fmt(r.nw),csv:r=>r.nw},
  {k:'p25',t:'25th pct',w:'.85fr',num:1,sortv:r=>D.socbench.p25[r.k],
   csv:r=>D.socbench.p25[r.k]*500||'',get:r=>money(D.socbench.p25[r.k]*500)},
  {k:'med',t:'Median',w:'.9fr',num:1,get:r=>money(r.med),csv:r=>Math.round(r.med)||''},
  {k:'p75',t:'75th pct',w:'.85fr',num:1,sortv:r=>D.socbench.p75[r.k],
   csv:r=>D.socbench.p75[r.k]*500||'',get:r=>money(D.socbench.p75[r.k]*500)},
  {k:'p90',t:'90th pct',w:'.85fr',num:1,sortv:r=>D.socbench.p90[r.k],
   csv:r=>D.socbench.p90[r.k]*500||'',get:r=>money(D.socbench.p90[r.k]*500)},
  {k:'lvl',t:'Avg level',w:'.7fr',num:1,get:r=>r.lvl?r.lvl.toFixed(1):'—',csv:r=>r.lvl?r.lvl.toFixed(2):''},
 ],
 loc:[
  {k:'name',t:'Location',w:'2.2fr',sortv:r=>D.city[r.k],csv:r=>D.city[r.k],
   get:r=>`<div class="nm">${esc(D.city[r.k])}</div>`},
  {k:'emps',t:'Employers',w:'1fr',num:1,get:r=>fmt(r.emps),csv:r=>r.emps},
  {k:'n',t:'Petitions',w:'1fr',num:1,get:r=>fmt(r.n),csv:r=>r.n},
  {k:'nw',t:'New pos.',w:'1fr',num:1,get:r=>fmt(r.nw),csv:r=>r.nw},
  {k:'med',t:'Median wage',w:'1.1fr',num:1,get:r=>money(r.med),csv:r=>Math.round(r.med)||''},
  {k:'lvl',t:'Avg level',w:'.9fr',num:1,get:r=>r.lvl?r.lvl.toFixed(1):'—',csv:r=>r.lvl?r.lvl.toFixed(2):''},
  {k:'pwr',t:'vs prevailing',w:'1fr',num:1,csv:r=>r.pwr?(r.pwr*100).toFixed(0):'',
   get:r=>r.pwr?(r.pwr*100).toFixed(0)+'%':'—'},
 ],
 raw:[
  {k:'name',t:'Employer',w:'2fr',sortv:r=>D.emp[P.e[r.i]],csv:r=>D.emp[P.e[r.i]],
   get:r=>`<div class="nm">${esc(D.emp[P.e[r.i]])}</div>`},
  {k:'per',t:'Period',w:'.75fr',sortv:r=>P.q[r.i],csv:r=>D.periods[P.q[r.i]],
   get:r=>`<span class="tag t-n">${D.periods[P.q[r.i]].replace('FY','')}</span>`},
  {k:'soc',t:'Occupation',w:'1.6fr',sortv:r=>D.soc[P.s[r.i]],csv:r=>D.soc[P.s[r.i]],
   get:r=>esc(D.soc[P.s[r.i]])},
  {k:'grp',t:'Group',w:'1fr',sortv:r=>D.grp[D.socgrp[P.s[r.i]]],csv:r=>D.grp[D.socgrp[P.s[r.i]]],
   get:r=>`<span class="tag ${GTAG[D.socgrp[P.s[r.i]]]}">${esc(D.grp[D.socgrp[P.s[r.i]]].split(' ')[0])}</span>`},
  {k:'jt',t:'Job title',w:'1.6fr',sortv:r=>D.jt[K.j[P.k[r.i]]],csv:r=>D.jt[K.j[P.k[r.i]]],
   get:r=>esc(D.jt[K.j[P.k[r.i]]])},
  {k:'city',t:'Location',w:'1.2fr',sortv:r=>D.city[K.c[P.k[r.i]]],csv:r=>D.city[K.c[P.k[r.i]]],
   get:r=>esc(D.city[K.c[P.k[r.i]]])},
  {k:'n',t:'Petitions',w:'.8fr',num:1,sortv:r=>P.n[r.i],csv:r=>P.n[r.i],get:r=>fmt(P.n[r.i])},
  {k:'nw',t:'New',w:'.6fr',num:1,sortv:r=>P.nw[r.i],csv:r=>P.nw[r.i],get:r=>fmt(P.nw[r.i])},
  {k:'p50',t:'Median',w:'.9fr',num:1,sortv:r=>P.p50[r.i],csv:r=>P.p50[r.i]||'',get:r=>money(P.p50[r.i])},
  {k:'lvl',t:'Lvl',w:'.5fr',num:1,sortv:r=>P.lvl[r.i],csv:r=>P.lvl[r.i]?(P.lvl[r.i]/10).toFixed(1):'',
   get:r=>P.lvl[r.i]?(P.lvl[r.i]/10).toFixed(1):'—'},
 ],
 trend:[
  {k:'name',t:'Employer',w:'2.2fr',sortv:r=>D.emp[r.k],csv:r=>D.emp[r.k],
   get:r=>`<div class="nm">${esc(D.emp[r.k])}</div><div class="sub">${esc(D.empmeta.hq[r.k]||'')}</div>`},
  {k:'spark',t:'Trend',w:'.9fr',nosort:1,csv:r=>r.series.join(' '),
   get:r=>sparkline(r.series)},
  {k:'a',t:'',w:'.9fr',num:1,sortv:r=>r.a,get:r=>fmt(r.a),csv:r=>r.a},
  {k:'b',t:'',w:'.9fr',num:1,sortv:r=>r.b,get:r=>fmt(r.b),csv:r=>r.b},
  {k:'delta',t:'Change',w:'.9fr',num:1,csv:r=>r.a?(r.delta*100).toFixed(1):'',
   sortv:r=>isFinite(r.delta)?r.delta:1000+r.b,   // "new" ranks top, ordered by volume not alphabet
   get:r=>r.a?`<span class="${r.delta>=0?'up':'dn'}">${signed(r.delta)}</span>`:'<span class="tag t-g">new</span>'},
  {k:'nwb',t:'New pos.',w:'.85fr',num:1,get:r=>fmt(r.nwb),csv:r=>r.nwb},
  {k:'medb',t:'Median wage',w:'1fr',num:1,get:r=>money(r.medb),csv:r=>Math.round(r.medb)||''},
  {k:'medd',t:'Wage change',w:'1fr',num:1,csv:r=>r.meda&&r.medb?(r.medd*100).toFixed(1):'',
   get:r=>r.meda&&r.medb?`<span class="${r.medd>=0?'up':'dn'}">${signed(r.medd)}</span>`:'—'},
 ],
};
function renderTable(){
  const cols=COLS[VIEW], s=SORT[VIEW], RH=rowH();
  const tpl=cols.map(c=>c.w).join(' ');
  $('#tblwrap').innerHTML=`<div class="thead" style="display:grid;grid-template-columns:${tpl}">`+
    cols.map(c=>`<div data-k="${c.k}" class="${s.k===c.k?'act':''}${c.num?' num':''}"
      style="justify-content:${c.num?'flex-end':'flex-start'}">${c.t}${s.k===c.k?
      `<span class="arw">${s.d<0?'▼':'▲'}</span>`:''}</div>`).join('')+
    `</div><div id="vport"><div id="spacer"></div></div>`;
  const cnt=ROWS.length, vp=$('#vport');
  $('#spacer').style.height=(cnt*RH)+'px';
  const draw=()=>{
    const st=vp.scrollTop, n=Math.ceil(vp.clientHeight/RH)+3, s0=Math.max(0,Math.floor(st/RH)-1);
    let html='';
    for(let i=s0;i<Math.min(cnt,s0+n);i++){
      html+=`<div class="tr" data-i="${i}" style="top:${i*RH}px;height:${RH}px;display:grid;grid-template-columns:${tpl}">`+
        cols.map(c=>`<div class="${c.num?'num':''}">${c.get(ROWS[i])}</div>`).join('')+`</div>`;
    }
    $('#spacer').innerHTML=html;
    $$('#spacer .tr').forEach(tr=>tr.onclick=()=>{
      const r=ROWS[+tr.dataset.i];
      openDrawer(VIEW==='raw'?P.e[r.i]:(VIEW==='emp'||VIEW==='trend'?r.k:null));});
  };
  vp.onscroll=draw; draw();
  $$('.thead div').forEach(d=>d.onclick=()=>{
    const c=cols.find(x=>x.k===d.dataset.k); if(c&&c.nosort) return;
    if(s.k===d.dataset.k) s.d*=-1; else {s.k=d.dataset.k;s.d=-1;}
    sortRows(); renderTable();});
}
function sortRows(){
  const cols=COLS[VIEW], s=SORT[VIEW];
  const c=cols.find(x=>x.k===s.k)||cols[1];
  const gv=c.sortv||(r=>r[s.k]);
  ROWS.sort((a,b)=>{const x=gv(a),y=gv(b);
    return typeof x==='string'?s.d*x.localeCompare(y):s.d*((x||0)-(y||0));});
}

/* ---------------- KPIs ---------------- */
function kpis(){
  let n=0,w=0,nw=0,den=0,cert=0; const emps=new Set(),vals=[],wts=[];
  for(let i=0;i<P.N;i++){ if(!MASK[i])continue;
    n+=P.n[i];w+=P.w[i];nw+=P.nw[i];den+=P.den[i];cert+=P.cert[i];emps.add(P.e[i]);
    if(P.p50[i]>0){vals.push(P.p50[i]);wts.push(P.n[i]);}}
  let med=weightedMedian(vals,wts), exact=false;
  if(!narrowed()){med=D.meta.medwage;exact=true;}
  const cards=[
    ['Petitions',fmt(n),`${pct(n/D.meta.rows)} of full dataset`],
    ['Employers',fmt(emps.size),'distinct sponsors'],
    ['Worker positions',fmt(w),'total requested'],
    ['Net-new positions',fmt(nw),`${pct(nw/(w||1))} of all positions`],
    ['Median wage',money(med),exact?'annualized, exact':'annualized, estimated'],
    ['Denial rate',pct(den/((den+cert)||1)),`${fmt(den)} denied`],
  ];
  $('#kpis').innerHTML=cards.map(([k,v,s])=>
    `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
}

/* ---------------- views ---------------- */
function periodPanel(){
  const ser=periodSeries();
  return {ser, html:`<div class="panel"><h3>Petitions by fiscal quarter
      <em>click a bar to select that period</em></h3>
      <div class="body"><canvas id="cper"></canvas></div></div>`};
}
function drawPeriodPanel(ser){
  const cv=$('#cper'); if(!cv) return;
  barSeries(cv,[...ser],D.periods.map(p=>p.replace('FY','')),
    {sel:i=>allPeriods()||F.pers.has(i),height:170});
  cv.onclick=e=>{
    const r=cv.getBoundingClientRect(), pad=46, iw=(r.width-pad-8)/D.periods.length;
    const i=Math.floor((e.clientX-r.left-pad)/iw);
    if(i<0||i>=D.periods.length) return;
    if(allPeriods()){F.pers=new Set([i]);}
    else {F.pers.has(i)?F.pers.delete(i):F.pers.add(i); if(!F.pers.size)F.pers=new Set();}
    refresh();};
  cv.style.cursor='pointer';
}
function viewEmp(){
  ROWS=rollEmp(); sortRows();
  const pp=periodPanel();
  $('#views').innerHTML=`
    <div class="grid g3">
      <div class="panel"><h3>Top sponsors <em>by petitions, current filter</em></h3>
        <div class="body"><canvas id="c1"></canvas></div></div>
      <div class="panel"><h3>Where the jobs are <em>click a state to filter</em></h3>
        <div class="body"><div id="tiles"></div></div></div>
    </div>
    <div class="grid g2">
      <div class="panel"><h3>Wage distribution <em>annualized, weighted by petitions</em></h3>
        <div class="body"><canvas id="c2"></canvas></div></div>
      ${pp.html}
    </div>
    <div class="tbar"><div class="cnt"><b>${fmt(ROWS.length)}</b> employers match</div>
      <div class="cnt" style="color:var(--mu2);font-size:11.5px">Wages annualized · median exact when
        unfiltered, marked ≈ when estimated from a filtered slice</div></div>
    <div id="tblwrap"></div>`;
  hbar($('#c1'),[...ROWS].sort((a,b)=>b.n-a.n).slice(0,14).map(r=>({l:D.emp[r.k],v:r.n})));
  tilemap($('#tiles'),rollSt());
  const vals=[],wts=[];
  for(let i=0;i<P.N;i++) if(MASK[i]&&P.p50[i]>0){vals.push(P.p50[i]);wts.push(P.n[i]);}
  histogram($('#c2'),vals,wts);
  drawPeriodPanel(pp.ser);
  renderTable();
}
function viewRole(){
  const rows=rollSoc(), de=distinct(i=>P.s[i]);
  rows.forEach(r=>r.emps=de.get(r.k)?.size||0);
  ROWS=rows; sortRows();
  $('#views').innerHTML=`
    <div class="grid g2">
      <div class="panel"><h3>Petitions by occupation group <em>click a bar to filter</em></h3>
        <div class="body"><div id="gbars"></div></div></div>
      <div class="panel"><h3>Median wage by occupation group <em>weighted</em></h3>
        <div class="body"><canvas id="c3"></canvas></div></div>
    </div>
    <div class="grid g2">
      <div class="panel"><h3>Most-sponsored occupations</h3>
        <div class="body"><canvas id="c1"></canvas></div></div>
      <div class="panel"><h3>Best-paying occupations <em>median, min. 200 petitions</em></h3>
        <div class="body"><canvas id="c2"></canvas></div></div>
    </div>
    <div class="tbar"><div class="cnt"><b>${fmt(ROWS.length)}</b> occupations match</div></div>
    <div id="tblwrap"></div>`;
  const gn=new Float64Array(D.grp.length), gv=[],gw=[];
  for(let i=0;i<D.grp.length;i++){gv.push([]);gw.push([]);}
  rows.forEach(r=>{const g=D.socgrp[r.k];gn[g]+=r.n;
    if(r.med>0){gv[g].push(r.med);gw[g].push(r.n);}});
  const gtot=gn.reduce((a,b)=>a+b,0)||1, gmax=Math.max(...gn,1);
  $('#gbars').innerHTML=D.grp.map((g,i)=>({g,i,n:gn[i]})).sort((a,b)=>b.n-a.n).filter(x=>x.n>0)
    .map(x=>`<div class="grow${F.grps.has(x.i)?' on':''}" data-g="${x.i}">
      <div class="gl">${esc(x.g)}</div><div class="gt"><i style="width:${(x.n/gmax*100).toFixed(2)}%"></i></div>
      <div class="gv">${fmt(x.n)}</div><div class="gp">${(x.n/gtot*100).toFixed(1)}%</div></div>`).join('');
  $$('#gbars .grow').forEach(el=>el.onclick=()=>{
    const i=+el.dataset.g; F.grps.has(i)?F.grps.delete(i):F.grps.add(i); refresh();});
  hbar($('#c3'),D.grp.map((g,i)=>({l:g,v:gv[i].length?weightedMedian(gv[i],gw[i]):0}))
    .filter(d=>d.v>0).sort((a,b)=>b.v-a.v),{f:money,labelW:150,c1:'#238636',c2:'#3fb950'});
  hbar($('#c1'),[...rows].sort((a,b)=>b.n-a.n).slice(0,14).map(r=>({l:D.soc[r.k],v:r.n})));
  hbar($('#c2'),[...rows].filter(r=>r.n>=200).sort((a,b)=>b.med-a.med).slice(0,14)
    .map(r=>({l:D.soc[r.k],v:r.med})),{f:money,c1:'#238636',c2:'#3fb950'});
  renderTable();
}
function viewLoc(){
  const rows=rollCity(), de=distinct(i=>K.c[P.k[i]]);
  rows.forEach(r=>r.emps=de.get(r.k)?.size||0);
  ROWS=rows; sortRows();
  const st=rollSt();
  $('#views').innerHTML=`
    <div class="grid g3">
      <div class="panel"><h3>Petitions by state</h3><div class="body"><div id="tiles"></div></div></div>
      <div class="panel"><h3>Top metros</h3><div class="body"><canvas id="c1"></canvas></div></div>
    </div>
    <div class="grid g2">
      <div class="panel"><h3>Highest-paying states <em>median, min. 500 petitions</em></h3>
        <div class="body"><canvas id="c2"></canvas></div></div>
      <div class="panel"><h3>Most net-new positions by state</h3>
        <div class="body"><canvas id="c3"></canvas></div></div>
    </div>
    <div class="tbar"><div class="cnt"><b>${fmt(ROWS.length)}</b> cities match</div></div>
    <div id="tblwrap"></div>`;
  tilemap($('#tiles'),st);
  hbar($('#c1'),[...rows].sort((a,b)=>b.n-a.n).slice(0,14).map(r=>({l:D.city[r.k],v:r.n})));
  hbar($('#c2'),st.filter(r=>r.n>=500).sort((a,b)=>b.med-a.med).slice(0,12)
    .map(r=>({l:D.st[r.k],v:r.med})),{f:money,labelW:44,c1:'#238636',c2:'#3fb950'});
  hbar($('#c3'),[...st].sort((a,b)=>b.nw-a.nw).slice(0,12)
    .map(r=>({l:D.st[r.k],v:r.nw})),{labelW:44,c1:'#8250df',c2:'#bc8cff'});
  renderTable();
}
function viewRaw(){
  ROWS=[];
  for(let i=0;i<P.N;i++) if(MASK[i]) ROWS.push({i,n:P.n[i]});
  const s=SORT.raw, c=COLS.raw.find(x=>x.k===s.k)||COLS.raw[6], gv=c.sortv;
  ROWS.sort((a,b)=>{const x=gv(a),y=gv(b);
    return typeof x==='string'?s.d*x.localeCompare(y):s.d*((x||0)-(y||0));});
  $('#views').innerHTML=`
    <div class="note"><b>Explorer</b> shows one row per employer × occupation × state × fiscal quarter —
      ${fmt(P.N)} rows in total. Median is the 50th percentile of annualized offered pay within that
      combination and quarter. Click any row for the full employer profile.</div>
    <div class="tbar"><div class="cnt"><b>${fmt(ROWS.length)}</b> combinations match</div></div>
    <div id="tblwrap"></div>`;
  renderTable();
}
