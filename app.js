const MUNICIPALITIES=['Martinópolis','Rancharia','Caiabu','Indiana','Taciba','Nantes','Iepê','João Ramalho'];
const GPS=new Set(['Caiabu','Indiana','Taciba','Nantes','Iepê','João Ramalho']);
const MONTHS=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_LONG=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const METRICS={
  FURTO_TOTAL:'Furtos totais',
  VEICULOS:'Furto/Roubo de veículos',
  'ROUBO - OUTROS':'Roubo - outros',
  HOMICÍDIO:'Letalidade violenta'
};
const KEY='criminal2cia_v4';
const PREV_KEY='criminal2cia_v3';
const OLD_KEY='criminal2cia_v2';
const FIREBASE_DB_URL='https://criminal-76994-default-rtdb.firebaseio.com';
const FIREBASE_ROOT='criminal2cia';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

function clone(v){return JSON.parse(JSON.stringify(v));}
function blankState(){return {occurrences:clone(window.SEED_DATA.occurrences),theftLegacy:clone(window.SEED_DATA.theftLegacy),theftOverrides:[],population:window.SEED_DATA.population,goals:[]};}
function normalizeState(x){
  if(!x||!Array.isArray(x.occurrences))return null;
  x.theftLegacy=Array.isArray(x.theftLegacy)?x.theftLegacy:clone(window.SEED_DATA.theftLegacy);
  x.theftOverrides=Array.isArray(x.theftOverrides)?x.theftOverrides:[];
  x.goals=Array.isArray(x.goals)?x.goals:[];
  x.population=x.population||window.SEED_DATA.population;
  return x;
}
function loadLocalState(){
  try{
    for(const k of [KEY,PREV_KEY,OLD_KEY]){
      const x=normalizeState(JSON.parse(localStorage.getItem(k)));
      if(x){localStorage.setItem(KEY,JSON.stringify(x));return x;}
    }
  }catch(e){}
  return blankState();
}
let state=loadLocalState();
let firebaseOnline=false;
let syncTimer=null;
let syncInFlight=false;
function firebaseUrl(path='state'){return `${FIREBASE_DB_URL}/${FIREBASE_ROOT}/${path}.json`; }
async function firebaseRequest(method,path='state',body){
  const opt={method,headers:{'Content-Type':'application/json'}};
  if(body!==undefined)opt.body=JSON.stringify(body);
  const res=await fetch(firebaseUrl(path),opt);
  if(!res.ok)throw new Error(`Firebase ${res.status}`);
  return method==='DELETE'?null:res.json();
}
function setFirebaseStatus(ok,text){
  firebaseOnline=ok;
  const dot=$('#firebaseDot'),label=$('#firebaseLabel'),sub=$('#firebaseSub');
  if(dot)dot.style.background=ok?'var(--green)':'var(--red)';
  if(label)label.textContent=text||(ok?'Firebase conectado':'Firebase offline');
  if(sub)sub.textContent=ok?'criminal-76994 • sincronizado':'Usando cópia local de segurança';
}
async function pushFirebaseNow(){
  if(syncInFlight)return;
  syncInFlight=true;
  try{
    await firebaseRequest('PUT','state',state);
    setFirebaseStatus(true,'Firebase conectado');
  }catch(err){
    console.error(err);
    setFirebaseStatus(false,'Falha ao sincronizar');
  }finally{syncInFlight=false;}
}
function saveState(){
  localStorage.setItem(KEY,JSON.stringify(state));
  clearTimeout(syncTimer);
  syncTimer=setTimeout(pushFirebaseNow,180);
}
async function loadFirebaseState(){
  setFirebaseStatus(false,'Conectando ao Firebase...');
  try{
    const remote=normalizeState(await firebaseRequest('GET','state'));
    if(remote){
      state=remote;
      localStorage.setItem(KEY,JSON.stringify(state));
    }else{
      state=loadLocalState();
      await firebaseRequest('PUT','state',state);
    }
    setFirebaseStatus(true,'Firebase conectado');
    return true;
  }catch(err){
    console.error(err);
    state=loadLocalState();
    setFirebaseStatus(false,'Firebase indisponível');
    return false;
  }
}
function groupOf(m){return m==='Martinópolis'||m==='Rancharia'?m:'GPs';}
function indicatorOf(c){if(c==='HOMICÍDIO')return 'Vítima de letalidade violenta';if(c==='FURTO DE VEÍCULO'||c==='ROUBO DE VEÍCULO')return 'Furto/Roubo de veículos';if(c==='ROUBO - OUTROS')return 'Roubo - outros';if(c==='FURTO')return 'Furtos totais';return 'Outros';}
function fmtDate(v){if(!v)return '—';const [y,m,d]=v.split('-');return `${d}/${m}/${y}`;}
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2300);}
function years(){const ys=new Set([2025,2026]);state.occurrences.forEach(r=>ys.add(+r.date.slice(0,4)));state.theftLegacy.forEach(r=>ys.add(+r.year));(state.theftOverrides||[]).forEach(r=>ys.add(+r.year));state.goals.forEach(g=>ys.add(+g.year));return [...ys].sort((a,b)=>b-a);}
function monthsForPeriod(type,value){if(type==='MONTH')return [+value];if(type==='BIMONTH'){const start=(+value-1)*2+1;return [start,start+1];}return [1,2,3,4,5,6,7,8,9,10,11,12];}
function selectedPeriod(){return {year:+$('#filterYear').value,type:$('#filterPeriodType').value,value:+($('#filterPeriodValue').value||0),months:monthsForPeriod($('#filterPeriodType').value,+($('#filterPeriodValue').value||0))};}
function periodLabel(type,value,year){if(type==='MONTH')return `${MONTHS_LONG[+value-1]} de ${year}`;if(type==='BIMONTH')return `${value}º bimestre de ${year}`;return `Ano de ${year}`;}
function matchesMetric(r,metric){if(metric==='VEICULOS')return ['FURTO DE VEÍCULO','ROUBO DE VEÍCULO'].includes(r.crime);if(metric==='HOMICÍDIO')return r.crime==='HOMICÍDIO';if(metric==='ROUBO - OUTROS')return r.crime==='ROUBO - OUTROS';if(metric==='FURTO_TOTAL')return r.crime==='FURTO';return true;}
function theftMonthValue(year,municipality,month){
  const override=(state.theftOverrides||[]).find(r=>+r.year===+year&&r.municipality===municipality&&+r.month===+month);
  if(override)return +override.count||0;
  const legacy=state.theftLegacy.filter(r=>+r.year===+year&&r.municipality===municipality&&+r.month===+month).reduce((a,b)=>a+(+b.count||0),0);
  return legacy;
}
function theftCounts(year,group='ALL'){
  const out=Array(12).fill(0);
  MUNICIPALITIES.forEach(m=>{if(group!=='ALL'&&groupOf(m)!==group)return;for(let month=1;month<=12;month++)out[month-1]+=theftMonthValue(year,m,month);});
  return out;
}
function metricSeries(year,metric,group='ALL'){if(metric==='FURTO_TOTAL')return theftCounts(year,group);const rows=state.occurrences.filter(r=>+r.date.slice(0,4)===+year&&(group==='ALL'||r.group===group));const out=Array(12).fill(0);rows.forEach(r=>{if(matchesMetric(r,metric))out[+r.date.slice(5,7)-1]++;});return out;}
function metricTotal(year,metric,group='ALL',months=null){const series=metricSeries(year,metric,group);return (months||[1,2,3,4,5,6,7,8,9,10,11,12]).reduce((a,m)=>a+series[m-1],0);}
function municipalityMetric(year,metric,mun,months=null){const ms=months||[1,2,3,4,5,6,7,8,9,10,11,12];if(metric==='FURTO_TOTAL'){return ms.reduce((a,m)=>a+theftMonthValue(year,mun,m),0);}return state.occurrences.filter(r=>+r.date.slice(0,4)===+year&&r.municipality===mun&&ms.includes(+r.date.slice(5,7))&&matchesMetric(r,metric)).length;}
function prevDelta(cur,prev){if(!prev)return cur?null:0;return (cur-prev)/prev*100;}
function kpiCard(label,value,sub,delta){let d='';if(delta!==undefined){d=delta===null?'<span class="delta">sem base anterior</span>':`<span class="delta ${delta>0?'up':delta<0?'down':''}">${delta>0?'+':''}${delta.toFixed(1)}% vs. mesmo período anterior</span>`;}return `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${d||sub||''}</div></div>`;}
function goalTotal(year,metric,group,months){return state.goals.filter(g=>+g.year===+year&&g.metric===metric&&g.group===group&&months.includes(+g.month)).reduce((a,g)=>a+(+g.value||0),0);}
function goalExists(year,metric,group,months){return state.goals.some(g=>+g.year===+year&&g.metric===metric&&g.group===group&&months.includes(+g.month));}
function goalCard(metric,registered,goal,hasGoal){
  if(!hasGoal)return `<div class="goal-card no-goal"><div class="goal-card-head"><span>${METRICS[metric]}</span><b>Sem meta</b></div><div class="goal-numbers"><strong>${registered}</strong><span>registrados</span></div><div class="goal-empty">Cadastre uma meta para visualizar o desempenho.</div></div>`;
  const pct=goal===0?(registered===0?0:999):registered/goal*100;
  const within=registered<=goal;
  const diff=goal-registered;
  return `<div class="goal-card ${within?'ok':'alert'}"><div class="goal-card-head"><span>${METRICS[metric]}</span><b>${within?'DENTRO DA META':'ACIMA DA META'}</b></div><div class="goal-numbers"><strong>${registered}</strong><span>de <b>${goal}</b></span></div><div class="goal-progress"><i style="width:${Math.min(pct,100)}%"></i></div><div class="goal-foot"><span>${pct.toFixed(0)}% da meta</span><span>${within?`Margem: ${diff}`:`Excesso: ${Math.abs(diff)}`}</span></div></div>`;
}
function updatePeriodFilter(){const type=$('#filterPeriodType').value,el=$('#filterPeriodValue');if(type==='YEAR'){el.classList.add('hidden');el.innerHTML='';return;}el.classList.remove('hidden');if(type==='MONTH')el.innerHTML=MONTHS_LONG.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');else el.innerHTML=[1,2,3,4,5,6].map(b=>`<option value="${b}">${b}º bimestre (${MONTHS[(b-1)*2]}-${MONTHS[(b-1)*2+1]})</option>`).join('');}
function renderDashboard(){
  const {year,type,value,months}=selectedPeriod(),group=$('#filterGroup').value,metric=$('#filterCrime').value;
  $('#periodSummary').innerHTML=`<span>Período analisado</span><strong>${periodLabel(type,value,year)}</strong><span>•</span><strong>${group==='ALL'?'Toda 2ª Cia':group}</strong>`;
  const metrics=['VEICULOS','ROUBO - OUTROS','HOMICÍDIO'];
  const totals=Object.fromEntries(metrics.map(m=>[m,metricTotal(year,m,group,months)]));
  const prevTotals=Object.fromEntries(metrics.map(m=>[m,metricTotal(year-1,m,group,months)]));
  $('#kpis').innerHTML=metrics.map(m=>kpiCard(METRICS[m],totals[m],'',prevDelta(totals[m],prevTotals[m]))).join('');
  const goalGroup=group;
  $('#goalOverview').innerHTML=metrics.map(m=>goalCard(m,totals[m],goalTotal(year,m,goalGroup,months),goalExists(year,m,goalGroup,months))).join('');
  $('#goalOverviewSubtitle').textContent=`${periodLabel(type,value,year)} • ${group==='ALL'?'Toda 2ª Cia':group}`;
  const useMetric=metric==='ALL'?'VEICULOS':metric;
  const series=metricSeries(year,useMetric,group);lineChart($('#monthlyChart'),series,MONTHS);
  const activeSeries=months.map(m=>series[m-1]);const prev=activeSeries.length>1?activeSeries[activeSeries.length-2]:0,cur=activeSeries.length?activeSeries[activeSeries.length-1]:0;$('#trendBadge').textContent=activeSeries.length>1&&prev?`${((cur-prev)/prev*100).toFixed(0)}% no último mês do período`:`${activeSeries.reduce((a,b)=>a+b,0)} no período`;
  renderTerritory(year,useMetric,months);renderRanking(year,useMetric,months);renderLatest(year,months,group,metric);
}
function lineChart(el,data,labels,data2=null){const W=720,H=250,p={l:38,r:12,t:20,b:32};const max=Math.max(1,...data,...(data2||[]));const x=i=>p.l+i*(W-p.l-p.r)/Math.max(1,labels.length-1),y=v=>H-p.b-v*(H-p.t-p.b)/max;let grid='';for(let i=0;i<=4;i++){const yy=p.t+i*(H-p.t-p.b)/4;grid+=`<line class="gridline" x1="${p.l}" y1="${yy}" x2="${W-p.r}" y2="${yy}"/>`;}const labs=labels.map((l,i)=>`<text class="chart-text" x="${x(i)}" y="${H-8}" text-anchor="middle">${l}</text>`).join('');const pts=data.map((v,i)=>`${x(i)},${y(v)}`).join(' ');const dots=data.map((v,i)=>`<circle class="point-a" cx="${x(i)}" cy="${y(v)}" r="3.2"><title>${labels[i]}: ${v}</title></circle>`).join('');let second='';if(data2){const p2=data2.map((v,i)=>`${x(i)},${y(v)}`).join(' ');second=`<polyline class="line-b" points="${p2}"/>`+data2.map((v,i)=>`<circle class="point-b" cx="${x(i)}" cy="${y(v)}" r="3"><title>${labels[i]}: ${v}</title></circle>`).join('');}el.innerHTML=`<svg class="svg-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<line class="axis" x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}"/>${labs}<polyline class="line-a" points="${pts}"/>${dots}${second}</svg>`;}
function renderTerritory(year,metric,months){const names=['Martinópolis','Rancharia','GPs'],vals=names.map(g=>metricTotal(year,metric,g,months)),total=vals.reduce((a,b)=>a+b,0)||1,colors=['#ffd21f','#67717e','#31c48d'];let a=0,parts=[];vals.forEach((v,i)=>{const deg=v/total*360;parts.push(`${colors[i]} ${a}deg ${a+deg}deg`);a+=deg;});$('#territoryChart').innerHTML=`<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${parts.join(',')})"></div><div class="legend">${names.map((n,i)=>`<div class="legend-row"><span class="legend-dot" style="background:${colors[i]}"></span><span>${n}</span><b>${vals[i]} <small>(${(vals[i]/total*100).toFixed(0)}%)</small></b></div>`).join('')}</div></div>`;}
function renderRanking(year,metric,months,el=$('#rankingChart')){const vals=MUNICIPALITIES.map(m=>[m,municipalityMetric(year,metric,m,months)]).sort((a,b)=>b[1]-a[1]);barList(el,vals);}
function barList(el,vals){const max=Math.max(1,...vals.map(x=>x[1]));el.innerHTML=`<div style="width:100%;padding-top:4px">${vals.map(([n,v])=>`<div style="display:grid;grid-template-columns:110px 1fr 35px;gap:9px;align-items:center;margin:11px 0;font-size:11px"><span style="color:#aeb6c1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n}</span><div style="height:9px;background:#20262d;border-radius:9px;overflow:hidden"><div style="height:100%;width:${v/max*100}%;background:var(--yellow);border-radius:9px"></div></div><b>${v}</b></div>`).join('')}</div>`;}
function renderLatest(year,months,group,metric){let rows=state.occurrences.filter(r=>+r.date.slice(0,4)===+year&&months.includes(+r.date.slice(5,7))&&(group==='ALL'||r.group===group)&&(metric==='ALL'||matchesMetric(r,metric))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);$('#latestRecords').innerHTML=rows.map(r=>`<div class="latest-item"><div class="latest-date">${fmtDate(r.date)}</div><div><b>${r.crime} • ${r.municipality}</b><p>${r.history}</p></div><span class="pill">${r.group}</span></div>`).join('')||'<p>Sem registros no período.</p>';}
function populate(){
  const ys=years(),optsYears=ys.map(y=>`<option>${y}</option>`).join('');['filterYear','compYearA','compYearB','goalYear','goalFilterYear'].forEach(id=>$('#'+id).innerHTML=optsYears);
  $('#filterYear').value=ys.includes(2026)?'2026':ys[0];$('#compYearA').value=ys.includes(2026)?'2026':ys[0];$('#compYearB').value=ys.includes(2025)?'2025':ys[Math.min(1,ys.length-1)];$('#goalYear').value=$('#filterYear').value;$('#goalFilterYear').value=$('#filterYear').value;
  $('#goalMonth').innerHTML=MONTHS_LONG.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');
  $('#theftQtyYear').innerHTML=optsYears;$('#theftQtyYear').value=ys[0];$('#theftQtyMonth').innerHTML=MONTHS_LONG.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');$('#theftQtyMunicipality').innerHTML=MUNICIPALITIES.map(m=>`<option>${m}</option>`).join('');
  const opts=MUNICIPALITIES.map(m=>`<option>${m}</option>`).join('');$('#recordMunicipality').innerHTML='<option value="">Selecione...</option>'+opts;$('#recordsMunicipality').innerHTML='<option value="ALL">Todos os municípios</option>'+opts;refreshCrimeFilter();updatePeriodFilter();
}
function refreshCrimeFilter(){const crimes=[...new Set(state.occurrences.map(r=>r.crime))].sort();$('#recordsCrime').innerHTML='<option value="ALL">Todos os delitos</option>'+crimes.map(c=>`<option>${c}</option>`).join('');}
function showView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===id));const meta={dashboard:['Dashboard Criminal','Visão consolidada e dinâmica dos indicadores da 2ª Cia'],thefts:['Furto outros','Quadro estatístico mensal, médias, população e taxa por 100 mil habitantes'],new:['Novo histórico','Cadastro único que atualiza os indicadores automaticamente'],records:['Base de dados','Consulta, edição e rastreabilidade dos históricos'],goals:['Metas criminais','Cadastro mensal de metas e acompanhamento automático'],comparative:['Comparativos','Análise entre anos e territórios'],settings:['Dados & Backup','Segurança, exportação e restauração da base']};$('#pageTitle').textContent=meta[id][0];$('#pageSubtitle').textContent=meta[id][1];if(id==='thefts')renderThefts();if(id==='records')renderRecords();if(id==='goals')renderGoals();if(id==='comparative')renderComparative();if(id==='settings')renderStatus();}
function updateAutoClass(){const m=$('#recordMunicipality').value,c=$('#recordCrime').value;$('#recordGroup').value=m?groupOf(m):'';$('#autoClass').innerHTML=m&&c?`<b>${groupOf(m)}</b> • ${indicatorOf(c)} • ${m}`:'Selecione município e delito para visualizar a classificação automática.';}

