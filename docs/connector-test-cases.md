# MCP Connector Test Prompts & Expected Results

> 10 个 Connector 的测试用例设计，Linear / Asana / Notion 为 P0（≥3 条）

---

## 🔴 P0 — Linear

### Test 1: 创建 Issue

**Prompt:**
> 在 Linear 中为 "Frontend" 团队创建一个 Bug 类型的 issue，标题为"登录页面在 Safari 浏览器下样式错乱"，优先级设为 Urgent，指派给 @zhangsan，添加标签 "bug" 和 "ui"。

**Expected Result:**
```json
{
  "action": "create_issue",
  "team": "Frontend",
  "title": "登录页面在 Safari 浏览器下样式错乱",
  "type": "Bug",
  "priority": "Urgent",
  "assignee": "zhangsan",
  "labels": ["bug", "ui"],
  "status": "success",
  "response": {
    "issue_id": "FRO-142",
    "url": "https://linear.app/team/issue/FRO-142"
  }
}
```

### Test 2: 查询 Cycle 进度

**Prompt:**
> 查看 Linear 中 "Backend" 团队当前 cycle 的完成进度，列出所有未完成的 issue 及其负责人。

**Expected Result:**
```json
{
  "action": "get_cycle_progress",
  "team": "Backend",
  "cycle": "current",
  "response": {
    "cycle_name": "Sprint 23",
    "total_issues": 18,
    "completed": 12,
    "in_progress": 4,
    "not_started": 2,
    "completion_rate": "66.7%",
    "incomplete_issues": [
      { "id": "BAK-88", "title": "优化数据库查询性能", "assignee": "lisi", "status": "In Progress" },
      { "id": "BAK-91", "title": "实现 Redis 缓存层", "assignee": "wangwu", "status": "In Progress" },
      { "id": "BAK-93", "title": "API 限流策略调整", "assignee": "lisi", "status": "In Progress" },
      { "id": "BAK-95", "title": "日志聚合服务部署", "assignee": "zhaoliu", "status": "In Progress" },
      { "id": "BAK-97", "title": "单元测试补全", "assignee": "wangwu", "status": "Todo" },
      { "id": "BAK-99", "title": "CI/CD 流水线优化", "assignee": "zhaoliu", "status": "Todo" }
    ]
  }
}
```

### Test 3: 批量更新 Issue 状态

**Prompt:**
> 把 Linear 中标签为 "v2.1-release" 的所有 issue 状态改为 "Done"，并在每个 issue 下添加评论"v2.1 已发布，关闭 issue"。

**Expected Result:**
```json
{
  "action": "batch_update_issues",
  "filter": { "label": "v2.1-release" },
  "updates": {
    "status": "Done",
    "comment": "v2.1 已发布，关闭 issue"
  },
  "response": {
    "matched_issues": 7,
    "updated_issues": 7,
    "failed": 0,
    "updated_ids": ["FRO-120", "FRO-125", "BAK-80", "BAK-82", "BAK-85", "MOB-44", "MOB-47"]
  }
}
```

### Test 4: 搜索并汇总 Issue

**Prompt:**
> 搜索 Linear 中过去 7 天内由我创建的所有 issue，按团队分组汇总数量和状态分布。

**Expected Result:**
```json
{
  "action": "search_and_summarize",
  "filter": { "creator": "me", "created_after": "7d" },
  "response": {
    "total": 9,
    "by_team": {
      "Frontend": { "total": 4, "Todo": 1, "In Progress": 2, "Done": 1 },
      "Backend": { "total": 3, "In Progress": 1, "In Review": 1, "Done": 1 },
      "Mobile": { "total": 2, "Todo": 1, "In Progress": 1 }
    }
  }
}
```

---

## 🔴 P0 — Asana

### Test 1: 创建带子任务的任务

**Prompt:**
> 在 Asana 的 "Q2 产品规划" 项目中创建任务"用户画像系统 V2"，截止日期设为 2026-05-15，指派给 @lisi，添加 3 个子任务：数据采集模块、画像标签体系设计、可视化看板开发。

