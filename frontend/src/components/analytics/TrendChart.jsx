import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import { Activity } from 'lucide-react';

const RESOURCE_COLORS = {
    Electricity: '#eab308',
    Water: '#3b82f6',
    Diesel: '#1e3a8a',
    Food: '#16a34a',
    LPG: '#dc2626',
    Waste: '#0d9488',
    Petrol: '#7c3aed',
    Kerosene: '#f97316',
    Default: '#64748b'
};

export default function TrendChart({ data, resources, title, height = 300 }) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px]" style={{ color: 'var(--text-secondary)' }}>
                <Activity size={40} className="opacity-20 mb-2" />
                <p className="text-sm font-medium opacity-50 uppercase tracking-widest">No usage trend data recorded</p>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className={`p-4 rounded-xl shadow-xl backdrop-blur-md bg-opacity-90 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border`}>
                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-tight">
                        {new Date(label).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <div className="space-y-2">
                        {payload.filter(entry => entry.value > 0).map((entry, index) => {
                            const resMeta = resources?.find(r => r.name === entry.dataKey);
                            const unit = resMeta?.unit || '';
                            return (
                                <div key={index} className="flex items-center justify-between gap-8">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold" style={{ color: entry.color }}>{entry.name}</span>
                                    </div>
                                    <span className="text-sm font-black tabular-nums">
                                        {entry.value.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold uppercase">{unit}</span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return null;
    };

    const keys = Object.keys(data[0] || {}).filter(k => k !== 'date' && k !== 'total' && k !== '_id');

    return (
        <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        {keys.map(key => (
                            <linearGradient key={`color-${key}`} id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={RESOURCE_COLORS[key] || RESOURCE_COLORS.Default} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={RESOURCE_COLORS[key] || RESOURCE_COLORS.Default} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                    <XAxis 
                        dataKey="date" 
                        stroke={isDark ? '#475569' : '#94a3b8'} 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        dy={10}
                    />
                    <YAxis 
                        stroke={isDark ? '#475569' : '#94a3b8'} 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                    
                    {keys.map(key => (
                        <Area 
                            key={key} 
                            type="monotone" 
                            dataKey={key} 
                            name={key}
                            stroke={RESOURCE_COLORS[key] || RESOURCE_COLORS.Default} 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill={`url(#color-${key})`} 
                            connectNulls
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
