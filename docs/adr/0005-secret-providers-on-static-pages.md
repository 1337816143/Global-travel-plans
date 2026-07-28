# ADR-0005：Static Pages 与秘密凭据边界

- 状态：Accepted with temporary legacy exception
- 日期：2026-07-28

## 背景

旧青岛 v2.4 前端依赖高德 JS Key、Security Code 和 Web Service Key。GitHub Pages 和浏览器 bundle 无法真正保存秘密；Vite 前端环境变量也会被用户读取。

Global Core 不能继续把这类凭据当作可安全保密的信息，也不能在没有后端网关时伪装为安全方案。

## 决定

### Global Core

- 不复制、重新声明或扩散旧高德凭据。
- 第一阶段只启用无需秘密且条款允许浏览器调用的 Provider。
- 需要秘密、签名或服务端 CORS 代理的 capability 返回 `unavailable`，并说明原因。
- `.env.example` 只描述变量名，不含值。
- 未来引入 Node、Serverless 或 Edge 网关必须另建 ADR，包含鉴权、速率限制、成本、隐私、部署和回滚。

### Legacy 青岛 v2.4 临时例外

仓库所有者于 2026-07-28 明确决定：在后端或其他可用替代方案成功落地之前，保留 Legacy 青岛项目中的现有高德凭据，以维持旧版功能正常运行。

该例外：

- 仅适用于保留的 Legacy 青岛运行链；
- 不表示这些凭据是秘密或安全的；
- 不允许将其复制进 Global Core、测试 fixture、文档示例或新 Provider；
- 不阻塞本阶段 Global Core 构建和测试；
- 在安全网关或无秘密替代方案可用后应重新评估并撤销。

## 备选方案

1. 将 key 放入 GitHub Actions secrets 后注入 Vite：拒绝，最终 bundle 仍公开。
2. 使用混淆或 Base64：拒绝，不是安全措施。
3. 立即移除 Legacy 凭据：当前暂缓，因为在没有替代方案时会破坏旧版运行能力。
4. 继续在 Global Core 使用旧凭据：拒绝，避免扩大暴露面和耦合。

## 后果

- Legacy 青岛 v2.4 可继续使用现有高德能力，但保留已知的公开凭据风险。
- Global Web 第一阶段不会依赖这些 Legacy 凭据。
- Leaflet 和 fixture 路线可完成 Global Core 最小闭环。
- 用户会看到明确的 capability 状态，不会得到伪造结果。

## 后续重新评估条件

出现以下任一条件时重新评估该临时例外：

- 可用的后端、Serverless 或 Edge 网关上线；
- 可替代的无秘密浏览器 Provider 验证成功；
- 高德凭据出现滥用、配额异常或功能失效；
- Legacy 青岛版本停止作为运行回退版本。