**Expected Result:**
```json
{
  "action": "create_task_with_subtasks",
  "project": "Q2 产品规划",
  "task": {
    "name": "用户画像系统 V2",
    "due_date": "2026-05-15",
    "assignee": "lisi"
  },
  "subtasks": [
    { "name": "数据采集模块", "status": "created" },
    { "name": "画像标签体系设计", "status": "created" },
    { "name": "可视化看板开发", "status": "created" }
  ],
  "response": {
    "task_gid": "1234567890",
    "task_url": "https://app.asana.com/0/project/1234567890",
    "subtask_count": 3
  }
}
```

### Test 2: 查询项目状态概览

**Prompt:**
> 查看 Asana 中 "App Redesign" 项目各 section 的任务完成情况，包括逾期任务数量。

**Expected Result:**
```json
{
  "action": "get_project_overview",
  "project": "App Redesign",
  "response": {
    "project_name": "App Redesign",
    "sections": [
      { "name": "Backlog", "total": 8, "completed": 0, "overdue": 0 },
      { "name": "In Progress", "total": 5, "completed": 0, "overdue": 2 },
      { "name": "Review", "total": 3, "completed": 0, "overdue": 1 },
      { "name": "Done", "total": 14, "completed": 14, "overdue": 0 }
    ],
    "total_tasks": 30,
    "total_completed": 14,
    "total_overdue": 3,
    "overdue_tasks": [
      { "name": "首页动画优化", "assignee": "wangwu", "due_date": "2026-04-10" },
      { "name": "暗黑模式适配", "assignee": "zhaoliu", "due_date": "2026-04-08" },
      { "name": "设计走查反馈修复", "assignee": "wangwu", "due_date": "2026-04-11" }
    ]
  }
}
```

### Test 3: 移动任务并更新依赖

**Prompt:**
> 在 Asana 中把任务 "API 网关重构" 从 "In Progress" 移到 "Review" section，并设置其为 "前端联调" 任务的前置依赖。

**Expected Result:**
```json
{
  "action": "move_task_and_set_dependency",
  "task": "API 网关重构",
  "move": {
    "from_section": "In Progress",
    "to_section": "Review"
  },
  "dependency": {
    "dependent_task": "前端联调",
    "dependency_type": "blocked_by",
    "blocking_task": "API 网关重构"
  },
  "response": {
    "task_moved": true,
    "dependency_set": true,
    "task_url": "https://app.asana.com/0/project/1234567891"
  }
}
```

### Test 4: 按人汇总本周工作量

**Prompt:**
> 汇总 Asana 中 "Engineering" 团队所有成员本周被分配的任务数量，按截止日期排序列出每人的任务列表。

**Expected Result:**
```json
{
  "action": "summarize_workload",
  "team": "Engineering",
  "time_range": "this_week",
  "response": {
    "members": [
      {
        "name": "lisi",
        "task_count": 5,
        "tasks": [
          { "name": "数据库迁移脚本", "due": "2026-04-14", "status": "In Progress" },
          { "name": "接口文档更新", "due": "2026-04-15", "status": "Not Started" },
          { "name": "性能压测", "due": "2026-04-16", "status": "Not Started" },
          { "name": "Code Review - Auth模块", "due": "2026-04-17", "status": "Not Started" },
          { "name": "周报整理", "due": "2026-04-18", "status": "Not Started" }
        ]
      },
      {
        "name": "wangwu",
        "task_count": 3,
        "tasks": [
          { "name": "首页动画优化", "due": "2026-04-14", "status": "In Progress" },
          { "name": "组件库升级", "due": "2026-04-16", "status": "Not Started" },
          { "name": "E2E测试补全", "due": "2026-04-18", "status": "Not Started" }
        ]
      }
    ]
  }
}
```

---

## 🔴 P0 — Notion

