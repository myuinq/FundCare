import { NextResponse } from 'next/server';
const positive=['上涨','增长','利好','突破','提升','流入','走高','新高','复苏','强势','大涨','回暖','扩张','增持','回购','修复'];
const negative=['下跌','风险','亏损','波动','暴跌','回调','承压','走低','减持','造假','终止','退潮','停牌','限购','调整','分化'];
function triggers(title:string,words:string[]){return words.filter(w=>title.includes(w));}

function cleanTitle(t:string){
  return String(t||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]+>/g,'').replace(/^[\s•·\-*]+/,'').replace(/^<+\s*/,'').replace(/\s*>+$/,'').replace(/[《》]/g,'').replace(/\s+/g,' ').trim();
}
export async function GET(){
  let titles:string[]=[]; let isFallback=false; const links:Record<string,string>={};
  try{
    const r=await fetch('https://finance.sina.com.cn/roll/',{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0'}});
    const html=await r.text();
    const items=[...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/g)]
      .map(m=>({url:m[1],title:cleanTitle(m[2])}))
      .filter(x=>x.title.length>=8&&x.title.length<=48&&!/视频|直播|登录|注册/.test(x.title));
    const seen=new Set<string>();
    for(const item of items){
      if(seen.has(item.title)) continue;
      seen.add(item.title); titles.push(item.title);
      const url=item.url.startsWith('//')?'https:'+item.url:item.url.startsWith('/')?'https://finance.sina.com.cn'+item.url:item.url;
      links[item.title]=url;
      if(titles.length>=20) break;
    }
  }catch{}
  if(titles.length<6){isFallback=true;titles=['A股三大指数震荡整理，市场成交额小幅变化','科技成长方向分化，半导体板块关注度提升','黄金价格高位波动，避险资产表现受关注','新能源板块延续调整，资金观望情绪较浓','多家上市公司披露回购计划，稳定市场预期','部分高位题材出现回调，短期波动风险增加','海外资金继续关注中国硬科技资产','资源品价格走低，周期板块承压'];}
  titles=titles.map(cleanTitle).filter(Boolean);
  const triggerMap:Record<string,string[]>={};
  const pos:string[]=[]; const neg:string[]=[]; const neu:string[]=[];
  titles.forEach(t=>{ const p=triggers(t,positive); const n=triggers(t,negative); triggerMap[t]=[...p,...n]; if(p.length&&p.length>=n.length) pos.push(t); else if(n.length) neg.push(t); else neu.push(t); });
  let sentiment='中性'; if(pos.length>=neg.length+2) sentiment='偏积极'; else if(neg.length>=pos.length+2) sentiment='偏消极';
  return NextResponse.json({titles,positive:pos,negative:neg,neutral:neu,count:titles.length,positiveCount:pos.length,negativeCount:neg.length,neutralCount:neu.length,sentiment,crawlTime:new Date().toLocaleString('zh-CN',{hour12:false}),isFallback,positiveWords:positive,negativeWords:negative,triggers:triggerMap,links});
}
