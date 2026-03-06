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
├── components/
│   ├── RunConfigModal.tsx   # 运行配置弹窗
│   ├── RunProgressModal.tsx # 运行进度弹窗
│   └── OverviewStats.tsx    # 运行概览统计
├── 设计PRD.md           # 产品需求说明书
└── README.md
```

## 设计文档

详见 [设计PRD.md](./设计PRD.md)（页面设计、UI/UX、用户操作流程、注意事项）。
