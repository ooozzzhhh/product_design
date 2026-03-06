/**
 * 各功能差异化的输入信息、运行日志、计算结果
 */

import { RunRecord } from './types';
import { FUNCTION_CONFIGS, hasVersionConcept, getProgressSteps } from './constants';

/** 按功能 ID 生成差异化的 inputInfo */
function getInputInfoByFunction(functionId: string, i: number): { key: string; value: string }[] {
  const base = { key: '数据范围', value: '2025-01-01 ~ 2026-02-09' };
  const maps: Record<string, { key: string; value: string }[]> = {
    dfp_demand_cleanse: [base, { key: '历史需求SKU数', value: `${(1200 + i * 50).toLocaleString()}` }, { key: '清洗规则', value: '去重+异常值剔除+补全' }, { key: '数据源', value: 'ERP + 手工录入' }],
    dfp_forecast_algo: [base, { key: '预测维度', value: 'SKU × 区域' }, { key: '历史期数', value: '24 个月' }, { key: '模型类型', value: 'ARIMA + 指数平滑' }],
    dfp_outlier_detect: [base, { key: '检测算法', value: 'IQR + 3σ' }, { key: '待检SKU数', value: `${(800 + i * 30).toLocaleString()}` }],
    dfp_seasonal_decompose: [base, { key: '分解方法', value: 'STL 季节性分解' }, { key: '周期', value: '12 个月' }],
    dfp_model_train: [base, { key: '训练集比例', value: '80%' }, { key: '特征数', value: '15' }, { key: '模型', value: 'LSTM + XGBoost' }],
    sop_plan_report: [base, { key: '计划层级', value: '产品族 × 月度' }, { key: '情景数', value: '3' }],
    sop_review_meeting: [{ key: '会议ID', value: `MT-2026020${(i % 9) + 1}` }, { key: '会议主题', value: '2026-Q1 产销评审' }, { key: '发起人', value: ['管理员 (Admin)', '张三', '李四'][i % 3] }, { key: '参与部门', value: '销售/生产/采购/财务' }],
    mps_supply_match: [base, { key: '物料数', value: `${(3240 + i * 100).toLocaleString()}` }, { key: '计划周期', value: '周' }, { key: '仓库', value: 'CP001, CP002' }],
    mps_algo: [base, { key: '优化目标', value: '满足率最大化' }, { key: '约束', value: '产能/物料/交期' }],
    mps_atp: [base, { key: '可承诺维度', value: 'SKU × 日期' }, { key: '提前期', value: '7 天' }],
    mps_capacity_load: [base, { key: '产线/工位', value: '24' }, { key: '分析周期', value: '日' }],
    mps_forecast_consume: [base, { key: '预测版本', value: '2026-Q1' }, { key: '冲减维度', value: 'SKU × 客户' }, { key: '库存考虑', value: '在库+在途' }],
    sch_rule_schedule: [base, { key: '排程规则', value: 'EDD + 急单优先' }, { key: '工序数', value: '156' }, { key: '设备数', value: '48' }],
    sch_supply_match: [base, { key: '订单数', value: `${(320 + i * 10).toLocaleString()}` }, { key: '产线', value: 'L1-L8' }],
    sch_capacity_balance: [base, { key: '瓶颈工序', value: '焊接/装配' }, { key: '负载阈值', value: '85%' }],
    sch_urgent_insert: [base, { key: '插单数量', value: '3' }, { key: '影响范围', value: '当日排程' }],
    sch_production_feedback: [base, { key: '反馈类型', value: '进度/完工/异常' }, { key: '采集周期', value: '4 小时' }, { key: '目标系统', value: 'MES / 手工' }],
    mrp_supply_match: [base, { key: '物料数', value: `${(3240 + i * 100).toLocaleString()}` }, { key: 'BOM 层级', value: '5' }, { key: '仓库', value: 'CP001, CP002, CP003' }],
    mrp_algo: [base, { key: '净需求计算', value: 'LFL' }, { key: '安全库存', value: '启用' }],
    mrp_kit_analysis: [base, { key: '订单数', value: `${(420 + i * 15).toLocaleString()}` }, { key: '齐套维度', value: '订单行' }],
    mrp_safety_stock: [base, { key: '服务水平目标', value: '95%' }, { key: '补货周期', value: '7 天' }],
    ips_interface_sync: [base, { key: '同步方向', value: '双向' }, { key: '接口数量', value: '24' }, { key: '目标系统', value: 'ERP / WMS' }],
    ips_auto_archive: [base, { key: '归档范围', value: '历史运行记录' }, { key: '保留期限', value: '90 天' }, { key: '归档格式', value: '压缩包' }],
  };
  return maps[functionId] || [base, { key: '处理数量', value: `${(1000 + i * 50).toLocaleString()}` }];
}

