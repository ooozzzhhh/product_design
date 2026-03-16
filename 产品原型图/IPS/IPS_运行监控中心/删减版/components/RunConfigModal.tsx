import React, { useState, useMemo } from 'react';
import { RunConfig, ModuleConfig } from '../types';

interface Props {
  isOpen: boolean;
  moduleConfig: ModuleConfig;
  functionName?: string;
  onConfirm: (config: RunConfig) => void;
  onCancel: () => void;
}

const POLICY_TEMPLATES: Record<string, string[]> = {
  default: ['标准策略_v1', '优化策略_核心', '全量重算方案', '增量计算规则'],
  MRP: ['标准供需匹配策略_v1', '紧急缺料应对策略_核心件', '年度冗余库存清理方案', 'LFL按需供应平衡规则'],
  SCH: ['规则式生产排程_标准', '规则式生产排程_交期优先', '规则式生产排程_产能优化', '规则式生产排程_成本最优'],
  DFP: ['标准预测算法', '季节性调整策略', '趋势预测方案', '组合预测规则'],
};

const RunConfigModal: React.FC<Props> = ({ isOpen, moduleConfig, functionName, onConfirm, onCancel }) => {
  const [runMode, setRunMode] = useState('仅运行变更数据');
  const [policyMode, setPolicyMode] = useState('规则模式');
  const [policyName, setPolicyName] = useState(
    (POLICY_TEMPLATES[moduleConfig.id] || POLICY_TEMPLATES.default)[0]
  );
  const [policySearch, setPolicySearch] = useState('');
  const [isPolicyDropdownOpen, setIsPolicyDropdownOpen] = useState(false);

  const templates = POLICY_TEMPLATES[moduleConfig.id] || POLICY_TEMPLATES.default;

  const filteredPolicies = useMemo(() => {
    return templates.filter((p) => p.toLowerCase().includes(policySearch.toLowerCase()));
  }, [policySearch, templates]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({ runMode, policyMode, policyName });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel}></div>
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#1a1f71] text-white flex items-center justify-center shadow-lg">
                <i className={`fa-solid ${moduleConfig.icon} text-xl`}></i>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">{functionName || moduleConfig.name} 运行配置</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  RUN CONFIGURATION
                </p>
              </div>
            </div>
            <button onClick={onCancel} className="text-slate-400 hover:text-rose-500 transition-all">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto">
          <div className="space-y-3 relative">
            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
              <i className="fa-solid fa-tag text-indigo-500"></i>
              策略名称
            </label>
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
              <input
                type="text"
                value={isPolicyDropdownOpen ? policySearch : policyName}
                onFocus={() => {
                  setIsPolicyDropdownOpen(true);
                  setPolicySearch(policyName);
                }}
                onChange={(e) => setPolicySearch(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                placeholder="搜索或选择策略名称..."
              />
              <button
                onClick={() => setIsPolicyDropdownOpen(!isPolicyDropdownOpen)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <i className={`fa-solid fa-chevron-${isPolicyDropdownOpen ? 'up' : 'down'}`}></i>
              </button>
            </div>
            {isPolicyDropdownOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  {filteredPolicies.length > 0 ? (
                    filteredPolicies.map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setPolicyName(p);
                          setIsPolicyDropdownOpen(false);
                        }}
                        className="w-full text-left px-5 py-3 text-sm font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-between"
                      >
                        {p}
                        {policyName === p && <i className="fa-solid fa-check text-indigo-500"></i>}
                      </button>
                    ))
                  ) : (
                    <div className="px-5 py-4 text-sm text-slate-400 italic">
                      未匹配到策略，输入后可直接使用
                    </div>
                  )}
                </div>
                {policySearch && !filteredPolicies.includes(policySearch) && (
                  <button
                    onClick={() => {
                      setPolicyName(policySearch);
                      setIsPolicyDropdownOpen(false);
                    }}
                    className="w-full text-left px-5 py-3 text-xs font-black bg-indigo-50 text-indigo-600 border-t border-indigo-100"
                  >
                    <i className="fa-solid fa-plus mr-2"></i>使用新名称: "{policySearch}"
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
              <i className="fa-solid fa-gears text-indigo-500"></i>
              运行模式
            </label>
            <div className="grid grid-cols-2 gap-3">
                {['仅运行变更数据', '全量数据重算'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setRunMode(mode)}
                  className={`py-3 px-4 rounded-lg text-xs font-bold border transition-all flex flex-col items-center gap-2 ${
                    runMode === mode
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <i
                    className={`fa-solid ${
                      mode === '仅运行变更数据' ? 'fa-bolt' : 'fa-database'
                    } text-lg`}
                  ></i>
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
              <i className="fa-solid fa-brain text-indigo-500"></i>
              策略模式
            </label>
            <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
              {['规则模式', '优化算法'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPolicyMode(mode)}
                  className={`flex-1 py-2 rounded text-xs font-bold transition-all ${
                    policyMode === mode ? 'bg-white text-[#4f46e5] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-white border border-slate-200 text-slate-500 rounded-lg text-sm font-bold hover:bg-slate-100"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 bg-[#1a1f71] text-white rounded-lg text-sm font-bold hover:bg-[#121650] transition-all"
          >
            确认并开始
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunConfigModal;
