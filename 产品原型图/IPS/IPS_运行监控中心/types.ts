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
  status: 'success' | 'failed' | 'running' | 'terminated';
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
