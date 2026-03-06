/**
 * 运行监控中心 - 模块与功能点配置
 */

import { ModuleConfig, ProgressStep, FunctionConfig, ModuleId, RunActionConfig } from './types';

export const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  SCH: { id: 'SCH', name: '生产排程', shortName: '排程', icon: 'fa-calendar-days', runIdPrefix: 'SCH', description: '规则式生产排程运行监控' },
  MPS: { id: 'MPS', name: '主计划', shortName: '主计划', icon: 'fa-chart-line', runIdPrefix: 'MPS', description: '主计划运行监控' },
  'S&OP': { id: 'S&OP', name: '产销协同', shortName: '产销', icon: 'fa-handshake', runIdPrefix: 'SOP', description: '产销协同运行监控' },
  DFP: { id: 'DFP', name: '需求预测', shortName: '预测', icon: 'fa-chart-mixed', runIdPrefix: 'DFP', description: '需求预测运行监控' },
  MRP: { id: 'MRP', name: '物料需求计划', shortName: 'MRP', icon: 'fa-boxes-stacked', runIdPrefix: 'MRP', description: '物料需求计划运行监控' },
  IPS: { id: 'IPS', name: '集成平台', shortName: '集成', icon: 'fa-plug', runIdPrefix: 'IPS', description: '集成平台任务监控' },
};

/** 算法功能统一图标 */
const ALGO_ICON = 'fa-calculator';

