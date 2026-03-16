import React from 'react';
import { FunctionConfig } from '../types';
import { RUN_ACTION_CONFIGS } from '../constants';

interface CardStats {
  lastStatus?: 'success' | 'failed' | 'running' | 'terminated';
  lastRunTime?: string;
  todayCount?: number;
  weekCount?: number;
  weekUserCount?: number;
  avgDuration?: string;
  /** 最近一次运行的计划版本 */
  lastPlanVersion?: string;
  /** 最近一次运行的需求版本 */
  lastDemandVersion?: string;
}

interface Props {
  func: FunctionConfig;
  stats?: CardStats;
  onClick: () => void;
}

const FunctionCard: React.FC<Props> = ({ func, stats = {}, onClick }) => {
  const { lastStatus, lastRunTime, todayCount = 0, weekCount = 0, weekUserCount = 0, avgDuration, lastPlanVersion, lastDemandVersion } = stats;
  const hasVersion = Boolean(lastPlanVersion || lastDemandVersion);
  const icon = RUN_ACTION_CONFIGS[func.id]?.icon ?? func.icon;

  const statusColor =
    lastStatus === 'success'
      ? 'text-emerald-600'
      : lastStatus === 'failed'
      ? 'text-rose-500'
      : lastStatus === 'running'
      ? 'text-indigo-500'
      : lastStatus === 'terminated'
      ? 'text-amber-600'
      : 'text-slate-400';

  const isRunning = lastStatus === 'running';

  // 并发模式标签配置
  const getConcurrencyLabel = () => {
    if (!func.concurrencyConfig) return null;
    const { mode, maxConcurrency } = func.concurrencyConfig;
    switch (mode) {
      case 'PARALLEL':
        return { text: '可并行', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: 'fa-arrows-split-up-and-left' };
      case 'EXCLUSIVE':
        return { text: '不可并行', color: 'bg-rose-50 text-rose-600 border-rose-200', icon: 'fa-lock' };
      case 'QUEUEABLE':
        return { text: '可排队', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: 'fa-clock' };
      case 'LIMITED_PARALLEL':
        return { text: `限${maxConcurrency}并发`, color: 'bg-indigo-50 text-indigo-600 border-indigo-200', icon: 'fa-gauge-high' };
      default:
        return null;
    }
  };

  const concurrencyLabel = getConcurrencyLabel();

  return (
    <button
      onClick={onClick}
      className="relative w-full aspect-square text-left bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all active:scale-[0.98] group flex flex-col overflow-hidden"
    >
      {/* 顶部：图标 + 模块标签 */}
      <div className="flex items-start justify-between mb-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
          <i className={`fa-solid ${icon} text-lg`}></i>
        </div>
        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
          {func.moduleId}
        </span>
      </div>

      {/* 中上部：功能名称 + 描述 */}
      <div className="mb-2">
        <h3 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2 mb-2">{func.name}</h3>
        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{func.description}</p>
      </div>

      {/* 中部：并发模式标签 */}
      {concurrencyLabel && (
        <div className="mb-3">
          <span className={`px-2.5 py-1 rounded border text-[10px] font-bold ${concurrencyLabel.color} flex items-center gap-1.5 w-fit`}>
            <i className={`fa-solid ${concurrencyLabel.icon}`}></i>
            {concurrencyLabel.text}
          </span>
        </div>
      )}

      {/* 中下部：运行状态 */}
      <div className="mb-3">
        {isRunning ? (
          <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-bold">
            <i className="fa-solid fa-spinner animate-spin"></i>
            <span>运行中</span>
          </div>
        ) : lastStatus ? (
          <div className={`flex items-center gap-1.5 text-[11px] font-bold ${statusColor}`}>
            <i className={`fa-solid ${lastStatus === 'success' ? 'fa-check-circle' : lastStatus === 'failed' ? 'fa-times-circle' : 'fa-minus-circle'}`}></i>
            <span>{lastStatus === 'success' ? '最近成功' : lastStatus === 'failed' ? '最近失败' : '已终止'}</span>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400">暂无运行记录</div>
        )}
        {lastRunTime && (
          <div className="text-[10px] text-slate-400 mt-0.5">{lastRunTime}</div>
        )}
      </div>

      {/* 底部：统计信息 */}
      <div className="mt-auto pt-3 border-t border-slate-100 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="flex flex-col">
            <span className="text-slate-400">今日运行</span>
            <span className="font-bold text-slate-700">{todayCount} 次</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400">本周运行</span>
            <span className="font-bold text-slate-700">{weekCount} 次</span>
          </div>
        </div>
        {avgDuration && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400">平均耗时</span>
            <span className="font-bold text-indigo-600">{avgDuration}</span>
          </div>
        )}
      </div>

      {/* 悬浮指示器 */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <i className="fa-solid fa-arrow-right text-indigo-500 text-sm"></i>
      </div>
    </button>
  );
};

export default FunctionCard;
