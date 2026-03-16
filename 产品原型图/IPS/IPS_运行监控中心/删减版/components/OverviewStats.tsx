import React from 'react';
import { RunOverviewStats } from '../types';

interface Props {
  stats: RunOverviewStats;
  title?: string;
}

const OverviewStats: React.FC<Props> = ({ stats, title = '运行概览' }) => {
  const cards = [
    { label: '今日', value: stats.todayCount, icon: 'fa-sun', color: 'text-amber-600' },
    { label: '本周', value: stats.weekCount, icon: 'fa-calendar-week', color: 'text-indigo-600' },
    { label: '成功率', value: `${stats.successRate}%`, icon: 'fa-chart-pie', color: 'text-emerald-600' },
    { label: '平均耗时', value: stats.avgDuration, icon: 'fa-clock', color: 'text-slate-600' },
  ];

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <span className="text-xs font-bold text-slate-500 uppercase">{title}</span>
      {cards.map((c, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
          <i className={`fa-solid ${c.icon} text-xs ${c.color}`}></i>
          <span className="text-xs text-slate-500">{c.label}</span>
          <span className={`text-sm font-bold ${c.color}`}>{c.value}</span>
        </div>
      ))}
    </div>
  );
};

export default OverviewStats;