/** 各模块功能点（算法功能 isAlgorithm: true 使用统一图标） */
export const FUNCTION_CONFIGS: FunctionConfig[] = [
  // DFP
  { id: 'dfp_demand_cleanse', moduleId: 'DFP', name: '历史需求清洗', icon: 'fa-broom', description: '清洗与预处理历史需求数据', runIdPrefix: 'DFP-CL', isAlgorithm: false },
  { id: 'dfp_forecast_algo', moduleId: 'DFP', name: '需求预测算法', icon: ALGO_ICON, description: '执行需求预测算法计算', runIdPrefix: 'DFP-FC', isAlgorithm: true },
  { id: 'dfp_outlier_detect', moduleId: 'DFP', name: '异常值检测', icon: ALGO_ICON, description: '识别并处理历史需求异常值', runIdPrefix: 'DFP-OL', isAlgorithm: true },
  { id: 'dfp_seasonal_decompose', moduleId: 'DFP', name: '季节性分解', icon: ALGO_ICON, description: '需求季节性趋势分解与建模', runIdPrefix: 'DFP-SD', isAlgorithm: true },
  { id: 'dfp_model_train', moduleId: 'DFP', name: '预测模型训练', icon: ALGO_ICON, description: '训练与优化预测模型', runIdPrefix: 'DFP-MT', isAlgorithm: true },
  // S&OP
  { id: 'sop_plan_report', moduleId: 'S&OP', name: '产销计划报告', icon: 'fa-chart-column', description: '产销协同计划汇总报告', runIdPrefix: 'SOP-PR', isAlgorithm: false },
  { id: 'sop_review_meeting', moduleId: 'S&OP', name: '产销评审会议', icon: 'fa-users', description: '监控已发起的产销评审会议流程当前节点', runIdPrefix: 'SOP-RM', isAlgorithm: false },
  // MPS
  { id: 'mps_supply_match', moduleId: 'MPS', name: '供需匹配计算', icon: ALGO_ICON, description: '主计划供需平衡计算', runIdPrefix: 'MPS-SM', isAlgorithm: true },
  { id: 'mps_algo', moduleId: 'MPS', name: '主计划算法', icon: ALGO_ICON, description: '主计划优化算法运行', runIdPrefix: 'MPS-AL', isAlgorithm: true },
  { id: 'mps_atp', moduleId: 'MPS', name: 'ATP 可承诺量计算', icon: ALGO_ICON, description: '可用量承诺与交期计算', runIdPrefix: 'MPS-AT', isAlgorithm: true },
  { id: 'mps_capacity_load', moduleId: 'MPS', name: '产能负荷分析', icon: ALGO_ICON, description: '产能负荷与瓶颈分析', runIdPrefix: 'MPS-CL', isAlgorithm: true },
  { id: 'mps_forecast_consume', moduleId: 'MPS', name: '预测冲减', icon: ALGO_ICON, description: '预测消耗与可用量冲减计算', runIdPrefix: 'MPS-FC', isAlgorithm: true },
  // SCH
  { id: 'sch_rule_schedule', moduleId: 'SCH', name: '规则式生产排程', icon: ALGO_ICON, description: '基于规则的排程计算', runIdPrefix: 'SCH-RS', isAlgorithm: true },
  { id: 'sch_supply_match', moduleId: 'SCH', name: '供需匹配计算', icon: ALGO_ICON, description: '排程供需平衡计算', runIdPrefix: 'SCH-SM', isAlgorithm: true },
  { id: 'sch_capacity_balance', moduleId: 'SCH', name: '产能平衡', icon: ALGO_ICON, description: '工序与设备产能平衡', runIdPrefix: 'SCH-CB', isAlgorithm: true },
  { id: 'sch_urgent_insert', moduleId: 'SCH', name: '插单模拟', icon: ALGO_ICON, description: '紧急插单影响模拟', runIdPrefix: 'SCH-UI', isAlgorithm: true },
  { id: 'sch_production_feedback', moduleId: 'SCH', name: '生产反馈', icon: 'fa-message', description: '生产进度反馈采集与回写', runIdPrefix: 'SCH-PF', isAlgorithm: false },
  // MRP
  { id: 'mrp_supply_match', moduleId: 'MRP', name: '供需匹配计算', icon: ALGO_ICON, description: '物料供需平衡计算', runIdPrefix: 'MRP-SM', isAlgorithm: true },
  { id: 'mrp_algo', moduleId: 'MRP', name: '物料需求算法', icon: ALGO_ICON, description: 'MRP 物料需求计算', runIdPrefix: 'MRP-AL', isAlgorithm: true },
  { id: 'mrp_kit_analysis', moduleId: 'MRP', name: '齐套分析', icon: ALGO_ICON, description: '订单物料齐套性分析', runIdPrefix: 'MRP-KA', isAlgorithm: true },
  { id: 'mrp_safety_stock', moduleId: 'MRP', name: '安全库存计算', icon: ALGO_ICON, description: '安全库存与再订货点计算', runIdPrefix: 'MRP-SS', isAlgorithm: true },
  // IPS
  { id: 'ips_interface_sync', moduleId: 'IPS', name: '接口同步', icon: 'fa-arrows-rotate', description: '跨系统接口数据同步', runIdPrefix: 'IPS-IS', isAlgorithm: false },
  { id: 'ips_auto_archive', moduleId: 'IPS', name: '自动归档任务', icon: 'fa-box-archive', description: '历史数据自动归档与清理', runIdPrefix: 'IPS-AA', isAlgorithm: false },
];