function theftMunicipalitySeries(year,mun){return MONTHS.map((_,i)=>municipalityMetric(year,'FURTO_TOTAL',mun,[i+1]));}
function theftMonthsComputed(year){
  const series=metricSeries(year,'FURTO_TOTAL','ALL');
  let last=0;series.forEach((v,i)=>{if(v>0)last=i+1;});
  if(+year===new Date().getFullYear()) last=Math.max(last,new Date().getMonth()+1);
  return last||12;
}
function theftRowData(year,mun){
  const series=theftMunicipalitySeries(year,mun), months=theftMonthsComputed(year), total=series.slice(0,months).reduce((a,b)=>a+b,0), pop=state.population[mun]||0;
  return {name:mun,series,total,avg:months?total/months:0,pop,rate:pop&&months?total*100000/pop/months:0,months};
}
function renderThefts(){
  const year=+$('#theftYear').value||years()[0], rows=MUNICIPALITIES.map(m=>theftRowData(year,m));
  const months=theftMonthsComputed(year), ciaSeries=MONTHS.map((_,i)=>MUNICIPALITIES.reduce((a,m)=>a+municipalityMetric(year,'FURTO_TOTAL',m,[i+1]),0));
  const ciaTotal=ciaSeries.slice(0,months).reduce((a,b)=>a+b,0), pop=MUNICIPALITIES.reduce((a,m)=>a+(state.population[m]||0),0), ciaAvg=months?ciaTotal/months:0, rate=pop&&months?ciaTotal*100000/pop/months:0;
  const prevYear=year-1, prevMonths=theftMonthsComputed(prevYear), prevTotal=metricTotal(prevYear,'FURTO_TOTAL','ALL',Array.from({length:Math.min(months,prevMonths)},(_,i)=>i+1)), delta=prevDelta(ciaTotal,prevTotal);
  $('#theftSummary').innerHTML=`<span>Ano analisado</span><strong>${year}</strong><span>•</span><strong>${months} mês${months===1?'':'es'} computado${months===1?'':'s'}</strong><span>•</span><span>Furto outros (exclui furto/roubo de veículos)</span>`;
  $('#theftYearBadge').textContent=`${year} × ${prevYear}`;
  $('#theftKpis').innerHTML=kpiCard('Total 2ª Cia',ciaTotal,'')+kpiCard('Média mensal',ciaAvg.toFixed(1),'')+kpiCard('Furto/100 mil hab.',rate.toFixed(1),'média mensal')+kpiCard(`Variação vs. ${prevYear}`,delta===null?'—':`${delta>0?'+':''}${delta.toFixed(1)}%`,delta>0?'Aumento':'Redução');
  const cells=r=>r.series.map((v,i)=>`<td class="num ${i>=r.months?'future':''}">${i>=r.months?'—':v}</td>`).join('');
  $('#theftTableBody').innerHTML=rows.map(r=>`<tr><td><b>${r.name}</b></td>${cells(r)}<td class="num total"><b>${r.total}</b></td><td class="num">${r.avg.toFixed(1)}</td><td class="num">${r.pop.toLocaleString('pt-BR')}</td><td class="num">${r.rate.toFixed(1)}</td><td class="num">${r.months}</td></tr>`).join('')+`<tr class="cia-row"><td><b>2ª Cia</b></td>${ciaSeries.map((v,i)=>`<td class="num ${i>=months?'future':''}">${i>=months?'—':v}</td>`).join('')}<td class="num total"><b>${ciaTotal}</b></td><td class="num"><b>${ciaAvg.toFixed(1)}</b></td><td class="num"><b>${pop.toLocaleString('pt-BR')}</b></td><td class="num"><b>${rate.toFixed(1)}</b></td><td class="num"><b>${months}</b></td></tr>`;
  const s1=ciaSeries.slice(0,6).reduce((a,b)=>a+b,0),s2=ciaSeries.slice(6,12).reduce((a,b)=>a+b,0),ps=metricSeries(prevYear,'FURTO_TOTAL','ALL'),p1=ps.slice(0,6).reduce((a,b)=>a+b,0),p2=ps.slice(6,12).reduce((a,b)=>a+b,0);
  const sem=(label,val,prev)=>{const d=prevDelta(val,prev);return `<div class="semester-card"><span>${label}</span><strong>${val}</strong><small>${d===null?'sem base':`${d>0?'+':''}${d.toFixed(1)}% vs. ${prevYear}`}</small></div>`};
  $('#theftSemesterCards').innerHTML=sem('1º semestre',s1,p1)+sem('2º semestre',s2,p2);
  lineChart($('#theftYoY'),ciaSeries,MONTHS,metricSeries(prevYear,'FURTO_TOTAL','ALL'));
}
function theftCsvText(){
  const year=+$('#theftYear').value, months=theftMonthsComputed(year), q=s=>`"${String(s??'').replaceAll('"','""')}"`;
  const header=['Município',...MONTHS_LONG,'Total','Média','População','Furto/100 mil hab.','Meses'];
  const rows=MUNICIPALITIES.map(m=>theftRowData(year,m));
  const lines=rows.map(r=>[r.name,...r.series.map((v,i)=>i<months?v:''),r.total,r.avg.toFixed(2),r.pop,r.rate.toFixed(2),r.months].map(q).join(','));
  return [header.map(q).join(','),...lines].join('\n');
}

