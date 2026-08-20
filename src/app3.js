
/* ---------------- trends view ---------------- */
function comparePeriods(){
  // choose two comparable periods: if the user picked exactly two, use those;
  // otherwise default to the most recent pair of same-quarter periods available.
  if(F.pers.size===2){const a=[...F.pers].sort((x,y)=>x-y);return a;}
  const n=D.periods.length;
  const q=i=>D.periods[i].slice(-2);
  for(let b=n-1;b>0;b--) for(let a=b-1;a>=0;a--)
    if(q(a)===q(b)) return [a,b];
  return [n-2,n-1];
}
function viewTrend(){
  const [A,B]=comparePeriods();
  const mA=computeMask({skipPeriods:true}), mB=mA;   // period applied manually below
  const nA=new Float64Array(D.emp.length), nB=new Float64Array(D.emp.length);
  const nwB=new Float64Array(D.emp.length);
  const vA=new Array(D.emp.length).fill(null), wA=new Array(D.emp.length).fill(null);
  const vB=new Array(D.emp.length).fill(null), wB=new Array(D.emp.length).fill(null);
  const series=new Map();
  for(let i=0;i<P.N;i++){
    if(!mA[i]) continue;
    const e=P.e[i], qi=P.q[i];
    if(!series.has(e)) series.set(e,new Float64Array(D.periods.length));
    series.get(e)[qi]+=P.n[i];
    if(qi===A){ nA[e]+=P.n[i]; if(P.p50[i]>0){(vA[e]||(vA[e]=[])).push(P.p50[i]);(wA[e]||(wA[e]=[])).push(P.n[i]);} }
    if(qi===B){ nB[e]+=P.n[i]; nwB[e]+=P.nw[i];
      if(P.p50[i]>0){(vB[e]||(vB[e]=[])).push(P.p50[i]);(wB[e]||(wB[e]=[])).push(P.n[i]);} }
  }
  const rows=[];
  series.forEach((ser,e)=>{
    const a=nA[e], b=nB[e];
    if(a+b===0) return;
    const meda=vA[e]?weightedMedian(vA[e],wA[e]):0, medb=vB[e]?weightedMedian(vB[e],wB[e]):0;
    rows.push({k:e,series:[...ser],a,b,nwb:nwB[e],meda,medb,
      delta:a?(b-a)/a:(b>0?Infinity:0),
      medd:(meda&&medb)?(medb-meda)/meda:0});
  });
  COLS.trend[2].t=D.periods[A].replace('FY','');
  COLS.trend[3].t=D.periods[B].replace('FY','');
  ROWS=rows.filter(r=>r.a+r.b>=MINV); sortRows();
  const totA=rows.reduce((s,r)=>s+r.a,0), totB=rows.reduce((s,r)=>s+r.b,0);
  const grew=ROWS.filter(r=>r.b>r.a).length, shrank=ROWS.filter(r=>r.b<r.a).length;
  const fresh=rows.filter(r=>r.a===0&&r.b>0).length, gone=rows.filter(r=>r.a>0&&r.b===0).length;
  const ser=periodSeries(mA);
  $('#views').innerHTML=`
    <div class="note"><b>Comparing ${D.periods[A]} → ${D.periods[B]}.</b>
      These are the same fiscal quarter a year apart, which is the only like-for-like comparison this
      dataset supports — filing volume is strongly seasonal, so comparing adjacent quarters would
      mislead. Select exactly two period chips above to compare any other pair.
      Rows below need at least ${MINV} LCAs across the two periods, and sort by ${D.periods[B]} volume until you click another column.</div>
    <div id="kpi2" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      <div class="kpi"><div class="k">${D.periods[A]}</div><div class="v">${fmt(totA)}</div>
        <div class="s">LCAs</div></div>
      <div class="kpi"><div class="k">${D.periods[B]}</div><div class="v">${fmt(totB)}</div>
        <div class="d ${totB>=totA?'up':'dn'}">${totA?signed((totB-totA)/totA):'—'} year over year</div></div>
      <div class="kpi"><div class="k">Grew</div><div class="v">${fmt(grew)}</div>
        <div class="s">employers filed more</div></div>
      <div class="kpi"><div class="k">Shrank</div><div class="v">${fmt(shrank)}</div>
        <div class="s">employers filed fewer</div></div>
      <div class="kpi"><div class="k">New or returning</div><div class="v">${fmt(fresh)}</div>
        <div class="s">filed in ${D.periods[B]}, not ${D.periods[A]}</div></div>
      <div class="kpi"><div class="k">Went quiet</div><div class="v">${fmt(gone)}</div>
        <div class="s">filed in ${D.periods[A]}, not ${D.periods[B]}</div></div>
    </div>
    <div class="grid g2">
      <div class="panel"><h3>LCAs by fiscal quarter <em>click a bar to select that period</em></h3>
        <div class="body"><canvas id="cper"></canvas></div></div>
      <div class="panel"><h3>Biggest movers <em>absolute change, ${D.periods[A]} → ${D.periods[B]}</em></h3>
        <div class="body"><canvas id="cmov"></canvas></div></div>
    </div>
    <div class="tbar"><div class="cnt"><b>${fmt(ROWS.length)}</b> employers with ${MINV}+ LCAs across both periods</div></div>
    <div id="tblwrap"></div>`;
  drawPeriodPanel(ser);
  const movers=[...ROWS].sort((a,b)=>Math.abs(b.b-b.a)-Math.abs(a.b-a.a)).slice(0,14)
    .map(r=>({l:D.emp[r.k],v:r.b-r.a}));
  const mx=Math.max(...movers.map(m=>Math.abs(m.v)),1);
  hbarSigned($('#cmov'),movers,mx);
  renderTable();
}
const MINV=10;
function hbarSigned(cv,items,max){
  if(!items.length){cv.style.height='0';return;}
  const {x,w}=hidpi(cv,items.length*22+8);
  const lw=150, mid=lw+(w-lw-12)/2, half=(w-lw-12)/2;
  x.strokeStyle='#252e3b';x.beginPath();x.moveTo(mid,0);x.lineTo(mid,items.length*22+2);x.stroke();
  items.forEach((d,i)=>{
    const y=i*22+4, bw=Math.max(1,half*Math.abs(d.v)/max*0.9);
    x.fillStyle='#8b98a9';x.font='11.5px ui-sans-serif,system-ui';x.textAlign='right';
    let lab=d.l;
    if(x.measureText(lab).width>lw-8){
      while(lab.length>3&&x.measureText(lab+'…').width>lw-8) lab=lab.slice(0,-1); lab+='…';}
    x.fillText(lab,lw-6,y+12);
    x.fillStyle=d.v>=0?'#238636':'#a4272a';
    x.beginPath();x.roundRect(d.v>=0?mid:mid-bw,y+2,bw,14,3);x.fill();
    x.fillStyle=d.v>=0?'#56d364':'#ff7b72';x.font='600 11px ui-sans-serif,system-ui';
    x.textAlign=d.v>=0?'left':'right';
    x.fillText((d.v>=0?'+':'')+fmt(d.v),d.v>=0?mid+bw+6:mid-bw-6,y+12);
  });
}

