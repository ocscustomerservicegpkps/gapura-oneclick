'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Bot, Send, Loader2, BarChart3, AlertTriangle, Shield, FileText, Search, Clock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalysisFilters } from './AIAnalysisFilterPanel';
import { 
  BarChart, Bar, PieChart, Pie, LineChart, Line, 
  XAxis, YAxis, Tooltip as RechartsTooltip, Legend, 
  ResponsiveContainer, Cell, CartesianGrid 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  highlights?: string[];
  ts: number;
}

interface SuggestionBubble {
  icon: typeof BarChart3;
  label: string;
  query: string;
  color: string;
}

const SUGGESTION_BUBBLES: SuggestionBubble[] = [
  {
    icon: BarChart3,
    label: 'Analisa data tertinggi bulan ini',
    query: 'Analisa data tertinggi bulan ini',
    color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400',
  },
  {
    icon: AlertTriangle,
    label: 'Identify Ineffective Actions',
    query: 'Analisa corrective action yang tidak efektif, tampilkan case yang sudah ada action tapi status masih Open',
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400',
  },
  {
    icon: Shield,
    label: 'Preventive Recommendations',
    query: 'Analisa rekomendasi preventif action agar case tidak berulang, berdasarkan pola root cause yang paling sering muncul',
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
  },
  {
    icon: FileText,
    label: 'Executive Summary',
    query: 'Buatkan ringkasan laporan bulanan lengkap: distribusi severity, top kategori, top station, dan rekomendasi',
    color: 'from-purple-500/20 to-violet-500/20 border-purple-500/30 text-purple-400',
  },
  {
    icon: Search,
    label: 'Top Irregularities',
    query: 'Show the top 10 irregularity categories with case counts, percentages, and the station with the most cases',
    color: 'from-rose-500/20 to-pink-500/20 border-rose-500/30 text-rose-400',
  },
  {
    icon: Clock,
    label: 'Prediksi SLA Resolusi',
    query: 'Berdasarkan data laporan yang masih Open saat ini, tolong prediksikan waktu resolusinya berdasarkan root cause dan action taken.',
    color: 'from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-400',
  },
];