### Test 1: 创建页面并填充内容

**Prompt:**
> 在 Notion 的 "技术文档" 空间下创建一个新页面，标题为"MCP Connector 接入指南"，包含以下内容结构：概述、认证方式、API 列表（表格）、错误码说明、FAQ。

**Expected Result:**
```json
{
  "action": "create_page",
  "parent": "技术文档",
  "title": "MCP Connector 接入指南",
  "content_blocks": [
    { "type": "heading_2", "text": "概述" },
    { "type": "paragraph", "text": "" },
    { "type": "heading_2", "text": "认证方式" },
    { "type": "paragraph", "text": "" },
    { "type": "heading_2", "text": "API 列表" },
    { "type": "table", "columns": ["API 名称", "Method", "路径", "说明"] },
    { "type": "heading_2", "text": "错误码说明" },
    { "type": "paragraph", "text": "" },
    { "type": "heading_2", "text": "FAQ" },
    { "type": "paragraph", "text": "" }
  ],
  "response": {
    "page_id": "abc123def456",
    "url": "https://notion.so/MCP-Connector-abc123def456",
    "status": "created"
  }
}
```

### Test 2: 查询数据库并筛选

**Prompt:**
> 查询 Notion 中 "需求池" 数据库，筛选出优先级为 P0 且状态不是"已完成"的所有条目，按创建时间倒序排列。

**Expected Result:**
```json
{
  "action": "query_database",
  "database": "需求池",
  "filter": {
    "and": [
      { "property": "优先级", "select": { "equals": "P0" } },
      { "property": "状态", "select": { "does_not_equal": "已完成" } }
    ]
  },
  "sort": { "property": "创建时间", "direction": "descending" },
  "response": {
    "total_results": 4,
    "results": [
      { "title": "支付流程改造", "优先级": "P0", "状态": "开发中", "负责人": "zhangsan", "创建时间": "2026-04-10" },
      { "title": "用户权限体系重构", "优先级": "P0", "状态": "设计中", "负责人": "lisi", "创建时间": "2026-04-08" },
      { "title": "数据大屏实时化", "优先级": "P0", "状态": "待开发", "负责人": "wangwu", "创建时间": "2026-04-05" },
      { "title": "多语言支持", "优先级": "P0", "状态": "评审中", "负责人": "zhaoliu", "创建时间": "2026-04-02" }
    ]
  }
}
```

### Test 3: 更新数据库条目属性

**Prompt:**
> 把 Notion "需求池" 数据库中标题为"支付流程改造"的条目状态改为"测试中"，并在备注字段追加"后端接口已完成，等待前端联调"。

**Expected Result:**
```json
{
  "action": "update_database_entry",
  "database": "需求池",
  "filter": { "property": "title", "equals": "支付流程改造" },
  "updates": {
    "状态": "测试中",
    "备注": { "append": "后端接口已完成，等待前端联调" }
  },
  "response": {
    "page_id": "xyz789",
    "updated_properties": ["状态", "备注"],
    "url": "https://notion.so/xyz789",
    "status": "success"
  }
}
```

### Test 4: 搜索并汇总跨页面内容

**Prompt:**
> 搜索 Notion 中所有包含 "MCP" 关键字的页面，列出页面标题、所在空间和最后编辑时间。

**Expected Result:**
```json
{
  "action": "search_pages",
  "query": "MCP",
  "response": {
    "total_results": 5,
    "results": [
      { "title": "MCP Connector 接入指南", "space": "技术文档", "last_edited": "2026-04-13T10:30:00Z" },
      { "title": "MCP 架构设计方案", "space": "架构", "last_edited": "2026-04-11T16:20:00Z" },
      { "title": "MCP SDK 发布计划", "space": "产品规划", "last_edited": "2026-04-09T09:15:00Z" },
      { "title": "MCP 竞品分析", "space": "市场调研", "last_edited": "2026-04-06T14:00:00Z" },
      { "title": "Q2 OKR - MCP 生态建设", "space": "OKR", "last_edited": "2026-04-01T11:00:00Z" }
    ]
  }
}
```

