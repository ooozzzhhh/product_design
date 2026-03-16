import React, { useState, useMemo } from 'react';
import { RunRecord, RunConfig, ModuleId, ModuleConfig, FunctionConfig } from './types';
import { MODULE_CONFIGS, getProgressSteps, getFunctionsByModule, hasVersionConcept, RUN_ACTION_CONFIGS } from './constants';
import { generateMockHistory } from './mockData';
import FunctionRunConfigModal from './components/FunctionRunConfigModal';
import RunProgressModal from './components/RunProgressModal';
import FunctionDetailView from './components/FunctionDetailView';

const INITIAL_HISTORY = generateMockHistory();

const App: React.FC = () => {
  const [currentModuleId, setCurrentModuleId] = useState<ModuleId>('MRP');
  const [selectedFunction, setSelectedFunction] = useState<FunctionConfig | null>(getFunctionsByModule('MRP')[0] || null);
  const [runHistory, setRunHistory] = useState<RunRecord[]>(INITIAL_HISTORY);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isProgressVisible, setIsProgressVisible] = useState(false);
  const [viewingRun, setViewingRun] = useState<RunRecord | null>(null);

  const moduleConfig = MODULE_CONFIGS[currentModuleId] || MODULE_CONFIGS.MRP;
  const functions = getFunctionsByModule(currentModuleId);

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

    // 根据并发模式决定新任务的状态
    const concurrencyMode = func.concurrencyConfig?.mode;
    const maxConcurrency = func.concurrencyConfig?.maxConcurrency || 1;
    const runningTasks = runHistory.filter(r => r.functionId === func.id && r.status === 'running');

    let initialStatus: 'running' | 'queued' = 'running';
    let queuePosition: number | undefined;

    if (concurrencyMode === 'EXCLUSIVE' || concurrencyMode === 'QUEUEABLE') {
      // 不可并行或可排队模式：最多1个运行中
      if (runningTasks.length >= 1) {
        initialStatus = 'queued';
        const queuedTasks = runHistory.filter(r => r.functionId === func.id && r.status === 'queued');
        queuePosition = queuedTasks.length + 1;
      }
    } else if (concurrencyMode === 'LIMITED_PARALLEL') {
      // 限N并发模式：最多N个运行中
      if (runningTasks.length >= maxConcurrency) {
        initialStatus = 'queued';
        const queuedTasks = runHistory.filter(r => r.functionId === func.id && r.status === 'queued');
        queuePosition = queuedTasks.length + 1;
      }
    }
    // PARALLEL 模式：不限制，始终为 running

    const newRecord: RunRecord = {
      id: newRunId,
      moduleId: currentModuleId,
      functionId: func.id,
      startTime,
      operator: '管理员 (Admin)',
      algorithmScheme: currentModuleId === 'SCH' ? '规则式生产排程' : config.policyMode,
      status: initialStatus,
      progress: 0,
      lastStep: initialStatus === 'queued' ? '等待中' : (steps[0]?.label ?? '初始化'),
      totalSteps: steps.length,
      runMode: config.runMode,
      policyMode: config.policyMode,
      policyName: config.policyName,
      planVersion: planVer,
      demandVersion: demandVer,
      inputInfo: inputInfoFromParams,
      algorithmLogs: initialStatus === 'queued' ? [
        `[${startTime.split(' ')[1]}] 任务已提交`,
        `[${startTime.split(' ')[1]}] 检测到前序任务正在运行`,
        `[${startTime.split(' ')[1]}] 当前排队中，等待资源释放...`,
      ] : [
        `[${startTime.split(' ')[1]}] ${steps[0]?.label ?? '初始化'}`,
      ],
      queueStatus: initialStatus === 'queued' && queuePosition !== undefined ? {
        position: queuePosition,
        estimatedWaitTime: `${queuePosition * 2}分钟`,
      } : undefined,
    };

    setRunHistory((prev) => [newRecord, ...prev]);
    setViewingRun(null);

    // 只有运行中的任务才打开进度弹窗，排队任务不打开
    if (initialStatus === 'running') {
      setIsProgressVisible(true);
    }
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
        {selectedFunction && (
          <FunctionDetailView
            func={selectedFunction}
            moduleConfig={moduleConfig}
            functions={functions}
            runHistory={runHistory}
            onFunctionChange={setSelectedFunction}
            onStartRun={handleStartRun}
            onDownloadAlgorithm={handleDownloadAlgorithm}
            onDownloadErrorLog={handleDownloadErrorLog}
            onViewProgress={handleViewProgress}
          />
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
