
import React, { useState, useCallback, useMemo } from 'react';
import { CustomerOrder, PlanStatus, AllocationStatus, MRPRunRecord, MRP_PROGRESS_STEPS } from './types';
import OrderTable from './components/OrderTable';
import MRPProgressModal from './components/MRPProgressModal';
import MRPConfigModal from './components/MRPConfigModal';
import { generateMRPSummary } from './services/geminiService';

const INITIAL_ORDERS: CustomerOrder[] = [
  { id: 1, isDelayed: false, planStatus: PlanStatus.UNPLANNED, allocationStatus: AllocationStatus.FULLY_ALLOCATED, orderNo: 'SO-2023-001', warehouseCode: 'CP001', itemCode: 'ZJ-BOARD-V1', deliveryDate: '2023-11-20', quantity: 100, lineNo: '1', salesDeptCode: 'D01', customerCode: 'C088', region: '华东', salesType: '标准销售' },
  { id: 2, isDelayed: true, planStatus: PlanStatus.UNPLANNED, allocationStatus: AllocationStatus.PARTIALLY_ALLOCATED, orderNo: 'SO-2023-002', warehouseCode: 'CP002', itemCode: 'MTR-150-AC', deliveryDate: '2023-11-22', quantity: 50, lineNo: '1', salesDeptCode: 'D02', customerCode: 'C102', region: '华北', salesType: '紧急订单' },
  { id: 3, isDelayed: false, planStatus: PlanStatus.UNPLANNED, allocationStatus: AllocationStatus.NOT_ALLOCATED, orderNo: 'SO-2023-003', warehouseCode: 'CP001', itemCode: 'CAB-ETH-5M', deliveryDate: '2023-12-01', quantity: 2000, lineNo: '1', salesDeptCode: 'D01', customerCode: 'C054', region: '华南', salesType: '标准销售' }
];

const INITIAL_HISTORY: MRPRunRecord[] = Array.from({ length: 15 }).map((_, i) => ({
  id: i === 0 ? 'MRP-899788' : i === 1 ? 'MRP-882910' : i === 2 ? 'MRP-882909' : `MRP-882${910 - i}`,
  startTime: i === 0 ? '2026-01-09 16:21:39' : `2023-11-${15 - Math.floor(i/2)} 09:30:15`,
  endTime: i === 0 ? '2026-01-09 16:21:44' : `2023-11-${15 - Math.floor(i/2)} 09:30:28`,
  duration: i === 0 ? '5s' : '13s',
  operator: i === 1 ? '系统自动任务' : '管理员 (Admin)',
  algorithmScheme: '标准 LFL 供需匹配',
  status: i % 2 === 0 ? 'failed' : 'success',
  progress: i % 2 === 0 ? 60 : 100,
  lastStep: i % 2 === 0 ? '执行供需平衡计算' : '建议计划生成与报告汇总',
  totalSteps: MRP_PROGRESS_STEPS.length,
  summary: i % 2 === 0 ? undefined : '本次 MRP 计算顺利完成。系统成功处理了订单，整体物料齐套率达到 94%。',
  isSimulatedFailure: i % 2 === 0,
  runMode: i % 3 === 0 ? '仅运行改变的物料' : '全量物料重算',
  policyMode: '规则模式',
  policyName: '标准供需匹配策略'
}));