---

## 🟡 P1 — Slack

### Test 1: 发送消息到频道

**Prompt:**
> 在 Slack 的 #engineering 频道发送一条消息："@channel v2.1 已发布到 staging 环境，请各位开始回归测试，预计明天下午发布到 production。"

**Expected Result:**
```json
{
  "action": "send_message",
  "channel": "#engineering",
  "message": "@channel v2.1 已发布到 staging 环境，请各位开始回归测试，预计明天下午发布到 production。",
  "response": {
    "message_ts": "1681382400.000100",
    "channel_id": "C01ABC123",
    "status": "sent"
  }
}
```

### Test 2: 搜索历史消息

**Prompt:**
> 搜索 Slack 中最近 30 天内 #incidents 频道中包含 "P0" 的所有消息，按时间倒序列出。

**Expected Result:**
```json
{
  "action": "search_messages",
  "channel": "#incidents",
  "query": "P0",
  "time_range": "30d",
  "response": {
    "total": 3,
    "messages": [
      { "user": "zhangsan", "text": "P0 告警：支付服务响应超时...", "timestamp": "2026-04-12T08:30:00Z" },
      { "user": "lisi", "text": "P0 事故复盘会议纪要已同步...", "timestamp": "2026-04-05T15:00:00Z" },
      { "user": "wangwu", "text": "P0：数据库主从延迟告警...", "timestamp": "2026-03-28T03:15:00Z" }
    ]
  }
}
```

---

## 🟡 P1 — monday.com

### Test 1: 创建 Item 并设置列值

**Prompt:**
> 在 monday.com 的 "Sprint Board" 中创建一个新 item "推送服务重构"，设置 Status 为 "Working on it"，Priority 为 "High"，Person 指派给 "zhangsan"，Timeline 为 4/14-4/25。

**Expected Result:**
```json
{
  "action": "create_item",
  "board": "Sprint Board",
  "item_name": "推送服务重构",
  "column_values": {
    "status": "Working on it",
    "priority": "High",
    "person": "zhangsan",
    "timeline": { "from": "2026-04-14", "to": "2026-04-25" }
  },
  "response": {
    "item_id": "9876543210",
    "board_url": "https://monday.com/boards/12345/items/9876543210",
    "status": "created"
  }
}
```

### Test 2: 获取看板汇总统计

**Prompt:**
> 获取 monday.com "Sprint Board" 中按 Status 分组的 item 数量统计。

**Expected Result:**
```json
{
  "action": "get_board_summary",
  "board": "Sprint Board",
  "group_by": "status",
  "response": {
    "total_items": 22,
    "groups": {
      "Done": 8,
      "Working on it": 6,
      "Stuck": 3,
      "Not Started": 5
    }
  }
}
```

---

## 🟡 P1 — Atlassian (Jira/Confluence)

### Test 1: 创建 Jira Issue

**Prompt:**
> 在 Jira 项目 "PLAT" 中创建一个 Story，标题为"接入第三方身份认证"，描述为"支持 SAML/OIDC 协议的 SSO 登录"，Sprint 设为当前 Sprint，Story Points 为 8。

**Expected Result:**
```json
{
  "action": "create_jira_issue",
  "project": "PLAT",
  "issue_type": "Story",
  "summary": "接入第三方身份认证",
  "description": "支持 SAML/OIDC 协议的 SSO 登录",
  "sprint": "current",
  "story_points": 8,
  "response": {
    "issue_key": "PLAT-256",
    "url": "https://company.atlassian.net/browse/PLAT-256",
    "status": "created"
  }
}
```

### Test 2: 搜索 Confluence 文档

**Prompt:**
> 搜索 Confluence 空间 "Engineering" 中标题包含"部署"的所有页面，列出标题和最后更新者。

