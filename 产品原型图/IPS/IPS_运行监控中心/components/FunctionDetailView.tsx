import React, { useState, useMemo, useEffect } from 'react';
import { RunRecord, FunctionConfig, ModuleConfig } from '../types';
import { getProgressSteps, hasVersionConcept, RUN_ACTION_CONFIGS } from '../constants';
import OverviewStats from './OverviewStats';

interface Props {
  func: FunctionConfig;
  moduleConfig: ModuleConfig;
  runHistory: RunRecord[];
  onBack: () => void;
  onStartRun: () => void;
  onDownloadAlgorithm: (runId: string) => void;
  onDownloadErrorLog: (runId: string) => void;
  onViewProgress: (run: RunRecord) => void;
}

const FunctionDetailView: React.FC<Props> = ({
  func,
  moduleConfig,
  runHistory,
  onBack,
  onStartRun,
  onDownloadAlgorithm,
  onDownloadErrorLog,
  onViewProgress,
}) => {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [stepsDetailRecord, setStepsDetailRecord] = useState<RunRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'running' | 'terminated'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const steps = getProgressSteps(moduleConfig.id, func.id);
  const showVersion = hasVersionConcept(moduleConfig.id);

  useEffect(() => {
    if (stepsDetailRecord) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [stepsDetailRecord]);

  const overviewStats = useMemo(() => {
    const recs = runHistory.filter((r) => r.functionId === func.id);
    const today = new Date().toDateString();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const todayCount = recs.filter((r) => new Date(r.startTime).toDateString() === today).length;
    const weekCount = recs.filter((r) => new Date(r.startTime) >= weekAgo).length;
    const successCount = recs.filter((r) => r.status === 'success').length;
    const successRate = recs.length > 0 ? Math.round((successCount / recs.length) * 100) : 0;
    const durations = recs.filter((r) => r.duration).map((r) => parseInt(r.duration || '0', 10));
    const avgSec = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const avgDuration = avgSec < 60 ? `${avgSec}s` : `${Math.floor(avgSec / 60)}m ${avgSec % 60}s`;
    return { todayCount, weekCount, successRate, avgDuration };
  }, [runHistory, func.id]);

  const allFilteredHistory = useMemo(() => {
    return runHistory.filter((r) => r.functionId === func.id).filter((run) => {
      const matchesSearch =
        run.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.operator.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || run.status === statusFilter;
      let matchesTime = true;
      if (startDate) matchesTime = matchesTime && new Date(run.startTime) >= new Date(startDate + ' 00:00:00');
      if (endDate) matchesTime = matchesTime && new Date(run.startTime) <= new Date(endDate + ' 23:59:59');
      return matchesSearch && matchesStatus && matchesTime;
    });
  }, [runHistory, func.id, searchTerm, statusFilter, startDate, endDate]);

  const totalPages = Math.ceil(allFilteredHistory.length / itemsPerPage);
  const pagedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return allFilteredHistory.slice(start, start + itemsPerPage);
  }, [allFilteredHistory, currentPage]);

  const getStepIndex = (lastStep: string) => {
    const index = steps.findIndex((s) => lastStep.includes(s.label));
    return index !== -1 ? index + 1 : 0;
  };
  const getCurrentStepIndex = (run: RunRecord) => {
    if ((run.status === 'running' || run.status === 'terminated') && run.progress !== undefined) {
      const idx = steps.findIndex((s) => run.progress! < s.percentage);
      return idx >= 0 ? idx : steps.length - 1;
    }
    const c = getStepIndex(run.lastStep);
    return Math.min(c, steps.length) - 1;
  };
  const getProgressFraction = (run: RunRecord) => {
    if (run.status === 'running') {
      const cur = getCurrentStepIndex(run);
      return `${cur + 1}/${steps.length}`;
    }
    return `${getStepIndex(run.lastStep)}/${steps.length}`;
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600">
          <i className="fa-solid fa-arrow-left"></i> 返回功能列表
        </button>
        <h2 className="text-lg font-black text-slate-900">{func.name}</h2>
      </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
        <OverviewStats stats={overviewStats} title={func.name} />
        {(() => {
          const actionConfig = RUN_ACTION_CONFIGS[func.id];
          if (!actionConfig?.showButton) return null;
          return (
            <button
              onClick={onStartRun}
              className="h-9 px-5 bg-[#1a1f71] text-white rounded-lg text-xs font-bold hover:bg-[#121650] flex items-center gap-2"
            >
              <i className={`fa-solid ${actionConfig.icon}`}></i>
              {actionConfig.label}
            </button>
          );
        })()}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input type="text" placeholder="搜索任务 ID 或操作人..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500/20" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} className="py-2 px-3 rounded-lg border border-slate-200 text-xs font-bold" />
          <span className="text-slate-400 text-xs">至</span>
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} className="py-2 px-3 rounded-lg border border-slate-200 text-xs font-bold" />
          <div className="flex bg-slate-100 p-0.5 rounded-lg">
            {[{ key: 'all', label: '全部' }, { key: 'success', label: '成功' }, { key: 'failed', label: '失败' }, { key: 'running', label: '运行中' }, { key: 'terminated', label: '已终止' }].map((s) => (
              <button key={s.key} onClick={() => { setStatusFilter(s.key as typeof statusFilter); setCurrentPage(1); }} className={`px-3 py-1.5 rounded text-xs font-bold ${statusFilter === s.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{s.label}</button>
            ))}
          </div>
          <button onClick={resetFilters} className="text-xs font-bold text-slate-500 hover:text-indigo-600">重置</button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="font-bold text-slate-500">执行历史</span>
            <span className="text-indigo-600 font-bold">共 {allFilteredHistory.length} 条</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">每页</span>
              <select
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="py-1 px-2 rounded border border-slate-200 text-xs font-bold bg-white"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} 条</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {allFilteredHistory.length > 0 ? (
          <div className="space-y-2">
            {pagedHistory.map((run) => {
              const isSuccess = run.status === 'success';
              const isRunning = run.status === 'running';
              const isTerminated = run.status === 'terminated';
              const compIdx = getStepIndex(run.lastStep);
              const expanded = selectedRecordId === run.id;

              return (
                <div key={run.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow transition-all">
                  <div className="flex items-center gap-4 p-3 cursor-pointer" onClick={() => setSelectedRecordId(expanded ? null : run.id)}>
                    <div className={`w-1.5 h-12 rounded ${isSuccess ? 'bg-emerald-500' : isRunning ? 'bg-indigo-500' : isTerminated ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 ${isSuccess ? 'bg-emerald-500' : isRunning ? 'bg-indigo-500' : isTerminated ? 'bg-amber-500' : 'bg-rose-500'}`}>
                      {isSuccess ? <i className="fa-solid fa-check text-sm"></i> : isRunning ? <i className="fa-solid fa-spinner animate-spin text-sm"></i> : isTerminated ? <i className="fa-solid fa-minus text-sm"></i> : <i className="fa-solid fa-xmark text-sm"></i>}
                    </div>
                    <div className={`flex-1 min-w-0 grid gap-4 ${showVersion ? 'grid-cols-6' : 'grid-cols-5'}`}>
                      <div><span className="text-[10px] text-slate-400 uppercase">任务ID</span><div className="text-xs font-bold text-slate-800 truncate">{run.id}</div></div>
                      <div><span className="text-[10px] text-slate-400 uppercase">开始时间</span><div className="text-xs font-bold text-slate-700">{run.startTime}</div></div>
                      <div><span className="text-[10px] text-slate-400 uppercase">时长</span><div className="text-xs font-bold">{isRunning ? '运行中' : isTerminated ? '已终止' : run.duration}</div></div>
                      <div><span className="text-[10px] text-slate-400 uppercase">操作人</span><div className="text-xs font-bold">{run.operator}</div></div>
                      {showVersion && (
                        <div><span className="text-[10px] text-slate-400 uppercase">计划版本</span><div className="text-xs font-bold text-indigo-600">{run.planVersion ?? '-'}</div></div>
                      )}
                      <div><span className="text-[10px] text-slate-400 uppercase">进度</span><div className="text-xs font-bold">{getProgressFraction(run)}</div></div>
                    </div>
                    <div className="flex gap-2 shrink-0 w-[220px] justify-end">
                      {isSuccess && <button onClick={(e) => { e.stopPropagation(); onDownloadAlgorithm(run.id); }} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-50">算法文件</button>}
                      {!isSuccess && !isRunning && !isTerminated && <button onClick={(e) => { e.stopPropagation(); onDownloadErrorLog(run.id); }} className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold">报错日志</button>}
                      {isRunning && <button onClick={(e) => { e.stopPropagation(); onViewProgress(run); }} className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-bold">查看进度</button>}
                      {isTerminated && <button disabled type="button" className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 text-xs font-bold border border-amber-200 cursor-default min-w-[4.5rem]">已终止</button>}
                      <button onClick={(e) => { e.stopPropagation(); setStepsDetailRecord(run); }} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-50">节点</button>
                    </div>
                    <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}></i>
                  </div>

                  {expanded && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-4">
                      {(run.inputInfo?.length > 0 || (showVersion && run.demandVersion)) && (
                        <div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">输入信息</div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {showVersion && run.demandVersion && (
                              <div className="flex gap-2"><span className="text-slate-500">需求版本:</span><span className="font-medium text-indigo-600">{run.demandVersion}</span></div>
                            )}
                            {(run.inputInfo || []).map((item, i) => (
                              <div key={i} className="flex gap-2"><span className="text-slate-500">{item.key}:</span><span className="font-medium">{item.value}</span></div>
                            ))}
                          </div>
                        </div>
                      )}
                      {run.algorithmLogs && run.algorithmLogs.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">{func.isAlgorithm ? '算法运行日志' : '功能运行日志'}</div>
                          <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-32 overflow-y-auto font-mono">{run.algorithmLogs.join('\n')}</pre>
                        </div>
                      )}
                      {run.results && run.results.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">计算结果</div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {run.results.map((item, i) => (
                              <div key={i} className="flex gap-2"><span className="text-slate-500">{item.key}:</span><span className="font-medium">{item.value}</span></div>
                            ))}
                          </div>
                        </div>
                      )}
                      {run.summary && (
                        <div className="text-xs text-slate-600 italic flex gap-2">
                          <i className="fa-solid fa-sparkles text-indigo-500"></i>
                          {run.summary}
                        </div>
                      )}
                      {(!run.inputInfo?.length && !run.algorithmLogs?.length && !run.results?.length && !run.summary) && (
                        <div className="text-xs text-slate-400">展开可查看：输入信息、算法运行日志、计算结果（演示用可接入真实数据）</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {(totalPages > 1 || allFilteredHistory.length > 0) && (
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 mt-4">
                <span className="text-xs text-slate-500">
                  显示第 {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, allFilteredHistory.length)} 条，共 {allFilteredHistory.length} 条
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold hover:bg-slate-50">«</button>
                  <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold hover:bg-slate-50">‹</button>
                  <span className="px-4 py-2 text-xs font-bold text-slate-700">第 {currentPage} / {totalPages} 页</span>
                  <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold hover:bg-slate-50">›</button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold hover:bg-slate-50">»</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg py-16 text-center">
            <i className="fa-solid fa-filter text-4xl text-slate-300 mb-4"></i>
            <p className="text-sm font-bold text-slate-500">未找到匹配记录</p>
            <button onClick={resetFilters} className="mt-3 text-xs font-bold text-indigo-600">重置筛选</button>
          </div>
        )}
      </div>

      {stepsDetailRecord && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setStepsDetailRecord(null)}></div>
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-900">执行节点 - {stepsDetailRecord.id}</h3>
              <button onClick={() => setStepsDetailRecord(null)} className="text-slate-400 hover:text-rose-500"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
              {getProgressSteps(stepsDetailRecord.moduleId, stepsDetailRecord.functionId).map((step, i) => {
                const curIdx = stepsDetailRecord.status === 'running' ? getCurrentStepIndex(stepsDetailRecord) : -1;
                const failIdx = stepsDetailRecord.status === 'failed' ? Math.max(0, getStepIndex(stepsDetailRecord.lastStep) - 1) : -1;
                const termIdx = stepsDetailRecord.status === 'terminated' ? getCurrentStepIndex(stepsDetailRecord) : -1;
                const isDone = stepsDetailRecord.status === 'success' ? true : stepsDetailRecord.status === 'running' ? i < curIdx : stepsDetailRecord.status === 'terminated' ? (termIdx >= 0 ? i < termIdx : false) : (failIdx >= 0 ? i < failIdx : false);
                const isCurrent = stepsDetailRecord.status === 'running' && i === curIdx;
                const isTerminatedAt = stepsDetailRecord.status === 'terminated' && termIdx >= 0 && i === termIdx;
                const isError = stepsDetailRecord.status === 'failed' && failIdx >= 0 && i === failIdx;
                return (
                  <div key={i} className="flex gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isError ? 'bg-rose-500 text-white' : isTerminatedAt ? 'bg-amber-500 text-white' : isDone ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {isError ? <i className="fa-solid fa-xmark"></i> : isTerminatedAt ? <i className="fa-solid fa-minus"></i> : isDone ? <i className="fa-solid fa-check"></i> : isCurrent ? <i className="fa-solid fa-spinner animate-spin"></i> : i + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${isDone || isCurrent || isTerminatedAt ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{isDone ? (isError ? '计算中止' : step.defaultRemark) : isCurrent ? '执行中...' : isTerminatedAt ? '已终止' : '待执行'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FunctionDetailView;
