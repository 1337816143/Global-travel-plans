# ADR-0003：核心规划采用确定性 Planner

- 状态：Accepted
- 日期：2026-07-28

## 背景

旅行计划涉及时间重叠、交通段、开放时间、锁定项、住宿和跨时区。自由文本生成无法稳定保证这些约束，也难以测试和回滚。

## 决定

- Planner 是纯 TypeScript 包，不访问网络、DOM、地图或 LLM。
- 相同 request、catalog、matrix、版本和 seed 生成相同 TripPlan。
- 强约束优先于候选评分。
- 所有输出经过独立 invariant validator。
- LLM 只能解释已经验证的结构化结果，不修改活动时间和路线。

## 备选方案

1. LLM 直接生成完整日程：拒绝，无法保证不变量和来源。
2. 第一阶段使用复杂整数规划：延期，工程和解释成本高于当前最小闭环需要。
3. 在 React 组件中逐步排程：拒绝，无法复用和属性测试。

## 后果

- 第一阶段算法可能不追求数学全局最优，但必须稳定、可解释。
- 无法满足的强约束会形成显式冲突，而不是被静默删除。
- Provider 新数据必须形成新的 Planner 输入版本或 replan suggestion。

## 回滚

Planner 包可以独立移除，不影响 Legacy Qingdao 页面；Global Web 在 Planner 不可用时只展示示例数据并明确不可规划。