**Expected Result:**
```json
{
  "action": "search_confluence",
  "space": "Engineering",
  "query": "title:部署",
  "response": {
    "total": 3,
    "results": [
      { "title": "生产环境部署手册", "last_updated_by": "zhangsan", "last_updated": "2026-04-10" },
      { "title": "K8s 部署配置指南", "last_updated_by": "lisi", "last_updated": "2026-03-28" },
      { "title": "灰度部署策略", "last_updated_by": "wangwu", "last_updated": "2026-03-15" }
    ]
  }
}
```

---

## 🟢 P2 — Amplitude

### Test 1: 查询事件漏斗

**Prompt:**
> 查询 Amplitude 中过去 7 天 "注册流程" 漏斗的转化率，步骤为：打开注册页 → 填写表单 → 提交注册 → 注册成功。

**Expected Result:**
```json
{
  "action": "query_funnel",
  "funnel_name": "注册流程",
  "time_range": "7d",
  "steps": ["打开注册页", "填写表单", "提交注册", "注册成功"],
  "response": {
    "overall_conversion": "32.5%",
    "steps": [
      { "step": "打开注册页", "users": 10000, "conversion": "100%" },
      { "step": "填写表单", "users": 6500, "conversion": "65.0%" },
      { "step": "提交注册", "users": 4200, "conversion": "64.6%" },
      { "step": "注册成功", "users": 3250, "conversion": "77.4%" }
    ]
  }
}
```

### Test 2: 查询用户分群指标

**Prompt:**
> 查询 Amplitude 中"付费用户"分群过去 30 天的日活趋势（DAU）。

**Expected Result:**
```json
{
  "action": "query_segment_metric",
  "segment": "付费用户",
  "metric": "DAU",
  "time_range": "30d",
  "response": {
    "avg_dau": 4520,
    "max_dau": 5100,
    "min_dau": 3800,
    "trend": "slight_increase",
    "data_points": 30
  }
}
```

---

## 🟢 P2 — Pendo

### Test 1: 查询功能采纳率

**Prompt:**
> 查询 Pendo 中"导出 PDF"功能过去 30 天的使用情况，包括使用人数、使用次数和采纳率。

**Expected Result:**
```json
{
  "action": "query_feature_adoption",
  "feature": "导出 PDF",
  "time_range": "30d",
  "response": {
    "unique_visitors": 1250,
    "total_clicks": 3800,
    "adoption_rate": "28.5%",
    "avg_clicks_per_user": 3.04,
    "trend_vs_last_period": "+12.3%"
  }
}
```

### Test 2: 查看用户引导完成率

**Prompt:**
> 查看 Pendo 中 "新手引导" guide 的完成率和各步骤的跳出率。

**Expected Result:**
```json
{
  "action": "get_guide_analytics",
  "guide": "新手引导",
  "response": {
    "total_views": 5000,
    "completion_rate": "45.2%",
    "steps": [
      { "step": "欢迎页", "views": 5000, "drop_off": "8%" },
      { "step": "创建第一个项目", "views": 4600, "drop_off": "22%" },
      { "step": "邀请团队成员", "views": 3588, "drop_off": "18%" },
      { "step": "完成设置", "views": 2942, "drop_off": "23%" },
      { "step": "引导完成", "views": 2260, "drop_off": "0%" }
    ]
  }
}
```

---

## 🟢 P2 — Fireflies.ai

### Test 1: 搜索会议记录

**Prompt:**
> 搜索 Fireflies.ai 中过去 14 天包含关键字 "技术方案评审" 的会议记录，返回会议标题、参与者和关键决策。