/* ---------------- insights ---------------- */
function viewIns(){
  const emp=rollEmp(), soc=rollSoc();
  const big=emp.filter(r=>r.n>=25);
  const growth=[...big].sort((a,b)=>(b.newr-a.newr)||(b.n-a.n)).slice(0,12);
  const payers=[...big].filter(r=>r.med>0&&r.n>=50).sort((a,b)=>(b.pwr-a.pwr)||(b.n-a.n)).slice(0,12);
  const senior=[...big].sort((a,b)=>(b.lvl-a.lvl)||(b.n-a.n)).slice(0,12);
  const denial=emp.filter(r=>r.den>=3).sort((a,b)=>(b.denr-a.denr)||(b.den-a.den)).slice(0,12);
  const card=(t,sub,rows,fn,f)=>`
    <div class="panel"><h3>${t} <em>${sub}</em></h3><div class="body"><table class="dt"><tbody>
      ${rows.map(r=>`<tr><td title="${esc(D.emp[r.k])}"
        style="width:100%;max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(D.emp[r.k])}</td>
        <td class="num sub">${fmt(r.n)}</td>
        <td class="num" style="font-weight:600;width:76px">${f(fn(r))}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  $('#views').innerHTML=`
    <div class="note">Rankings use the current filters and period selection, limited to employers with
      enough volume to be meaningful (25+ LCAs, 50+ for the pay ranking, 3+ denials for the denial
      ranking). Ties break by petition volume, so the largest employer at a given rate appears first
      rather than whoever comes first alphabetically.</div>
    <div class="grid g2">
      ${card('Actually growing headcount','share of positions that are net-new · 25+ LCAs',growth,r=>r.newr,pct)}
      ${card('Pays furthest above prevailing wage','offered ÷ required minimum',payers,r=>r.pwr,v=>(v*100).toFixed(0)+'%')}
    </div>
    <div class="grid g2">
      ${card('Hires the most senior roles','average prevailing-wage level (1–4)',senior,r=>r.lvl,v=>v.toFixed(2))}
      ${card('Highest DOL LCA denial rate','denied ÷ decided · 3+ denials',denial,r=>r.denr,pct)}
    </div>
    <div class="grid g2">
      <div class="panel"><h3>Wage spread by occupation <em>25th–75th percentile, top 14 by volume</em></h3>
        <div class="body" id="spread"></div></div>
      <div class="panel"><h3>Concentration <em>share of LCAs held by the top N sponsors</em></h3>
        <div class="body"><canvas id="c9"></canvas></div></div>
    </div>`;
  const top=[...soc].sort((a,b)=>b.n-a.n).slice(0,14);
  const gmax=Math.max(...top.map(r=>D.socbench.p75[r.k]*500),1);
  $('#spread').innerHTML=`<table class="dt"><tbody>${top.map(r=>{
    const a=D.socbench.p25[r.k]*500,b=D.socbench.p75[r.k]*500;
    return `<tr><td title="${esc(D.soc[r.k])}"
      style="width:100%;max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(D.soc[r.k])}</td>
      <td style="width:46%;min-width:120px"><div class="wbar"><i style="left:${a/gmax*100}%;
        width:${Math.max(2,(b-a)/gmax*100)}%"></i></div></td>
      <td class="num" style="width:74px;font-weight:600">${money(r.med)}</td></tr>`;}).join('')}</tbody></table>`;
  const tot=emp.reduce((s,r)=>s+r.n,0)||1, sorted=[...emp].sort((a,b)=>b.n-a.n);
  const marks=[10,25,50,100,250,500,1000], cum=[]; let run=0,ci=0;
  for(let i=0;i<sorted.length&&ci<marks.length;i++){run+=sorted[i].n;
    if(i+1===marks[ci]){cum.push({l:'Top '+marks[ci],v:run/tot});ci++;}}
  hbar($('#c9'),cum,{f:pct,labelW:66,c1:'#8250df',c2:'#bc8cff',height:cum.length*22+8});
}

