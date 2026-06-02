import { NextResponse } from 'next/server';

export async function GET(){
  const now=new Date().toLocaleString('zh-CN',{hour12:false});
  try{
    const url='https://push2.eastmoney.com/api/qt/stock/get?secid=1.000300&fields=f43,f44,f45,f46,f47,f48,f57,f58,f59,f60,f169,f170';
    const r=await fetch(url,{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0','Referer':'https://quote.eastmoney.com/'}});
    const data=await r.json();
    const d=data?.data;
    if(!d || typeof d.f170==='undefined') throw new Error('no hs300 data');
    const rate=Number(d.f170)/100;
    return NextResponse.json({
      hs300:{name:'沪深300',code:'000300',rate:Number(rate.toFixed(2)),price:d.f43?Number(d.f43)/100:undefined,source:'东方财富指数行情'},
      updatedAt:now,
      isFallback:false
    });
  }catch{
    return NextResponse.json({
      hs300:{name:'沪深300',code:'000300',rate:-0.45,source:'备用基准数据'},
      updatedAt:now,
      isFallback:true
    });
  }
}