**Expected Result:**
```json
{
  "action": "search_meetings",
  "query": "技术方案评审",
  "time_range": "14d",
  "response": {
    "total": 2,
    "meetings": [
      {
        "title": "MCP 架构技术方案评审",
        "date": "2026-04-11T14:00:00Z",
        "duration_min": 60,
        "participants": ["zhangsan", "lisi", "wangwu"],
        "key_decisions": [
          "采用事件驱动架构",
          "使用 CloudFlare Workers 作为网关层",
          "Q2 内完成 MVP"
        ]
      },
      {
        "title": "支付重构技术方案评审",
        "date": "2026-04-04T10:00:00Z",
        "duration_min": 45,
        "participants": ["lisi", "zhaoliu"],
        "key_decisions": [
          "引入幂等键机制",
          "分阶段灰度上线"
        ]
      }
    ]
  }
}
```

### Test 2: 获取会议待办事项

**Prompt:**
> 获取 Fireflies.ai 中最近一次会议的 action items 列表。

**Expected Result:**
```json
{
  "action": "get_action_items",
  "meeting": "latest",
  "response": {
    "meeting_title": "周一站会",
    "date": "2026-04-13T09:30:00Z",
    "action_items": [
      { "item": "完成 connector SDK 文档", "assignee": "zhangsan", "due": "2026-04-15" },
      { "item": "修复登录超时 bug", "assignee": "lisi", "due": "2026-04-14" },
      { "item": "准备 Q2 规划 PPT", "assignee": "wangwu", "due": "2026-04-17" }
    ]
  }
}
```

---

## 🟢 P2 — Salesforce

### Test 1: 查询客户信息

**Prompt:**
> 查询 Salesforce 中公司名称为"TechCorp"的客户信息，包括联系人、最近的 Opportunity 和合同状态。

**Expected Result:**
```json
{
  "action": "query_account",
  "account_name": "TechCorp",
  "response": {
    "account_id": "001ABC123",
    "industry": "Technology",
    "contacts": [
      { "name": "John Smith", "role": "CTO", "email": "john@techcorp.com" },
      { "name": "Jane Doe", "role": "VP Engineering", "email": "jane@techcorp.com" }
    ],
    "latest_opportunity": {
      "name": "TechCorp Enterprise License",
      "stage": "Negotiation",
      "amount": "$150,000",
      "close_date": "2026-05-01"
    },
    "contract_status": "Active",
    "contract_end_date": "2027-03-31"
  }
}
```

### Test 2: 创建 Opportunity

**Prompt:**
> 在 Salesforce 中为客户 "TechCorp" 创建一个新的 Opportunity，名称为 "TechCorp Platform Expansion"，金额 $80,000，阶段为 "Qualification"，预计关闭日期 2026-06-30。

**Expected Result:**
```json
{
  "action": "create_opportunity",
  "account": "TechCorp",
  "opportunity": {
    "name": "TechCorp Platform Expansion",
    "amount": 80000,
    "stage": "Qualification",
    "close_date": "2026-06-30"
  },
  "response": {
    "opportunity_id": "006XYZ789",
    "url": "https://company.my.salesforce.com/006XYZ789",
    "status": "created"
  }
}
```

---

## 汇总

| Connector | 优先级 | Test Case 数量 | 覆盖操作 |
|-----------|--------|---------------|----------|
| **Linear** | P0 | 4 | 创建 / 查询Cycle / 批量更新 / 搜索汇总 |
| **Asana** | P0 | 4 | 创建带子任务 / 项目概览 / 移动+依赖 / 工作量汇总 |
| **Notion** | P0 | 4 | 创建页面 / 查询数据库 / 更新条目 / 搜索汇总 |
| Slack | P1 | 2 | 发消息 / 搜索历史 |
| monday.com | P1 | 2 | 创建Item / 看板统计 |
| Atlassian | P1 | 2 | Jira创建 / Confluence搜索 |
| Amplitude | P2 | 2 | 漏斗查询 / 分群指标 |
| Pendo | P2 | 2 | 功能采纳率 / 引导完成率 |
| Fireflies.ai | P2 | 2 | 搜索会议 / 获取待办 |
| Salesforce | P2 | 2 | 查询客户 / 创建Opportunity |
| **合计** | — | **26** | — |