/** 按功能 ID 生成差异化的 results */
function getResultsByFunction(functionId: string, i: number, status: string): { key: string; value: string }[] | undefined {
  if (status !== 'success') return undefined;
  const maps: Record<string, { key: string; value: string }[]> = {
    dfp_demand_cleanse: [{ key: '清洗后条数', value: `${(45800 + i * 200).toLocaleString()}` }, { key: '剔除异常值', value: `${(120 + i).toLocaleString()}` }, { key: '数据质量得分', value: `${96 + (i % 4)}%` }],
    dfp_forecast_algo: [{ key: '预测 MAPE', value: `${(12 + i % 5)}%` }, { key: '预测条数', value: `${(15600 + i * 100).toLocaleString()}` }, { key: '置信区间', value: '90%' }],
    dfp_outlier_detect: [{ key: '检测异常数', value: `${(85 + i).toLocaleString()}` }, { key: '已处理', value: `${(80 + i).toLocaleString()}` }],
    dfp_seasonal_decompose: [{ key: '趋势强度', value: `${(0.72 + i * 0.01).toFixed(2)}` }, { key: '季节性强度', value: `${(0.85 + i * 0.01).toFixed(2)}` }],
    dfp_model_train: [{ key: '验证集 MAPE', value: `${(10 + i % 4)}%` }, { key: '特征重要性', value: '已生成' }],
    sop_plan_report: [{ key: '报告页数', value: '24' }, { key: '覆盖产品族', value: '12' }],
    sop_review_meeting: [{ key: '当前节点', value: '会议闭环' }, { key: '议程确认', value: '4/4 部门' }, { key: '待办事项', value: '5 项' }],
    mps_supply_match: [{ key: '匹配订单数', value: `${(12580 + i * 200).toLocaleString()}` }, { key: '齐套率', value: `${(92 + i % 6)}%` }, { key: '缺口物料', value: `${(12 + i % 5).toLocaleString()}` }],
    mps_algo: [{ key: '优化目标值', value: '94.2%' }, { key: '计划行数', value: `${(8320 + i * 150).toLocaleString()}` }],
    mps_atp: [{ key: '可承诺 SKU', value: `${(2560 + i * 80).toLocaleString()}` }, { key: '平均交期', value: '5 天' }],
    mps_capacity_load: [{ key: '超负荷产线', value: '2' }, { key: '平均负荷', value: '78%' }],
    mps_forecast_consume: [{ key: '冲减预测数', value: `${(1850 + i * 50).toLocaleString()}` }, { key: '剩余可用', value: `${(920 + i * 20).toLocaleString()}` }],
    sch_rule_schedule: [{ key: '排程订单数', value: `${(318 + i * 10).toLocaleString()}` }, { key: '交期达成率', value: `${(88 + i % 8)}%` }, { key: '设备利用率', value: '82%' }],
    sch_supply_match: [{ key: '匹配完成', value: `${(12580 + i * 200).toLocaleString()}` }],
    sch_capacity_balance: [{ key: '平衡后 gap', value: '0' }, { key: '调整工序', value: '12' }],
    sch_urgent_insert: [{ key: '受影响订单', value: '8' }, { key: '重排耗时', value: '2.3s' }],
    sch_production_feedback: [{ key: '采集反馈条数', value: `${(256 + i * 10).toLocaleString()}` }, { key: '回写成功', value: '是' }],
    mrp_supply_match: [{ key: '处理条数', value: `${(12580 + i * 200).toLocaleString()}` }, { key: '齐套率', value: `${(92 + i % 6)}%` }, { key: '计划订单', value: `${(1850 + i * 50).toLocaleString()}` }],
    mrp_algo: [{ key: 'MRP 爆炸完成', value: '是' }, { key: '产出 PPO', value: `${(3200 + i * 80).toLocaleString()}` }],
    mrp_kit_analysis: [{ key: '齐套订单', value: `${(380 + i * 12).toLocaleString()}` }, { key: '缺料订单', value: '18' }],
    mrp_safety_stock: [{ key: '计算 SKU 数', value: `${(2680 + i * 60).toLocaleString()}` }, { key: '再订货点', value: '已更新' }],
    ips_interface_sync: [{ key: '同步接口数', value: '24' }, { key: '同步耗时', value: '45s' }],
    ips_auto_archive: [{ key: '归档记录数', value: `${(12500 + i * 200).toLocaleString()}` }, { key: '归档大小', value: '2.3 GB' }],
  };
  return maps[functionId] || [{ key: '处理条数', value: `${(12580 + i * 200).toLocaleString()}` }, { key: '完成率', value: `${(92 + i % 6)}%` }];
}

