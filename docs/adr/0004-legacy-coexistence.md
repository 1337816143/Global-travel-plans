# ADR-0004：Legacy Qingdao 与 Global Core 并存迁移

- 状态：Accepted
- 日期：2026-07-28

## 背景

青岛 v2.4 已有可运行页面、历史版本、稳定回退和用户数据。直接原地重写会破坏回滚能力，并把旧全局状态带入新核心。

## 决定

- `legacy-qingdao-v2.4-baseline` 为不可变迁移基线。
- `archive/v1.0.15-stable` 继续作为更早稳定回退。
- Global Core 在新的 workspace 目录建设，不依赖 `src-v2` 运行时。
- 旧数据只能通过只读 importer 进入 fixture。
- 新版达到全部完成定义前，不删除或替换旧线上入口。
- 最终切换通过 Pages artifact 完成，Legacy 保留独立路径。

## 备选方案

1. 在 `src-v2` 内逐文件改造成 React：拒绝，迁移期间难以保持行为和稳定回退。
2. 只复制当前 HTML 作为备份后删除历史：拒绝，不满足可追溯性。
3. 新建完全无历史仓库：拒绝，丢失来源、回滚和审计链。

## 后果

- 迁移期仓库体积较大，存在两套应用。
- 新旧 CI 需要隔离。
- 数据迁移需要明确 importer 和 namespace。
- 出现问题时可以关闭 Draft PR 或重新部署 Legacy artifact。
