'use client';

import { motion } from 'framer-motion';

interface PrettyPayloadProps {
    payload: Record<string, unknown> | unknown;
    depth?: number;
}

export function PrettyPayload({ payload, depth = 0 }: PrettyPayloadProps) {
    if (!payload || typeof payload !== 'object') {
        return <span className="text-white/80 font-mono text-[10px]">{String(payload)}</span>;
    }

    const entries = Object.entries(payload as Record<string, unknown>);

    return (
        <div className={`flex flex-wrap gap-1.5 ${depth > 0 ? 'ml-2 mt-1' : ''}`}>
            {entries.map(([key, value]) => (
                <motion.div
                    key={key}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 border border-white/10 rounded-full group/token hover:bg-white/10 transition-all duration-300"
                >
                    <span className="text-[9px] font-black uppercase tracking-tighter text-white/50 group-hover/token:text-emerald-400/50 transition-colors">
                        {key}
                    </span>
                    {typeof value === 'object' && value !== null ? (
                        <PrettyPayload payload={value} depth={depth + 1} />
                    ) : (
                        <span className="text-[10px] font-mono font-medium text-white/90">
                            {String(value)}
                        </span>
                    )}
                </motion.div>
            ))}
        </div>
    );
}
