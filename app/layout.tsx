import './styles.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'FundCare｜基金组合智能分析工具', description: '基金组合结构分析、新闻情绪与 DeepSeek AI 报告' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
