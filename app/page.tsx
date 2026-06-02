'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import demoHoldings from '../data/demo-holdings.json';

type FundInput={id:number;code:string;amount:string;name?:string;status?:string};
type Analysis=any; type News=any; type Benchmark=any;
// 默认演示组合配置：如需修改所有人看到的默认演示持仓，可改 data/demo-holdings.json。
const demo:FundInput[]=(demoHoldings as any[]).map((item,i)=>({
 id:i+1,
 code:String(item.code||'').padStart(6,'0'),
 amount:String(item.amount||''),
 name:item.name||'',
 status:item.name?'演示导入':'待识别'
}));

function demoToText(rows:FundInput[]){
 return rows.map(r=>`${r.code} ${r.amount} ${r.name||''}`.trim()).join('\n');
}
function parseDemoConfigText(text:string){
 const rows:FundInput[]=[]; const errors:string[]=[];
 text.split(/\n+/).forEach((raw,idx)=>{
  const line=raw.trim(); if(!line) return;
  const parts=line.split(/[，,|｜\t ]+/).filter(Boolean);
  const code=(line.match(/(?<!\d)(\d{6})(?!\d)/)?.[1]||parts.find(x=>/^\d{6}$/.test(x))||'').padStart(6,'0').slice(0,6);
  const amountToken=parts.find(x=>/^\d+(?:\.\d+)?$/.test(x) && x!==code) || '';
  const amount=amountToken.replace(/,/g,'');
  const name=line.replace(code,'').replace(amountToken,'').replace(/[，,|｜;]/g,' ').trim();
  if(!code && !name){ errors.push(`第 ${idx+1} 行缺少基金代码或名称`); return; }
  if(!amount || Number.isNaN(Number(amount)) || Number(amount)<=0){ errors.push(`第 ${idx+1} 行持仓金额无效`); return; }
  rows.push({id:Date.now()+idx+Math.random(),code,amount,name,status:name?'演示导入':'待识别'});
 });
 return {rows,errors};
}
const pieColors=['#3FA7F5','#F4C430','#F59E4C','#8B6FE8','#36C3A4','#5B6FE6','#F0647A','#7CC8F8','#F7D86A','#A68EF0'];
const nav=[['section-input','01 持仓录入'],['section-overview','02 明细与概览'],['section-structure','03 结构分析'],['section-news','04 新闻情绪'],['section-ai','05 AI 报告']];
const sortLabels:any={default:'默认顺序',code:'基金代码',name:'基金名称',theme:'主题分类',amount:'持仓金额',rate:'涨跌幅',estimatedProfit:'当日估算收益'};

function reportHtml(text:string){
 return text.split('\n').filter(Boolean).map((line,i)=>{
  const clean=line.replace(/^#+\s*/,'').replace(/^[-•]\s*/,'').replace(/^\d+[\.、]\s*/,'');
  const isTitle=/^(组合概览|主要风险|市场情绪解读|结构优化建议|注意事项|一、|二、|三、|四、|五、)/.test(clean);
  return <p key={i} className={isTitle?'reportTitle':''}>{clean}</p>;
 });
}
function pct(n:number){return `${Number(n||0).toFixed(1)}%`}
function money(n:number){return `${Number(n||0).toLocaleString()} 元`}
function riskLevel(score:number){ if(score<=30) return '较低'; if(score<=60) return '中等'; if(score<=80) return '偏高'; return '较高'; }
function downloadFile(name:string,content:string,type='text/plain;charset=utf-8'){
 const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
}
function makeReportMarkdown(advice:string,analysis:any,news:any,source:string,benchmark:any){
 const hs=benchmark?.hs300; const rel=hs?Number((Number(analysis?.portfolioRate||0)-Number(hs.rate||0)).toFixed(2)):null;
 const sections=parseReportSections(advice);
 const body=sections.map(sec=>`## ${sec.title}\n${sec.body.join('\n')}`).join('\n\n');
 return `# FundCare 基金组合智能分析报告\n\n生成时间：${new Date().toLocaleString('zh-CN',{hour12:false})}\nAI 报告模式：${source}\n组合规模：${analysis?.totalAmount||0} 元\n估算涨跌幅：${analysis?.portfolioRate||0}%\n当日估算收益：${analysis?.totalProfit||0} 元\n沪深300：${hs?hs.rate+'%':'未接入'}${rel!==null?`\n相对沪深300：${rel>=0?'跑赢':'跑输'} ${Math.abs(rel)} 个百分点`:''}\n市场情绪：${news?.sentiment||'未抓取'}\n\n${body}\n\n---\n本报告仅供参考，不构成投资建议。`;
}
function sanitizeTitle(t:string){return String(t||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/^[\s•·\-*]+/,'').replace(/^<+\s*/,'').replace(/\s*>+$/,'').replace(/[《》]/g,'').trim();}
function normalizeBullets(value:any){
 const arr=Array.isArray(value)?value:String(value||'').split(/\n+/);
 return arr.map((x:any)=>String(x||'').replace(/^[-•\d\.、\s]+/,'').trim()).filter(Boolean);
}
function parseReportSections(text:string){
 const schema=[
  ['overview','组合概览','组合规模、当日收益和主题分布摘要已收起。'],
  ['risk','主要风险','主题集中度、单只权重和同类重复风险已收起。'],
  ['market','市场情绪','新闻情绪与基准对比解读已收起。'],
  ['structure','主题结构','主题占比与当日贡献来源已收起。'],
  ['suggestion','优化方向','结构检查和后续关注方向已收起。'],
  ['notice','注意事项','风险提示和使用边界已收起。']
 ];
 try{
  const obj=JSON.parse(String(text||''));
  if(obj && typeof obj==='object'){
   return schema.map(([key,title,collapsed])=>{
    const legacy:any={overview:['overview','summary','组合概览'],risk:['risk','risks','主要风险'],market:['market','市场情绪','市场情绪解读'],structure:['structure','主题结构'],suggestion:['suggestion','suggestions','优化方向','结构优化建议'],notice:['notice','notes','注意事项']};
    const keys=legacy[key]||[key];
    const val=keys.map((k:string)=>obj[k]).find((v:any)=>v!==undefined&&v!==null&&String(v).trim?.()!=='')||'';
    return {key,title,collapsed,body:normalizeBullets(val).length?normalizeBullets(val):['暂无内容。']};
   });
  }
 }catch{}
 const lines=String(text||'').split('\n').map(x=>x.trim()).filter(Boolean).map(line=>line.replace(/^#+\s*/,'').replace(/^[-•]\s*/,'').replace(/^\d+[\.、]\s*/,''));
 const sections=schema.map(([key,title,collapsed])=>({key,title,collapsed,body:[] as string[]}));
 let idx=0;
 for(const line of lines){
  const found=sections.findIndex(sec=>line===sec.title||line.startsWith(sec.title+'：')||line.startsWith(sec.title+':'));
  if(found>=0){idx=found; const rest=line.replace(sections[found].title,'').replace(/^[:：]\s*/,''); if(rest) sections[idx].body.push(rest);}
  else sections[idx].body.push(line);
 }
 return sections.map(sec=>({...sec,body:sec.body.length?sec.body:['暂无内容。']}));
}
function polar(cx:number,cy:number,r:number,angle:number){const a=(angle-90)*Math.PI/180; return {x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)};}
function arcPath(start:number,end:number,outer=46,inner=25){
 const cx=50,cy=50; const large=end-start>180?1:0; const p1=polar(cx,cy,outer,end); const p2=polar(cx,cy,outer,start); const p3=polar(cx,cy,inner,start); const p4=polar(cx,cy,inner,end);
 return `M ${p1.x} ${p1.y} A ${outer} ${outer} 0 ${large} 0 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${inner} ${inner} 0 ${large} 1 ${p4.x} ${p4.y} Z`;
}
function relText(combo:number,base:number){const diff=Number((combo-base).toFixed(2)); return `${diff>=0?'跑赢':'跑输'} ${Math.abs(diff).toFixed(2)} 个百分点`;}
function parseOcrText(text:string){
 const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean); const joined=lines.join(' ');
 const codes=[...joined.matchAll(/(?<!\d)(\d{6})(?!\d)/g)].map(m=>m[1]);
 const rows:FundInput[]=[]; const seen=new Set<string>();
 for(const code of codes){
   if(seen.has(code)) continue; seen.add(code);
   const idx=joined.indexOf(code); const near=joined.slice(Math.max(0,idx-40),idx+90);
   const amountMatch=near.match(/(?:持有金额|持仓金额|市值|金额|资产)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]{3,}(?:\.\d{1,2})?)/g);
   let amount='';
   if(amountMatch){ const nums=amountMatch.map(x=>x.replace(/[^0-9.]/g,'')).filter(x=>Number(x)>0&&x!==code); amount=nums[nums.length-1]||''; }
   rows.push({id:Date.now()+Math.random()+rows.length,code,amount,name:'',status:'截图识别待确认'});
 }
 return rows;
}