function renderRecords(){const q=$('#searchRecords').value.toLowerCase(),m=$('#recordsMunicipality').value,c=$('#recordsCrime').value;const rows=[...state.occurrences].filter(r=>(m==='ALL'||r.municipality===m)&&(c==='ALL'||r.crime===c)&&(!q||(`${r.history} ${r.municipality} ${r.crime}`).toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date));$('#recordsBody').innerHTML=rows.map(r=>`<tr><td>${fmtDate(r.date)}</td><td><span class="pill">${r.crime}</span></td><td>${r.municipality}</td><td>${r.group}</td><td class="history">${r.history}</td><td><div class="row-actions"><button class="icon-btn edit" data-id="${r.id}">Editar</button><button class="icon-btn delete" data-id="${r.id}">Excluir</button></div></td></tr>`).join('')||'<tr><td colspan="6">Nenhum registro encontrado.</td></tr>';$$('.edit').forEach(b=>b.onclick=()=>editRecord(b.dataset.id));$$('.delete').forEach(b=>b.onclick=()=>deleteRecord(b.dataset.id));}
function editRecord(id){const r=state.occurrences.find(x=>x.id===id);if(!r)return;$('#recordId').value=r.id;$('#recordDate').value=r.date;$('#recordMunicipality').value=r.municipality;$('#recordCrime').value=r.crime;$('#recordHistory').value=r.history;$('#recordResult').value=r.result||'';$('#recordNote').value=r.note||'';updateAutoClass();showView('new');}
function deleteRecord(id){const r=state.occurrences.find(x=>x.id===id);if(!r)return;if(!confirm(`Excluir definitivamente o registro de ${fmtDate(r.date)} - ${r.crime}?`))return;state.occurrences=state.occurrences.filter(x=>x.id!==id);saveState();renderRecords();renderDashboard();toast('Registro excluído.');}
function renderGoals(){const y=+$('#goalFilterYear').value,g=$('#goalFilterGroup').value;const rows=state.goals.filter(x=>+x.year===y&&(g==='ALL_FILTER'||x.group===g)).sort((a,b)=>a.month-b.month||a.metric.localeCompare(b.metric));$('#goalsBody').innerHTML=rows.map(x=>`<tr><td>${x.year}</td><td>${MONTHS_LONG[x.month-1]}</td><td>${x.group==='ALL'?'Toda 2ª Cia':x.group}</td><td>${METRICS[x.metric]}</td><td><b>${x.value}</b></td><td><div class="row-actions"><button class="icon-btn goal-edit" data-id="${x.id}">Editar</button><button class="icon-btn delete goal-delete" data-id="${x.id}">Excluir</button></div></td></tr>`).join('')||'<tr><td colspan="6">Nenhuma meta cadastrada para este filtro.</td></tr>';$$('.goal-edit').forEach(b=>b.onclick=()=>editGoal(b.dataset.id));$$('.goal-delete').forEach(b=>b.onclick=()=>deleteGoal(b.dataset.id));}
function editGoal(id){const g=state.goals.find(x=>x.id===id);if(!g)return;$('#goalId').value=g.id;$('#goalYear').value=g.year;$('#goalMonth').value=g.month;$('#goalGroup').value=g.group;$('#goalMetric').value=g.metric;$('#goalValue').value=g.value;window.scrollTo({top:0,behavior:'smooth'});}
function deleteGoal(id){const g=state.goals.find(x=>x.id===id);if(!g)return;if(!confirm(`Excluir a meta de ${MONTHS_LONG[g.month-1]} para ${METRICS[g.metric]}?`))return;state.goals=state.goals.filter(x=>x.id!==id);saveState();renderGoals();renderDashboard();toast('Meta excluída.');}
function clearGoalForm(){$('#goalForm').reset();$('#goalId').value='';$('#goalYear').value=$('#filterYear').value;}
function renderComparative(){const a=+$('#compYearA').value,b=+$('#compYearB').value,m=$('#compMetric').value,sa=metricSeries(a,m),sb=metricSeries(b,m),ta=sa.reduce((x,y)=>x+y,0),tb=sb.reduce((x,y)=>x+y,0),d=prevDelta(ta,tb);$('#compKpis').innerHTML=kpiCard(`Total ${a}`,ta)+kpiCard(`Total ${b}`,tb)+kpiCard('Variação',d===null?'—':`${d>0?'+':''}${d.toFixed(1)}%`,d>0?'Aumento':'Redução')+kpiCard('Diferença absoluta',ta-tb);$('#compSubtitle').textContent=`${a} em amarelo • ${b} em cinza`;lineChart($('#comparisonChart'),sa,MONTHS,sb);const vals=MUNICIPALITIES.map(n=>[n,municipalityMetric(a,m,n)-municipalityMetric(b,m,n)]).sort((x,y)=>Math.abs(y[1])-Math.abs(x[1]));barList($('#comparisonRanking'),vals.map(x=>[`${x[0]} (${x[1]>0?'+':''}${x[1]})`,Math.abs(x[1])]))}
function renderStatus(){$('#dataStatus').innerHTML=`<div class="status-item"><span>Históricos detalhados</span><b>${state.occurrences.length}</b></div><div class="status-item"><span>Linhas importadas de Furto outros</span><b>${state.theftLegacy.length}</b></div><div class="status-item"><span>Lançamentos/correções de Furto outros</span><b>${(state.theftOverrides||[]).length}</b></div><div class="status-item"><span>Metas cadastradas</span><b>${state.goals.length}</b></div><div class="status-item"><span>Municípios</span><b>${MUNICIPALITIES.length}</b></div><div class="status-item"><span>Armazenamento principal</span><b>${firebaseOnline?'Firebase Realtime Database':'Cópia local (offline)'}</b></div>`;}
function download(name,text,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href);}
function csvText(){const q=s=>`"${String(s??'').replaceAll('"','""')}"`;return ['Data,Delito,Município,Grupo,Histórico,Resultado,Observação,Fonte',...state.occurrences.map(r=>[r.date,r.crime,r.municipality,r.group,r.history,r.result||'',r.note||'',r.source||'Sistema'].map(q).join(','))].join('\n');}