/** 各功能运行按钮具象化配置（贴合业务场景） */
export const RUN_ACTION_CONFIGS: Record<string, RunActionConfig> = {
  // DFP
  dfp_demand_cleanse: {
    showButton: true,
    label: '执行清洗',
    icon: 'fa-broom',
    modalTitle: '历史需求清洗',
    showPolicyConfig: false,
    params: [
      { key: 'dataSource', label: '数据源', type: 'select', required: true, options: [
        { value: 'ERP', label: 'ERP' }, { value: '手工录入', label: '手工录入' }, { value: 'ERP+手工', label: 'ERP + 手工录入' },
      ]},
      { key: 'dateRange', label: '数据范围', type: 'date', required: true, placeholder: '起止日期' },
      { key: 'cleanseRule', label: '清洗规则', type: 'select', options: [
        { value: 'standard', label: '去重+异常值剔除+补全' }, { value: 'strict', label: '严格模式（含缺失值填充）' },
      ]},
    ],
  },
  dfp_forecast_algo: {
    showButton: true,
    label: '执行预测',
    icon: 'fa-chart-line',
    modalTitle: '需求预测算法',
    showPolicyConfig: true,
    params: [
      { key: 'demandVersion', label: '需求版本', type: 'select', required: true, options: [
        { value: 'DFP-20260209', label: 'DFP-20260209' }, { value: 'DFP-20260201', label: 'DFP-20260201' },
      ]},
      { key: 'forecastDimension', label: '预测维度', type: 'select', options: [
        { value: 'SKU', label: 'SKU' }, { value: 'SKU×区域', label: 'SKU × 区域' }, { value: '产品族', label: '产品族' },
      ]},
      { key: 'modelType', label: '模型类型', type: 'select', options: [
        { value: 'ARIMA', label: 'ARIMA' }, { value: '指数平滑', label: '指数平滑' }, { value: 'ARIMA+指数平滑', label: 'ARIMA + 指数平滑' },
      ]},
    ],
  },
  dfp_outlier_detect: {
    showButton: true,
    label: '执行检测',
    icon: 'fa-magnifying-glass',
    modalTitle: '异常值检测',
    showPolicyConfig: false,
    params: [
      { key: 'demandVersion', label: '需求版本', type: 'select', required: true, options: [
        { value: 'DFP-20260209', label: 'DFP-20260209' }, { value: 'DFP-20260201', label: 'DFP-20260201' },
      ]},
      { key: 'detectMethod', label: '检测方法', type: 'select', options: [
        { value: 'IQR', label: 'IQR 四分位距' }, { value: '3sigma', label: '3σ 标准差' }, { value: 'IQR+3sigma', label: 'IQR + 3σ' },
      ]},
    ],
  },
  dfp_seasonal_decompose: {
    showButton: true,
    label: '执行分解',
    icon: 'fa-chart-column',
    modalTitle: '季节性分解',
    showPolicyConfig: false,
    params: [
      { key: 'demandVersion', label: '需求版本', type: 'select', required: true, options: [
        { value: 'DFP-20260209', label: 'DFP-20260209' }, { value: 'DFP-20260201', label: 'DFP-20260201' },
      ]},
      { key: 'cycle', label: '周期', type: 'select', options: [
        { value: '12', label: '12 个月' }, { value: '4', label: '4 季度' }, { value: '52', label: '52 周' },
      ]},
    ],
  },
  dfp_model_train: {
    showButton: true,
    label: '执行训练',
    icon: 'fa-brain',
    modalTitle: '预测模型训练',
    showPolicyConfig: true,
    params: [
      { key: 'demandVersion', label: '需求版本', type: 'select', required: true, options: [
        { value: 'DFP-20260209', label: 'DFP-20260209' }, { value: 'DFP-20260201', label: 'DFP-20260201' },
      ]},
      { key: 'trainRatio', label: '训练集比例', type: 'select', options: [
        { value: '70', label: '70%' }, { value: '80', label: '80%' }, { value: '90', label: '90%' },
      ]},
      { key: 'modelType', label: '模型', type: 'select', options: [
        { value: 'LSTM', label: 'LSTM' }, { value: 'XGBoost', label: 'XGBoost' }, { value: 'LSTM+XGBoost', label: 'LSTM + XGBoost' },
      ]},
    ],
  },
  // S&OP
  sop_plan_report: {
    showButton: true,
    label: '生成报告',
    icon: 'fa-chart-column',
    modalTitle: '产销计划报告',
    showPolicyConfig: false,
    params: [
      { key: 'planVersion', label: '计划版本', type: 'select', required: true, options: [
        { value: '2026-02-Q1', label: '2026-02-Q1' }, { value: '2026-01-Q1', label: '2026-01-Q1' },
      ]},
      { key: 'reportPeriod', label: '报告周期', type: 'select', options: [
        { value: 'month', label: '月度' }, { value: 'quarter', label: '季度' },
      ]},
      { key: 'planLevel', label: '计划层级', type: 'select', options: [
        { value: 'product_family', label: '产品族 × 月度' }, { value: 'sku', label: 'SKU × 周' },
      ]},
    ],
  },
  sop_review_meeting: {
    showButton: true,
    label: '发起会议',
    icon: 'fa-video',
    modalTitle: '产销评审会议',
    showPolicyConfig: false,
    params: [
      { key: 'planVersion', label: '计划版本', type: 'select', required: true, options: [
        { value: '2026-02-Q1', label: '2026-02-Q1' }, { value: '2026-01-Q1', label: '2026-01-Q1' },
      ]},
      { key: 'meetingTopic', label: '会议主题', type: 'text', required: true, placeholder: '例：2026-Q1 产销评审' },
      { key: 'participants', label: '参与部门', type: 'select', options: [
        { value: 'default', label: '销售/生产/采购/财务' }, { value: 'full', label: '全部门' },
      ]},
      { key: 'agendaTemplate', label: '议程模板', type: 'select', options: [
        { value: 'standard', label: '标准评审流程' }, { value: 'quick', label: '快速评审' },
      ]},
    ],
  },
  // MPS
  mps_supply_match: {
    showButton: true,
    label: '执行匹配',
    icon: 'fa-arrows-left-right',
    modalTitle: '主计划供需匹配',
    showPolicyConfig: true,
    params: [
      { key: 'planVersion', label: '计划版本', type: 'select', required: true, options: [
        { value: '2026-02-Q1', label: '2026-02-Q1' }, { value: '2026-01-Q1', label: '2026-01-Q1' },
      ]},
      { key: 'demandVersion', label: '需求版本', type: 'select', required: true, options: [
        { value: 'DFP-20260209', label: 'DFP-20260209' }, { value: 'DFP-20260201', label: 'DFP-20260201' },
      ]},
      { key: 'warehouse', label: '仓库', type: 'select', options: [
        { value: 'CP001,CP002', label: 'CP001, CP002' }, { value: 'all', label: '全部' },
      ]},
    ],
  },
  mps_algo: {
    showButton: true,
    label: '执行主计划',
    icon: 'fa-calculator',
    modalTitle: '主计划算法',
    showPolicyConfig: true,
    params: [
      { key: 'planVersion', label: '计划版本', type: 'select', required: true, options: [
        { value: '2026-02-Q1', label: '2026-02-Q1' }, { value: '2026-01-Q1', label: '2026-01-Q1' },
      ]},
      { key: 'demandVersion', label: '需求版本', type: 'select', required: true, options: [
        { value: 'DFP-20260209', label: 'DFP-20260209' }, { value: 'DFP-20260201', label: 'DFP-20260201' },
      ]},
      { key: 'optimizeTarget', label: '优化目标', type: 'select', options: [
        { value: 'fulfill', label: '满足率最大化' }, { value: 'cost', label: '成本最小化' },
      ]},
    ],
  },
  mps_atp: {
    showButton: true,
    label: '计算ATP',
    icon: 'fa-hand-holding-hand',
    modalTitle: 'ATP 可承诺量计算',
    showPolicyConfig: false,
    params: [
      { key: 'planVersion', label: '计划版本', type: 'select', required: true, options: [
        { value: '2026-02-Q1', label: '2026-02-Q1' }, { value: '2026-01-Q1', label: '2026-01-Q1' },
      ]},
      { key: 'atpDimension', label: '可承诺维度', type: 'select', options: [
        { value: 'SKU×日期', label: 'SKU × 日期' }, { value: '产品族×周', label: '产品族 × 周' },
      ]},
    ],
  },
  mps_capacity_load: {
    showButton: true,
    label: '分析产能',
    icon: 'fa-gauge-high',
    modalTitle: '产能负荷分析',
    showPolicyConfig: false,
    params: [
      { key: 'planVersion', label: '计划版本', type: 'select', required: true, options: [
        { value: '2026-02-Q1', label: '2026-02-Q1' }, { value: '2026-01-Q1', label: '2026-01-Q1' },
      ]},
      { key: 'lineScope', label: '产线范围', type: 'select', options: [
        { value: 'all', label: '全部产线' }, { value: 'L1-L8', label: 'L1-L8' },
      ]},
    ],
  },
  mps_forecast_consume: {
    showButton: true,
    label: '执行冲减',
    icon: 'fa-minus',
    modalTitle: '预测冲减',
    showPolicyConfig: false,
    params: [
      { key: 'planVersion', label: '计划版本', type: 'select', required: true, options: [
        { value: '2026-02-Q1', label: '2026-02-Q1' }, { value: '2026-01-Q1', label: '2026-01-Q1' },
      ]},
      { key: 'demandVersion', label: '需求版本', type: 'select', required: true, options: [
        { value: 'DFP-20260209', label: 'DFP-20260209' }, { value: 'DFP-20260201', label: 'DFP-20260201' },
      ]},
      { key: 'consumeDimension', label: '冲减维度', type: 'select', options: [
        { value: 'SKU×客户', label: 'SKU × 客户' }, { value: '产品族', label: '产品族' },
      ]},
    ],
  },
  // SCH
  sch_rule_schedule: {
    showButton: true,
    label: '执行排程',
    icon: 'fa-calendar-days',
    modalTitle: '规则式生产排程',
    showPolicyConfig: true,
    params: [
      { key: 'scheduleRule', label: '排程规则', type: 'select', required: true, options: [
        { value: 'EDD', label: 'EDD 交期优先' }, { value: 'urgent', label: '急单优先' }, { value: 'EDD+urgent', label: 'EDD + 急单优先' },
      ]},
      { key: 'orderScope', label: '订单范围', type: 'select', options: [
        { value: 'today', label: '当日' }, { value: 'week', label: '本周' }, { value: 'all', label: '全部待排' },
      ]},
      { key: 'dateRange', label: '排程日期', type: 'date', required: true, placeholder: '起止日期' },
    ],
  },
  sch_supply_match: {
    showButton: true,
    label: '执行匹配',
    icon: 'fa-arrows-left-right',
    modalTitle: '排程供需匹配',
    showPolicyConfig: false,
    params: [
      { key: 'orderScope', label: '订单范围', type: 'select', options: [
        { value: 'today', label: '当日' }, { value: 'week', label: '本周' },
      ]},
      { key: 'productionLine', label: '产线', type: 'select', options: [
        { value: 'L1-L8', label: 'L1-L8' }, { value: 'all', label: '全部' },
      ]},
    ],
  },
  sch_capacity_balance: {
    showButton: true,
    label: '执行平衡',
    icon: 'fa-scale-balanced',
    modalTitle: '产能平衡',
    showPolicyConfig: false,
    params: [
      { key: 'orderScope', label: '订单范围', type: 'select', options: [
        { value: 'today', label: '当日' }, { value: 'week', label: '本周' },
      ]},
      { key: 'loadThreshold', label: '负载阈值', type: 'select', options: [
        { value: '80', label: '80%' }, { value: '85', label: '85%' }, { value: '90', label: '90%' },
      ]},
    ],
  },
  sch_urgent_insert: {
    showButton: true,
    label: '模拟插单',
    icon: 'fa-plus',
    modalTitle: '插单模拟',
    showPolicyConfig: false,
    params: [
      { key: 'urgentOrders', label: '插单订单', type: 'text', required: true, placeholder: '订单号，逗号分隔' },
      { key: 'impactScope', label: '影响范围', type: 'select', options: [
        { value: 'today', label: '当日排程' }, { value: 'week', label: '本周排程' },
      ]},
    ],
  },
  sch_production_feedback: {
    showButton: true,
    label: '采集反馈',
    icon: 'fa-message',
    modalTitle: '生产反馈采集',
    showPolicyConfig: false,
    params: [
      { key: 'feedbackSource', label: '反馈源', type: 'select', required: true, options: [
        { value: 'MES', label: 'MES' }, { value: '手工', label: '手工录入' }, { value: 'MES+手工', label: 'MES + 手工' },
      ]},
      { key: 'collectPeriod', label: '采集周期', type: 'select', options: [
        { value: '2h', label: '2 小时' }, { value: '4h', label: '4 小时' }, { value: '8h', label: '8 小时' },
      ]},
    ],
  },
  // MRP
  mrp_supply_match: {
    showButton: true,
    label: '执行匹配',
    icon: 'fa-arrows-left-right',
    modalTitle: 'MRP 供需匹配',
    showPolicyConfig: true,
    params: [
      { key: 'planVersion', label: '计划版本', type: 'select', required: true, options: [
        { value: '2026-02-Q1', label: '2026-02-Q1' }, { value: '2026-01-Q1', label: '2026-01-Q1' },
      ]},
      { key: 'warehouse', label: '仓库', type: 'select', options: [
        { value: 'CP001,CP002,CP003', label: 'CP001, CP002, CP003' }, { value: 'all', label: '全部' },
      ]},
    ],
  },
  mrp_algo: {
    showButton: true,
    label: '执行MRP',
    icon: 'fa-calculator',
    modalTitle: '物料需求算法',
    showPolicyConfig: true,
    params: [
      { key: 'planVersion', label: '计划版本', type: 'select', required: true, options: [
        { value: '2026-02-Q1', label: '2026-02-Q1' }, { value: '2026-01-Q1', label: '2026-01-Q1' },
      ]},
      { key: 'netReqMethod', label: '净需求计算', type: 'select', options: [
        { value: 'LFL', label: 'LFL 按需' }, { value: 'FOQ', label: 'FOQ 固定批量' },
      ]},
    ],
  },
  mrp_kit_analysis: {
    showButton: true,
    label: '齐套分析',
    icon: 'fa-boxes-stacked',
    modalTitle: '齐套分析',
    showPolicyConfig: false,
    params: [
      { key: 'planVersion', label: '计划版本', type: 'select', required: true, options: [
        { value: '2026-02-Q1', label: '2026-02-Q1' }, { value: '2026-01-Q1', label: '2026-01-Q1' },
      ]},
      { key: 'kitDimension', label: '齐套维度', type: 'select', options: [
        { value: 'order_line', label: '订单行' }, { value: 'order', label: '订单' },
      ]},
    ],
  },
  mrp_safety_stock: {
    showButton: true,
    label: '计算安全库存',
    icon: 'fa-shield-halved',
    modalTitle: '安全库存计算',
    showPolicyConfig: false,
    params: [
      { key: 'planVersion', label: '计划版本', type: 'select', required: true, options: [
        { value: '2026-02-Q1', label: '2026-02-Q1' }, { value: '2026-01-Q1', label: '2026-01-Q1' },
      ]},
      { key: 'serviceLevel', label: '服务水平目标', type: 'select', options: [
        { value: '90', label: '90%' }, { value: '95', label: '95%' }, { value: '98', label: '98%' },
      ]},
    ],
  },
  // IPS
  ips_interface_sync: {
    showButton: true,
    label: '执行同步',
    icon: 'fa-arrows-rotate',
    modalTitle: '接口同步',
    showPolicyConfig: false,
    params: [
      { key: 'syncDirection', label: '同步方向', type: 'select', required: true, options: [
        { value: 'inbound', label: '入库' }, { value: 'outbound', label: '出库' }, { value: 'bidirectional', label: '双向' },
      ]},
      { key: 'targetSystem', label: '目标系统', type: 'select', required: true, options: [
        { value: 'ERP', label: 'ERP' }, { value: 'WMS', label: 'WMS' }, { value: 'MES', label: 'MES' },
      ]},
      { key: 'interfaceScope', label: '接口范围', type: 'select', options: [
        { value: 'all', label: '全部接口' }, { value: 'incremental', label: '增量接口' },
      ]},
    ],
  },
  ips_auto_archive: {
    showButton: true,
    label: '立即归档',
    icon: 'fa-box-archive',
    modalTitle: '自动归档任务',
    showPolicyConfig: false,
    params: [
      { key: 'archiveScope', label: '归档范围', type: 'select', required: true, options: [
        { value: 'run_history', label: '历史运行记录' }, { value: 'logs', label: '日志文件' }, { value: 'all', label: '全部' },
      ]},
      { key: 'retentionDays', label: '保留期限', type: 'select', options: [
        { value: '30', label: '30 天' }, { value: '60', label: '60 天' }, { value: '90', label: '90 天' },
      ]},
    ],
  },
};