function parseBulkHoldings(text:string){
 const rows:FundInput[]=[]; const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
 for(const line of lines){
   const code=line.match(/(?<!\d)(\d{6})(?!\d)/)?.[1]||'';
   const nums=[...line.matchAll(/\d+(?:,\d{3})*(?:\.\d+)?/g)].map(m=>m[0]).filter(x=>x.replace(/,/g,'')!==code);
   const amount=(nums[0]||'').replace(/,/g,'');
   const name=line.replace(code,'').replace(nums[0]||'','').replace(/[，,;；|]/g,' ').trim();
   if(code||amount||name) rows.push({id:Date.now()+Math.random()+rows.length,code,amount,name,status:'批量粘贴待确认'});
 }
 return rows;
}

export default function Page(){
 const [funds,setFunds]=useState<FundInput[]>([{id:Date.now(),code:'',amount:''}]);
 const [loading,setLoading]=useState(''); const [analysis,setAnalysis]=useState<Analysis|null>(null); const [news,setNews]=useState<News|null>(null); const [benchmark,setBenchmark]=useState<Benchmark|null>(null); const [advice,setAdvice]=useState(''); const [source,setSource]=useState(''); const [error,setError]=useState('');
 const [activeMetric,setActiveMetric]=useState(''); const [showScaleAmount,setShowScaleAmount]=useState(false); const [showProfitAmount,setShowProfitAmount]=useState(true); const [showRateAmount,setShowRateAmount]=useState(true); const [selectedTheme,setSelectedTheme]=useState(''); const [pulseTheme,setPulseTheme]=useState(''); const [hoverTheme,setHoverTheme]=useState<any|null>(null); const [tooltipPos,setTooltipPos]=useState({x:0,y:0}); const [newsFilter,setNewsFilter]=useState<'all'|'positive'|'negative'|'neutral'>('all'); const [activeNews,setActiveNews]=useState(''); const [showRules,setShowRules]=useState(false);
 const [showDisclaimer,setShowDisclaimer]=useState(false); const [sort,setSort]=useState<{key:string;dir:'asc'|'desc'|''}>({key:'default',dir:''}); const [collapsedReport,setCollapsedReport]=useState<Record<string,boolean>>({}); const [showAllInput,setShowAllInput]=useState(false); const [showAllRows,setShowAllRows]=useState(false); const [showAllNews,setShowAllNews]=useState(false);
 const [ocrOpen,setOcrOpen]=useState(false); const [ocrLoading,setOcrLoading]=useState(false); const [ocrText,setOcrText]=useState(''); const [ocrRows,setOcrRows]=useState<FundInput[]>([]); const [pasteText,setPasteText]=useState(''); const [dragging,setDragging]=useState(false); const fileRef=useRef<HTMLInputElement|null>(null);
 const [demoOpen,setDemoOpen]=useState(false);const [isMobile,setIsMobile]=useState(false); const [demoText,setDemoText]=useState(demoToText(demo)); const [demoMessage,setDemoMessage]=useState('');
 const canAnalyze=useMemo(()=>funds.some(f=>f.code&&Number(f.amount)>0),[funds]);
 useEffect(()=>{setShowDisclaimer(true); try{localStorage.removeItem('fundcare_holdings_v53');}catch{}},[]);
 useEffect(()=>{
  const check=()=>setIsMobile(window.matchMedia('(max-width: 768px)').matches);
  check();
  window.addEventListener('resize',check);
  return()=>window.removeEventListener('resize',check);
},[]);
 useEffect(()=>{
  const check=()=>setIsMobile(window.innerWidth<=768);
  check();
  window.addEventListener('resize',check);
  return()=>window.removeEventListener('resize',check);
},[]);
 useEffect(()=>{setActiveNews(''); setShowAllNews(false);},[newsFilter]);
 useEffect(()=>{try{localStorage.setItem('fundcare_holdings_v53',JSON.stringify(funds));}catch{}},[funds]);
 function update(id:number,patch:Partial<FundInput>){setFunds(v=>v.map(f=>f.id===id?{...f,...patch}:f))}
 function add(){setFunds(v=>[...v,{id:Date.now()+Math.random(),code:'',amount:''}])}
 function remove(id:number){setFunds(v=>v.length>1?v.filter(f=>f.id!==id):v)}
 function clearLocal(){localStorage.removeItem('fundcare_holdings_v53'); setFunds([{id:Date.now(),code:'',amount:''}]); setAnalysis(null); setNews(null); setBenchmark(null); setAdvice('');}

 function importDemo(){
  let rows=demo;
  try{ const saved=localStorage.getItem('fundcare_custom_demo_v1'); if(saved){ const parsed=JSON.parse(saved); if(Array.isArray(parsed)&&parsed.length) rows=parsed.map((r:any,i:number)=>({id:Date.now()+i,code:String(r.code||'').padStart(6,'0'),amount:String(r.amount||''),name:r.name||'',status:r.name?'演示导入':'待识别'})); }}catch{}
  setFunds(rows.map((r,i)=>({...r,id:Date.now()+i,status:r.name?'演示导入':'待识别'}))); setAnalysis(null); setAdvice(''); setNews(null); setBenchmark(null); setError('');
 }
 function saveDemoConfig(){
  const parsed=parseDemoConfigText(demoText);
  if(parsed.errors.length){ setDemoMessage(parsed.errors.slice(0,3).join('；')); return; }
  if(!parsed.rows.length){ setDemoMessage('请至少填写一只基金。'); return; }
  try{ localStorage.setItem('fundcare_custom_demo_v1',JSON.stringify(parsed.rows.map(({code,amount,name})=>({code,amount,name})))); setDemoMessage(`已保存 ${parsed.rows.length} 只演示基金。下次点击“导入演示组合”会优先使用这份设置。`); }
  catch{ setDemoMessage('保存失败：浏览器本地存储不可用。'); }
 }
 function resetDemoConfig(){
  try{localStorage.removeItem('fundcare_custom_demo_v1');}catch{}
  setDemoText(demoToText(demo)); setDemoMessage('已恢复默认演示组合。');
 }
 function selectTheme(theme:string){
  setSelectedTheme(theme);
  setPulseTheme('');
  requestAnimationFrame(()=>setPulseTheme(theme));
 }
 async function lookup(){
  setError(''); setLoading('正在识别基金名称...');
  try{ const codes=funds.map(f=>f.code).filter(Boolean); const res=await fetch('/api/lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codes})}); if(!res.ok) throw new Error('识别接口返回异常'); const data=await res.json(); const map:Record<string,any>={}; (data.funds||[]).forEach((x:any)=>map[String(x.code).padStart(6,'0')]=x); setFunds(v=>v.map(f=>{ if(!f.code)return f; const key=String(f.code).padStart(6,'0'); const info=map[key]; return {...f,code:key,name:info?.name||f.name||'',status:info?.status||f.status||'未识别'}; })); }
  catch(e:any){ setError('基金名称识别失败：请检查网络，或先手动填写基金名称后继续分析。'); }
  setLoading('');
 }
 async function run(){
  setError(''); setLoading('正在自动分类、估算涨跌、抓取新闻并生成 AI 报告...'); setAdvice(''); setActiveMetric(''); setSelectedTheme(''); setPulseTheme('');
  try{ const clean=funds.filter(f=>f.code&&Number(f.amount)>0); const a=await (await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({funds:clean})})).json(); setAnalysis(a); setTimeout(()=>document.getElementById('section-overview')?.scrollIntoView({behavior:'smooth',block:'start'}),80); const [n,b]=await Promise.all([(await fetch('/api/news')).json(),(await fetch('/api/benchmark')).json()]); setNews(n); setBenchmark(b); const ai=await (await fetch('/api/ai-advice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({analysis:a,news:n,benchmark:b})})).json(); setAdvice(ai.advice); setSource(ai.source); }
  catch(e:any){ setError('分析失败：请确认项目已经启动，或稍后重试。'); }
  setLoading('');
 }
 async function handleOcr(file:File){
  setOcrLoading(true); setOcrText(''); setOcrRows([]); setError('');
  try{
    if(!(window as any).Tesseract){ await new Promise<void>((resolve,reject)=>{const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; s.onload=()=>resolve(); s.onerror=()=>reject(new Error('OCR库加载失败')); document.body.appendChild(s);}); }
    const T=(window as any).Tesseract; const ret=await T.recognize(file,'chi_sim+eng',{logger:()=>{}}); const text=ret?.data?.text||''; setOcrText(text); const parsed=parseOcrText(text); setOcrRows(parsed.length?parsed:[{id:Date.now(),code:'',amount:'',name:'',status:'需手动补充'}]);
  }catch(e:any){ setError('截图识别失败：请换一张更清晰的持仓截图，或继续手动录入。'); }
  setOcrLoading(false);
 }
 function confirmOcr(){ const valid=ocrRows.filter(r=>r.code||r.amount||r.name); if(valid.length){setFunds(valid.map((r,i)=>({...r,id:Date.now()+i,status:r.status||'截图导入待识别'}))); setOcrOpen(false); setOcrText(''); setOcrRows([]);} }
 const themeRows=(analysis?.themeRows||[]).map((t:any,i:number)=>({...t,color:pieColors[i%pieColors.length]}));
 const maxThemeProfit=Math.max(1,...themeRows.map((r:any)=>Math.abs(r.estimatedProfit||0)));
 const sortedRows=useMemo(()=>{ const rows=[...(analysis?.rows||[])]; if(!sort.key||sort.key==='default'||!sort.dir) return rows; rows.sort((a:any,b:any)=>{ const av=a[sort.key], bv=b[sort.key]; const na=Number(av), nb=Number(bv); let cmp=0; if(!Number.isNaN(na)&&!Number.isNaN(nb)) cmp=na-nb; else cmp=String(av||'').localeCompare(String(bv||''),'zh-CN'); return sort.dir==='asc'?cmp:-cmp; }); return rows; },[analysis,sort]);
 function toggleSort(key:string){ setSort(s=>s.key!==key?{key,dir:'asc'}:s.dir==='asc'?{key,dir:'desc'}:s.dir==='desc'?{key:'default',dir:''}:{key,dir:'asc'}); }
 const defaultInputCount=isMobile?2:5;
const visibleInputFunds=showAllInput?funds:funds.slice(0,defaultInputCount);
 const visibleRows=showAllRows?sortedRows:sortedRows.slice(0,isMobile?3:6);
 const metricDetail=useMemo(()=>{
  if(!analysis||!activeMetric) return null; const rows=analysis.rows||[]; const themes=analysis.themeRows||[]; const maxFund=[...rows].sort((a:any,b:any)=>b.amount-a.amount)[0]; const bestFund=[...rows].sort((a:any,b:any)=>b.estimatedProfit-a.estimatedProfit)[0]; const worstFund=[...rows].sort((a:any,b:any)=>a.estimatedProfit-b.estimatedProfit)[0]; const bestTheme=[...themes].sort((a:any,b:any)=>(b.estimatedProfit||0)-(a.estimatedProfit||0))[0]; const worstTheme=[...themes].sort((a:any,b:any)=>(a.estimatedProfit||0)-(b.estimatedProfit||0))[0]; const hs=benchmark?.hs300; const rel=hs?relText(Number(analysis.portfolioRate||0),Number(hs.rate||0)):'';
  const hasPositiveTheme=(bestTheme?.estimatedProfit||0)>0; const hasPositiveFund=(bestFund?.estimatedProfit||0)>0;
  const hasNegativeTheme=(worstTheme?.estimatedProfit||0)<0; const hasNegativeFund=(worstFund?.estimatedProfit||0)<0;
  const positiveThemeLabel=hasPositiveTheme?'正贡献最大的主题':'拖累较小的主题';
  const positiveFundLabel=hasPositiveFund?'正贡献最大的基金':'拖累较小的基金';
  const negativeThemeLabel=hasNegativeTheme?'负贡献最大的主题':'贡献较小的主题';
  const negativeFundLabel=hasNegativeFund?'负贡献最大的基金':'贡献较小的基金';
  const map:any={
   scale:{title:'组合规模说明',lines:[`当前纳入分析基金：${rows.length} 只`,`总持仓金额：${money(analysis.totalAmount)}`,`平均单只持仓：${money(rows.length?analysis.totalAmount/rows.length:0)}`,`最大单只持仓：${maxFund?.code||'-'} ${maxFund?.name||''}，${money(maxFund?.amount||0)}`]},
   profit:{title:'估算盈亏构成',lines:[`${positiveThemeLabel}：${bestTheme?.theme||'-'} ${money(bestTheme?.estimatedProfit||0)}`,`${negativeThemeLabel}：${worstTheme?.theme||'-'} ${money(worstTheme?.estimatedProfit||0)}`,`${positiveFundLabel}：${bestFund?.code||'-'} ${bestFund?.name||''} ${money(bestFund?.estimatedProfit||0)}`,`${negativeFundLabel}：${worstFund?.code||'-'} ${worstFund?.name||''} ${money(worstFund?.estimatedProfit||0)}`,`完整基金级数据见下方基金明细表，避免重复展示。`]},
   rate:{title:'估算涨跌幅与基准对比',lines:[`组合估算涨跌幅：${analysis.portfolioRate}%`,hs?`沪深300：${hs.rate}%`:'沪深300：暂未获取到数据',hs?`相对沪深300：${rel}`:'相对沪深300：待数据返回后显示',`计算方式：组合预估盈亏 ÷ 组合总持仓金额。`,`说明：基金净值通常在交易日收盘后披露，当前结果可能存在延迟或误差，最终以基金公司披露净值为准。`]},
   risk:{title:'集中度风险说明',lines:[`当前等级：${riskLevel(analysis.riskScore)}（${analysis.riskScore}/100）`,`第一大主题：${themes[0]?.theme||'-'}，占比 ${pct(themes[0]?.ratio||0)}`,`前两大主题合计占比：${pct(analysis.riskDetail?.topTwoThemeRatio||0)}`,`第一大基金：${maxFund?.code||'-'} ${maxFund?.name||''}，占比 ${pct(maxFund?.amount/analysis.totalAmount*100||0)}`,`基金数量：${rows.length} 只`,`评分参考第一大主题占比、前两大主题占比、第一大基金占比和基金数量。0–30较低，31–60中等，61–80偏高，81–100较高。`]}
  };
  return map[activeMetric];
 },[analysis,activeMetric,benchmark]);
 const selectedThemeRows=selectedTheme?(analysis?.rows||[]).filter((r:any)=>r.theme===selectedTheme):[];
 const filteredNews=useMemo(()=>{ if(!news) return []; if(newsFilter==='positive') return (news.positive||[]).map(sanitizeTitle); if(newsFilter==='negative') return (news.negative||[]).map(sanitizeTitle); if(newsFilter==='neutral') return (news.neutral||[]).map(sanitizeTitle); return (news.titles||[]).map(sanitizeTitle); },[news,newsFilter]);
 const visibleNews=showAllNews?filteredNews:filteredNews.slice(0,5);
 const filterLabel=newsFilter==='all'?'全部新闻':newsFilter==='positive'?'积极新闻':newsFilter==='negative'?'消极新闻':'中性新闻';
 const pieSegments=themeRows.reduce((acc:any[],t:any)=>{ const start=acc.length?acc[acc.length-1].end:0; const end=start+(t.ratio||0)*3.6; acc.push({...t,start,end,d:arcPath(start,end)}); return acc;},[]);
 const sortedThemesByProfit=[...themeRows].sort((a:any,b:any)=>(b.estimatedProfit||0)-(a.estimatedProfit||0));
 const topTheme=sortedThemesByProfit[0]; const bottomTheme=sortedThemesByProfit[sortedThemesByProfit.length-1];
 const contributionSummary=selectedTheme?`当前选中：${selectedTheme}`:((topTheme?.estimatedProfit||0)>0?`最大正贡献：${topTheme?.theme||'-'} ｜ 最大拖累：${bottomTheme?.theme||'-'}`:`拖累较小：${topTheme?.theme||'-'} ｜ 最大拖累：${bottomTheme?.theme||'-'}`);
 const reportSections=useMemo(()=>parseReportSections(advice),[advice]);
 return <main>
  {showDisclaimer&&<div className="modalMask"><div className="modal"><h2>免责声明</h2><p>FundCare 仅用于基金组合信息整理、持仓结构分析、新闻情绪辅助判断和 AI 文本生成展示。本工具不提供确定性收益预测，不构成任何基金、证券或其他金融产品的买入、卖出、持有建议。</p><p>页面中的涨跌幅、预估盈亏、新闻情绪和 AI 报告均可能存在延迟、误差或不完整情况。用户应以基金公司、交易平台及监管机构披露的信息为准，并自行承担投资决策风险。</p><div className="modalActions"><a href="/disclaimer" target="_blank">免责声明</a><a href="/privacy" target="_blank">隐私政策</a><button className="primary" onClick={()=>setShowDisclaimer(false)}>我已知晓并继续使用</button></div></div></div>}
  <section className="hero boxed sectionEnter"><div><p className="eyebrow brandTitle">FUNDCARE</p><h1><span>基金组合智能分析工具</span></h1><p className="sub">输入基金代码与持仓金额，FundCare 可自动识别基金名称，并在分析阶段生成主题分类、估算涨跌、新闻情绪观察和 AI 组合分析报告。工具重点在于帮助用户整理个人基金组合、理解主题分布和识别结构性风险，不做确定性收益预测，也不提供明确买卖指令。</p><div className="flow">{nav.map(([id,label],i)=><a style={{animationDelay:`${0.12+i*0.06}s`}} key={id} href={`#${id}`}>{label}</a>)}</div></div><div className="heroCard"><b>工具定位</b><p>FundCare 面向个人基金组合的结构分析场景，帮助用户快速查看持仓分布、主题集中度、短期估算波动和外部新闻情绪。</p><small>系统输出仅用于信息整理和风险提示，最终仍应以基金公司披露净值和个人独立判断为准。</small></div></section>

  <section id="section-input" className="boxed panel sectionEnter">
   <div className="panelHead"><div><h2>01 持仓录入与基金识别</h2><p>只需要输入基金代码和持仓金额。基金名称可自动识别；主题分类放到后续分析阶段自动完成。</p></div><div className="demoControl"><button className="ghost demoImport" onClick={importDemo}>导入演示组合</button><button className="demoGear" title="演示组合设置" aria-label="演示组合设置" aria-expanded={demoOpen} onClick={()=>setDemoOpen(v=>!v)}>⚙</button></div></div>
   <div className="inputTools"><button className="secondary" onClick={()=>setOcrOpen(!ocrOpen)}>上传持仓截图识别（Beta）</button><button onClick={()=>downloadFile('fundcare-holdings.json',JSON.stringify(funds,null,2),'application/json;charset=utf-8')}>导出持仓配置</button><button onClick={clearLocal}>清空本地数据</button></div>
   {demoOpen&&<div className="demoEditor"><div><h3>演示组合设置</h3><p>每行一只基金，支持空格、逗号或竖线分隔：基金代码 持仓金额 基金名称。该设置仅保存在当前浏览器。</p></div><textarea value={demoText} onChange={e=>{setDemoText(e.target.value);setDemoMessage('')}} spellCheck={false}/><div className="demoEditorActions"><button className="secondary" onClick={saveDemoConfig}>保存设置</button><button className="mini" onClick={resetDemoConfig}>恢复默认</button><button className="mini" onClick={()=>setDemoOpen(false)}>关闭</button></div>{demoMessage&&<p className="demoMessage">{demoMessage}</p>}</div>}
   {ocrOpen&&<div className="ocrBox"><div className="ocrHead"><div><h3>截图辅助识别（Beta）</h3><p>支持把支付宝/基金持仓截图拖入下方区域，OCR 会先提取文字，再生成待确认列表。识别结果可能有误，需确认后才导入。</p></div><button className="mini" onClick={()=>fileRef.current?.click()}>选择截图</button><input ref={fileRef} type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0]; if(f) handleOcr(f)}}/></div><div className={`dropZone ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files?.[0]; if(f) handleOcr(f)}}><b>拖入持仓截图到这里</b><span>或点击“选择截图”。识别失败时，可复制文字到下方批量导入。</span></div>{ocrLoading&&<p className="loading">正在识别截图文字；如果失败，可改用下方文本粘贴导入。</p>}{ocrText&&<details><summary>查看 OCR 原始文字</summary><pre>{ocrText}</pre></details>}<div className="pasteBox"><textarea placeholder="也可以粘贴持仓文本，例如：018957 3015.68 中航机遇领航混合C" value={pasteText} onChange={e=>setPasteText(e.target.value)} /><button className="secondary" onClick={()=>setOcrRows(parseBulkHoldings(pasteText))} disabled={!pasteText.trim()}>解析粘贴文本</button></div>{ocrRows.length>0&&<div className="ocrRows"><div className="row header"><span>基金代码</span><span>持仓金额</span><span>基金名称</span><span>状态</span><span>操作</span></div>{ocrRows.map(r=><div className="row" key={r.id}><input value={r.code} onChange={e=>setOcrRows(v=>v.map(x=>x.id===r.id?{...x,code:e.target.value.replace(/\D/g,'').slice(0,6)}:x))}/><input value={r.amount} onChange={e=>setOcrRows(v=>v.map(x=>x.id===r.id?{...x,amount:e.target.value}:x))}/><input placeholder="可确认后再识别" value={r.name||''} onChange={e=>setOcrRows(v=>v.map(x=>x.id===r.id?{...x,name:e.target.value}:x))}/><span className="badge manual">{r.status||'待确认'}</span><button className="mini" onClick={()=>setOcrRows(v=>v.filter(x=>x.id!==r.id))}>删除</button></div>)}</div>}<div className="actions"><button className="secondary" onClick={()=>setOcrRows(v=>[...v,{id:Date.now()+Math.random(),code:'',amount:'',name:'',status:'手动补充'}])}>+ 添加识别行</button><button className="primary" disabled={!ocrRows.length} onClick={confirmOcr}>确认导入录入表</button></div></div>}
   <div className="inputTable"><div className="row header"><span>基金代码</span><span>持仓金额</span><span>基金名称</span><span>识别状态</span><span>操作</span></div>{visibleInputFunds.map(f=><div className="row" key={f.id}><input placeholder="如 018957" value={f.code} onChange={e=>update(f.id,{code:e.target.value.replace(/\D/g,'').slice(0,6),name:'',status:'待识别'})}/><input placeholder="如 3000" value={f.amount} onChange={e=>update(f.id,{amount:e.target.value})}/><input placeholder="点击识别后自动填写，也可手动修改" value={f.name||''} onChange={e=>update(f.id,{name:e.target.value,status:'手动填写'})}/><span className={`badge ${(f.status||'待识别').includes('已')?'ok':(f.status||'').includes('手动')||(f.status||'').includes('截图')?'manual':'wait'}`}>{f.status||'待识别'}</span><button className="mini" onClick={()=>remove(f.id)}>删除</button></div>)}</div>{funds.length>5&&<div className="tableToggle"><span>当前已录入 {funds.length} 只基金，默认显示前 {defaultInputCount} 只。</span><button className="mini" onClick={()=>setShowAllInput(!showAllInput)}>{showAllInput?'收起持仓':'展开全部持仓'}</button></div>}
   <div className="actions"><button onClick={add} className="secondary">+ 添加基金</button><button onClick={lookup} disabled={!funds.some(f=>f.code)} className="secondary">识别基金名称</button><button onClick={run} disabled={!canAnalyze} className="primary">开始智能分析</button></div>
   {loading&&<p className="loading">{loading}</p>}{error&&<p className="error">{error}</p>}
   <p className="localNote">默认打开为空白；如需保留当前持仓，可使用“导出持仓配置”保存，或复制批量文本后下次粘贴导入。</p>
  </section>

  {analysis&&<>
   <section id="section-overview" className="boxed panel sectionEnter"><h2>02 持仓明细与组合概览</h2><p className="note">先看组合总体，再看每只基金细节；点击上方指标卡片可在下方查看计算依据。</p><div className="metrics"><div role="button" tabIndex={0} onClick={()=>setActiveMetric(activeMetric==='scale'?'':'scale')} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setActiveMetric(activeMetric==='scale'?'':'scale')}}} className={`metricCard ${activeMetric==='scale'?'activeMetric':''}`}><span className="metricTitleLine"><span>组合规模</span><button type="button" className="amountToggle" aria-pressed={!showScaleAmount} aria-label={showScaleAmount?'隐藏组合规模金额':'显示组合规模金额'} title={showScaleAmount?'隐藏组合规模金额':'显示组合规模金额'} onClick={(e)=>{e.stopPropagation();setShowScaleAmount(v=>!v)}}>{showScaleAmount?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6.7 5 2.3 8.1 1 12c1.3 3.9 5.7 7 11 7s9.7-3.1 11-7c-1.3-3.9-5.7-7-11-7Zm0 11.5A4.5 4.5 0 1 1 12 7a4.5 4.5 0 0 1 0 9.5Zm0-2A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5.5Z"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.3 2 22 20.7 20.7 22l-3-3A12.7 12.7 0 0 1 12 20C6.7 20 2.3 16.9 1 13c.6-1.9 1.9-3.6 3.6-4.9L2 3.3 3.3 2Zm4 8.8A4.5 4.5 0 0 0 13.2 16l-1.7-1.7A2.5 2.5 0 0 1 9.7 12.5L7.3 10.8ZM12 6c5.3 0 9.7 3.1 11 7a11.1 11.1 0 0 1-3.2 4.6l-3.1-3.1A4.5 4.5 0 0 0 10.5 8.3L8.2 6A12.3 12.3 0 0 1 12 6Z"/></svg>}</button></span><b>{showScaleAmount?Number(analysis.totalAmount||0).toLocaleString():'******'}</b></div><div role="button" tabIndex={0} onClick={()=>setActiveMetric(activeMetric==='profit'?'':'profit')} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setActiveMetric(activeMetric==='profit'?'':'profit')}}} className={`metricCard ${activeMetric==='profit'?'activeMetric':''}`}><span className="metricTitleLine"><span>估算盈亏</span><button type="button" className="amountToggle" aria-pressed={!showProfitAmount} aria-label={showProfitAmount?'隐藏估算盈亏':'显示估算盈亏'} title={showProfitAmount?'隐藏估算盈亏':'显示估算盈亏'} onClick={(e)=>{e.stopPropagation();setShowProfitAmount(v=>!v)}}>{showProfitAmount?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6.7 5 2.3 8.1 1 12c1.3 3.9 5.7 7 11 7s9.7-3.1 11-7c-1.3-3.9-5.7-7-11-7Zm0 11.5A4.5 4.5 0 1 1 12 7a4.5 4.5 0 0 1 0 9.5Zm0-2A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5.5Z"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.3 2 22 20.7 20.7 22l-3-3A12.7 12.7 0 0 1 12 20C6.7 20 2.3 16.9 1 13c.6-1.9 1.9-3.6 3.6-4.9L2 3.3 3.3 2Zm4 8.8A4.5 4.5 0 0 0 13.2 16l-1.7-1.7A2.5 2.5 0 0 1 9.7 12.5L7.3 10.8ZM12 6c5.3 0 9.7 3.1 11 7a11.1 11.1 0 0 1-3.2 4.6l-3.1-3.1A4.5 4.5 0 0 0 10.5 8.3L8.2 6A12.3 12.3 0 0 1 12 6Z"/></svg>}</button></span><b className={analysis.totalProfit>=0?'red':'green'}>{showProfitAmount?Number(analysis.totalProfit||0).toLocaleString():'******'}</b></div><div role="button" tabIndex={0} onClick={()=>setActiveMetric(activeMetric==='rate'?'':'rate')} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setActiveMetric(activeMetric==='rate'?'':'rate')}}} className={`metricCard ${activeMetric==='rate'?'activeMetric':''}`}><span className="metricTitleLine"><span>估算涨跌幅</span><button type="button" className="amountToggle" aria-pressed={!showRateAmount} aria-label={showRateAmount?'隐藏估算涨跌幅':'显示估算涨跌幅'} title={showRateAmount?'隐藏估算涨跌幅':'显示估算涨跌幅'} onClick={(e)=>{e.stopPropagation();setShowRateAmount(v=>!v)}}>{showRateAmount?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6.7 5 2.3 8.1 1 12c1.3 3.9 5.7 7 11 7s9.7-3.1 11-7c-1.3-3.9-5.7-7-11-7Zm0 11.5A4.5 4.5 0 1 1 12 7a4.5 4.5 0 0 1 0 9.5Zm0-2A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5.5Z"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.3 2 22 20.7 20.7 22l-3-3A12.7 12.7 0 0 1 12 20C6.7 20 2.3 16.9 1 13c.6-1.9 1.9-3.6 3.6-4.9L2 3.3 3.3 2Zm4 8.8A4.5 4.5 0 0 0 13.2 16l-1.7-1.7A2.5 2.5 0 0 1 9.7 12.5L7.3 10.8ZM12 6c5.3 0 9.7 3.1 11 7a11.1 11.1 0 0 1-3.2 4.6l-3.1-3.1A4.5 4.5 0 0 0 10.5 8.3L8.2 6A12.3 12.3 0 0 1 12 6Z"/></svg>}</button></span><b className={analysis.portfolioRate>=0?'red':'green'}>{showRateAmount?`${analysis.portfolioRate}%`:'****%'}</b></div><button onClick={()=>setActiveMetric(activeMetric==='risk'?'':'risk')} className={`metricCard ${activeMetric==='risk'?'activeMetric':''}`}><span className="metricTitleLine"><span>集中度风险</span></span><b>{analysis.riskScore}/100</b></button></div>{activeMetric&&metricDetail&&<div className="metricDetailCard"><div><h3>{metricDetail.title}</h3><button className="mini" onClick={()=>setActiveMetric('')}>收起</button></div>{metricDetail.lines.map((x:string)=><p key={x}>• {x}</p>)}</div>}
   <div className="mobileSort"><label>排序方式：</label><select value={`${sort.key}:${sort.dir}`} onChange={e=>{const [key,dir]=e.target.value.split(':'); setSort({key,dir:dir as any});}}><option value="default:">默认顺序</option><option value="amount:desc">持仓金额从高到低</option><option value="amount:asc">持仓金额从低到高</option><option value="rate:desc">涨跌幅从高到低</option><option value="rate:asc">涨跌幅从低到高</option><option value="estimatedProfit:desc">当日估算收益从高到低</option><option value="estimatedProfit:asc">当日估算收益从低到高</option></select></div>
   <div className="detailTable"><div className="dHead">{['code','name','theme','amount','rate','estimatedProfit'].map(k=><button key={k} onClick={()=>toggleSort(k)} aria-sort={sort.key===k?(sort.dir==='asc'?'ascending':'descending'):'none'}>{sortLabels[k]} {sort.key===k?(sort.dir==='asc'?'↑':'↓'):'↕'}</button>)}</div>{visibleRows.map((r:any)=><div className="dRow" key={r.code}><span data-label="基金代码">{r.code}</span><span data-label="基金名称">{r.name}</span><span data-label="主题分类"><em className="themeTag">{r.theme}</em></span><span data-label="持仓金额">{Number(r.amount).toLocaleString()}</span><span data-label="涨跌幅" className={r.rate>=0?'red':'green'}>{r.rate}%</span><span data-label="当日估算收益" className={r.estimatedProfit>=0?'red':'green'}>{r.estimatedProfit}</span></div>)}</div>{sortedRows.length>6&&<div className="tableToggle detailToggle"><span>当前显示 {visibleRows.length} / {sortedRows.length} 只基金。</span><button className="mini" onClick={()=>setShowAllRows(!showAllRows)}>{showAllRows?'收起明细':'查看全部基金明细'}</button></div>}<p className="note sourceNote">数据说明：涨跌幅和当日估算收益为实时估算或备用估算结果，最终以基金公司披露净值为准。</p></section>

   <section id="section-structure" className="boxed panel sectionEnter"><div className="panelIntro"><h2>03 组合结构分析</h2><p>左侧看主题配置结构，右侧看各主题对当日估算盈亏的贡献。点击饼图、图例或柱状图后，左右会联动高亮，并在右下展示该主题下基金盈亏详情。</p></div><div className="analysisGrid linked"><div className="subCard structureCard"><h3>主题配置结构</h3><div className="donutBox"><svg viewBox="0 0 100 100" className="donut">{pieSegments.map((s:any)=><path key={s.theme} d={s.d} fill={s.color} className={`pieSlice ${selectedTheme===s.theme?'selected':''}`} onMouseEnter={()=>setHoverTheme(s)} onMouseMove={(e)=>setTooltipPos({x:e.clientX, y:e.clientY})} onMouseLeave={()=>setHoverTheme(null)} onClick={()=>selectTheme(s.theme)} />)}<circle cx="50" cy="50" r="22" fill="#fff"/><text x="50" y="48" textAnchor="middle" className="donutNum">{themeRows.length}</text><text x="50" y="56" textAnchor="middle" className="donutText">类主题</text></svg></div><div className="legend">{themeRows.map((p:any)=><button key={p.theme} className={selectedTheme===p.theme?'selected':''} onMouseEnter={()=>setHoverTheme(p)} onMouseMove={(e)=>setTooltipPos({x:e.clientX, y:e.clientY})} onMouseLeave={()=>setHoverTheme(null)} onClick={()=>selectTheme(p.theme)}><i style={{background:p.color}}></i><span>{p.theme}</span><b>{pct(p.ratio)}</b></button>)}</div><p className="hintText">点击图例或扇区，可联动查看右侧主题贡献与基金详情。</p></div><div className="subCard contributionCard"><div className="subHead"><h3>主题盈亏贡献</h3><button className="mini" disabled={!selectedTheme} onClick={()=>{setSelectedTheme('');setPulseTheme('')}}>清除选中</button></div><p className="barSummary">{contributionSummary}</p><div className="profitBars">{themeRows.map((r:any)=><button key={r.theme} data-theme={r.theme} className={`profitLine ${selectedTheme===r.theme?'selected':''} ${pulseTheme===r.theme?'pulse':''}`} onMouseEnter={()=>setHoverTheme(r)} onMouseMove={(e)=>setTooltipPos({x:e.clientX, y:e.clientY})} onMouseLeave={()=>setHoverTheme(null)} onClick={()=>selectTheme(r.theme)}><span>{r.theme}</span><div><i key={selectedTheme===r.theme?`active-${r.theme}`:`idle-${r.theme}`} className={(r.estimatedProfit||0)>=0?'pos':'neg'} style={{width:`${Math.max(6,Math.abs(r.estimatedProfit||0)/maxThemeProfit*100)}%`}}></i></div><b className={(r.estimatedProfit||0)>=0?'red':'green'}>{r.estimatedProfit}</b></button>)}</div><div className="themeDetailBox">{selectedTheme?<><div className="themeDetailHead"><h3>{selectedTheme} · 主题基金盈亏详情</h3><span>{selectedThemeRows.length} 只基金</span></div><div className="miniTable compact"><div><b>基金代码</b><b>基金名称</b><b>涨跌幅</b><b>当日估算收益</b></div>{selectedThemeRows.map((r:any)=><div key={r.code}><span>{r.code}</span><span>{r.name}</span><span className={r.rate>=0?'red':'green'}>{r.rate}%</span><span className={r.estimatedProfit>=0?'red':'green'}>{money(r.estimatedProfit)}</span></div>)}</div></>:<p>点击左侧饼图、图例或上方柱状图，查看对应主题下的基金盈亏明细。</p>}</div></div></div></section>
  </>}

  {news&&<section id="section-news" className="boxed panel sectionEnter"><div className="panelHead"><div><h2>04 市场新闻情绪</h2><p>抓取财经新闻标题并按关键词粗略判断情绪，只作为市场环境观察。</p></div><span className="sentiment">市场情绪：{news.sentiment}</span></div><div className="statusStrip compact"><span>数据状态：{news.isFallback?'新闻抓取失败，当前使用备用新闻样例':'新闻抓取成功，当前使用实时新闻标题'} ｜ 抓取时间：{news.crawlTime||'未记录'}</span><button className="mini" onClick={()=>setShowRules(!showRules)}>{showRules?'收起情绪规则':'查看情绪规则'}</button></div>{showRules&&<div className="ruleBox compactRules"><p>情绪规则：按积极 / 消极 / 中性三类关键词粗分。</p><p>积极触发词：{(news.positiveWords||[]).slice(0,8).join('、')}</p><p>消极触发词：{(news.negativeWords||[]).slice(0,8).join('、')}</p><p>未触发明显积极或消极关键词的标题归为中性。</p></div>}<div className="newsStats"><button className={newsFilter==='all'?'selected':''} onClick={()=>setNewsFilter('all')}><span>抓取新闻数量</span><b>{news.count||news.titles?.length||0}</b></button><button className={newsFilter==='positive'?'selected':''} onClick={()=>setNewsFilter('positive')}><span>积极标题数量</span><b>{news.positiveCount||0}</b></button><button className={newsFilter==='negative'?'selected':''} onClick={()=>setNewsFilter('negative')}><span>消极标题数量</span><b>{news.negativeCount||0}</b></button><button className={newsFilter==='neutral'?'selected':''} onClick={()=>setNewsFilter('neutral')}><span>中性标题数量</span><b>{news.neutralCount||0}</b></button></div><div className="newsList"><h3>当前显示：{filterLabel}（{filteredNews.length} 条）</h3>{filteredNews.length?<ol className="newsCompactList">{visibleNews.map((t:string)=>{const url=news.links?.[t]; const isOpen=activeNews===t; return <li key={t} className={isOpen?'open':''}><button type="button" onClick={()=>url?window.open(url,'_blank','noopener,noreferrer'):setActiveNews(isOpen?'':t)}><span>{t}</span>{url?<em>查看原文 ↗</em>:<em>{isOpen?'收起依据':'查看依据'}</em>}</button>{!url&&isOpen?<small>{news.triggers?.[t]?.length?`情绪触发词：${news.triggers[t].join('、')}`:'该标题未触发明显积极或消极关键词，因此归为中性。'}<br/>暂无原文链接，仅展示抓取标题。</small>:null}{url&&news.triggers?.[t]?.length?<small>触发词：{news.triggers[t].join('、')}</small>:null}</li>})}</ol>:<p className="emptyNews">当前分类下暂无新闻标题，可切换“全部新闻”查看。</p>}{filteredNews.length>5&&<div className="tableToggle newsToggle"><span>默认展示前 5 条，当前显示 {visibleNews.length} / {filteredNews.length} 条。</span><button className="mini" onClick={()=>setShowAllNews(!showAllNews)}>{showAllNews?'收起新闻':'展开全部新闻'}</button></div>}</div></section>}

  {advice&&<section id="section-ai" className="boxed panel report sectionEnter"><div className="panelHead"><div><h2>05 AI 组合分析报告</h2><p>AI 报告模式：{source.includes('DeepSeek')?'DeepSeek 智能分析版':'基础规则版'}。{source.includes('DeepSeek')?'已连接 DeepSeek API。':'当前未连接 DeepSeek API，报告基于本地规则生成，适合快速查看组合结构。'}</p></div><div className="reportActions"><button className="secondary" onClick={()=>navigator.clipboard?.writeText(advice)}>复制报告</button><button className="secondary" onClick={()=>downloadFile('fundcare-report.txt',advice)}>导出 TXT</button><button className="secondary" onClick={()=>downloadFile('fundcare-report.md',makeReportMarkdown(advice,analysis,news,source,benchmark),'text/markdown;charset=utf-8')}>导出 Markdown</button><button className="secondary" onClick={()=>window.print()}>打印/保存 PDF</button></div></div><div className="reportBox reportCards refined twoByThree">{reportSections.map(sec=>{const collapsed=!!collapsedReport[sec.title]; return <div className={`reportSectionCard refined ${sec.key==='notice'?'softNotice':''}`} key={sec.title}><button className="reportSectionHead" aria-expanded={!collapsed} aria-controls={`report-section-${sec.key}`} onClick={()=>setCollapsedReport(v=>({...v,[sec.title]:!v[sec.title]}))}><span>{sec.title}</span><em>{collapsed?'展开':'收起'}</em></button>{collapsed?<div className="reportCollapsedHint">{sec.collapsed}</div>:<div id={`report-section-${sec.key}`} className="reportSectionBody">{sec.body.map((line,i)=><p key={i}>• {line}</p>)}</div>}</div>})}</div><p className="aiFootnote">说明：所有涨跌幅、当日估算收益和 AI 文本均基于当前可用数据生成，最终以基金公司披露净值为准。本报告仅供信息整理和风险提示，不构成投资建议。</p></section>}
  {hoverTheme&&<div className="chartTip floating globalTip" style={{left:Math.max(12, Math.min(tooltipPos.x+10, (typeof window!=='undefined'?window.innerWidth:1200)-240)), top:Math.max(12, Math.min(tooltipPos.y+10, (typeof window!=='undefined'?window.innerHeight:800)-130))}}><b>{hoverTheme.theme}</b><span>持仓占比：{pct(hoverTheme.ratio)}</span><span>持仓金额：{money(hoverTheme.amount)}</span></div>}
  <footer className="boxed footer"><span>© 2026 FundCare · 本工具仅供参考，不构成投资建议。</span><a href="/disclaimer">免责声明</a><a href="/privacy">隐私政策</a><button className="linkBtn" onClick={()=>setShowDisclaimer(true)}>重新查看免责声明</button></footer><button className="toTop" onClick={()=>scrollTo({top:0,behavior:'smooth'})}>↑</button>
 </main>
}
