import { NextResponse } from 'next/server';
import { FUND_MAP } from '../fund-map';

type HoldingRow = { code?: string; name?: string; amount?: string | number; status?: string };

function cleanAmount(value:any){
  const text=String(value??'').replace(/[,，\s]/g,'');
  const m=text.match(/-?\d+(?:\.\d+)?/);
  return m?m[0]:'';
}
function normalizeLine(line:string){
  return String(line||'')
    .replace(/[|｜]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function compactText(text:string){ return String(text||'').replace(/\s+/g,''); }
function amountCandidates(line:string, excludeCode=''){
  return [...String(line||'').matchAll(/\d{1,3}(?:[,，]\d{3})*(?:\.\d+)?|\d{3,}(?:\.\d+)?|\d+(?:\.\d+)?/g)]
    .map(m=>m[0].replace(/[,，]/g,''))
    .filter(n=>n!==excludeCode && Number(n)>0 && Number(n)<100000000);
}
function findFundByLine(line:string){
  const raw=normalizeLine(line);
  const noSpace=compactText(raw);
  let code=raw.match(/(?<!\d)(\d{6})(?!\d)/)?.[1]||'';
  if(code && FUND_MAP[code]) return {code,name:FUND_MAP[code].name};
  let best:{code:string;name:string;score:number}|null=null;
  for(const [c,item] of Object.entries(FUND_MAP)){
    const full=compactText(item.name||'');
    if(!full) continue;
    let score=0;
    if(noSpace.includes(full)) score=120;
    else if(full.includes(noSpace) && noSpace.length>=4) score=70;
    else {
      const tokens=['信息','芯片','机遇','新锦绣','创新','稀土','光伏','远见','化工','黄金','上海金','电网','稀有金属','有色金属','中证','ETF','联接'];
      score=tokens.filter(t=>full.includes(t)&&noSpace.includes(t)).length*10;
    }
    if(score>(best?.score||0)) best={code:c,name:item.name,score};
  }
  if(best && best.score>=20) return {code:best.code,name:best.name};
  return {code,name:''};
}
function inferCodeByName(name:string){
  const n=compactText(name);
  if(!n) return '';
  let best=''; let bestScore=0;
  for(const [code,item] of Object.entries(FUND_MAP)){
    const full=compactText(item.name||'');
    if(!full) continue;
    let score=0;
    if(full===n) score=100;
    else if(full.includes(n)||n.includes(full)) score=80;
    else{
      const tokens=['信息','芯片','机遇','新锦绣','创新','稀土','光伏','远见','化工','黄金','上海金','电网','稀有金属','有色金属'];
      score=tokens.filter(t=>full.includes(t)&&n.includes(t)).length*12;
    }
    if(score>bestScore){bestScore=score; best=code;}
  }
  return bestScore>=12?best:'';
}
function repairRows(rows:HoldingRow[]):HoldingRow[]{
  const fixed:HoldingRow[]=[];
  const clean=(r:HoldingRow):HoldingRow=>{
    const name=String(r.name||'').trim();
    let code=String(r.code||'').replace(/\D/g,'').slice(0,6);
    if(code) code=code.padStart(6,'0');
    if(!code&&name) code=inferCodeByName(name);
    return {code,name,amount:cleanAmount(r.amount),status:'待确认'};
  };
  const list=(rows||[]).map(clean).filter(r=>r.code||r.name||r.amount);
  for(let i=0;i<list.length;i++){
    const r=list[i];
    const hasFund=!!(r.code||r.name);
    const hasAmount=!!r.amount;
    if(hasFund){
      const next=list[i+1];
      if(!hasAmount && next && !(next.code||next.name) && next.amount){
        fixed.push({...r,amount:next.amount,status:'待确认'});
        i++;
      }else fixed.push({...r,status:'待确认'});
    }else if(hasAmount && fixed.length && !fixed[fixed.length-1].amount){
      fixed[fixed.length-1]={...fixed[fixed.length-1],amount:r.amount,status:'待确认'};
    }
  }
  const seen=new Set<string>();
  return fixed.filter(r=>{
    const k=`${r.code}-${r.name}-${r.amount}`;
    if(seen.has(k)) return false;
    seen.add(k);
    return !!(r.code||r.name||r.amount);
  }).slice(0,30);
}
function normalizeRows(rows:any[]):HoldingRow[]{
  const raw:HoldingRow[]=[];
  for(const item of rows||[]){
    const name=String(item.name||item.fundName||item['基金名称']||'').trim();
    let code=String(item.code||item.fundCode||item['基金代码']||'').replace(/\D/g,'').slice(0,6);
    if(code) code=code.padStart(6,'0');
    if(!code&&name) code=inferCodeByName(name);
    const amount=cleanAmount(item.amount??item.holdingAmount??item['持仓金额']??item['金额']);
    raw.push({code,name,amount,status:'待确认'});
  }
  return repairRows(raw);
}
function localParse(text:string):HoldingRow[]{
  const lines=String(text||'').split(/\n+/).map(normalizeLine).filter(Boolean);
  const rows:HoldingRow[]=[];
  const consumed=new Set<number>();
  for(let i=0;i<lines.length;i++){
    if(consumed.has(i)) continue;
    const line=lines[i];
    const fund=findFundByLine(line);
    const code=fund.code;
    const name=fund.name;
    const nums=amountCandidates(line, code);
    let amount=nums.find(n=>Number(n)>0 && Number(n)<100000000) || '';
    if(code||name){
      if(!amount){
        for(let j=i+1;j<Math.min(lines.length,i+4);j++){
          if(consumed.has(j)) continue;
          const nextFund=findFundByLine(lines[j]);
          // 如果下一行已经是另一只基金，不越界拿金额
          if(nextFund.code||nextFund.name) break;
          const nextNums=amountCandidates(lines[j]);
          const candidate=nextNums.find(n=>Number(n)>0 && Number(n)<100000000);
          if(candidate){ amount=candidate; consumed.add(j); break; }
        }
      }
      rows.push({code,name,amount,status:'待确认'});
      continue;
    }
    // 纯金额行：补到上一只没有金额的基金上，不单独形成一行
    const onlyNums=amountCandidates(line);
    if(onlyNums.length && rows.length && !rows[rows.length-1].amount){
      rows[rows.length-1].amount=onlyNums[0];
    }
  }
  return repairRows(rows);
}

export async function POST(req:Request){
  try{
    const {text}=await req.json();
    const ocrText=String(text||'').slice(0,12000);
    if(!ocrText.trim()) return NextResponse.json({rows:[],source:'empty'});
    const fallback=localParse(ocrText);
    const apiKey=process.env.DEEPSEEK_API_KEY;
    if(!apiKey){ return NextResponse.json({rows:fallback,source:'local-rules'}); }
    const prompt=`你是基金持仓截图识别助手。请从 OCR 文本中提取用户持有的基金清单，只返回 JSON，不要 Markdown。\n要求：\n1. 只提取基金代码、基金名称、持仓金额。\n2. 不要把昨日收益、持有收益、涨跌幅误认为持仓金额。\n3. 如果基金代码和基金名称在一行、金额在下一行，需要把金额配对到上一只基金。\n4. 如果能从基金名称推断代码，可填写 code；不能确定时 code 为空。\n5. amount 只保留数字。\n6. 不要返回只有金额、没有基金代码和基金名称的独立行。\n7. 返回格式必须是 {"rows":[{"code":"001513","name":"易方达信息产业混合A","amount":"4652.76"}]}。\nOCR 文本如下：\n${ocrText}`;
    const r=await fetch('https://api.deepseek.com/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({model:'deepseek-chat',messages:[{role:'user',content:prompt}],response_format:{type:'json_object'},temperature:0.1,max_tokens:1600})
    });
    if(!r.ok) throw new Error(`DeepSeek ${r.status}`);
    const data=await r.json();
    const content=data?.choices?.[0]?.message?.content||'{}';
    const parsed=JSON.parse(content);
    const rows=normalizeRows(parsed.rows||[]);
    return NextResponse.json({rows:rows.length?rows:fallback,source:rows.length?'deepseek-ai':'local-rules'});
  }catch(e:any){
    try{ const {text}=await req.json(); return NextResponse.json({rows:localParse(String(text||'')),source:'local-rules',warning:'AI解析失败，已使用规则兜底'}); }
    catch{ return NextResponse.json({rows:[],source:'error',warning:'图片识别解析失败'}); }
  }
}
