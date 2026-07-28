# ADR-0001：采用 Static-first npm workspace 架构

- 状态：Accepted
- 日期：2026-07-28

## 背景

第一阶段需要多目的地规划、来源追溯、地图、分享和打印，但不需要账号、支付或秘密后端。GitHub Pages 无法安全保存秘密凭据。

## 决定

采用：

- TypeScript strict；
- npm workspaces；
- Vite + React；
- 纯 TypeScript domain/planner；
- Provider 和 MapAdapter packages；
- GitHub Pages 静态部署；
- 需秘密的 capability 默认 unavailable。

不建立形式化后端。

## 备选方案

1. 继续扩展旧单文件 JS：拒绝，构建和全局状态耦合无法支持全球核心。
2. 立即建立 Node API：拒绝，第一阶段没有足够的秘密服务或写入需求，增加运维和成本。
3. 全部使用第三方 SaaS：拒绝，核心规划和数据可追溯性不能外包。

## 后果

优点：部署简单、成本低、离线友好、核心可在 Node/浏览器测试。  
限制：实时商业 API、秘密签名和跨域代理能力延后。  
回滚：关闭 Global Web 部署，继续使用 Qingdao v2.4 artifact。