$$('.nav-btn').forEach(b=>b.onclick=()=>showView(b.dataset.view));
$$('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));
['filterYear','filterGroup','filterCrime','filterPeriodValue'].forEach(id=>$('#'+id).onchange=renderDashboard);
$('#filterPeriodType').onchange=()=>{updatePeriodFilter();renderDashboard();};
$('#resetFilters').onclick=()=>{$('#filterYear').value='2026';$('#filterPeriodType').value='YEAR';updatePeriodFilter();$('#filterGroup').value='ALL';$('#filterCrime').value='ALL';renderDashboard();};
$('#recordMunicipality').onchange=updateAutoClass;$('#recordCrime').onchange=updateAutoClass;
$('#clearForm').onclick=()=>{$('#recordForm').reset();$('#recordId').value='';updateAutoClass();};
$('#recordForm').onsubmit=e=>{e.preventDefault();const id=$('#recordId').value||`r-${Date.now()}`;const rec={id,date:$('#recordDate').value,municipality:$('#recordMunicipality').value,group:groupOf($('#recordMunicipality').value),crime:$('#recordCrime').value,history:$('#recordHistory').value.trim(),result:$('#recordResult').value,note:$('#recordNote').value.trim(),source:'Sistema',legacy:false,updatedAt:new Date().toISOString()};const ix=state.occurrences.findIndex(x=>x.id===id);if(ix>=0)state.occurrences[ix]={...state.occurrences[ix],...rec};else state.occurrences.push(rec);saveState();refreshCrimeFilter();$('#recordForm').reset();$('#recordId').value='';updateAutoClass();renderDashboard();toast(ix>=0?'Registro atualizado.':'Histórico salvo e estatísticas atualizadas.');};
['searchRecords','recordsMunicipality','recordsCrime'].forEach(id=>$('#'+id).addEventListener(id==='searchRecords'?'input':'change',renderRecords));
$('#goalForm').onsubmit=e=>{e.preventDefault();const payload={id:$('#goalId').value||`g-${Date.now()}`,year:+$('#goalYear').value,month:+$('#goalMonth').value,group:$('#goalGroup').value,metric:$('#goalMetric').value,value:+$('#goalValue').value,updatedAt:new Date().toISOString()};const duplicate=state.goals.findIndex(g=>g.id!==payload.id&&g.year===payload.year&&g.month===payload.month&&g.group===payload.group&&g.metric===payload.metric);if(duplicate>=0){if(!confirm('Já existe uma meta para este mesmo ano, mês, território e indicador. Deseja substituí-la?'))return;state.goals.splice(duplicate,1);}const ix=state.goals.findIndex(g=>g.id===payload.id);if(ix>=0)state.goals[ix]=payload;else state.goals.push(payload);saveState();clearGoalForm();populateGoalYearsOnly();renderGoals();renderDashboard();toast(ix>=0?'Meta atualizada.':'Meta cadastrada com sucesso.');};
function populateGoalYearsOnly(){const ys=years(),curFilter=$('#goalFilterYear').value,curGoal=$('#goalYear').value;const html=ys.map(y=>`<option>${y}</option>`).join('');$('#goalYear').innerHTML=html;$('#goalFilterYear').innerHTML=html;if(ys.includes(+curGoal))$('#goalYear').value=curGoal;if(ys.includes(+curFilter))$('#goalFilterYear').value=curFilter;}
$('#clearGoalForm').onclick=clearGoalForm;$('#goalFilterYear').onchange=renderGoals;$('#goalFilterGroup').onchange=renderGoals;
$('#theftQtyForm').onsubmit=e=>{e.preventDefault();const payload={year:+$('#theftQtyYear').value,month:+$('#theftQtyMonth').value,municipality:$('#theftQtyMunicipality').value,count:+$('#theftQtyValue').value,updatedAt:new Date().toISOString()};if(payload.count<0||!Number.isFinite(payload.count))return;state.theftOverrides=state.theftOverrides||[];const ix=state.theftOverrides.findIndex(r=>+r.year===payload.year&&+r.month===payload.month&&r.municipality===payload.municipality);if(ix>=0)state.theftOverrides[ix]={...state.theftOverrides[ix],...payload};else state.theftOverrides.push({id:`ft-${Date.now()}`,...payload});saveState();populateGoalYearsOnly();$('#theftYear').innerHTML=years().map(y=>`<option>${y}</option>`).join('');$('#theftYear').value=payload.year;renderThefts();renderDashboard();renderStatus();toast(ix>=0?'Quantidade de Furto outros atualizada.':'Quantidade de Furto outros cadastrada.');};
$('#clearTheftQty').onclick=()=>{$('#theftQtyForm').reset();$('#theftQtyYear').value=$('#theftYear').value||years()[0];};
['compYearA','compYearB','compMetric'].forEach(id=>$('#'+id).onchange=renderComparative);
$('#theftYear').onchange=renderThefts;
$('#theftExportCsv').onclick=()=>download(`furto-outros-${$('#theftYear').value}.csv`,theftCsvText(),'text/csv;charset=utf-8');
$('#exportJson').onclick=()=>download(`backup-criminal-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state,null,2),'application/json');
$('#exportCsv').onclick=$('#exportCsvTop').onclick=()=>download(`historicos-criminal-${new Date().toISOString().slice(0,10)}.csv`,csvText(),'text/csv;charset=utf-8');
$('#importJson').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const x=JSON.parse(await f.text());if(!x.occurrences||!x.theftLegacy)throw Error();x.goals=x.goals||[];x.theftOverrides=x.theftOverrides||[];state=x;saveState();populate();renderDashboard();renderStatus();toast('Backup restaurado com sucesso.');}catch{alert('Arquivo de backup inválido.');}};
$('#resetData').onclick=()=>{if(!confirm('Restaurar os dados originais importados da planilha? Registros e metas adicionados nesta versão serão removidos.'))return;localStorage.removeItem(KEY);localStorage.removeItem(PREV_KEY);localStorage.removeItem(OLD_KEY);state=blankState();saveState();populate();renderDashboard();renderStatus();toast('Base original restaurada.');};

async function bootstrap(){
  await loadFirebaseState();
  populate();
  $('#theftYear').innerHTML=years().map(y=>`<option>${y}</option>`).join('');
  $('#theftYear').value=years()[0];
  $('#recordDate').value=new Date().toISOString().slice(0,10);
  renderDashboard();
  renderStatus();
}

window.addEventListener('focus',async()=>{
  if(!firebaseOnline)return;
  try{
    const remote=normalizeState(await firebaseRequest('GET','state'));
    if(remote){state=remote;localStorage.setItem(KEY,JSON.stringify(state));populate();renderDashboard();renderStatus();}
  }catch(e){setFirebaseStatus(false,'Firebase indisponível');}
});

bootstrap();