export const DEFAULT_PROGRESS_STEPS: ProgressStep[] = [
  { label: '基础数据获取与校验', percentage: 25, defaultRemark: '系统已完成数据快照，通过基础数据合规性校验。' },
  { label: '业务逻辑计算', percentage: 50, defaultRemark: '引擎已执行核心业务计算逻辑。' },
  { label: '结果校验与优化', percentage: 75, defaultRemark: '计算结果校验与优化处理中。' },
  { label: '报告生成与汇总', percentage: 100, defaultRemark: '计算顺利结束，报告已准备就绪。' },
];

export const MRP_PROGRESS_STEPS: ProgressStep[] = [
  { label: '基础数据获取与校验', percentage: 25, defaultRemark: '系统已完成仓库快照，通过 BOM 与前置期校验。' },
  { label: '物料分层排序', percentage: 50, defaultRemark: '基于低位阶码完成物料依赖解构。' },
  { label: '执行供需平衡计算', percentage: 75, defaultRemark: '供需匹配引擎对冲库存与在途。' },
  { label: '建议计划生成与报告汇总', percentage: 100, defaultRemark: '已生成 PPO 与齐套分析报告。' },
];

export const SCH_PROGRESS_STEPS: ProgressStep[] = [
  { label: '基础数据获取与校验', percentage: 25, defaultRemark: '获取订单、BOM、产能等基础数据。' },
  { label: '规则式排程计算', percentage: 50, defaultRemark: '执行规则式生产排程逻辑。' },
  { label: '产能平衡与优化', percentage: 75, defaultRemark: '产能平衡与工序排程。' },
  { label: '排程结果输出', percentage: 100, defaultRemark: '排程结果与甘特图生成完成。' },
];

