/**
 * 运行监控中心 - 通用类型定义
 */

export type ModuleId = 'SCH' | 'MPS' | 'S&OP' | 'DFP' | 'MRP' | 'IPS';

/** 功能点 ID（各模块的一次性长时间复杂计算） */
export type FunctionId = string;

/** 模块配置 */
export interface ModuleConfig {
  id: ModuleId;
  name: string;
  shortName: string;
  icon: string;
  runIdPrefix: string;
  description: string;
}

/** 功能点配置（每个模块下的可监控功能） */
export interface FunctionConfig {
  id: FunctionId;
  moduleId: ModuleId;
  name: string;
  icon: string;
  description: string;
  runIdPrefix: string;
  /** 是否算法计算功能（true=算法运行日志+统一图标，false=功能运行日志） */
  isAlgorithm?: boolean;
  /** 并发控制配置 */
  concurrencyConfig?: ConcurrencyConfig;
}

/** 进度步骤 */
export interface ProgressStep {
  label: string;
  percentage: number;
  defaultRemark?: string;
}

/** 运行记录 */
export interface RunRecord {
  id: string;
  moduleId: ModuleId;
  functionId: FunctionId;
  startTime: string;
  endTime?: string;
  duration?: string;
  operator: string;
  algorithmScheme: string;
  status: 'success' | 'failed' | 'running' | 'terminated' | 'queued';
  progress: number;
  lastStep: string;
  totalSteps?: number;
  summary?: string;
  isSimulatedFailure?: boolean;
  runMode?: string;
  policyMode?: string;
  policyName?: string;
  /** 算法输入信息 */
  inputInfo?: { key: string; value: string }[];
  /** 算法运行日志 */
  algorithmLogs?: string[];
  /** 计算结果摘要 */
  results?: { key: string; value: string }[];
  /** 计划版本（MPS/S&OP/DFP/MRP 等有版本概念的模块） */
  planVersion?: string;
  /** 需求版本（同上） */
  demandVersion?: string;
  /** 排队状态（仅当 status 为 'queued' 时有值） */
  queueStatus?: QueueStatus;
  /** 节点详情 */
  nodeDetails?: NodeDetail[];
  /** 性能监控指标 */
  performanceMetrics?: PerformanceMetrics;
}

export interface RunConfig {
  runMode: string;
  policyMode: string;
  policyName: string;
  /** 用户选择的差异化参数（各功能必填项） */
  params?: Record<string, string>;
}

/** 运行参数字段定义 */
export interface RunParamField {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date';
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}

/** 功能运行按钮配置（具象化差异化） */
export interface RunActionConfig {
  /** 是否显示运行按钮 */
  showButton: boolean;
  /** 按钮文案 */
  label: string;
  /** 按钮图标 */
  icon: string;
  /** 弹窗标题 */
  modalTitle: string;
  /** 必选参数（点运行时需用户选择） */
  params: RunParamField[];
  /** 是否展示策略/运行模式等通用配置 */
  showPolicyConfig?: boolean;
}

export interface RunOverviewStats {
  todayCount: number;
  weekCount: number;
  successRate: number;
  avgDuration: string;
}

/** 并发控制模式 */
export type ConcurrencyMode = 'PARALLEL' | 'EXCLUSIVE' | 'QUEUEABLE' | 'LIMITED_PARALLEL';

/** 并发控制配置 */
export interface ConcurrencyConfig {
  mode: ConcurrencyMode;
  maxConcurrency?: number; // 仅 LIMITED_PARALLEL 模式需要
}

/** 排队状态 */
export interface QueueStatus {
  position: number; // 排队位置
  estimatedWaitTime?: string; // 预计等待时间
}

/** 性能监控指标 */
export interface PerformanceMetrics {
  jvm?: {
    heapUsed: number;
    heapMax: number;
    nonHeapUsed: number;
    gcCount: number;
    gcTime: number;
  };
  thread?: {
    threadCount: number;
    peakThreadCount: number;
    daemonThreadCount: number;
  };
  db?: {
    activeConnections: number;
    idleConnections: number;
    maxConnections: number;
  };
  nodes?: {
    nodeName: string;
    duration: number;
    processedCount: number;
    progressPercentage: number;
  }[];
}

/** 节点执行状态 */
export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'terminated' | 'skipped';

/** 节点详情 */
export interface NodeDetail {
  nodeName: string;
  status: NodeStatus;
  startTime?: string;
  endTime?: string;
  duration?: number;
  description?: string;
  isInterruptible?: boolean; // 是否可中断
  isSkippableOnError?: boolean; // 是否可在异常时跳过
  businessMetrics?: { key: string; value: string }[]; // 业务指标
  warningMessages?: string[]; // 警告信息
  errorMessages?: string[]; // 错误信息
}
