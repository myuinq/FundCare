import { NextResponse } from 'next/server';
import { FUND_MAP, themeFromName } from '../fund-map';

async function quote(code:string){
  const clean=String(code||'').trim().padStart(6,'0');
  const fallback=FUND_MAP[clean];
  try{
    const r=await fetch(`https://fundgz.1234567.com.cn/js/${clean}.js?rt=${Date.now()}`,{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0'}});
    const t=await r.text(); const m=t.match(/jsonpgz\((.*)\);?/);
    if(!m) throw new Error('no data');
    const d=JSON.parse(m[1]);
    const date=d.gztime||d.jzrq||new Date().toLocaleString('zh-CN',{hour12:false});
    return {name:d.name||fallback?.name||'',rate:Number(d.gszzl??fallback?.rate??0),date,ok:true,source:'实时估算'};
  }catch{
    return {name:fallback?.name||'',rate:Number(fallback?.rate||0),date:fallback?'PDF演示组合备用':'',ok:!!fallback,source:fallback?'备用数据':'手动补充'};
  }
}
export async function POST(req:Request){
  const {funds}=await req.json();
  const rows=[];
  for(const f of funds||[]){
    const code=String(f.code||'').padStart(6,'0'); const q=await quote(code); const amount=Number(f.amount||0);
    const name=String(f.name||'').trim() || q.name || `基金${code}`;
    const theme=FUND_MAP[code]?.theme || themeFromName(name);
    const rate=Number.isFinite(q.rate)?q.rate:0; const est=Number((amount*rate/100).toFixed(2));
    rows.push({code,name,theme,amount,rate:Number(rate.toFixed(2)),estimatedProfit:est,date:q.date,status:q.source});
  }
  const totalAmount=rows.reduce((s,r)=>s+r.amount,0); const totalProfit=rows.reduce((s,r)=>s+r.estimatedProfit,0); const portfolioRate=totalAmount?totalProfit/totalAmount*100:0;
  const themeAgg:Record<string,{amount:number;estimatedProfit:number;count:number}>={};
  rows.forEach(r=>{ if(!themeAgg[r.theme]) themeAgg[r.theme]={amount:0,estimatedProfit:0,count:0}; themeAgg[r.theme].amount+=r.amount; themeAgg[r.theme].estimatedProfit+=r.estimatedProfit; themeAgg[r.theme].count+=1; });
  const themeRows=Object.entries(themeAgg).map(([theme,v])=>({theme,amount:Number(v.amount.toFixed(2)),estimatedProfit:Number(v.estimatedProfit.toFixed(2)),count:v.count,ratio:totalAmount?v.amount/totalAmount*100:0})).sort((a,b)=>b.amount-a.amount);
  const maxFundRatio=totalAmount?Math.max(0,...rows.map(r=>r.amount/totalAmount*100)):0;
  const topTwoThemeRatio=themeRows.slice(0,2).reduce((s,r)=>s+r.ratio,0); const maxThemeRatio=themeRows[0]?.ratio||0;
  const fundCountPenalty=rows.length>=12?0:rows.length>=8?5:rows.length>=5?10:18;
  const riskScore=Math.min(100,Math.round(maxThemeRatio*0.35+topTwoThemeRatio*0.30+maxFundRatio*0.20+fundCountPenalty));
  return NextResponse.json({rows,totalAmount:Number(totalAmount.toFixed(2)),totalProfit:Number(totalProfit.toFixed(2)),portfolioRate:Number(portfolioRate.toFixed(2)),themeRows,riskScore,riskDetail:{maxThemeRatio:Number(maxThemeRatio.toFixed(2)),topTwoThemeRatio:Number(topTwoThemeRatio.toFixed(2)),maxFundRatio:Number(maxFundRatio.toFixed(2)),fundCount:rows.length,fundCountPenalty},generatedAt:new Date().toLocaleString('zh-CN',{hour12:false})});
}
