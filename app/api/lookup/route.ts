import { NextResponse } from 'next/server';
import { FUND_MAP, themeFromName } from '../fund-map';

async function fetchFund(code:string){
  const clean=String(code||'').trim().padStart(6,'0');
  if(FUND_MAP[clean]) return {code:clean,name:FUND_MAP[clean].name,theme:FUND_MAP[clean].theme,rate:FUND_MAP[clean].rate||0,date:'PDF演示组合',status:'已识别'};
  try{
    const r=await fetch(`https://fundgz.1234567.com.cn/js/${clean}.js?rt=${Date.now()}`,{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0'}});
    const text=await r.text();
    const m=text.match(/jsonpgz\((.*)\);?/);
    if(!m) throw new Error('接口无匹配数据');
    const data=JSON.parse(m[1]);
    const name=data.name||`基金${clean}`;
    return {code:clean,name,theme:themeFromName(name),rate:(Number.isFinite(Number(data.gszzl))&&String(data.gszzl||'').trim()!==''?Number(data.gszzl):Number(FUND_MAP[clean]?.rate||0)),date:data.gztime||data.jzrq||'',status:'已识别'};
  }catch(e){
    return {code:clean,name:'',theme:'待确认',rate:0,date:'',status:'未识别'};
  }
}

export async function POST(req:Request){
  try{
    const body=await req.json();
    const codes:string[] = body.codes || [];
    const result=await Promise.all(codes.map(fetchFund));
    return NextResponse.json({funds:result});
  }catch(e){
    return NextResponse.json({funds:[]});
  }
}