/** 产销计划报告：报告生成流程 */
export const SOP_PLAN_REPORT_STEPS: ProgressStep[] = [
  { label: '计划数据汇总', percentage: 25, defaultRemark: '已汇总产品族×月度计划数据。' },
  { label: '报告生成', percentage: 50, defaultRemark: '产销计划报告生成完成。' },
  { label: '报告输出', percentage: 100, defaultRemark: '报告已导出可供下载。' },
];

/** 产销评审会议：会议流程节点 */
export const SOP_REVIEW_MEETING_STEPS: ProgressStep[] = [
  { label: '会议发起', percentage: 17, defaultRemark: '会议已创建，议程已下发。' },
  { label: '议程预审', percentage: 33, defaultRemark: '各部门已确认议程。' },
  { label: '数据收集', percentage: 50, defaultRemark: '销售、生产、采购、财务数据已就绪。' },
  { label: '会议进行中', percentage: 67, defaultRemark: '评审讨论进行中。' },
  { label: '纪要待确认', percentage: 83, defaultRemark: '会议纪要已生成，待确认。' },
  { label: '会议闭环', percentage: 100, defaultRemark: '会议已结束，待办已分配。' },
];

/** DFP 需求预测算法通用步骤 */
export const DFP_ALGO_STEPS: ProgressStep[] = [
  { label: '历史数据加载与校验', percentage: 25, defaultRemark: '需求历史数据已加载，维度校验通过。' },
  { label: '特征工程与模型计算', percentage: 50, defaultRemark: '特征提取完成，模型执行运算。' },
  { label: '结果校验与输出', percentage: 100, defaultRemark: '预测结果校验通过，已写入需求版本。' },
];