/* ---------------- lottery ---------------- */
// National USCIS aggregates. These are deliberately kept separate from the DOL LCA payload:
// USCIS does not publish registration-level records or a key that can join a registration to an LCA.
function viewLottery(){
  ROWS=[];
  const hist=LOTTERY.history, latest=hist[hist.length-1];
  const latestRate=latest.selected/latest.eligible*100;
  const maxEligible=Math.max(...hist.map(r=>r.eligible));
  $('#views').innerHTML=`
    <div class="note warn"><b>National USCIS statistics — not employer estimates.</b>
      The controls, periods, employers, occupations, locations, wages and LCA denial data elsewhere in
      this app do not filter this view. USCIS publishes only national registration aggregates, not
      registration-level outcomes or a registration-to-LCA join key.</div>
    <div class="lottery-hero">
      <div class="panel"><h3>What the published rate actually measures</h3><div class="body">
        <div class="lottery-rate"><strong>${latestRate.toFixed(2)}%</strong><span>FY2026 selected registrations ÷ eligible registrations</span></div>
        <p class="source-list">${fmt(latest.selected)} selected registrations out of
          ${fmt(latest.eligible)} eligible registrations. This is <b>not</b> a visa approval rate,
          petition approval rate, or exact person-level probability.</p>
        <div class="lottery-flow">
          <div class="lottery-step"><b>1 · DOL LCA</b><span>Wage and worksite filing; the main dashboard's data.</span></div>
          <div class="lottery-step"><b>2 · Registration</b><span>Cap-subject beneficiary enters USCIS selection.</span></div>
          <div class="lottery-step"><b>3 · I-129 petition</b><span>Only a selected registration permits cap filing.</span></div>
          <div class="lottery-step"><b>4 · Adjudication</b><span>USCIS may approve or deny the filed petition.</span></div>
        </div>
      </div></div>
      <div class="panel"><h3>Eligible registration volume <em>USCIS fiscal years</em></h3><div class="body lottery-bars">
        ${hist.map(r=>`<div class="lottery-bar"><span>FY${r.fy}</span>
          <div class="lottery-track" data-tip="FY${r.fy}: ${fmt(r.eligible)} eligible · ${fmt(r.selected)} selected"><i style="width:${r.eligible/maxEligible*100}%"></i></div>
          <span>${(r.eligible/1000).toFixed(0)}k</span></div>`).join('')}
      </div></div>
    </div>
    <div class="panel" style="margin-bottom:16px"><h3>Historical registration outcomes
      <em>selected registration count, not people approved</em></h3><div class="body" style="overflow-x:auto">
      <table class="dt"><thead><tr><th>Cap FY</th><th class="num">Total</th>
        <th class="num">Eligible</th><th class="num">No other eligible registration</th>
        <th class="num">Multiple eligible registrations</th><th class="num">Selected</th>
        <th class="num">Selected ÷ eligible</th><th>Selection unit</th></tr></thead><tbody>
        ${hist.map(r=>`<tr><td><b>FY${r.fy}</b></td><td class="num sub">${fmt(r.total)}</td>
          <td class="num">${fmt(r.eligible)}</td><td class="num sub">${fmt(r.single)}</td>
          <td class="num sub">${fmt(r.multiple)}</td><td class="num">${fmt(r.selected)}</td>
          <td class="num"><b>${(r.selected/r.eligible*100).toFixed(2)}%</b></td>
          <td><span class="tag ${r.system==='beneficiary-centric'?'t-g':'t-n'}">${r.system}</span></td></tr>`).join('')}
      </tbody></table></div></div>
    <div class="note"><b>Why FY2025 changes the comparison.</b> USCIS moved to beneficiary-centric
      selection for FY2025: selection is run on each unique beneficiary, and every registrant with a
      valid registration for a selected beneficiary may be notified. The published table still reports
      <em>selected registrations</em>, so its ratio is not an exact unique-person selection probability.
      Eligible excludes duplicates, employer-deleted registrations, invalid travel documents and failed payments.</div>
    <div class="panel" style="margin-bottom:16px"><h3>FY2027 wage-weighted selection
      <em>DHS projections from the final rule, not observed outcomes</em></h3><div class="body">
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:11px">
        ${LOTTERY.weights.map((r,i)=>`<div class="kpi weight-card level${i+1}">
          <div class="k">Wage Level ${r.level} · ${r.label}</div><div class="v">${r.projected.toFixed(2)}%</div>
          <div class="s">projected probability · ${r.weight}× pool weight</div></div>`).join('')}
      </div>
      <p class="source-list">For FY2027, USCIS generally enters a unique beneficiary in the pool one,
        two, three or four times based on the highest OEWS wage level the offered wage equals or exceeds.
        A selected beneficiary still counts once toward the cap. Actual odds depend on the final pool;
        the percentages above are DHS modeling in the rule, not guarantees and not derived from this app's LCAs.</p>
    </div></div>
    <div class="grid g2">
      <div class="panel"><h3>What this view can answer</h3><div class="body source-list">
        ✓ National eligible and selected registration counts<br>
        ✓ How multiple-registration volume changed<br>
        ✓ Published historical selected-registration ratios<br>
        ✓ FY2027 selection weights and DHS projected odds
      </div></div>
      <div class="panel"><h3>What public data cannot answer</h3><div class="body source-list">
        ✕ Employer-specific lottery success<br>
        ✕ Which LCA belonged to an unselected registration<br>
        ✕ Exact unique-person odds from selected-registration counts<br>
        ✕ Petition or visa approval from registration selection
      </div></div>
    </div>
    <div class="panel"><h3>Primary sources <em>retrieved ${LOTTERY.asOf}</em></h3><div class="body source-list">
      <a href="${LOTTERY.source}" target="_blank" rel="noopener">USCIS — H-1B Electronic Registration Process and historical data</a><br>
      <a href="${LOTTERY.rule}" target="_blank" rel="noopener">DHS — FY2027 Weighted Selection Process final rule</a>
    </div></div>`;
}