/** 为有版本概念的模块生成版本号 */
function getVersionByModule(moduleId: string, functionId: string, i: number): { planVersion?: string; demandVersion?: string } {
  if (!hasVersionConcept(moduleId as 'MPS' | 'S&OP' | 'DFP' | 'MRP')) return {};
  const q = ['Q1', 'Q2', 'Q3', 'Q4'][(i % 4)];
  const ym = `2026-${String(1 + (i % 12)).padStart(2, '0')}`;
  const date = `2026020${Math.max(1, (i % 9) + 1)}`;
  if (moduleId === 'DFP') {
    return { planVersion: undefined, demandVersion: `DFP-${date}` };
  }
  return { planVersion: `${ym}-${q}`, demandVersion: `DFP-${date}` };
}

/** 按功能生成符合其特点的运行日志 */
function getLogsByFunction(functionId: string, status: string, startTime: string): string[] {
  const t = startTime.split(' ')[1] || '09:30:00';
  const logsMap: Record<string, { success: string[]; running: string[]; failed: string[] }> = {
    dfp_demand_cleanse: {
      success: [`[${t}] 数据源连接成功`, `[${t}] 清洗规则加载完成`, `[${t}] 去重、异常值剔除、补全执行完成`, `[${t}] 数据质量得分计算完成`, `[${t}] 清洗后数据已写入`],
      running: [`[${t}] 数据源连接成功`, `[${t}] 清洗规则加载完成`, `[${t}] 规则清洗执行中...`],
      failed: [`[${t}] 数据源连接成功`, `[${t}] 清洗规则加载完成`, `[${t}] 数据格式异常，清洗中止`],
    },
    dfp_forecast_algo: {
      success: [`[${t}] 历史需求数据加载完成`, `[${t}] 特征工程执行完成`, `[${t}] ARIMA/指数平滑模型计算完成`, `[${t}] MAPE 校验通过`, `[${t}] 预测结果已写入需求版本`],
      running: [`[${t}] 历史需求数据加载完成`, `[${t}] 特征工程执行完成`, `[${t}] 模型计算中...`],
      failed: [`[${t}] 历史需求数据加载完成`, `[${t}] 特征工程执行完成`, `[${t}] 历史期数不足，计算中止`],
    },
    dfp_outlier_detect: {
      success: [`[${t}] 待检 SKU 数据加载完成`, `[${t}] IQR/3σ 检测执行完成`, `[${t}] 异常值已标记`, `[${t}] 处理策略应用完成`, `[${t}] 检测报告已生成`],
      running: [`[${t}] 待检 SKU 数据加载完成`, `[${t}] IQR/3σ 检测执行中...`],
      failed: [`[${t}] 待检 SKU 数据加载完成`, `[${t}] 检测参数异常，计算中止`],
    },
    dfp_seasonal_decompose: {
      success: [`[${t}] 需求序列加载完成`, `[${t}] STL 分解计算完成`, `[${t}] 趋势、季节性、残差已分离`, `[${t}] 强度指标计算完成`, `[${t}] 分解结果已输出`],
      running: [`[${t}] 需求序列加载完成`, `[${t}] STL 季节性分解执行中...`],
      failed: [`[${t}] 需求序列加载完成`, `[${t}] 周期设置与数据长度不匹配，分解中止`],
    },
    dfp_model_train: {
      success: [`[${t}] 训练集/验证集划分完成`, `[${t}] 特征构建完成`, `[${t}] LSTM/XGBoost 模型训练完成`, `[${t}] 验证集 MAPE 计算完成`, `[${t}] 模型已保存`],
      running: [`[${t}] 训练集/验证集划分完成`, `[${t}] 模型训练中...`],
      failed: [`[${t}] 训练集/验证集划分完成`, `[${t}] 训练样本不足，训练中止`],
    },
    sop_plan_report: {
      success: [`[${t}] 计划数据汇总完成`, `[${t}] 报告模板加载完成`, `[${t}] 产销计划报告生成完成`, `[${t}] 报告已导出`],
      running: [`[${t}] 计划数据汇总完成`, `[${t}] 报告生成中...`],
      failed: [`[${t}] 计划数据汇总完成`, `[${t}] 数据缺失，报告生成中止`],
    },
    sop_review_meeting: {
      success: [`[${t}] 会议流程已创建`, `[${t}] 议程已下发`, `[${t}] 各部门数据已就绪`, `[${t}] 评审讨论完成`, `[${t}] 纪要已生成`, `[${t}] 会议已闭环`],
      running: [`[${t}] 会议流程已创建`, `[${t}] 议程已下发`, `[${t}] 数据收集中...`],
      failed: [`[${t}] 会议流程已创建`, `[${t}] 议程预审超时，流程中止`],
    },
    mps_supply_match: {
      success: [`[${t}] 供需数据加载完成`, `[${t}] 物料、产能约束校验通过`, `[${t}] 供需匹配引擎执行完成`, `[${t}] 齐套率计算完成`, `[${t}] 匹配结果已写入计划版本`],
      running: [`[${t}] 供需数据加载完成`, `[${t}] 供需匹配计算中...`],
      failed: [`[${t}] 供需数据加载完成`, `[${t}] 产能数据异常，匹配中止`],
    },
    mps_algo: {
      success: [`[${t}] 主计划数据校验通过`, `[${t}] 优化目标与约束加载完成`, `[${t}] 供需平衡与优化计算完成`, `[${t}] 满足率达标`, `[${t}] 主计划已写入计划版本`],
      running: [`[${t}] 主计划数据校验通过`, `[${t}] 优化计算中...`],
      failed: [`[${t}] 主计划数据校验通过`, `[${t}] 无可行解，计算中止`],
    },
    mps_atp: {
      success: [`[${t}] 可承诺维度数据加载完成`, `[${t}] 提前期计算完成`, `[${t}] ATP 引擎执行完成`, `[${t}] 交期校验通过`, `[${t}] 可承诺量已更新`],
      running: [`[${t}] 可承诺维度数据加载完成`, `[${t}] ATP 计算中...`],
      failed: [`[${t}] 可承诺维度数据加载完成`, `[${t}] 库存数据异常，计算中止`],
    },
    mps_capacity_load: {
      success: [`[${t}] 产线/工位数据加载完成`, `[${t}] 负荷分析计算完成`, `[${t}] 瓶颈识别完成`, `[${t}] 负荷报告已生成`],
      running: [`[${t}] 产线/工位数据加载完成`, `[${t}] 负荷分析计算中...`],
      failed: [`[${t}] 产线/工位数据加载完成`, `[${t}] 产能数据缺失，分析中止`],
    },
    mps_forecast_consume: {
      success: [`[${t}] 预测版本加载完成`, `[${t}] 在库+在途数据获取完成`, `[${t}] 冲减计算执行完成`, `[${t}] 剩余可用量已更新`],
      running: [`[${t}] 预测版本加载完成`, `[${t}] 冲减计算中...`],
      failed: [`[${t}] 预测版本加载完成`, `[${t}] 冲减维度不一致，计算中止`],
    },
    sch_rule_schedule: {
      success: [`[${t}] 订单、BOM、产能数据加载完成`, `[${t}] EDD+急单优先规则执行完成`, `[${t}] 排程结果生成完成`, `[${t}] 甘特图已输出`],
      running: [`[${t}] 订单、BOM、产能数据加载完成`, `[${t}] 规则式排程计算中...`],
      failed: [`[${t}] 订单、BOM、产能数据加载完成`, `[${t}] 产能不足，排程中止`],
    },
    sch_supply_match: {
      success: [`[${t}] 订单与产线数据加载完成`, `[${t}] 供需匹配计算完成`, `[${t}] 匹配结果已写入`],
      running: [`[${t}] 订单与产线数据加载完成`, `[${t}] 供需匹配计算中...`],
      failed: [`[${t}] 订单与产线数据加载完成`, `[${t}] 匹配规则异常，计算中止`],
    },
    sch_capacity_balance: {
      success: [`[${t}] 工序与设备产能加载完成`, `[${t}] 负载阈值校验完成`, `[${t}] 产能平衡计算完成`, `[${t}] 调整工序已输出`],
      running: [`[${t}] 工序与设备产能加载完成`, `[${t}] 产能平衡计算中...`],
      failed: [`[${t}] 工序与设备产能加载完成`, `[${t}] 瓶颈工序无法平衡，计算中止`],
    },
    sch_urgent_insert: {
      success: [`[${t}] 排程快照加载完成`, `[${t}] 插单影响模拟完成`, `[${t}] 受影响订单已识别`, `[${t}] 重排耗时已统计`],
      running: [`[${t}] 排程快照加载完成`, `[${t}] 插单影响模拟中...`],
      failed: [`[${t}] 排程快照加载完成`, `[${t}] 插单约束冲突，模拟中止`],
    },
    sch_production_feedback: {
      success: [`[${t}] MES/手工反馈源连接成功`, `[${t}] 进度/完工/异常反馈采集完成`, `[${t}] 反馈数据校验通过`, `[${t}] 已回写至排程系统`],
      running: [`[${t}] MES/手工反馈源连接成功`, `[${t}] 反馈采集中...`],
      failed: [`[${t}] MES/手工反馈源连接成功`, `[${t}] 反馈格式异常，回写中止`],
    },
    mrp_supply_match: {
      success: [`[${t}] 仓库快照、BOM 加载完成`, `[${t}] 物料分层排序完成`, `[${t}] 供需平衡计算完成`, `[${t}] 计划订单已生成`],
      running: [`[${t}] 仓库快照、BOM 加载完成`, `[${t}] 供需平衡计算中...`],
      failed: [`[${t}] 仓库快照、BOM 加载完成`, `[${t}] BOM 数据异常，计算中止`],
    },
    mrp_algo: {
      success: [`[${t}] 仓库快照、BOM 加载完成`, `[${t}] 物料分层排序完成`, `[${t}] MRP 爆炸完成`, `[${t}] PPO 已生成`],
      running: [`[${t}] 仓库快照、BOM 加载完成`, `[${t}] MRP 爆炸计算中...`],
      failed: [`[${t}] 仓库快照、BOM 加载完成`, `[${t}] 前置期异常，计算中止`],
    },
    mrp_kit_analysis: {
      success: [`[${t}] 订单与 BOM 加载完成`, `[${t}] 齐套维度分析完成`, `[${t}] 齐套/缺料订单已识别`, `[${t}] 分析报告已生成`],
      running: [`[${t}] 订单与 BOM 加载完成`, `[${t}] 齐套分析中...`],
      failed: [`[${t}] 订单与 BOM 加载完成`, `[${t}] 物料主数据缺失，分析中止`],
    },
    mrp_safety_stock: {
      success: [`[${t}] 服务水平目标加载完成`, `[${t}] 补货周期数据获取完成`, `[${t}] 安全库存计算完成`, `[${t}] 再订货点已更新`],
      running: [`[${t}] 服务水平目标加载完成`, `[${t}] 安全库存计算中...`],
      failed: [`[${t}] 服务水平目标加载完成`, `[${t}] 历史消耗数据不足，计算中止`],
    },
    ips_interface_sync: {
      success: [`[${t}] 目标系统接口连接建立`, `[${t}] 数据拉取与转换完成`, `[${t}] 同步写入完成`, `[${t}] 校验通过`],
      running: [`[${t}] 目标系统接口连接建立`, `[${t}] 数据拉取与转换中...`],
      failed: [`[${t}] 目标系统接口连接建立`, `[${t}] 接口超时，同步中止`],
    },
    ips_auto_archive: {
      success: [`[${t}] 历史记录扫描完成`, `[${t}] 归档打包完成`, `[${t}] 归档文件已存储`, `[${t}] 原数据已清理`],
      running: [`[${t}] 历史记录扫描完成`, `[${t}] 归档打包中...`],
      failed: [`[${t}] 历史记录扫描完成`, `[${t}] 磁盘空间不足，归档中止`],
    },
  };

  const def = {
    success: [`[${t}] 初始化完成`, `[${t}] 数据校验通过`, `[${t}] 业务逻辑计算完成`, `[${t}] 结果输出完成`],
    running: [`[${t}] 初始化完成`, `[${t}] 数据校验通过`, `[${t}] 业务逻辑计算中...`],
    failed: [`[${t}] 初始化完成`, `[${t}] 数据校验通过`, `[${t}] 执行异常，任务中止`],
  };

  const logs = logsMap[functionId] || def;
  return status === 'success' ? logs.success : status === 'running' ? logs.running : logs.failed;
}

