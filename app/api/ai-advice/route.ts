import { NextResponse } from 'next/server';

type ReportObj = {
  overview:string[];
  risk:string[];
  market:string[];
  structure:string[];
  suggestion:string[];
  notice:string[];
};
function compact(n:any){ return Number(n||0).toLocaleString('zh-CN',{maximumFractionDigits:2}); }
function fallbackObj(a:any,n:any,b?:any):ReportObj{
 const top=a?.themeRows?.[0]; const hs=b?.hs300; const rel=hs?Number((Number(a?.portfolioRate||0)-Number(hs.rate||0)).toFixed(2)):null; const rows=[...(a?.rows||[])]; const worst=[...rows].sort((x:any,y:any)=>x.estimatedProfit-y.estimatedProfit)[0]; const best=[...rows].sort((x:any,y:any)=>y.estimatedProfit-x.estimatedProfit)[0];
 const themes=[...(a?.themeRows||[])]; const topTwo=themes.slice(0,2).map((x:any)=>x.theme).join('、')||'待确认';
 return {
  overview:[`组合规模约 ${compact(a?.totalAmount)} 元，当日估算收益约 ${compact(a?.totalProfit)} 元，估算涨跌幅为 ${a?.portfolioRate||0}%。`,`第一大主题为${top?.theme||'待确认'}，占比约 ${top?.ratio?.toFixed?.(1)||0}%，组合共纳入 ${rows.length||0} 只基金。`],
  risk:[`集中度风险评分为 ${a?.riskScore||0}/100，可重点观察前两大主题（${topTwo}）和第一大基金权重。`,`当日拖累较大的基金为 ${worst?.code||'-'} ${worst?.name||''}，表现相对较好的基金为 ${best?.code||'-'} ${best?.name||''}。`],
  market:[`新闻标题情绪为“${n?.sentiment||'中性'}”，共抓取 ${n?.count||0} 条，其中积极 ${n?.positiveCount||0} 条、消极 ${n?.negativeCount||0} 条。`,hs?`沪深300涨跌幅为 ${hs.rate}%，组合相对沪深300${rel>=0?'跑赢':'跑输'} ${Math.abs(rel)} 个百分点。`:'沪深300基准数据暂未获取。'],
  structure:[`主题主要集中在 ${themes.slice(0,3).map((x:any)=>`${x.theme} ${Number(x.ratio||0).toFixed(1)}%`).join('、')}。`,`当日主题贡献可结合 03 模块查看，重点关注收益来源与持仓占比是否一致。`],
  suggestion:[`建议优先检查主题集中度、单只基金占比和同类基金重复持有情况。`,`若某一主题占比明显高于自身风险承受能力，可进一步比较相关基金费率、标的、规模与波动特征。`],
  notice:[`以上内容为基金组合结构观察和课程项目演示，不构成买入、卖出、加仓或减仓建议。`,`估算数据、新闻抓取和 AI 文本均可能存在延迟或误差，请以基金公司披露净值和个人独立判断为准。`]
 };
}
function fallback(a:any,n:any,b?:any){ return JSON.stringify(fallbackObj(a,n,b)); }
export async function POST(req:Request){
 const {analysis,news,benchmark}=await req.json();
 const key=process.env.DEEPSEEK_API_KEY;
 if(!key) return NextResponse.json({advice:fallback(analysis,news,benchmark),source:'基础规则版：未配置 DEEPSEEK_API_KEY'});
 const prompt=`你是审慎的基金组合分析助手。请根据用户持仓数据生成中文结构化报告。
请只输出一个合法 JSON 对象，不要输出 Markdown、代码块或额外解释。JSON 必须包含以下六个字段，每个字段都是字符串数组，每个数组 2 条以内，每条 40-90 字：
{
  "overview": ["组合概览要点1", "组合概览要点2"],
  "risk": ["主要风险要点1", "主要风险要点2"],
  "market": ["市场情绪要点1", "市场情绪要点2"],
  "structure": ["主题结构要点1", "主题结构要点2"],
  "suggestion": ["优化方向要点1", "优化方向要点2"],
  "notice": ["注意事项要点1", "注意事项要点2"]
}
要求：
1）必须结合具体基金代码、基金名称、主题占比、主题盈亏贡献、集中度风险和新闻情绪，不要泛泛而谈；
2）不要给出明确买入、卖出、加仓、减仓指令；
3）不要承诺收益，不使用“必涨、稳赚、立刻买入”等表述；
4）建议用“可关注、可进一步核查、若风险承受能力较低可考虑”等审慎表达；
5）如果数据来源是备用估算，要提醒用户以基金公司披露净值为准。
组合数据：${JSON.stringify(analysis)}
新闻情绪：${JSON.stringify(news)}
基准指数：${JSON.stringify(benchmark)}`;
 try{
  const r=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:'deepseek-chat',messages:[{role:'system',content:'你只做基金组合结构分析和风险观察，不提供具体交易指令。必须返回合法 JSON 对象。'},{role:'user',content:prompt}],temperature:0.2,response_format:{type:'json_object'},max_tokens:1600})});
  if(!r.ok) throw new Error(await r.text());
  const data=await r.json();
  const content=data.choices?.[0]?.message?.content||'';
  try{ JSON.parse(content); return NextResponse.json({advice:content,source:'DeepSeek API'}); }
  catch{ return NextResponse.json({advice:fallback(analysis,news,benchmark),source:'基础规则版：DeepSeek JSON 解析失败'}); }
 }catch(e:any){return NextResponse.json({advice:fallback(analysis,news,benchmark),source:'基础规则版：DeepSeek API 调用失败'});}
}
