import React, { useState, useMemo, useEffect } from 'react';
import { RunConfig, ModuleConfig } from '../types';
import { RUN_ACTION_CONFIGS } from '../constants';

const POLICY_TEMPLATES: Record<string, string[]> = {
  default: ['标准策略_v1', '优化策略_核心', '全量重算方案', '增量计算规则'],
  MRP: ['标准供需匹配策略_v1', '紧急缺料应对策略_核心件', '年度冗余库存清理方案', 'LFL按需供应平衡规则'],
  MPS: ['标准主计划策略', '满足率优先策略', '成本优化策略'],
  SCH: ['规则式生产排程_标准', '规则式生产排程_交期优先', '规则式生产排程_产能优化', '规则式生产排程_成本最优'],
  DFP: ['标准预测算法', '季节性调整策略', '趋势预测方案', '组合预测规则'],
};

interface Props {
  isOpen: boolean;
  moduleConfig: ModuleConfig;
  functionId: string;
  functionName?: string;
  onConfirm: (config: RunConfig) => void;
  onCancel: () => void;
}

const FunctionRunConfigModal: React.FC<Props> = ({
  isOpen,
  moduleConfig,
  functionId,
  functionName,
  onConfirm,
  onCancel,
}) => {
  const actionConfig = RUN_ACTION_CONFIGS[functionId];
  const showPolicy = actionConfig?.showPolicyConfig ?? true;

  const [runMode, setRunMode] = useState('仅运行变更数据');
  const [policyMode, setPolicyMode] = useState('规则模式');
  const [policyName, setPolicyName] = useState(
    (POLICY_TEMPLATES[moduleConfig.id] || POLICY_TEMPLATES.default)[0]
  );
  const [policySearch, setPolicySearch] = useState('');
  const [isPolicyDropdownOpen, setIsPolicyDropdownOpen] = useState(false);
  const [params, setParams] = useState<Record<string, string>>({});
  const [openParamKey, setOpenParamKey] = useState<string | null>(null);

  const templates = POLICY_TEMPLATES[moduleConfig.id] || POLICY_TEMPLATES.default;
  const filteredPolicies = useMemo(
    () => templates.filter((p) => p.toLowerCase().includes(policySearch.toLowerCase())),
    [policySearch, templates]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && actionConfig) {
      const init: Record<string, string> = {};
      actionConfig.params.forEach((p) => {
        if (p.type === 'select' && p.options?.[0]) init[p.key] = p.options[0].value;
      });
      setParams(init);
      setOpenParamKey(null);
    }
  }, [isOpen, functionId]);

  const updateParam = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!actionConfig) return true;
    for (const p of actionConfig.params) {
      if (p.required && !params[p.key]?.trim()) return false;
    }
    return true;
  };

  const handleConfirm = () => {
    if (!validate()) return;
    onConfirm({
      runMode,
      policyMode,
      policyName,
      params: Object.keys(params).length ? params : undefined,
    });
  };

  if (!isOpen) return null;
  if (!actionConfig) return null;

  const title = actionConfig.modalTitle;
  const canConfirm = validate();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel}></div>
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#1a1f71] text-white flex items-center justify-center shadow-lg">
                <i className={`fa-solid ${actionConfig.icon} text-xl`}></i>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">{title}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  {functionName || moduleConfig.name}
                </p>
              </div>
            </div>
            <button onClick={onCancel} className="text-slate-400 hover:text-rose-500 transition-all">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
        </div>

        <div className="relative flex-1 min-h-0 overflow-hidden">
          {openParamKey && (
            <div
              className="absolute inset-0 z-10"
              onClick={() => setOpenParamKey(null)}
              aria-hidden
            />
          )}
          <div className="p-5 space-y-6 overflow-y-auto">
          {/* 功能差异化参数 */}
          {actionConfig.params.length > 0 && (
            <div className="space-y-4">
              <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                <i className="fa-solid fa-sliders text-indigo-500"></i>
                运行参数
              </label>
              <div className="space-y-4">
                {actionConfig.params.map((p) => (
                  <div key={p.key} className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500">
                      {p.label}
                      {p.required && <span className="text-rose-500 ml-0.5">*</span>}
                    </label>
                    {p.type === 'select' ? (
                      <div className={`relative ${openParamKey === p.key ? 'z-20' : ''}`}>
                        <div
                          onClick={() => {
                            setIsPolicyDropdownOpen(false);
                            setOpenParamKey(openParamKey === p.key ? null : p.key);
                          }}
                          className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 outline-none transition-all cursor-pointer flex items-center justify-between"
                        >
                          <span className={params[p.key] ? 'text-slate-800' : 'text-slate-400'}>
                            {p.options?.find((o) => o.value === params[p.key])?.label ?? '请选择'}
                          </span>
                          <i className={`fa-solid fa-chevron-${openParamKey === p.key ? 'up' : 'down'} text-slate-400 absolute right-4 top-1/2 -translate-y-1/2`}></i>
                        </div>
                        {openParamKey === p.key && (
                          <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                              <div className="max-h-48 overflow-y-auto">
                                {p.options?.map((o) => (
                                  <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => {
                                      updateParam(p.key, o.value);
                                      setOpenParamKey(null);
                                    }}
                                    className="w-full text-left px-5 py-3 text-sm font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-between"
                                  >
                                    {o.label}
                                    {params[p.key] === o.value && <i className="fa-solid fa-check text-indigo-500"></i>}
                                  </button>
                                ))}
                              </div>
                            </div>
                        )}
                      </div>
                    ) : p.type === 'date' ? (
                      <input
                        type="date"
                        value={params[p.key] ?? ''}
                        onChange={(e) => updateParam(p.key, e.target.value)}
                        placeholder={p.placeholder}
                        className="w-full pl-4 pr-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                      />
                    ) : (
                      <input
                        type="text"
                        value={params[p.key] ?? ''}
                        onChange={(e) => updateParam(p.key, e.target.value)}
                        placeholder={p.placeholder}
                        className="w-full pl-4 pr-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 策略配置（可选） */}
          {showPolicy && (
            <>
              <div className="space-y-3 relative">
                <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                  <i className="fa-solid fa-tag text-indigo-500"></i>
                  策略名称
                </label>
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                  <input
                    type="text"
                    value={isPolicyDropdownOpen ? policySearch : policyName}
                    onFocus={() => {
                      setOpenParamKey(null);
                      setIsPolicyDropdownOpen(true);
                      setPolicySearch(policyName);
                    }}
                    onChange={(e) => setPolicySearch(e.target.value)}
                    className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                    placeholder="搜索或选择策略名称..."
                  />
                  <button
                    type="button"
                    onClick={() => setIsPolicyDropdownOpen(!isPolicyDropdownOpen)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                        <div className="px-5 py-4 text-sm text-slate-400 italic">未匹配到策略</div>
                      )}
                    </div>
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
                      <i className={`fa-solid ${mode === '仅运行变更数据' ? 'fa-bolt' : 'fa-database'} text-lg`}></i>
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
            </>
          )}
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
            disabled={!canConfirm}
            className="flex-1 py-3 bg-[#1a1f71] text-white rounded-lg text-sm font-bold hover:bg-[#121650] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionConfig.label}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FunctionRunConfigModal;