/** DFP 历史需求清洗：数据处理流程 */
export const DFP_DEMAND_CLEANSE_STEPS: ProgressStep[] = [
  { label: '数据源连接', percentage: 25, defaultRemark: 'ERP 及手工录入数据已连接。' },
  { label: '规则清洗执行', percentage: 50, defaultRemark: '去重、异常值剔除、补全规则已执行。' },
  { label: '清洗结果输出', percentage: 100, defaultRemark: '清洗后数据已写入，质量得分已计算。' },
];

/** MPS 主计划算法通用步骤 */
export const MPS_ALGO_STEPS: ProgressStep[] = [
  { label: '主计划数据获取与校验', percentage: 25, defaultRemark: '供需数据、产能约束已加载校验。' },
  { label: '供需平衡与优化计算', percentage: 50, defaultRemark: '供需匹配引擎执行，优化目标计算完成。' },
  { label: '计划结果输出', percentage: 100, defaultRemark: '主计划结果已生成并写入计划版本。' },
];

/** IPS 接口同步流程 */
export const IPS_INTERFACE_SYNC_STEPS: ProgressStep[] = [
  { label: '接口连接建立', percentage: 25, defaultRemark: '目标系统接口连接已建立。' },
  { label: '数据拉取与转换', percentage: 50, defaultRemark: '数据拉取完成，格式转换执行中。' },
  { label: '同步写入与校验', percentage: 100, defaultRemark: '数据已同步写入，校验完成。' },
];

