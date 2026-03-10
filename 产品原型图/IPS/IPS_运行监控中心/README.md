# 运行监控中心

悠桦林 SCP 平台 - 通用运行监控中心。支持 SCH、MPS、S&OP、DFP、MRP、MDS、SDS、IPS 等各业务模块的运行监控与历史追溯。

## 快速启动

```bash
npm install
npm run dev
```

浏览器访问 http://localhost:3001

## 项目结构

```
运行监控中心/
├── App.tsx              # 主应用
├── index.html
├── index.tsx
├── types.ts             # 类型定义
├── constants.ts         # 模块与步骤配置
├── mockData.ts          # 模拟数据
├── components/
│   ├── FunctionCard.tsx         # 功能卡片
│   ├── FunctionDetailView.tsx   # 功能详情视图
│   ├── FunctionRunConfigModal.tsx # 功能运行配置弹窗
│   ├── OverviewStats.tsx        # 运行概览统计
│   ├── RunConfigModal.tsx       # 运行配置弹窗
│   └── RunProgressModal.tsx     # 运行进度弹窗
├── 设计PRD.md           # 产品需求说明书
└── README.md
```

## 设计文档

详见 [设计PRD.md](./设计PRD.md)（页面设计、UI/UX、用户操作流程、注意事项）。

## 更新历史

### 2026-03-10 (20260310103000)

**新增功能**:
- 并发控制规范 (PRD 2.1.6):支持PARALLEL/EXCLUSIVE/QUEUEABLE/LIMITED_PARALLEL四种并发模式
- 实时推送机制 (PRD 2.1.7):支持WebSocket实时推送与轮询降级
- 终止与异常跳过 (PRD 2.1.8):支持任务终止、节点级可中断控制、异常跳过框架
- 性能监控 (PRD 2.1.9):支持节点级业务指标、性能监控接口、性能详情弹窗

**修改文件**:
- `types.ts`:新增并发控制、排队状态、性能监控、节点详情等类型定义
- `constants.ts`:为所有功能点配置添加并发控制配置
- `mockData.ts`:新增排队状态和节点详情的模拟数据
- `components/RunProgressModal.tsx`:新增终止确认对话框和性能详情弹窗
- `components/FunctionDetailView.tsx`:新增排队状态展示和异常跳过节点展示

详见 [20260310103000/修改说明.md](./20260310103000/修改说明.md)

