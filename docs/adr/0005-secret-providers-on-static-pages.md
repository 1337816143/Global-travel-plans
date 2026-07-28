# ADR-0005：Static Pages 禁用需要秘密凭据的 Provider

- 状态：Accepted
- 日期：2026-07-28

## 背景

旧公开源码包含高德 JS Key、Security Code 和 Web Service Key。GitHub Pages 和浏览器 bundle 无法保存秘密；Vite 前端环境变量也会被用户读取。

## 决定

- 旧凭据视为已泄露，不复制到 Global Core。
- 第一阶段只启用无需秘密且条款允许浏览器调用的 Provider。
- 需要秘密、签名或服务端 CORS 代理的 capability 返回 `unavailable`，并说明原因。
- `.env.example` 只描述变量名，不含值。
- 未来引入 Node/Serverless/Edge 网关必须另建 ADR，包含鉴权、速率限制、成本、隐私、部署和回滚。

## 备选方案

1. 将 key 放入 GitHub Actions secrets 后注入 Vite：拒绝，最终 bundle 仍公开。
2. 继续使用旧公开 key：拒绝，无法控制滥用和配额。
3. 使用混淆或 Base64：拒绝，不是安全措施。

## 后果

- 第一阶段高德搜索、路线、天气和实时路况在 Global Web 中不可用。
- Leaflet 和 fixture 路线足以完成最小闭环。
- 用户会看到明确的 capability 状态，不会得到伪造结果。

## 运维动作

仓库所有者应在高德控制台撤销或轮换旧公开凭据。此动作在仓库外完成，完成前 R-001 保持 Open。