/** IPS 自动归档流程 */
export const IPS_AUTO_ARCHIVE_STEPS: ProgressStep[] = [
  { label: '归档范围扫描', percentage: 25, defaultRemark: '符合保留期限的历史记录已扫描。' },
  { label: '归档打包', percentage: 50, defaultRemark: '数据已压缩打包。' },
  { label: '归档完成与清理', percentage: 100, defaultRemark: '归档文件已存储，原数据已清理。' },
];

/** SCH 生产反馈流程 */
export const SCH_PRODUCTION_FEEDBACK_STEPS: ProgressStep[] = [
  { label: '反馈源连接', percentage: 25, defaultRemark: 'MES/手工反馈数据源已连接。' },
  { label: '反馈采集与校验', percentage: 50, defaultRemark: '进度/完工/异常反馈已采集。' },
  { label: '回写完成', percentage: 100, defaultRemark: '反馈数据已回写至排程系统。' },
];

export function getProgressSteps(moduleId: string, functionId?: string): ProgressStep[] {
  if (functionId === 'sop_review_meeting') return SOP_REVIEW_MEETING_STEPS;
  if (functionId === 'sop_plan_report') return SOP_PLAN_REPORT_STEPS;
  if (functionId === 'dfp_demand_cleanse') return DFP_DEMAND_CLEANSE_STEPS;
  if (functionId?.startsWith('dfp_')) return DFP_ALGO_STEPS;
  if (functionId?.startsWith('mps_')) return MPS_ALGO_STEPS;
  if (functionId === 'ips_interface_sync') return IPS_INTERFACE_SYNC_STEPS;
  if (functionId === 'ips_auto_archive') return IPS_AUTO_ARCHIVE_STEPS;
  if (functionId === 'sch_production_feedback') return SCH_PRODUCTION_FEEDBACK_STEPS;
  if (moduleId === 'MRP' && (!functionId || functionId.includes('mrp_'))) return MRP_PROGRESS_STEPS;
  if (moduleId === 'SCH') return SCH_PROGRESS_STEPS;
  return DEFAULT_PROGRESS_STEPS;
}

export function getFunctionsByModule(moduleId: ModuleId): FunctionConfig[] {
  return FUNCTION_CONFIGS.filter((f) => f.moduleId === moduleId);
}

/** 支持计划版本/需求版本的模块（SCH、IPS 无版本概念） */
export const VERSIONED_MODULES: ModuleId[] = ['MPS', 'S&OP', 'DFP', 'MRP'];

export function hasVersionConcept(moduleId: ModuleId): boolean {
  return VERSIONED_MODULES.includes(moduleId);
}