interface AIAssistantChatProps {
  filters: AnalysisFilters | null;
  filtersApplied: boolean;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

 
function CustomXAxisTick({ x, y, payload }: any) {
  const isWebkit = typeof window !== 'undefined' && /AppleWebKit/i.test(navigator.userAgent);

  const text = payload.value;
  const label = text.length > 20 ? text.substring(0, 18) + '...' : text;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="end"
        fill="#6b7280"
        fontSize={10}
        fontWeight={500}
        transform="rotate(-40)"
        style={isWebkit ? { filter: 'drop-shadow(0px 0px 0px)' } : {}}
      >
        {label}
      </text>
    </g>
  );
}

 
function AIChart({ config }: { config: any }) {
  if (!config || !config.type || !config.data || !Array.isArray(config.data)) {
    return <div className="text-red-400 text-xs p-4 bg-red-950/30 border border-red-900/50 rounded-xl">Format data visualisasi tidak sesuai.</div>;
  }

  const { type, title } = config;
  let data = config.data;

  if (Array.isArray(data) && data.length > 0) {
     
    data = data.map((item: any) => {
      const keys = Object.keys(item);
      let name = item.name;
      let value = item.value;

      if (name === undefined) {
        const strKey = keys.find((k) => typeof item[k] === 'string' && isNaN(Number(item[k])));
        name = strKey ? item[strKey] : String(item[keys[0]] || '');
      }

      if (value === undefined) {
        const numKey = keys.find((k) => typeof item[k] === 'number');
        if (numKey) {
          value = item[numKey];
        } else {
          const parseableKey = keys.find((k) => k !== 'name' && k !== Object.keys({name})[0] && !isNaN(Number(item[k])));
          value = parseableKey ? Number(item[parseableKey]) : 0;
        }
      }

      return {
        ...item,
        name: String(name || ''),
        value: Number(value) || 0
      };
    });
  }

  return (
    <div className="my-6 p-5 bg-white border border-slate-200 rounded-2xl shadow-xl">
      {title && <h4 className="text-sm font-semibold tracking-wide text-slate-800 mb-6 flex items-center gap-2"><BarChart3 size={16} className="text-emerald-500"/> {title}</h4>}
      <div className="h-72 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={<CustomXAxisTick />} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} 
                itemStyle={{ color: '#0f172a', fontSize: '12px', fontWeight: 600 }}
                cursor={{ fill: '#f1f5f9' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : type === 'pie' ? (
            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <Pie 
                isAnimationActive={false}
                data={data} 
                cx="50%" 
                cy="50%" 
                innerRadius={0} 
                outerRadius={90} 
                dataKey="value" 
                stroke="#ffffff" 
                strokeWidth={2}
                label={({ name, value }) => `${name} : ${value}`}
                labelLine={true}
              >
                {data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip 
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} 
                itemStyle={{ color: '#0f172a', fontSize: '12px', fontWeight: 600 }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="square" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
            </PieChart>
          ) : type === 'line' ? (
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={<CustomXAxisTick />} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} 
                itemStyle={{ color: '#0f172a', fontSize: '12px', fontWeight: 600 }}
              />
              <Line type="monotone" dataKey="value" stroke="#34d399" strokeWidth={3} dot={{ r: 4, fill: '#ffffff', strokeWidth: 2, stroke: '#34d399' }} activeDot={{ r: 6, fill: '#34d399', stroke: '#fff' }} />
            </LineChart>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-400 font-mono tracking-widest uppercase">Tipe chart tidak didukung</div>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function renderMarkdown(content: string): ReactNode {
  const elements: ReactNode[] = [];

  const normalizedContent = content.replace(/(?:\*\*)?json:chart(?:\*\*)?\s*(\{[\s\S]*?\})/g, '```json\n$1\n```');

  const parts = normalizedContent.split(/```(?:json|json:chart)?\s*(\{[\s\S]*?\})\s*```/);

  parts.forEach((part, index) => {

    if (index % 2 === 1) {
      try {
        const chartData = JSON.parse(part.trim());
        if (chartData.type && chartData.data && Array.isArray(chartData.data)) {
          elements.push(<AIChart key={`chart-${index}`} config={chartData} />);
        } else {

          elements.push(
            <pre key={`code-${index}`} className="p-4 my-4 bg-slate-50 text-slate-800 font-mono text-xs rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
              {part.trim()}
            </pre>
          );
        }
      } catch {

        elements.push(
          <div key={`chart-error-${index}`} className="p-4 my-4 bg-red-50 text-red-600 text-[10px] rounded-xl border border-red-200 font-mono">
            ⚠️ Failed to load data visualization. Make sure the JSON format is correct.
            <pre className="mt-2 opacity-60 text-slate-500">{part.trim()}</pre>
          </div>
        );
      }
      return;
    }

    const lines = part.split('\n');
    let tableBuffer: string[] = [];
    let inTable = false;

    const flushTable = () => {
      if (tableBuffer.length < 2) return;
      const headerLine = tableBuffer[0];
      const dataLines = tableBuffer.slice(2);
      const headers = headerLine.split('|').map((h) => h.trim()).filter(Boolean);

      elements.push(
        <div key={`table-${index}-${elements.length}`} className="overflow-x-auto my-6 rounded-2xl border border-slate-200 shadow-sm bg-white">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {headers.map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataLines.map((line, ri) => {
                const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
                return (
                  <tr key={ri} className="hover:bg-slate-50 transition-colors">
                    {cells.map((c, ci) => (
                      <td key={ci} className="px-4 py-3 text-slate-600 font-medium">
                        {renderInline(c)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      tableBuffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        continue;
      }

      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        if (!inTable) inTable = true;
        tableBuffer.push(trimmed);
        continue;
      }
      if (inTable) {
        inTable = false;
        flushTable();
      }

      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3 key={`h3-${index}-${i}`} className="text-[15px] font-display font-medium tracking-wide text-emerald-700 mt-8 mb-4 border-b border-slate-200 pb-2">
            {renderInline(trimmed.slice(3))}
          </h3>
        );
        continue;
      }
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={`h4-${index}-${i}`} className="text-[12px] font-bold text-slate-800 mt-6 mb-3 uppercase tracking-widest">
            {renderInline(trimmed.slice(4))}
          </h4>
        );
        continue;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <div key={`ul-${index}-${i}`} className="flex items-start gap-3 ml-1 my-2">
            <span className="mt-1.5 w-1 h-1 rounded-sm bg-emerald-500 shadow-sm shrink-0" />
            <span className="text-sm font-medium text-slate-600 leading-relaxed font-sans">{renderInline(trimmed.slice(2))}</span>
          </div>
        );
        continue;
      }

      const numberedMatch = trimmed.match(/^(\d+)\.\s(.+)/);
      if (numberedMatch) {
        elements.push(
          <div key={`ol-${index}-${i}`} className="flex items-start gap-3 ml-1 my-2">
            <span className="text-[11px] font-black text-emerald-600 mt-[2px] w-4 shrink-0 font-mono tracking-tighter">{numberedMatch[1]}.</span>
            <span className="text-sm font-medium text-slate-600 leading-relaxed font-sans">{renderInline(numberedMatch[2])}</span>
          </div>
        );
        continue;
      }

      if (!trimmed) {
        elements.push(<div key={`br-${index}-${i}`} className="h-2" />);
        continue;
      }

      elements.push(
        <p key={`p-${index}-${i}`} className="text-sm font-medium text-slate-700 leading-relaxed my-2 font-sans tracking-tight">
          {renderInline(trimmed)}
        </p>
      );
    }

    if (inTable) flushTable();
  });

  return <>{elements}</>;
}

function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(<span key={keyIdx++}>{remaining.slice(0, boldMatch.index)}</span>);
      }
      parts.push(<strong key={keyIdx++} className="font-bold text-slate-900">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    const italicMatch = remaining.match(/\*(.+?)\*/);
    if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) {
        parts.push(<span key={keyIdx++}>{remaining.slice(0, italicMatch.index)}</span>);
      }
      parts.push(<em key={keyIdx++} className="italic text-slate-500">{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }

    parts.push(<span key={keyIdx++}>{remaining}</span>);
    break;
  }

  return <>{parts}</>;
}

const DAILY_QUOTA = 5;

export function AIAssistantChat({ filters, filtersApplied }: AIAssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [rateLimit, setRateLimit] = useState<{ remaining: number; resetAt: number } | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const chatGenerationRef = useRef(0);

  const rateLimitExhausted = rateLimit !== null && rateLimit.remaining < 0;
  const canSend = input.trim().length > 0 && !sending && filtersApplied && !rateLimitExhausted;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  const askQuestion = async (question: string) => {
    if (!question.trim() || sending) return;

    const generation = chatGenerationRef.current;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, filters }),
      });

      if (res.status === 429) {
        const errData = await res.json().catch(() => ({}));
        if (generation !== chatGenerationRef.current) return;
        setRateLimit({ remaining: -1, resetAt: errData.resetAt || 0 });
        const resetMsg = errData.resetAt
          ? ` Coba lagi setelah ${new Date(errData.resetAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}.`
          : '';
        const limitMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚠️ **Daily limit reached.** You've used ${DAILY_QUOTA}/${DAILY_QUOTA} questions today.${resetMsg}`,
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, limitMsg]);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || `API error: ${res.status}`);
      }

      const result = await res.json();
      if (generation !== chatGenerationRef.current) return;

      if (result.rateLimit) setRateLimit(result.rateLimit);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.answer || 'Maaf, tidak dapat menghasilkan insight dari data ini.',
        highlights: result.highlights,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      if (generation !== chatGenerationRef.current) return;
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `⚠️ **Failed to generate insight.** ${err instanceof Error ? err.message : 'Try again later.'}`,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      // A cleared/superseded request must not stomp on a newer generation's
      // `sending` state when it eventually settles.
      if (generation === chatGenerationRef.current) {
        setSending(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {}
      {messages.length > 0 && (
        <button
          onClick={() => {
            chatGenerationRef.current += 1;
            setMessages([]);
            setSending(false);
          }}
          className="absolute top-4 right-4 lg:right-6 z-50 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase rounded-xl border border-slate-200 bg-white/80 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-500 shadow-sm backdrop-blur-md transition-all"
        >
          <Trash2 size={12} /> Clear Chat
        </button>
      )}

      {}

      {}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 space-y-8 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {}
        <AnimatePresence>
        {messages.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center h-full min-h-[50vh] py-8"
          >
            <h4 className="text-2xl font-display font-medium text-slate-800 mb-3 tracking-wide">
              {filtersApplied ? 'Systems Ready' : 'Awaiting Parameters'}
            </h4>
            <p className="text-sm font-medium text-slate-500 mb-10 text-center max-w-md leading-relaxed">
              {filtersApplied
                ? 'Engage with AI Analytics. Request global summaries, localized anomaly detection, or dynamic visual renderings of the data matrix.'
                : 'Initialize the parameter matrix via the filter control panel to begin systematic analysis.'}
            </p>

            {filtersApplied && (
              <motion.div 
                variants={{
                  hidden: { opacity: 0 },
                  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
                }}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 justify-center w-full max-w-4xl"
              >
                {SUGGESTION_BUBBLES.map((bubble) => (
                  <motion.button
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      show: { opacity: 1, y: 0 }
                    }}
                    key={bubble.query}
                    onClick={() => askQuestion(bubble.query)}
                    disabled={sending}
                    className={cn(
                      'group flex flex-col gap-3 p-5 rounded-2xl text-left backdrop-blur-md bg-white border border-slate-200 shadow-sm',
                      'hover:bg-slate-50 hover:border-emerald-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)] hover:-translate-y-1',
                      'transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none'
                    )}
                  >
                    <div className={cn('p-2.5 rounded-xl bg-gradient-to-br transition-transform group-hover:scale-110 shrink-0 border bg-white', bubble.color)}>
                      <bubble.icon size={18} />
                    </div>
                    <span className="text-xs font-semibold tracking-wide text-slate-600 group-hover:text-emerald-600 transition-colors mt-1">{bubble.label}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
        </AnimatePresence>

        {}
        <div className="space-y-8">
          {messages.map((msg) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              key={msg.id} 
              className={cn('flex gap-4', msg.role === 'user' ? 'flex-row-reverse' : '')}
            >
              <div
                className={cn(
                  'h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm backdrop-blur-md mt-1',
                  msg.role === 'assistant'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                    : 'bg-slate-100 border-slate-200 text-slate-500'
                )}
              >
                {msg.role === 'assistant' ? <Bot size={20} /> : <span className="text-[10px] font-black tracking-widest">USR</span>}
              </div>

              <div className={cn('flex flex-col max-w-[85%] lg:max-w-[75%]', msg.role === 'user' ? 'items-end' : '')}>
                <div
                  className={cn(
                    'px-6 py-5 shadow-sm backdrop-blur-md border',
                    msg.role === 'assistant'
                      ? 'bg-white border-slate-200 rounded-2xl rounded-tl-sm text-slate-800'
                      : 'bg-emerald-50 border-emerald-100 text-emerald-900 rounded-2xl rounded-tr-sm'
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose-compact">{renderMarkdown(msg.content)}</div>
                  ) : (
                    <p className="text-[15px] font-medium tracking-tight font-sans leading-relaxed">{msg.content}</p>
                  )}
                </div>

                {msg.highlights && msg.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {msg.highlights.map((h, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold tracking-widest uppercase rounded-lg border border-emerald-200 shadow-sm"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                <span className="mt-2 text-[10px] font-mono tracking-widest text-slate-400 px-1">
                  {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {}
        <AnimatePresence>
        {sending && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex gap-4"
          >
            <div className="h-10 w-10 mt-1 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
              <Bot size={20} />
            </div>
            <div className="bg-white border border-slate-200 backdrop-blur-md shadow-sm px-6 py-5 rounded-2xl rounded-tl-sm flex gap-3 items-center">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce" />
              </div>
              <span className="text-xs tracking-widest font-mono text-emerald-600 uppercase ml-2 animate-pulse">Computing matrix...</span>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        <div ref={endRef} className="h-4" />

        {}
        {messages.length > 0 && !sending && filtersApplied && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-4 border-t border-slate-100"
          >
            <p className="text-[10px] text-slate-400 mb-3 font-bold font-mono uppercase tracking-widest">Recommended Queries:</p>
            <div className="flex flex-wrap gap-2.5">
              {SUGGESTION_BUBBLES.filter(
                (b) => !messages.some((m) => m.role === 'user' && m.content === b.query)
              )
                .slice(0, 3)
                .map((bubble) => (
                  <button
                    key={bubble.query}
                    onClick={() => askQuestion(bubble.query)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-semibold bg-white text-slate-600 text-left border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 transition-all shadow-sm backdrop-blur-md"
                  >
                    <bubble.icon size={12} className="text-emerald-500" />
                    {bubble.label}
                  </button>
                ))}
            </div>
          </motion.div>
        )}
      </div>

      {}
      <div className="p-4 lg:p-6 bg-slate-50 border-t border-slate-200 relative z-20">
        <div className="relative max-w-5xl mx-auto">
          {}
          <div className="absolute -inset-1 bg-emerald-100 rounded-2xl blur-xl opacity-0 transition-opacity duration-500 peer-focus-within:opacity-100" />

          <div className="relative flex items-center bg-white border border-slate-200 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-500/10 rounded-2xl shadow-sm transition-all">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={rateLimitExhausted ? 'Batas harian tercapai. Coba lagi besok.' : filtersApplied ? 'Query AI Analytics...' : 'Awaiting data matrix parameters...'}
              disabled={!filtersApplied || sending || rateLimitExhausted}
              className="peer w-full bg-transparent px-6 py-5 text-sm font-medium tracking-tight text-slate-900 placeholder:text-slate-400 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSend) {
                  e.preventDefault();
                  askQuestion(input);
                }
              }}
            />
            <div className="pr-3">
              <button
                disabled={!canSend}
                onClick={() => askQuestion(input)}
                className="flex aspect-square h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 hover:bg-emerald-500 hover:text-white text-emerald-600 ring-1 ring-emerald-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all duration-300"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="translate-x-0.5" />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between max-w-5xl mx-auto mt-4 px-2">
          <p className="text-[9px] font-mono tracking-widest text-slate-400 uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Gemini 2.5 Flash · AI Analytics
          </p>
          {rateLimit !== null && (
            <p className={cn(
              'text-[9px] font-mono tracking-widest uppercase',
              rateLimitExhausted ? 'text-red-400' : rateLimit.remaining <= 1 ? 'text-amber-500' : 'text-slate-400'
            )}>
              {rateLimitExhausted ? 'Daily limit reached' : `${rateLimit.remaining + 1}/${DAILY_QUOTA} questions today`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
