# ADR-0002：领域坐标统一使用 WGS84

- 状态：Accepted
- 日期：2026-07-28

## 背景

旧系统同时使用 Leaflet/OSM 和高德。高德展示需要 GCJ-02，但全球数据、GPS、OSM 和多数开放数据使用 WGS84。

## 决定

- Place、POI、TravelLeg geometry 和 MapRenderModel 的 canonical 坐标全部为 WGS84。
- GCJ-02 转换只能出现在 AMap Provider/MapAdapter 边界。
- Provider 返回其他坐标系时必须在 mapper 内转换并记录来源坐标系。
- 不允许将转换结果写回 domain catalog。

## 备选方案

1. 中国数据存 GCJ-02、海外存 WGS84：拒绝，会污染领域模型并导致跨境计算错误。
2. 所有坐标存两套：拒绝，容易漂移；只有观察值确需保留时才记录原始坐标元数据。

## 后果

- Leaflet 可直接渲染领域坐标。
- AMap adapter 需要经过单元测试的转换函数。
- 路径距离和 bbox 计算统一。
- AMap 未启用时不影响全球核心。

## 回滚

不需要数据回滚；Legacy 系统继续使用原实现，新核心可以禁用 AMap adapter。
