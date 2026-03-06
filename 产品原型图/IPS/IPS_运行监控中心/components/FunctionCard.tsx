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

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all active:scale-[0.98] group"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
          <i className={`fa-solid ${icon} text-xl`}></i>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 truncate">{func.name}</h3>
            {isRunning && <i className="fa-solid fa-spinner animate-spin text-indigo-500 shrink-0 text-sm" aria-hidden></i>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{func.description}</p>
        </div>
        <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all shrink-0 mt-1"></i>
      </div>
      <div className="grid grid-cols-3 grid-rows-2 gap-3 mt-4">
        <div className="col-span-3 flex flex-col gap-1">
          {(lastRunTime || isRunning) && (
            <div className={`flex items-center gap-1.5 text-[11px] ${statusColor}`}>
              {isRunning ? (
                <><i className="fa-solid fa-spinner animate-spin"></i>运行中</>
              ) : (
                <>
                  最近运行: {lastRunTime}
                  {hasVersion && (lastPlanVersion || lastDemandVersion) && (
                    <>
                      <span className="opacity-60">·</span>
                      {lastPlanVersion && <span>计划版本 {lastPlanVersion}</span>}
                      {lastDemandVersion && !lastPlanVersion && <span>需求版本 {lastDemandVersion}</span>}
                    </>
                  )}
                </>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            {todayCount > 0 && <span>今日运行 {todayCount} 次</span>}
            {weekCount > 0 && <span>本周运行 {weekCount} 次</span>}
          </div>
        </div>
        <div className="col-span-2 text-[11px] text-slate-500">
          {weekUserCount > 0 && <span>本周使用用户数: <span className="font-bold text-indigo-600">{weekUserCount}</span> 人</span>}
        </div>
        <div className="col-span-1 text-[11px] text-slate-500 text-right">
          {avgDuration && <span>平均耗时 {avgDuration}</span>}
        </div>
      </div>
    </button>
  );
};

export default FunctionCard;