/* ---------------- drawer ---------------- */
function openDrawer(e){
  if(e==null) return;
  const rows=[]; for(let i=EOFF[e];i<EOFF[e+1];i++) rows.push(i);
  if(!rows.length) return;
  const inPer=i=>allPeriods()||F.pers.has(P.q[i]);
  const sel=rows.filter(inPer);
  const use=sel.length?sel:rows;
  let n=0,w=0,nw=0,ct=0,den=0,cert=0; const vals=[],wts=[];
  use.forEach(i=>{n+=P.n[i];w+=P.w[i];nw+=P.nw[i];ct+=P.ct[i];den+=P.den[i];cert+=P.cert[i];
    if(P.p50[i]>0){vals.push(P.p50[i]);wts.push(P.n[i]);}});
  const med=allPeriods()?(D.empwage.p50[e]*500||weightedMedian(vals,wts)):weightedMedian(vals,wts);
  const wp25=D.empwage.p25[e]*500, wp75=D.empwage.p75[e]*500;
  $('#dname').textContent=D.emp[e];
  const law=D.lawmap.get(e);
  $('#dmeta').innerHTML=[esc(D.empmeta.hq[e]||''),
    D.empmeta.naics[e]?'NAICS '+esc(D.empmeta.naics[e]):'',
    D.empmeta.dep[e]>=50?'<span class="tag t-a">H-1B dependent</span>':'',
    D.empmeta.wv[e]>0?'<span class="tag t-r">Willful violator</span>':'',
    allPeriods()?'':`<span class="tag t-b">${[...F.pers].sort((a,b)=>a-b).map(p=>D.periods[p]).join(', ')}</span>`
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');
  const byRole=new Map(),byLoc=new Map(),byTitle=new Map();
  use.forEach(i=>{const kk=P.k[i];
    for(const [m,key] of [[byRole,D.soc[P.s[i]]],[byLoc,D.city[K.c[kk]]],[byTitle,D.jt[K.j[kk]]]]){
      const o=m.get(key)||{n:0,nw:0,v:[],w:[],lvl:0,lw:0};
      o.n+=P.n[i];o.nw+=P.nw[i];
      if(P.p50[i]>0){o.v.push(P.p50[i]);o.w.push(P.n[i]);}
      if(P.lvl[i]>0){o.lvl+=P.lvl[i]*P.n[i];o.lw+=P.n[i];}
      m.set(key,o);}});
  const tbl=(m,label,extra)=>{
    const arr=[...m.entries()].sort((a,b)=>b[1].n-a[1].n).slice(0,14);
    const mx=Math.max(...arr.map(x=>x[1].n),1);
    return `<table class="dt"><thead><tr><th>${label}</th><th class="num">LCAs</th>
      <th class="num">New</th><th class="num">Median</th>${extra?'<th class="num">Lvl</th>':''}</tr></thead>
      <tbody>${arr.map(([k,o])=>`<tr><td title="${esc(k)}"
        style="width:100%;max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k)}</td>
        <td class="num"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
          <div class="wbar" style="width:34px"><i style="width:${o.n/mx*100}%"></i></div>${fmt(o.n)}</div></td>
        <td class="num sub">${fmt(o.nw)}</td><td class="num">${money(weightedMedian(o.v,o.w))}</td>
        ${extra?`<td class="num sub">${o.lw?(o.lvl/o.lw/10).toFixed(1):'—'}</td>`:''}</tr>`).join('')}
      </tbody></table>`;};
  // per-period history (always full history, regardless of the period filter)
  const hist=new Float64Array(D.periods.length), histNew=new Float64Array(D.periods.length);
  const hv=[],hw=[];
  for(let p=0;p<D.periods.length;p++){hv.push([]);hw.push([]);}
  rows.forEach(i=>{hist[P.q[i]]+=P.n[i];histNew[P.q[i]]+=P.nw[i];
    if(P.p50[i]>0){hv[P.q[i]].push(P.p50[i]);hw[P.q[i]].push(P.n[i]);}});
  let best=-1,bn=-1; use.forEach(i=>{if(P.n[i]>bn){bn=P.n[i];best=P.s[i];}});
  const natMed=best>=0?D.socbench.p50[best]*500:0;
  const nat=(natMed&&med)?`<div class="note" style="margin:0 0 16px"><b>${esc(D.emp[e])}</b> pays a median
    of <b>${money(med)}</b> against a national median of <b>${money(natMed)}</b> for
    ${esc(D.soc[best])} — <b class="${med>=natMed?'up':'dn'}">${signed(med/natMed-1)}</b>.</div>`:'';
  $('#dbody').innerHTML=`${nat}
    <div class="dsec"><div class="dstat">
      <div><div class="k">LCAs</div><div class="v">${fmt(n)}</div></div>
      <div><div class="k">Worker positions</div><div class="v">${fmt(w)}</div></div>
      <div><div class="k">Net-new</div><div class="v">${fmt(nw)}</div></div>
      <div><div class="k">Continuing</div><div class="v">${fmt(ct)}</div></div>
      <div><div class="k">Median wage</div><div class="v">${money(med)}</div></div>
      <div><div class="k">DOL LCA denial rate</div><div class="v">${pct(den/((den+cert)||1))}</div></div>
    </div>
    ${wp25&&wp75?`<div style="margin-top:9px;font-size:11.5px;color:var(--mu)">
      Pay range across all periods: <b style="color:var(--tx)">${money(wp25)}</b> (25th pct)
      &nbsp;—&nbsp; <b style="color:var(--tx)">${money(wp75)}</b> (75th pct)</div>`:''}</div>
    <div class="dsec"><h4>Filing history by fiscal quarter</h4>
      <table class="dt"><thead><tr><th>Period</th><th class="num">LCAs</th>
        <th class="num">Net-new</th><th class="num">Median wage</th></tr></thead><tbody>
        ${D.periods.map((p,i)=>hist[i]?`<tr><td>${p}</td><td class="num">${fmt(hist[i])}</td>
          <td class="num sub">${fmt(histNew[i])}</td>
          <td class="num">${money(weightedMedian(hv[i],hw[i]))}</td></tr>`:'').join('')}
      </tbody></table></div>
    <div class="dsec"><h4>Occupations sponsored</h4>${tbl(byRole,'SOC occupation',1)}</div>
    <div class="dsec"><h4>Actual job titles used</h4>${tbl(byTitle,'Job title')}</div>
    <div class="dsec"><h4>Worksite locations</h4>${tbl(byLoc,'City')}</div>
    ${law?`<div class="dsec"><h4>Immigration counsel</h4>
      <div style="font-size:12.5px">${esc(law)}</div></div>`:''}`;
  $('#drawer').classList.add('open'); $('#scrim').classList.add('on');
}
const closeDrawer=()=>{$('#drawer').classList.remove('open');$('#scrim').classList.remove('on');};

/* ---------------- csv ---------------- */
function exportCSV(){
  if(VIEW==='lottery'){
    const fields=['cap_fiscal_year','total_registrations','eligible_registrations',
      'eligible_no_other_registration','eligible_multiple_registrations','selected_registrations',
      'selected_divided_by_eligible_percent','selection_unit'];
    const lines=[`# USCIS H-1B registration history — retrieved ${LOTTERY.asOf} — ${LOTTERY.source}`,
      fields.join(',')];
    LOTTERY.history.forEach(r=>lines.push([r.fy,r.total,r.eligible,r.single,r.multiple,r.selected,
      (r.selected/r.eligible*100).toFixed(2),r.system].join(',')));
    lines.push('',`# FY2027 DHS projected wage-level probabilities — ${LOTTERY.rule}`,
      'wage_level,pool_weight,projected_probability_percent');
    LOTTERY.weights.forEach(r=>lines.push([r.level,r.weight,r.projected.toFixed(2)].join(',')));
    const blob=new Blob([lines.join('\n')],{type:'text/csv'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download='h1b_lottery_national_uscis.csv';a.click();
    URL.revokeObjectURL(a.href);return;
  }
  const cols=COLS[VIEW];
  const strip=h=>String(h).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').replace(/[—≈]/g,'').trim();
  const fields=[];
  cols.forEach(c=>{fields.push([c.t||c.k,r=>c.csv?c.csv(r):strip(c.get(r))]);
    if(c.csv2) fields.push(c.csv2);});
  const q=v=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const periodNote=allPeriods()?'all periods':[...F.pers].sort((a,b)=>a-b).map(p=>D.periods[p]).join('+');
  const lines=[`# H-1B Sponsor Explorer — ${VIEW} view — ${periodNote} — ${D.meta.source}`,
               fields.map(f=>q(f[0])).join(',')];
  ROWS.forEach(r=>lines.push(fields.map(f=>q(f[1](r))).join(',')));
  const blob=new Blob([lines.join('\n')],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`h1b_${VIEW}_${periodNote.replace(/[^\w]/g,'')}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}
