import React, { useState, useEffect } from 'react';
import { ProgressStep, ModuleConfig, RunRecord } from '../types';
import { getProgressSteps } from '../constants';

interface Props {
  isOpen: boolean;
  isVisible: boolean;
  moduleConfig: ModuleConfig;
  functionName?: string;
  functionId?: string;
  /** 查看运行中任务时传入，展示当前节点转圈 */
  viewingRun?: RunRecord | null;
  onViewingClose?: () => void;
  /** 终止运行中任务 */
  onTerminate?: () => void;
  onComplete: (summary: string, lastStep: string) => void;
  onClose: (hasError: boolean, progress: number, lastStep: string) => void;
  generateSummary: () => Promise<string>;
}

const RunProgressModal: React.FC<Props> = ({
  isOpen,
  isVisible,
  moduleConfig,
  functionName,
  functionId,
  viewingRun,
  onViewingClose,
  onTerminate,
  onComplete,
  onClose,
  generateSummary,
}) => {
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [hasError, setHasError] = useState(false);

  const steps = getProgressSteps(moduleConfig.id, functionId ?? viewingRun?.functionId);

  const isViewMode = !!viewingRun && viewingRun.status === 'running';

  /** 根据 progress 计算当前步骤索引（保证进度与节点对齐） */
  const getCurrentStepIndexFromProgress = (p: number) => {
    const idx = steps.findIndex((s) => p < s.percentage);
    return idx >= 0 ? idx : steps.length - 1;
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setCurrentStepIndex(0);
      setIsFinished(false);
      setHasError(false);
      return;
    }
    if (isViewMode && viewingRun) {
      setProgress(viewingRun.progress);
      setCurrentStepIndex(getCurrentStepIndexFromProgress(viewingRun.progress));
      setIsFinished(false);
      return;
    }
    setProgress(0);
    setCurrentStepIndex(0);
    setIsFinished(false);
    setHasError(false);

    const interval = setInterval(() => {
      setProgress((p) => {
        const increment = Math.random() * 4;
        const nextVal = Math.min(100, p + increment);
        if (nextVal >= 100) {
          clearInterval(interval);
          setIsFinished(true);
          setTimeout(async () => {
            const summary = await generateSummary();
            onComplete(summary, steps[steps.length - 1].label);
          }, 800);
        }
        return nextVal;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isOpen, isViewMode, viewingRun?.id, viewingRun?.progress, viewingRun?.lastStep]);

  useEffect(() => {
    if (!isViewMode && isOpen) {
      const idx = steps.findIndex((s) => s.percentage >= progress);
      setCurrentStepIndex(idx === -1 ? steps.length - 1 : idx);
    }
  }, [progress, isViewMode, isOpen, steps]);

  if (!isOpen) return null;

  const currentStepLabel = steps[currentStepIndex]?.label || '准备计算';
  const displayProgress = isViewMode ? (viewingRun?.progress ?? progress) : progress;
  const displayStepIndex = isViewMode ? getCurrentStepIndexFromProgress(displayProgress) : currentStepIndex;
  const isRunning = isViewMode || !isFinished;

  const handleClose = () => {
    if (isViewMode && onViewingClose) {
      onViewingClose();
    }
    onClose(hasError || false, displayProgress, currentStepLabel);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        !isVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleClose}></div>

      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-xl overflow-hidden transform transition-all flex flex-col">
        <div className="p-5 pb-4">
          <div className="flex justify-between items-center mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900">
                {isViewMode ? '查看运行进度' : isFinished ? `${functionName || moduleConfig.name} 计算完成` : `${functionName || moduleConfig.name} 正在执行计算`}
              </h2>
              <p className="text-slate-400 text-sm font-medium">
                {isViewMode ? '当前任务运行中，查看节点进度' : isFinished ? '计算已完成' : '核心算法正在执行中...'}
              </p>
            </div>
            {isViewMode && onTerminate ? (
              <button
                onClick={() => { onTerminate(); }}
                className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 active:scale-95 transition-all flex items-center gap-2 shadow-lg"
              >
                <i className="fa-solid fa-stop"></i>
                终止
              </button>
            ) : (
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg bg-indigo-600 ${isRunning ? 'animate-breathe' : ''}`}>
                <i className={`fa-solid ${isFinished ? 'fa-check' : 'fa-loader animate-spin'} text-xl`}></i>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">整体执行进度</span>
              <span className="text-sm font-black text-indigo-600">
                {isFinished ? `${steps.length}/${steps.length}` : `${displayStepIndex + 1}/${steps.length}`}
              </span>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-50">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out relative bg-indigo-600 overflow-hidden"
                style={{ width: `${displayProgress}%` }}
              >
                {isRunning && <div className="progress-flow-shine" />}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-5 py-4 space-y-5">
          {steps.map((step, idx) => {
            const isStepDone = displayProgress >= step.percentage;
            const isCurrentStep = idx === displayStepIndex && !isFinished;
            const showSpinning = isCurrentStep && isRunning;

            return (
              <div key={idx} className="relative">
                {idx < steps.length - 1 && (
                  <div
                    className={`absolute left-4 top-10 w-0.5 h-12 -ml-[1px] transition-colors duration-500 ${
                      displayProgress > step.percentage ? 'bg-indigo-600' : 'bg-slate-100'
                    }`}
                  ></div>
                )}
                <div className="flex items-center gap-5">
                  <div
                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-500 ${
                      isStepDone ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {showSpinning ? (
                      <i className="fa-solid fa-loader animate-spin text-sm"></i>
                    ) : isStepDone ? (
                      <i className="fa-solid fa-check"></i>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-black ${isStepDone ? 'text-slate-800' : 'text-slate-400'}`}>
                      {step.label}
                    </p>
                    {showSpinning && (
                      <span className="text-[10px] text-indigo-500 font-bold animate-pulse">计算中...</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-5 pt-4 flex justify-end bg-slate-50/50 items-center">
          <button
            onClick={handleClose}
            className="px-6 py-2 text-sm font-bold text-white rounded-lg transition-all bg-slate-900 hover:bg-slate-800"
          >
            {isViewMode ? '关闭' : '关闭窗口'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunProgressModal;
