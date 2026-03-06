
export enum PlanStatus {
  UNPLANNED = '未计划',
  PLANNED = '已计划',
  PLANNING = '计划中'
}

export enum AllocationStatus {
  FULLY_ALLOCATED = '完全分配',
  PARTIALLY_ALLOCATED = '部分分配',
  NOT_ALLOCATED = '未分配'
}

export interface MRPError {
  id: string;
  code: string;
  type: '数据缺失' | '逻辑冲突' | '库存不足' | '前置期异常';
  message: string;
  affectedItem: string;
}

export interface CustomerOrder {
  id: number;
  isDelayed: boolean;
  planStatus: PlanStatus;
  allocationStatus: AllocationStatus;
  orderNo: string;
  warehouseCode: string;
  itemCode: string;
  deliveryDate: string;
  quantity: number;
  lineNo: string;
  salesDeptCode: string;
  customerCode: string;
  region: string;
  salesType: string;
}

export interface ProgressStep {
  label: string;
  percentage: number;
  defaultRemark?: string;
}

export const MRP_PROGRESS_STEPS: ProgressStep[] = [
  { label: '基础数据获取与校验', percentage: 25, defaultRemark: '系统已完成全球 12 个仓库的实时快照，通过了 BOM 完整性与基础物料前置期的合规性校验。' },
  { label: '物料分层排序', percentage: 50, defaultRemark: '引擎已基于低位阶码算法完成 3200+ 物料的依赖关系解构，确保计算顺序符合装配逻辑。' },
  { label: '执行供需平衡计算', percentage: 75, defaultRemark: '供需匹配引擎正在对冲安全库存、在途 PO 与现有库存，累计完成 8.5w 次平衡运算。' },
  { label: '建议计划生成与报告汇总', percentage: 100, defaultRemark: '计算顺利结束，已生成建议 PPO 记录，齐套分析与产能负荷预警报告已准备就绪。' },
];

export interface MRPRunRecord {
  id: string;
  startTime: string;
  endTime?: string;
  duration?: string;
  operator: string;
  algorithmScheme: string;
  status: 'success' | 'failed' | 'running';
  progress: number;
  lastStep: string;
  totalSteps?: number;
  summary?: string;
  isSimulatedFailure?: boolean;
  // 更新配置信息字段名
  runMode?: string;
  policyMode?: string;
  policyName?: string;
}
