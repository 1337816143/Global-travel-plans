# Planner Pipeline

## 1. 目标

Planner 必须在相同输入、相同数据版本、相同 travel-time matrix 和相同 seed 下生成相同结果。它不调用网络、不访问浏览器、不依赖大语言模型。

## 2. 输入

```ts
interface PlannerInput {
  request: TripRequest;
  catalog: PlanningCatalog;
  travelTimeMatrix: TravelTimeMatrix;
  seed: number;
  plannerVersion: string;
  dataVersion: string;
  clock: PlannerClock;
}
```

`PlannerClock` 由调用方注入，测试不得依赖真实当前时间。

## 3. 阶段

### Stage 1：校验用户输入

- Zod 校验 TripRequest；
- 日期范围或总天数必须二选一且一致；
- 目的地去重；
- mustVisit 与 excluded 不得冲突；
- 锁定活动必须有可解析时间和地点；
- 每日 start/end 必须形成正时间预算；
- 预算和体力约束规范化。

失败：返回结构化 input error，不生成部分计划。

### Stage 2：规范化地点、日期和时区

- 将目的地解析为 Place；
- 确定每段使用的 IANA timezone；
- 生成旅行 local date 序列；
- 跨时区交通使用 instant + origin/destination local display；
- 保留日期边界，不使用字符串截断代替时区转换。

输出：`NormalizedTripContext`。

### Stage 3：解析强约束

分类：

- mustVisit；
- excluded；
- locked activities；
- destination order；
- fixed arrival/departure；
- opening-time windows；
- accommodation check-in/out；
- accessibility/physical constraints。

所有强约束产生 source/path，便于冲突解释。

### Stage 4：构建候选集

- 只选择属于所选目的地、规划单元或明确转场节点的 POI；
- 去除 excluded；
- 合并重复 POI ID；
- 计算兴趣、时长、体力、天气、预约和来源完整度分数；
- 缺少关键数据的 POI 可以保留，但增加 uncertainty penalty。

### Stage 5：获取交通矩阵

Planner 只读取已提供的 `TravelTimeMatrix`：

- `measured`：来自已审核 Provider observation；
- `scheduled`：明确班次/时刻；
- `estimated`：基于距离和模式；
- `unavailable`：不可计算。

直线距离只能用于估算，结果必须标记 `estimated`，不能写成实际路线距离。

### Stage 6：地域与时间窗口聚类

分两步：

1. 地域聚类：同 planning unit、距离矩阵和跨区惩罚；
2. 时间窗口聚类：开放时间、日出/日落、预约、室内外和固定活动。

聚类算法第一阶段采用稳定、可解释的贪心方法，不引入难以验证的黑盒优化器。

### Stage 7：分配目的地天数

最少保证：

- 每个目的地的 arrival/departure 时间；
- PlanningUnit recommendedDays；
- mustVisit 总时长；
- 跨城市转场时间；
- 用户目的地权重；
- 总天数守恒。

输出解释：每个目的地分配天数及主要原因。

### Stage 8：生成每日时间预算

对每个 local date 建立：

- 可用开始/结束；
- arrival/departure 占用；
- 酒店入住/退房；
- 用餐窗口；
- 休息窗口；
- 锁定活动；
- 剩余可排程区间。

### Stage 9：放置锁定活动

- 原时间和日期不得自动改变；
- 冲突时保留锁定活动；
- 对重叠、不可达、闭馆生成 error conflict；
- 不为了生成“看似完整”的计划而删除锁定项。

### Stage 10：安排 mustVisit

排序：

1. 窄时间窗；
2. 预约要求；
3. 用户优先级；
4. 可达性；
5. 稳定 tie-break。

无法放置的 mustVisit 进入 unresolved conflict，并保留在未安排清单。

### Stage 11：填充普通候选活动

在剩余时间预算中按分数和增量旅行成本选择：

```text
utility = interestScore
        + sourceConfidence
        + clusterAffinity
        + weatherSuitability
        - travelCost
        - physicalPenalty
        - uncertaintyPenalty
```

分数仅用于候选排序，不覆盖强约束。

### Stage 12：插入 TravelLeg

相邻 Activity 之间必须有 TravelLeg：

- origin/destination 与相邻活动一致；
- duration 和 distance 带 method；
- 跨城市交通明确保留 buffer；
- unavailable 时仍创建 TravelLeg，占用保守估计或产生冲突；
- 不允许 UI 根据两点直线自行画出“实际路线”。

### Stage 13：插入用餐、休息、入住和退房

- 用餐使用用户窗口；
- 体力较低时增加最短休息；
- 午间炎热约束可以限制高暴露户外活动；
- 入住/退房与住宿日期一致；
- 换酒店增加行李和 check-in 成本。

### Stage 14：住宿区域推荐

第一阶段只输出区域：

```text
area score = weighted daily travel time
           + late return penalty
           + hotel change cost
           + luggage/physical penalty
           + budget fit
           + transport preference fit
```

没有可靠 AccommodationProvider 时，不输出实时酒店价格、评分或库存。

### Stage 15：冲突检查

至少检查：

- overlap；
- day budget exceeded；
- missing TravelLeg；
- TravelLeg endpoint mismatch；
- date out of range；
- timezone/date loss；
- wrong destination POI；
- locked item moved/deleted；
- accommodation date mismatch；
- cross-city buffer insufficient；
- opening hours conflict；
- reservation unresolved；
- unreachable segment；
- stale fact used as current。

### Stage 16：解释与假设

输出：

- destination day allocation reasons；
- activity choice reasons；
- accommodation area reasons；
- estimates and unavailable data；
- provider degradation；
- data freshness summary；
- unresolved conflicts。

解释来自结构化 reason code，不由 LLM 自由发明。

### Stage 17：最终不变量验证

最终 validator 是发布闸门：

- 存在 error violation 时，TripPlan status 为 `conflicted`；
- 不允许把 invalid plan 标记为 complete；
- UI 必须显示冲突；
- 序列化前再次验证。

## 4. 核心不变量

实现必须覆盖用户规定的 15 项不变量，并增加：

16. Activity 和 TravelLeg ID 全局唯一。
17. 每个时间值携带 timezone 或明确为 instant。
18. 所有 estimate 带 estimation method。
19. 所有 DynamicObservation 可追溯到 SourceRef。
20. Planner 结果不包含 Provider secret 或原始响应。

## 5. 属性测试

使用 fast-check 或等价生成器覆盖：

- 空 catalog；
- 单日；
- 0/1/多目的地；
- 超量 mustVisit；
- 多时区与日期线；
- 重复 POI；
- 不可达 matrix；
- 无开放时段；
- Provider 全部 unavailable；
- 极低每日时间预算；
- 锁定活动重叠；
- 拖拽后重规划；
- 多次重规划稳定性；
- 同 seed 重复运行深相等。

属性不是“总能生成无冲突计划”，而是：

- 不发生异常崩溃；
- 不静默违反强约束；
- 冲突可解释；
- 输出总能通过 Schema；
- deterministic。

## 6. 第一阶段算法限制

主动不做：

- 复杂整数规划/遗传算法；
- 实时交通连续优化；
- 自动预订；
- LLM 直接排程；
- 无来源的“最佳路线”。

第一阶段优先选择简单、稳定、可解释并能通过全部不变量的算法。