/** 根据 progress 计算当前步骤索引（与 RunProgressModal 一致） */
function getCurrentStepIndexFromProgress(progress: number, steps: { percentage: number }[]): number {
  const idx = steps.findIndex((s) => progress < s.percentage);
  return idx >= 0 ? idx : steps.length - 1;
}

/** 按功能生成匹配其步骤的 lastStep（与 progress 对齐） */
function getLastStepByFunction(functionId: string, moduleId: string, status: string, progress: number): string {
  const steps = getProgressSteps(moduleId, functionId);
  if (status === 'success') return steps[steps.length - 1]?.label ?? '完成';
  if (status === 'running') {
    const idx = getCurrentStepIndexFromProgress(progress, steps);
    return steps[idx]?.label ?? '执行中';
  }
  const idx = Math.min(getCurrentStepIndexFromProgress(progress, steps) + 1, steps.length - 1);
  return steps[idx]?.label ?? '异常';
}

export function generateMockHistory(): RunRecord[] {
  const records: RunRecord[] = [];
  const statuses: ('success' | 'failed' | 'running')[] = ['success', 'success', 'failed', 'success', 'success', 'failed', 'success', 'running'];
  const durations = ['8s', '12s', '15s', '6s', '22s', '11s', '18s', '进行中'];
  const operators = ['管理员 (Admin)', '系统自动任务', '张三', '李四', '系统自动任务', '王五', '管理员 (Admin)', '赵六'];

  FUNCTION_CONFIGS.forEach((f, fi) => {
    const count = 5 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const status = statuses[(fi + i) % statuses.length];
      const dayOffset = Math.floor(i / 2);
      const hour = 8 + (i % 12);
      const min = 10 + (i % 50);
      const startTime = `2026-02-0${Math.max(1, 9 - dayOffset)} ${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${(i * 7 % 60).toString().padStart(2, '0')}`;
      const endMin = min + (status === 'running' ? 0 : 1 + (i % 5));
      const endTime = status === 'running' ? undefined : `2026-02-0${Math.max(1, 9 - dayOffset)} ${hour.toString().padStart(2, '0')}:${Math.min(59, endMin).toString().padStart(2, '0')}:${((i * 7 + 15) % 60).toString().padStart(2, '0')}`;

      records.push({
        id: `${f.runIdPrefix}-${String(899000 - fi * 100 - i).padStart(6, '0')}`,
        moduleId: f.moduleId,
        functionId: f.id,
        startTime,
        endTime,
        duration: status === 'running' ? undefined : durations[(fi + i) % durations.length],
        operator: operators[(fi + i) % operators.length],
        algorithmScheme: f.moduleId === 'SCH' ? '规则式生产排程' : '标准策略',
        status,
        progress: status === 'success' ? 100 : status === 'running' ? 35 + (i % 50) : 40 + (i % 40),
        lastStep: getLastStepByFunction(f.id, f.moduleId, status, status === 'success' ? 100 : status === 'running' ? 35 + (i % 50) : 40 + (i % 40)),
        totalSteps: getProgressSteps(f.moduleId, f.id).length,
        summary: status === 'success' ? `本次 ${f.name} 计算顺利完成，完成率达到 ${92 + (i % 6)}%。` : undefined,
        runMode: i % 3 === 0 ? '仅运行变更数据' : '全量数据重算',
        policyMode: '规则模式',
        policyName: f.moduleId === 'SCH' ? '规则式生产排程策略' : '标准策略_v1',
        inputInfo: getInputInfoByFunction(f.id, i),
        algorithmLogs: getLogsByFunction(f.id, status, startTime),
        results: getResultsByFunction(f.id, i, status),
        ...getVersionByModule(f.moduleId, f.id, i),
      });
    }
  });

  return records.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
}