type ViewMode = 'orders' | 'results';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewMode>('orders'); 
  const [orders, setOrders] = useState<CustomerOrder[]>(INITIAL_ORDERS);
  
  // MRP 状态管理
  const [isMRPRunning, setIsMRPRunning] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
  // 运行模式暂存
  const [pendingRunMode, setPendingRunMode] = useState<'normal' | 'failure' | 'abort'>('normal');

  const [isSimulatingFailure, setIsSimulatingFailure] = useState(false);
  const [isSimulatingAbort, setIsSimulatingAbort] = useState(false);
  const [runHistory, setRunHistory] = useState<MRPRunRecord[]>(INITIAL_HISTORY);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'running'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [stepsDetailRecord, setStepsDetailRecord] = useState<MRPRunRecord | null>(null);

  const handleDownloadAlgorithm = (runId: string) => {
    const content = `MRP任务ID: ${runId}\n算法方案: 标准 LFL 供需匹配\n执行时间: ${new Date().toLocaleString()}\n算法内核版本: v2.5.4\n配置参数: { "LFL": true, "safetyStockEnable": true, "leadTimeBuffer": "2d" }`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MRP_Algorithm_Config_${runId}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadErrorLog = (runId: string) => {
    const header = "错误级别,模块,错误代码,受影响SKU,异常描述\n";
    const rows = [
      `CRITICAL,SupplyMatch,E001,SKU-9921,物料供应缺口大于在途库存，且前置期不足以支持补货。`,
      `WARNING,InventorySync,W042,SKU-1022,仓库 CP001 返回库存异步锁死，已回退至上个快照点。`,
      `ERROR,LogicEngine,E105,SKU-3329,检测到循环BOM结构，逻辑引擎已中止递归计算。`
    ];
    const csvContent = "\uFEFF" + header + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MRP_Error_Log_${runId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 第一步：点击运行按钮，打开配置弹窗
  const handleStartMRPProcess = (mode: 'normal' | 'failure' | 'abort' = 'normal') => {
    if (isMRPRunning) {
      setIsModalVisible(true);
      return;
    }
    setPendingRunMode(mode);
    setIsConfigModalOpen(true);
  };

  // 第二步：配置完成后，正式启动运行
  const onConfirmConfig = (config: { runMode: string; policyMode: string; policyName: string }) => {
    setIsConfigModalOpen(false);
    
    const mode = pendingRunMode;
    const newRunId = `MRP-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const startTime = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    
    const newRecord: MRPRunRecord = {
      id: newRunId,
      startTime: startTime,
      operator: '管理员 (Admin)',
      algorithmScheme: config.policyMode,
      status: 'running',
      progress: 0,
      lastStep: '初始化引擎...',
      totalSteps: MRP_PROGRESS_STEPS.length,
      isSimulatedFailure: mode === 'failure',
      runMode: config.runMode,
      policyMode: config.policyMode,
      policyName: config.policyName
    };
    
    setRunHistory(prev => [newRecord, ...prev]);
    setIsSimulatingFailure(mode === 'failure');
    setIsSimulatingAbort(mode === 'abort');
    setIsMRPRunning(true);
    setIsModalVisible(true);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const allFilteredHistory = useMemo(() => {
    return runHistory.filter(run => {
      const matchesSearch = run.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            run.operator.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || run.status === statusFilter;
      let matchesTime = true;
      if (startDate) matchesTime = matchesTime && new Date(run.startTime) >= new Date(startDate + " 00:00:00");
      if (endDate) matchesTime = matchesTime && new Date(run.startTime) <= new Date(endDate + " 23:59:59");
      return matchesSearch && matchesStatus && matchesTime;
    });
  }, [runHistory, searchTerm, statusFilter, startDate, endDate]);

  const totalPages = Math.ceil(allFilteredHistory.length / itemsPerPage);
  const pagedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return allFilteredHistory.slice(start, start + itemsPerPage);
  }, [allFilteredHistory, currentPage]);

  const getStepIndex = (lastStep: string) => {
    if (lastStep.includes('汇总')) return MRP_PROGRESS_STEPS.length;
    const index = MRP_PROGRESS_STEPS.findIndex(s => lastStep.includes(s.label));
    return index !== -1 ? index + 1 : 0;
  };

  const formatMockStepTime = (baseStartTime: string, offsetSeconds: number) => {
    const d = new Date(baseStartTime);
    d.setSeconds(d.getSeconds() + offsetSeconds);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
  };

  const plannedCount = orders.filter(o => o.planStatus === PlanStatus.PLANNED).length;
  const unplannedCount = orders.filter(o => o.planStatus === PlanStatus.UNPLANNED).length;

  return (
    <div className="flex min-h-screen bg-[#f3f6fb] font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col sticky top-0 h-screen z-20">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="bg-[#1a1f71] p-2 rounded-lg text-white">
              <i className="fa-solid fa-microchip text-xl"></i>
            </div>
            <span className="text-xl font-bold text-slate-900">智能 MRP</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <button onClick={() => setActiveView('orders')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'orders' ? 'bg-[#eef2ff] text-[#4f46e5]' : 'text-slate-500 hover:bg-slate-50'}`}>
            <i className="fa-solid fa-table-list text-lg"></i>
            客户订单
          </button>
          <button onClick={() => { setActiveView('results'); setCurrentPage(1); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'results' ? 'bg-[#eef2ff] text-[#4f46e5]' : 'text-slate-500 hover:bg-slate-50'}`}>
            <i className="fa-solid fa-square-poll-vertical text-lg"></i>
            MRP运行结果中心
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {activeView === 'orders' ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <h1 className="text-3xl font-black text-slate-900">客户订单管理</h1>
                  <p className="text-slate-500 font-medium">管理与发起客户订单的物料需求计划</p>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handleStartMRPProcess('abort')} 
                    className="h-12 px-6 bg-white border-2 border-amber-200 text-amber-600 rounded-2xl text-sm font-black hover:bg-amber-50 transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                  >
                    <i className="fa-solid fa-hand"></i>
                    模拟人工中断
                  </button>
                  <button 
                    onClick={() => handleStartMRPProcess('failure')} 
                    className="h-12 px-6 bg-white border-2 border-rose-200 text-rose-500 rounded-2xl text-sm font-black hover:bg-rose-50 transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                  >
                    <i className="fa-solid fa-bug"></i>
                    模拟异常
                  </button>
                  <button 
                    onClick={() => handleStartMRPProcess('normal')} 
                    className="h-12 px-8 bg-[#1a1f71] text-white rounded-2xl text-sm font-black hover:bg-[#121650] transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-indigo-100"
                  >
                    <i className="fa-solid fa-bolt-lightning"></i>
                    运行 MRP
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-sm font-black text-slate-900">待处理客户订单列表</h4>
                  <div className="flex items-center gap-6 text-xs font-black">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span>
                      已计划: <span className="text-slate-900 font-black">{plannedCount}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]"></span>
                      待处理: <span className="text-slate-900 font-black">{unplannedCount}</span>
                    </span>
                  </div>
                </div>
                <OrderTable orders={orders} />
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">MRP运行结果中心</h1>
                <p className="text-slate-500 font-medium text-sm">追溯历史执行任务详情，支持下载算法文件与报错日志</p>
              </div>

              {/* Filter Bar */}
              <div className="bg-white border border-gray-100 p-8 rounded-[2.5rem] shadow-sm space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  <div className="relative lg:col-span-6">
                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input 
                      type="text" 
                      placeholder="搜索任务 ID 或操作人..." 
                      className="w-full pl-11 pr-4 py-3 rounded-2xl border-none bg-[#f3f6fb] text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                  </div>
                  <div className="lg:col-span-4 flex items-center gap-2">
                    <div className="relative flex-1">
                       <i className="fa-solid fa-calendar-day absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                       <input 
                        type="date" 
                        className="w-full pl-10 pr-3 py-3 rounded-2xl border-none bg-[#f3f6fb] text-xs font-bold"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                       />
                    </div>
                    <span className="text-slate-400 font-bold text-xs uppercase">to</span>
                    <div className="relative flex-1">
                       <i className="fa-solid fa-calendar-day absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                       <input 
                        type="date" 
                        className="w-full pl-10 pr-3 py-3 rounded-2xl border-none bg-[#f3f6fb] text-xs font-bold"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                       />
                    </div>
                  </div>
                  <div className="lg:col-span-2 flex justify-end">
                    <button 
                      onClick={resetFilters}
                      className="h-12 px-6 bg-[#f3f6fb] text-[#1a1f71] rounded-2xl text-xs font-bold hover:bg-[#e2e8f0] transition-all flex items-center gap-2 whitespace-nowrap"
                    >
                      <i className="fa-solid fa-rotate-left"></i>
                      重置所有筛选
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-slate-500">任务状态:</span>
                  <div className="flex bg-[#f3f6fb] p-1 rounded-xl">
                    {[
                      { key: 'all', label: '全部' },
                      { key: 'success', label: '计算成功' },
                      { key: 'failed', label: '计算中止' },
                      { key: 'running', label: '正在计算' }
                    ].map((s) => (
                      <button 
                        key={s.key}
                        onClick={() => { setStatusFilter(s.key as any); setCurrentPage(1); }}
                        className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${statusFilter === s.key ? 'bg-white text-[#4f46e5] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* History List */}
              <div className="space-y-6">
                <div className="flex justify-between px-2">
                  <h4 className="text-sm font-bold text-slate-400">执行历史记录</h4>
                  <span className="text-xs font-bold text-[#4f46e5]">显示 {allFilteredHistory.length > 0 ? pagedHistory.length : 0} / {allFilteredHistory.length} 项结果</span>
                </div>

                {allFilteredHistory.length > 0 ? (
                  <div className="space-y-6">
                    {pagedHistory.map((run) => {
                      const isSuccess = run.status === 'success';
                      const isRunning = run.status === 'running';
                      const isFailed = run.status === 'failed';
                      const compIdx = getStepIndex(run.lastStep);
                      
                      return (
                        <div key={run.id} className="bg-white border border-gray-100 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-md transition-all">
                          <div className="flex items-stretch min-h-[180px]">
                            <div className={`w-2 ${isSuccess ? 'bg-[#10b981]' : isRunning ? 'bg-[#4f46e5]' : 'bg-[#ef4444]'}`}></div>
                            
                            <div className="flex-1 p-8 flex items-center">
                              <div className="grid grid-cols-12 w-full gap-6 items-center">
                                <div className="col-span-3 flex items-center gap-6 border-r border-gray-50 pr-6">
                                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg ${isSuccess ? 'bg-[#10b981] shadow-emerald-50' : isRunning ? 'bg-[#4f46e5] shadow-indigo-50 animate-pulse' : 'bg-[#ef4444] shadow-rose-50'}`}>
                                    <i className={`fa-solid ${isSuccess ? 'fa-check' : isRunning ? 'fa-loader animate-spin' : 'fa-triangle-exclamation'}`}></i>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{run.id}</div>
                                    <div className={`text-xl font-bold ${isSuccess ? 'text-[#10b981]' : isRunning ? 'text-[#4f46e5]' : 'text-[#ef4444]'}`}>
                                      {isSuccess ? '计算成功' : isRunning ? '正在计算...' : (run.lastStep.includes('中断') ? '人工中止' : '运行中止')}
                                    </div>
                                  </div>
                                </div>

                                <div className="col-span-6 grid grid-cols-4 gap-y-6 px-6">
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">开始时间</div>
                                    <div className="text-[13px] font-bold text-slate-700 leading-tight">
                                      {run.startTime.split(' ')[0]}<br/>{run.startTime.split(' ')[1]}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">运行时长</div>
                                    <div className="text-[13px] font-bold text-slate-700">{isRunning ? '进行中' : run.duration}</div>
                                  </div>
                                  <div className="space-y-1 cursor-pointer group/progress" onClick={() => setStepsDetailRecord(run)}>
                                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest group-hover/progress:text-[#4f46e5]">执行进度节点</div>
                                    <div className="flex items-center gap-2">
                                      <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${isSuccess ? 'bg-[#ecfdf5] text-[#10b981]' : isRunning ? 'bg-[#eef2ff] text-[#4f46e5]' : 'bg-[#fef2f2] text-[#ef4444]'}`}>
                                        {isRunning ? `${Math.round(run.progress)}%` : `${compIdx}/${MRP_PROGRESS_STEPS.length}`}
                                      </div>
                                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full rounded-full ${isSuccess ? 'bg-[#10b981]' : isRunning ? 'bg-[#4f46e5]' : 'bg-[#ef4444]'}`} 
                                          style={{ width: isRunning ? `${run.progress}%` : `${(compIdx/MRP_PROGRESS_STEPS.length)*100}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">操作人</div>
                                    <div className="text-[13px] font-bold text-slate-700">{run.operator}</div>
                                  </div>
                                  <div className="space-y-1 col-span-2">
                                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">策略模式</div>
                                    <div className="text-[13px] font-bold text-[#4f46e5]">{run.policyMode || run.algorithmScheme}</div>
                                  </div>
                                  <div className="space-y-1 col-span-2">
                                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">运行模式</div>
                                    <div className="text-[13px] font-bold text-slate-700">{run.runMode || '全量物料重算'}</div>
                                  </div>
                                </div>

                                <div className="col-span-3 flex justify-end gap-3 pl-6 border-l border-gray-50">
                                  {isSuccess ? (
                                    <>
                                      <button onClick={() => setSelectedRecordId(selectedRecordId === run.id ? null : run.id)} className={`h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${selectedRecordId === run.id ? 'bg-[#4f46e5] text-white' : 'bg-[#eef2ff] text-[#4f46e5] hover:bg-[#e0e7ff]'}`}>
                                        <i className="fa-solid fa-brain"></i> 结果查看
                                      </button>
                                      <button onClick={() => handleDownloadAlgorithm(run.id)} className="h-10 px-4 rounded-xl border border-gray-100 bg-[#f8fafc] text-slate-600 text-xs font-bold flex items-center gap-2 hover:bg-white transition-all">
                                        <i className="fa-solid fa-code"></i> 算法文件
                                      </button>
                                    </>
                                  ) : isRunning ? (
                                    <button 
                                      onClick={() => {
                                        setIsSimulatingFailure(run.isSimulatedFailure || false);
                                        setIsMRPRunning(true);
                                        setIsModalVisible(true);
                                      }}
                                      className="h-10 px-6 rounded-xl bg-[#4f46e5] text-white text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                    >
                                      <i className="fa-solid fa-loader animate-spin"></i> 查看进度
                                    </button>
                                  ) : (
                                    <>
                                      <button onClick={() => handleDownloadAlgorithm(run.id)} className="h-10 px-4 rounded-xl border border-gray-100 bg-[#f8fafc] text-slate-600 text-xs font-bold flex items-center gap-2 hover:bg-white transition-all">
                                        <i className="fa-solid fa-code"></i> 算法文件
                                      </button>
                                      <button onClick={() => handleDownloadErrorLog(run.id)} className="h-10 px-4 rounded-xl bg-[#fef2f2] text-[#ef4444] text-xs font-bold flex items-center gap-2 hover:bg-[#fee2e2] transition-all">
                                        <i className="fa-solid fa-file-circle-xmark"></i> 报错日志
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {selectedRecordId === run.id && (
                            <div className="px-8 pb-8 pt-4 border-t border-gray-50 animate-in slide-in-from-top-4 space-y-4">
                               <div className="grid grid-cols-3 gap-6">
                                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                     <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">策略名称</div>
                                     <div className="text-sm font-bold text-slate-700">{run.policyName || '未命名策略'}</div>
                                  </div>
                                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                     <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">计算逻辑</div>
                                     <div className="text-sm font-bold text-indigo-600">{run.policyMode || '基础规则'}</div>
                                  </div>
                                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                     <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">运行模式</div>
                                     <div className="text-sm font-bold text-slate-700">{run.runMode || '全量重算'}</div>
                                  </div>
                               </div>
                               {run.summary && (
                                 <div className="bg-[#f8fafc] rounded-2xl p-6 border border-gray-100 italic text-sm text-slate-600 flex gap-4">
                                    <i className="fa-solid fa-sparkles text-[#4f46e5] text-xl mt-1"></i>
                                    <p>{run.summary}</p>
                                 </div>
                               )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {totalPages > 1 && (
                      <div className="flex justify-center mt-12 pb-10">
                        <div className="flex items-center gap-2">
                           <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 bg-white text-slate-400 hover:text-indigo-600 disabled:opacity-30"><i className="fa-solid fa-angles-left"></i></button>
                           <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 bg-white text-slate-400 hover:text-indigo-600 disabled:opacity-30"><i className="fa-solid fa-angle-left"></i></button>
                           <div className="flex gap-2 mx-4">
                              {[...Array(totalPages)].map((_, i) => (
                                <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${currentPage === i + 1 ? 'bg-[#4f46e5] text-white shadow-lg shadow-indigo-100 scale-110' : 'bg-white text-slate-400 border border-gray-100 hover:border-indigo-200'}`}>{i + 1}</button>
                              ))}
                           </div>
                           <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 bg-white text-slate-400 hover:text-indigo-600 disabled:opacity-30"><i className="fa-solid fa-angle-right"></i></button>
                           <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 bg-white text-slate-400 hover:text-indigo-600 disabled:opacity-30"><i className="fa-solid fa-angles-right"></i></button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white border border-gray-100 rounded-[2.5rem] py-24 flex flex-col items-center justify-center text-center space-y-8 shadow-sm">
                    <div className="relative">
                      <div className="w-24 h-24 bg-[#f3f6fb] rounded-full flex items-center justify-center text-slate-400">
                        <i className="fa-solid fa-filter text-4xl"></i>
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full border border-gray-100 flex items-center justify-center text-[#ef4444] shadow-sm">
                        <i className="fa-solid fa-circle-xmark text-lg"></i>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-black text-slate-900">未找到匹配记录</h3>
                      <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed font-medium">
                        请尝试调整筛选关键词、状态或时间范围条件。
                      </p>
                    </div>
                    <button 
                      onClick={resetFilters}
                      className="px-8 py-3 bg-[#f3f6fb] text-[#1a1f71] rounded-2xl text-xs font-bold hover:bg-[#e2e8f0] transition-all flex items-center gap-2 shadow-sm"
                    >
                      <i className="fa-solid fa-rotate-left"></i>
                      重置所有筛选
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Configuration Modal */}
      <MRPConfigModal 
        isOpen={isConfigModalOpen}
        onConfirm={onConfirmConfig}
        onCancel={() => setIsConfigModalOpen(false)}
      />

      {/* Step Detail Modal */}
      {stepsDetailRecord && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setStepsDetailRecord(null)}></div>
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#4f46e5] text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                  <i className="fa-solid fa-list-check text-xl"></i>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">执行节点详情</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{stepsDetailRecord.id}</p>
                </div>
              </div>
              <button onClick={() => setStepsDetailRecord(null)} className="w-10 h-10 rounded-full hover:bg-white flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto">
              {MRP_PROGRESS_STEPS.map((step, i) => {
                const compIdx = getStepIndex(stepsDetailRecord.lastStep);
                const isDone = i + 1 <= compIdx;
                const isError = stepsDetailRecord.status === 'failed' && i + 1 === compIdx;
                const mockCompletionTime = isDone ? formatMockStepTime(stepsDetailRecord.startTime, (i + 1) * 2 + Math.floor(Math.random() * 2)) : null;

                return (
                  <div key={i} className="flex items-start gap-6 group">
                    <div className="relative flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shadow-sm transition-all ${
                        isError ? 'bg-rose-500 text-white ring-4 ring-rose-50 animate-pulse' :
                        isDone ? 'bg-[#10b981] text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {isError ? <i className="fa-solid fa-xmark"></i> : isDone ? <i className="fa-solid fa-check"></i> : i + 1}
                      </div>
                      {i < MRP_PROGRESS_STEPS.length - 1 && (
                        <div className={`w-0.5 h-20 mt-2 ${isDone && (i + 1 < compIdx) ? 'bg-[#10b981]' : 'bg-slate-100'}`}></div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                         <p className={`text-base font-black transition-colors ${isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                           {step.label}
                         </p>
                         {mockCompletionTime && (
                           <div className="flex items-center gap-1.5 px-3 py-1 bg-[#f3f6fb] rounded-lg text-[10px] font-black text-slate-500 border border-slate-100">
                             <i className="fa-solid fa-clock"></i>
                             {mockCompletionTime}
                           </div>
                         )}
                      </div>
                      <div className={`text-xs leading-relaxed p-4 rounded-xl border transition-all ${
                        isDone ? 'bg-slate-50 text-slate-600 border-slate-100' : 'bg-slate-50/50 text-slate-300 border-dashed border-slate-200'
                      }`}>
                        <div className="font-bold uppercase tracking-widest text-[9px] mb-2 opacity-60 flex items-center gap-1.5 text-indigo-500">
                           <i className="fa-solid fa-comment-dots"></i>
                           执行备注
                        </div>
                        <div className="font-medium">
                          {isDone ? (isError ? "引擎检测到数据异常或算法约束冲突，计算过程被迫中止。" : step.defaultRemark) : "节点尚未激活，等待引擎队列调度..."}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setStepsDetailRecord(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      <MRPProgressModal 
        isOpen={isMRPRunning}
        isVisible={isModalVisible}
        simulateFailure={isSimulatingFailure}
        simulateAbort={isSimulatingAbort}
        onComplete={(s, step) => {
          setIsMRPRunning(false);
          setIsModalVisible(false);
          setRunHistory(prev => prev.map(run => run.status === 'running' ? { 
            ...run, 
            status: 'success', 
            summary: s, 
            lastStep: step, 
            progress: 100, 
            endTime: new Date().toLocaleTimeString(), 
            duration: '12s' 
          } : run));
          setOrders(prev => prev.map(order => ({ ...order, planStatus: PlanStatus.PLANNED })));
        }}
        onClose={(hasError, progress, step) => {
          setIsModalVisible(false);
          setRunHistory(prev => prev.map(run => run.status === 'running' ? {
            ...run,
            progress: progress,
            lastStep: hasError ? run.lastStep : step,
            status: hasError ? 'failed' : 'running'
          } : run));
          setIsMRPRunning(false); 
        }}
        onAbort={(p, step) => {
          setRunHistory(prev => prev.map(run => run.status === 'running' ? { 
            ...run, 
            status: 'failed', 
            lastStep: `人工中断 (${step})`, 
            progress: p, 
            endTime: new Date().toLocaleTimeString(), 
            duration: '8s' 
          } : run));
        }}
        generateSummary={async () => await generateMRPSummary(orders)}
      />
    </div>
  );
};

export default App;
