import React, { useState, useMemo } from 'react';
import { RunRecord, RunConfig, ModuleId, ModuleConfig, FunctionConfig } from './types';
import { MODULE_CONFIGS, getProgressSteps, getFunctionsByModule, hasVersionConcept, RUN_ACTION_CONFIGS } from './constants';
import { generateMockHistory } from './mockData';
import FunctionRunConfigModal from './components/FunctionRunConfigModal';
import RunProgressModal from './components/RunProgressModal';
import FunctionCard from './components/FunctionCard';
import FunctionDetailView from './components/FunctionDetailView';

const INITIAL_HISTORY = generateMockHistory();

const App: React.FC = () => {
  const [currentModuleId, setCurrentModuleId] = useState<ModuleId>('MRP');
  const [selectedFunction, setSelectedFunction] = useState<FunctionConfig | null>(null);
  const [runHistory, setRunHistory] = useState<RunRecord[]>(INITIAL_HISTORY);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isProgressVisible, setIsProgressVisible] = useState(false);
  const [viewingRun, setViewingRun] = useState<RunRecord | null>(null);

  const moduleConfig = MODULE_CONFIGS[currentModuleId] || MODULE_CONFIGS.MRP;
  const functions = getFunctionsByModule(currentModuleId);

  /** 卡片统计：最近运行、今日/本周次数、本周使用用户数、平均耗时 */
  const cardStats = useMemo(() => {
    const stats: Record<string, { lastStatus?: 'success' | 'failed' | 'running'; lastRunTime?: string; todayCount: number; weekCount: number; weekUserCount: number; avgDuration: string; lastPlanVersion?: string; lastDemandVersion?: string }> = {};
    const today = new Date().toDateString();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    functions.forEach((f) => {
      const recs = runHistory.filter((r) => r.functionId === f.id).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      const todayRecs = recs.filter((r) => new Date(r.startTime).toDateString() === today);
      const weekRecs = recs.filter((r) => new Date(r.startTime) >= weekAgo);
      const weekUserSet = new Set(weekRecs.map((r) => r.operator));
      const durations = weekRecs.filter((r) => r.duration && /^\d+s?$/.test(r.duration)).map((r) => parseInt(r.duration || '0', 10));
      const avgSec = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
      const avgDuration = avgSec < 60 ? `${avgSec}s` : `${Math.floor(avgSec / 60)}m`;

      stats[f.id] = {
        lastStatus: recs[0]?.status,
        lastRunTime: recs[0] ? recs[0].startTime.slice(0, 16) : undefined,
        todayCount: todayRecs.length,
        weekCount: weekRecs.length,
        weekUserCount: weekUserSet.size,
        avgDuration,
        lastPlanVersion: recs[0]?.planVersion,
        lastDemandVersion: recs[0]?.demandVersion,
      };
    });
    return stats;
  }, [runHistory, functions]);

  const handleStartRun = () => {
    const func = selectedFunction;
    if (!func) return;
    setIsConfigModalOpen(true);
  };

  const onConfirmConfig = (config: RunConfig) => {
    const func = selectedFunction;
    if (!func) return;
    setIsConfigModalOpen(false);
    const prefix = func.runIdPrefix;
    const newRunId = `${prefix}-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const startTime = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const steps = getProgressSteps(moduleConfig.id, func.id);

    const nowStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const q = ['Q1', 'Q2', 'Q3', 'Q4'][Math.floor(now.getMonth() / 3)];
    const hasVer = hasVersionConcept(currentModuleId);
    const planVer = (hasVer && config.params?.planVersion) || (hasVer && currentModuleId !== 'DFP' ? `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${q}` : undefined);
    const demandVer = (hasVer && config.params?.demandVersion) || (hasVer ? `DFP-${nowStr}` : undefined);

    const inputInfoFromParams = config.params
      ? Object.entries(config.params)
          .filter(([, v]) => v)
          .map(([key, value]) => {
            const label = RUN_ACTION_CONFIGS[func.id]?.params?.find((p) => p.key === key)?.label ?? key;
            return { key: label, value };
          })
      : undefined;

    const newRecord: RunRecord = {
      id: newRunId,
      moduleId: currentModuleId,
      functionId: func.id,
      startTime,
      operator: '管理员 (Admin)',
      algorithmScheme: currentModuleId === 'SCH' ? '规则式生产排程' : config.policyMode,
      status: 'running',
      progress: 0,
      lastStep: steps[0]?.label ?? '初始化',
      totalSteps: steps.length,
      runMode: config.runMode,
      policyMode: config.policyMode,
      policyName: config.policyName,
      planVersion: planVer,
      demandVersion: demandVer,
      inputInfo: inputInfoFromParams,
    };

    setRunHistory((prev) => [newRecord, ...prev]);
    setViewingRun(null);
    setIsProgressVisible(true);
  };

  const handleDownloadAlgorithm = (runId: string) => {
    const content = `任务ID: ${runId}\n功能: ${selectedFunction?.name}\n执行时间: ${new Date().toLocaleString()}\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Run_Config_${runId}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadErrorLog = (runId: string) => {
    const header = '错误级别,模块,错误代码,异常描述\n';
    const rows = [`CRITICAL,Core,E001,数据异常导致计算中断。`, `WARNING,Sync,W042,数据同步超时。`];
    const blob = new Blob(['\uFEFF' + header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Error_Log_${runId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleViewProgress = (run: RunRecord) => {
    setViewingRun(run);
    setIsProgressVisible(true);
  };

  const generateSummary = async () => {
    return `${selectedFunction?.name || moduleConfig.name} 计算完成。所有数据已重新评估并纳入计划。`;
  };

  return (
    <div className="min-h-screen bg-[#f3f6fb] font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-[#1a1f71] p-2 rounded-lg text-white">
              <i className="fa-solid fa-gauge-high text-lg"></i>
            </div>
            <span className="text-lg font-bold text-slate-900">运行监控中心</span>
          </div>
          <div className="relative">
            <select
              value={currentModuleId}
              onChange={(e) => {
                setCurrentModuleId(e.target.value as ModuleId);
                setSelectedFunction(null);
              }}
              className="pl-4 pr-10 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-800 appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
            >
              {(Object.keys(MODULE_CONFIGS) as ModuleId[]).map((mid) => (
                <option key={mid} value={mid}>
                  {MODULE_CONFIGS[mid].name}
                </option>
              ))}
            </select>
            <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {selectedFunction ? (
          <FunctionDetailView
            func={selectedFunction}
            moduleConfig={moduleConfig}
            runHistory={runHistory}
            onBack={() => setSelectedFunction(null)}
            onStartRun={handleStartRun}
            onDownloadAlgorithm={handleDownloadAlgorithm}
            onDownloadErrorLog={handleDownloadErrorLog}
            onViewProgress={handleViewProgress}
          />
        ) : (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-black text-slate-900">{moduleConfig.name} - 可监控功能</h1>
              <p className="text-sm text-slate-500 mt-0.5">{moduleConfig.description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {functions.map((f) => (
                <FunctionCard key={f.id} func={f} stats={cardStats[f.id]} onClick={() => setSelectedFunction(f)} />
              ))}
            </div>

            {functions.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-lg py-16 text-center">
                <p className="text-slate-500">该模块暂无配置可监控功能</p>
              </div>
            )}
          </div>
        )}
      </main>

      <FunctionRunConfigModal
        isOpen={isConfigModalOpen}
        moduleConfig={moduleConfig}
        functionId={selectedFunction?.id ?? ''}
        functionName={selectedFunction?.name}
        onConfirm={onConfirmConfig}
        onCancel={() => setIsConfigModalOpen(false)}
      />

      <RunProgressModal
        isOpen={isProgressVisible}
        isVisible={isProgressVisible}
        moduleConfig={moduleConfig}
        functionName={selectedFunction?.name}
        functionId={selectedFunction?.id}
        viewingRun={viewingRun}
        onViewingClose={() => setViewingRun(null)}
        onTerminate={viewingRun ? () => {
          const func = selectedFunction;
          if (!func) return;
          setRunHistory((prev) =>
            prev.map((r) =>
              r.id === viewingRun.id ? { ...r, status: 'terminated' as const } : r
            )
          );
          setIsProgressVisible(false);
          setViewingRun(null);
        } : undefined}
        onComplete={(s, step) => {
          setIsProgressVisible(false);
          setViewingRun(null);
          const func = selectedFunction;
          if (!func) return;
          setRunHistory((prev) =>
            prev.map((r) =>
              r.status === 'running' && r.functionId === func.id
                ? { ...r, status: 'success' as const, summary: s, lastStep: step, progress: 100, endTime: new Date().toLocaleTimeString(), duration: '12s' }
                : r
            )
          );
        }}
        onClose={(hasError, progress, step) => {
          setIsProgressVisible(false);
          setViewingRun(null);
          const func = selectedFunction;
          if (!func) return;
          setRunHistory((prev) =>
            prev.map((r) =>
              r.status === 'running' && r.functionId === func.id
                ? { ...r, progress, lastStep: hasError ? r.lastStep : step, status: hasError ? ('failed' as const) : ('running' as const) }
                : r
            )
          );
        }}
        generateSummary={generateSummary}
      />
    </div>
  );
};

export default App;
