
/* ---------------- chrome: chips, presets, wiring ---------------- */
// Periods distorted by a known real-world event rather than by the data.
const PNOTE={'FY2026Q1':'Depressed by the Oct 2025 federal shutdown — OFLC issued almost no decisions '+
  'between Oct 2 and Oct 31, and Nov/Dec carry the catch-up backlog. Do not compare this quarter '+
  'against other Q1s at face value.'};
function renderPeriods(){
  const ser=periodSeries(computeMask({skipPeriods:true}));
  const max=Math.max(...ser,1);
  $('#pers').innerHTML=D.periods.map((p,i)=>
    `<div class="per${allPeriods()||F.pers.has(i)?' on':''}${PNOTE[p]?' warn':''}" data-p="${i}"
       data-tip="${p} · ${fmt(ser[i])} LCAs under the current filters${PNOTE[p]?' — ⚠ '+PNOTE[p]:''}">
      <b>${p.replace('FY','')}${PNOTE[p]?' <em>⚠</em>':''}</b>
      <u>${ser[i]>=1000?(ser[i]/1000).toFixed(0)+'k':fmt(ser[i])}</u>
      <div class="pb"><i style="width:${(ser[i]/max*100).toFixed(1)}%"></i></div></div>`).join('');
  $$('#pers .per').forEach(el=>el.onclick=ev=>{
    const i=+el.dataset.p;
    if(ev.shiftKey&&F.pers.size){                       // shift-click extends a contiguous run
      const cur=[...F.pers], lo=Math.min(...cur,i), hi=Math.max(...cur,i);
      F.pers=new Set(); for(let x=lo;x<=hi;x++) F.pers.add(x);
    } else if(allPeriods()){ F.pers=new Set([i]); }
    else { F.pers.has(i)?F.pers.delete(i):F.pers.add(i); }
    refresh();});
  const PRESETS=[
    ['All periods',()=>new Set()],
    ['Latest quarter',()=>new Set([D.periods.length-1])],
    ['FY2026',()=>new Set(D.periods.map((p,i)=>p.startsWith('FY2026')?i:-1).filter(i=>i>=0))],
    ['Jul–Sep, all years',()=>new Set(D.periods.map((p,i)=>p.endsWith('Q4')?i:-1).filter(i=>i>=0))],
    ['Last 12 months',()=>{const want=['FY2025Q4','FY2026Q1','FY2026Q2','FY2026Q3'];
      return new Set(D.periods.map((p,i)=>want.includes(p)?i:-1).filter(i=>i>=0));}],
  ];
  const eq=s=>{const a=[...F.pers].sort().join(','),b=[...s].sort().join(',');
    return a===b||(a===''&&s.size===D.periods.length);};
  $('#psets').innerHTML=PRESETS.map(([lab,f],i)=>{
    const s=f(); if(lab!=='All periods'&&!s.size) return '';
    return `<button data-i="${i}" class="${eq(s)?'on':''}">${lab}</button>`;}).join('');
  $$('#psets button').forEach(b=>b.onclick=()=>{F.pers=PRESETS[+b.dataset.i][1]();refresh();});
  const totalSel=allPeriods()?ser.reduce((a,b)=>a+b,0)
    :[...F.pers].reduce((a,i)=>a+ser[i],0);
  $('#phint').textContent=(allPeriods()?`All ${D.periods.length} quarters`
    :`${F.pers.size} of ${D.periods.length} quarters`)+` · ${fmt(totalSel)} LCAs`;
  const hit=[...F.pers].map(i=>D.periods[i]).filter(p=>PNOTE[p]);
  const box=$('#pwarn');
  if(hit.length&&!allPeriods()){ box.style.display='block';
    box.innerHTML=`<b>⚠ ${hit.join(', ')}</b> — ${PNOTE[hit[0]]}`; }
  else box.style.display='none';
}
function renderChips(){
  const c=facet(i=>D.socgrp[P.s[i]],D.grp.length,{skipGroups:true});
  $('#gchips').innerHTML=D.grp.map((g,i)=>
    `<div class="gchip${F.grps.has(i)?' on':''}${c[i]?'':' zero'}" data-g="${i}">${esc(g)}
      <span>${c[i]>=1000?(c[i]/1000).toFixed(c[i]>=10000?0:1)+'k':fmt(c[i])}</span></div>`).join('');
  $$('#gchips .gchip').forEach(el=>el.onclick=()=>{
    const i=+el.dataset.g;
    F.grps.has(i)?F.grps.delete(i):F.grps.add(i);
    if(F.grps.size) [...F.socs].forEach(s=>{const ix=D.soc.indexOf(s);
      if(ix>=0&&!F.grps.has(D.socgrp[ix])) F.socs.delete(s);});
    refresh();});
  const names=[...F.grps].map(i=>D.grp[i]);
  $('#ghint').textContent=names.length?names.join(' · '):'All groups included';
  const pool=F.grps.size?D.soc.filter((s,i)=>F.grps.has(D.socgrp[i])):D.soc;
  $('#socl').innerHTML=pool.map(s=>`<option value="${esc(s)}">`).join('');
  $('#fsoc').placeholder=F.grps.size?`Search ${fmt(pool.length)} occupations in group…`
                                    :'e.g. Software Developers';
}
function renderPills(){
  $('#socpills').innerHTML=[...F.socs].map(s=>
    `<span class="pill"><b>${esc(s)}</b><i data-s="${esc(s)}">×</i></span>`).join('');
  $$('#socpills i').forEach(x=>x.onclick=()=>{F.socs.delete(x.dataset.s);refresh();});
  $('#whint').textContent=F.wage?`Showing groups with median ≥ ${money(F.wage)}`:'No wage floor applied';
}
function refresh(){
  const standalone=VIEW==='lottery';
  $('#pstrip').style.display=standalone?'none':'';
  $('#side').style.display=standalone?'none':'';
  $('#kpis').style.display=standalone?'none':'';
  $('#csv').textContent=standalone?'Export lottery CSV':'Export CSV';
  clearMaskCache(); buildMask();
  if(!standalone){renderPeriods();renderChips();kpis();}
  $('#content').classList.toggle('raw',VIEW==='raw');
  ({emp:viewEmp,role:viewRole,loc:viewLoc,raw:viewRaw,trend:viewTrend,ins:viewIns,lottery:viewLottery})[VIEW]();
  if(!standalone)renderPills();
  const p=new URLSearchParams();
  if(F.q)p.set('q',F.q); if(F.st)p.set('st',F.st); if(F.city)p.set('city',F.city);
  if(F.socs.size)p.set('soc',[...F.socs].join('|'));
  if(F.grps.size)p.set('g',[...F.grps].join(','));
  if(!allPeriods())p.set('p',[...F.pers].sort((a,b)=>a-b).join(','));
  if(F.wage)p.set('w',F.wage); if(F.lvl)p.set('lvl',F.lvl);
  if(VIEW!=='emp')p.set('v',VIEW);
  history.replaceState(null,'',p.toString()?'#'+p:location.pathname);
}
let deb; const debounce=fn=>(...a)=>{clearTimeout(deb);deb=setTimeout(()=>fn(...a),190);};
function init(){
  $('#srcline').innerHTML=`${D.meta.source} · ${D.periods.length} fiscal quarters<br>
    ${D.periods[0]} – ${D.periods[D.periods.length-1]} · ${fmt(D.meta.rows)} LCAs
    · ${fmt(D.meta.employers)} employers`;
  $('#cityl').innerHTML=D.city.map(s=>`<option value="${esc(s)}">`).join('');
  $('#fst').innerHTML='<option value="">All states</option>'+
    D.st.filter(s=>s&&s!=='??').map(s=>`<option>${s}</option>`).join('');
  $('#q').oninput=debounce(()=>{F.q=$('#q').value;refresh();});
  $('#fsoc').onchange=()=>{const v=$('#fsoc').value.trim();
    if(D.soc.includes(v)){F.socs.add(v);$('#fsoc').value='';refresh();}};
  $('#fst').onchange=()=>{F.st=$('#fst').value;refresh();};
  $('#fcity').onchange=()=>{F.city=D.city.includes($('#fcity').value)?$('#fcity').value:'';refresh();};
  $('#fwage').oninput=debounce(()=>{F.wage=parseInt($('#fwage').value.replace(/\D/g,''))||0;refresh();});
  $('#flvl').onchange=()=>{F.lvl=+$('#flvl').value||0;refresh();};
  ['fnew|onlyNew','fdep|noDep','fabove|above','fmin3|min3'].forEach(p=>{
    const [id,k]=p.split('|'); $('#'+id).onchange=()=>{F[k]=$('#'+id).checked;refresh();};});
  $('#reset').onclick=()=>{
    Object.assign(F,{q:'',pers:new Set(),grps:new Set(),socs:new Set(),st:'',city:'',
      wage:0,lvl:0,onlyNew:false,noDep:false,above:false,min3:false});
    ['q','fsoc','fcity','fwage'].forEach(i=>$('#'+i).value='');
    ['fst','flvl'].forEach(i=>$('#'+i).value='');
    ['fnew','fdep','fabove','fmin3'].forEach(i=>$('#'+i).checked=false);
    refresh();};
  const closeSide=()=>{$('#side').classList.remove('open');$('#sidescrim').classList.remove('on');};
  $('#sidetoggle').onclick=()=>{
    const o=$('#side').classList.toggle('open');
    $('#sidescrim').classList.toggle('on',o);};
  $('#sidescrim').onclick=closeSide;
  addEventListener('resize',()=>{if(innerWidth>900)closeSide();});
  $('#csv').onclick=exportCSV;
  $('#about').onclick=()=>$('#modal').classList.add('on');
  $('#mclose').onclick=()=>$('#modal').classList.remove('on');
  $('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').classList.remove('on');};
  $('#dclose').onclick=closeDrawer; $('#scrim').onclick=closeDrawer;
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeDrawer();$('#modal').classList.remove('on');closeSide();}
    if(e.key==='/'&&document.activeElement.tagName!=='INPUT'){e.preventDefault();$('#q').focus();}});
  $$('nav button[data-v]').forEach(b=>b.onclick=()=>{
    $$('nav button[data-v]').forEach(x=>x.classList.remove('on'));b.classList.add('on');
    VIEW=b.dataset.v;refresh();});
  const tip=$('#tip');
  document.addEventListener('mouseover',e=>{
    const t=e.target.closest('[data-tip]');
    if(!t){tip.classList.remove('on');return;}
    tip.textContent=t.dataset.tip;tip.classList.add('on');});
  document.addEventListener('mousemove',e=>{
    tip.style.left=Math.min(e.clientX+13,innerWidth-tip.offsetWidth-8)+'px';
    tip.style.top=(e.clientY+15)+'px';});
  const h=new URLSearchParams(location.hash.slice(1));
  if(h.get('q')){F.q=h.get('q');$('#q').value=F.q;}
  if(h.get('st')){F.st=h.get('st');$('#fst').value=F.st;}
  if(h.get('city')){F.city=h.get('city');$('#fcity').value=F.city;}
  if(h.get('soc'))h.get('soc').split('|').forEach(s=>F.socs.add(s));
  if(h.get('g'))h.get('g').split(',').forEach(s=>F.grps.add(+s));
  if(h.get('p'))h.get('p').split(',').forEach(s=>F.pers.add(+s));
  if(h.get('w')){F.wage=+h.get('w');$('#fwage').value=F.wage;}
  if(h.get('lvl')){F.lvl=+h.get('lvl');$('#flvl').value=F.lvl;}
  const validViews=new Set(['emp','role','loc','raw','trend','ins','lottery']);
  if(validViews.has(h.get('v'))){VIEW=h.get('v');$$('nav button[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===VIEW));}
  let rt; addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(refresh,220);});
  refresh();
}
boot().catch(err=>{
  $('#loader').innerHTML=`<h1 style="color:#f85149">Failed to load</h1>
    <p style="max-width:520px;text-align:center">${esc(err.message||err)}</p>`;
  console.error(err);});
</script>
</body>
</html>
