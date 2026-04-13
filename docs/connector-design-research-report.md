# Agent Connector 设计调研报告

> 调研日期：2026-04-13
> 调研范围：Claude (Anthropic)、ChatGPT (OpenAI)、Coze (ByteDance)、Cursor、Dify
> 核心关注：Connector 的添加/删除、会话级启用/禁用、权限管控

---

## 目录

1. [调研总览](#1-调研总览)
2. [Claude Connectors（Anthropic）](#2-claude-connectorsanthopic) ⭐ 重点参考
3. [ChatGPT Apps（OpenAI）](#3-chatgpt-appsopenai)
4. [Coze Plugins（ByteDance）](#4-coze-pluginsbytedance)
5. [Cursor MCP](#5-cursor-mcp)
6. [Dify Tools](#6-dify-tools)
7. [横向对比总结](#7-横向对比总结)
8. [对我们产品的设计建议](#8-对我们产品的设计建议)

---

## 1. 调研总览

| 平台 | 术语 | 添加方式 | 删除方式 | 会话级控制 | 权限管控 | 协议 |
|------|------|---------|---------|-----------|---------|------|
| **Claude** | Connector | Directory 浏览 + OAuth 连接 | Settings 断开 | ✅ Toggle per conversation | 工具级 Allow/Approval/Block | Remote MCP |
| **ChatGPT** | App (原 Connector) | App Directory + Connect | Settings 断开 / Admin Disable | ✅ @mention / + 菜单 | Admin RBAC + Action Control | MCP / OpenAPI |
| **Coze** | Plugin | Plugin Store 添加 / 自建 | 编辑页移除 | ❌ Agent 级（非会话级） | Creator/Admin 权限 | API / IDE |
| **Cursor** | MCP Server | JSON 配置文件 | 编辑配置文件删除 | ❌ 全局可用 | 无 | MCP (stdio/SSE) |
| **Dify** | Tool / Plugin | Marketplace 安装 / 自建 | 卸载 | ❌ Workflow 级 | Workspace 级 | OpenAPI / Plugin |

---

## 2. Claude Connectors（Anthropic）⭐ 重点参考

### 2.1 概述

Claude 的 Connector 系统是目前市面上**最成熟的 Agent-Connector 集成方案**。它基于 MCP（Model Context Protocol）标准，支持 100+ 第三方远程 MCP 服务器，覆盖 Slack、Linear、Notion、Google Drive、Salesforce 等主流工具。

### 2.2 添加 Connector

**路径一：从聊天界面添加**
1. 点击聊天输入框左下角的 **"+"** 按钮（或键入 `/`）
2. 悬停到 **"Connectors"**
3. 点击 **"Manage connectors"**
4. 点击 Connectors 旁的 **"+"** 按钮
5. 弹出 Connector 目录弹窗，可按分类浏览或搜索

**路径二：从设置页添加**
1. 导航到 **Customize > Connectors** (`claude.ai/customize/connectors`)
2. 点击 Connectors 旁的 **"+"**
3. 浏览目录，选择想要的 connector，点击 **"Connect"**
4. 完成 OAuth 授权流程

**截图参考（用户提供的 Claude Cowork 截图）：**

> 📸 如下图所示，这是 Claude 的 "Add connectors" 弹窗界面。用户可以看到搜索框和一个 connector 卡片网格布局，每个卡片展示：
> - 服务 Logo（左侧图标）
> - 服务名称（如 Slack、Linear、Asana...）
> - "Connect" 操作按钮（右侧）
>
> 布局为两列网格，每行两个卡片，视觉上清晰简洁。

```
┌─────────────────────────────────────────┐
│  Add connectors                      ✕  │
│  ┌─────────────────────────────────┐    │
│  │ 🔍 Search connectors...        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────┐ ┌────────────────┐ │
│  │ # Slack  Connect│ │ ◆ Linear  Conn │ │
│  └─────────────────┘ └────────────────┘ │
│  ┌─────────────────┐ ┌────────────────┐ │
│  │ ● Asana  Connect│ │ ▪ monday  Conn │ │
│  └─────────────────┘ └────────────────┘ │
│  ┌─────────────────┐ ┌────────────────┐ │
│  │ ▲ Jira   Connect│ │ N Notion  Conn │ │
│  └─────────────────┘ └────────────────┘ │
│  ┌─────────────────┐ ┌────────────────┐ │
│  │ ◉ Amplitude Conn│ │ ▶ Pendo   Conn │ │
│  └─────────────────┘ └────────────────┘ │
│  ┌─────────────────┐ ┌────────────────┐ │
│  │ F Fireflies Conn│ │ ☁ Salesforce C │ │
│  └─────────────────┘ └────────────────┘ │
└─────────────────────────────────────────┘
```

**Custom Connector（自定义 MCP 连接）：**
1. Customize > Connectors 页点击 "+"
2. 选择 "Add custom connector"
3. 输入 MCP Server URL
4. （可选）配置 OAuth Client ID / Secret
5. 点击 "Add"

### 2.3 删除/断开 Connector

1. 导航到 **Customize > Connectors**
2. 找到要删除的 connector
3. 点击 **"Remove"** 或三点菜单 **"..."** > Remove
4. 确认断开

> 💡 **设计亮点**：删除操作不是"删除"而是"断开连接"（Disconnect），语义更准确，降低用户心理压力。

### 2.4 会话级启用/禁用（核心差异化设计）⭐⭐⭐

这是 Claude 最独特且最值得借鉴的设计：

1. 在聊天界面点击左下角 **"+"** 按钮
2. 悬停到 **"Connectors"** 展开子菜单
3. 看到已连接的所有 connector，每个旁边有 **Toggle 开关**
4. 用户可以**逐个开启/关闭**特定 connector
5. 该设置**仅影响当前会话**，不影响全局

```
┌────────────────────────┐
│  + │ Connectors    ▶   │
│    │ ┌────────────────┐ │
│    │ │ Slack     [✓]  │ │
│    │ │ Linear    [✓]  │ │
│    │ │ Notion    [ ]  │ │  ← 本轮关闭 Notion
│    │ │ Asana     [✓]  │ │
│    │ │ ──────────────  │ │
│    │ │ Tool access ▶  │ │
│    │ │ Manage connectors│ │
│    │ └────────────────┘ │
│    │                    │
└────────────────────────┘
```

**Tool Access 模式（当 connector 数量多时）：**

Claude 提供三种 Tool Access 模式：
- **Auto**（默认）：Claude 自动决定何时使用哪些 connector
- **On demand**：仅在用户明确提及时才加载 connector 工具描述（10+ connector 时推荐）
- **Always on**：所有 connector 始终加载

### 2.5 Team/Enterprise 权限管控

| 层级 | 能力 |
|------|------|
| **Org Owner** | 启用/禁用 connector for 全组织 |
| **Org Owner** | 限制工具权限（Always allow / Needs approval / Blocked） |
| **Org Owner** | 按类型批量管理（如：关闭所有写操作） |
| **Individual User** | 自行认证、会话级 toggle |

**工具权限粒度示例**：
- ✅ Allow：搜索 Linear issues（只读）
- ⚠️ Needs approval：创建 Linear issue（每次需确认）
- 🚫 Blocked：删除 Linear issue

---

## 3. ChatGPT Apps（OpenAI）

### 3.1 概述

OpenAI 在 2025 年底将 "Connectors" 重命名为 **"Apps"**，统一了交互式应用和数据连接器的体验。基于 MCP 和 OpenAPI 两种协议。

### 3.2 添加 App

**路径一：App Directory**
1. 前往 **Settings → Apps** 或 `chatgpt.com/apps`
2. 浏览 App Directory，按类别筛选
3. 点击感兴趣的 App，查看详情
4. 点击 **"Connect"**
5. 完成 OAuth 授权

**路径二：在聊天中使用**
- 使用 **@mention** 语法直接引用 App
- 点击 **"+" → "More"** 选择要添加的 App

```
┌──────────────────────────────────────┐
│  App Directory                       │
│  ┌──────────┐ ┌──────────┐ ┌──────┐ │
│  │ Lifestyle│ │Productiv.│ │  All │ │
│  └──────────┘ └──────────┘ └──────┘ │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ 🔍 Search apps...            │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌───────────┐  ┌───────────┐        │
│  │ Slack     │  │ Notion    │        │
│  │ [Connect] │  │ [Connect] │        │
│  └───────────┘  └───────────┘        │
│  ┌───────────┐  ┌───────────┐        │
│  │ Canva     │  │ Figma     │        │
│  │ [Connect] │  │ [Connect] │        │
│  └───────────┘  └───────────┘        │
└──────────────────────────────────────┘
```

### 3.3 删除/管理 App

- **个人用户**：Settings → Apps → 选择 App → **Disconnect**
- **Workspace Admin**：Workspace Settings → Apps → Enabled tab → **"..." → Disable**
- **Enterprise Admin**：
  - Directory tab 中 Enable/Disable
  - 配置 Action Control（限制特定操作）
  - 配置 Domain 限制（限制可连接的账号域名）
  - 配置 RBAC（按用户组控制访问）

### 3.4 会话级控制

ChatGPT 的会话级控制不如 Claude 直观：
- 没有显式的 per-conversation toggle
- 通过 **@mention** 来显式调用特定 App
- 如果不 @mention，model 会自动判断是否使用已启用的 App
- Admin 可以在 workspace 级别配置 parameter constraints 来限制 action 参数

### 3.5 特色功能

| 功能 | 说明 |
|------|------|
| **Interactive Apps** | 在聊天中嵌入交互式 UI（地图、看板、设计工具） |
| **Sync** | 预同步内容到知识库，提升响应速度 |
| **Deep Research** | App 可与 Deep Research 模式联动，自动跨源调研 |
| **Action Control** | Enterprise admin 可精细控制每个 action 的参数约束 |
| **App SDK** | 开发者可用 App SDK 构建和发布自定义 App |

### 3.6 权限管控

| Plan | Interactive | Search | Deep Research | Sync | Write | Custom (MCP) |
|------|:-----------:|:------:|:------------:|:----:|:-----:|:------------:|
| Free | ✔ | ✔* | ✔* | - | ✔ | - |
| Plus | ✔ | ✔ | ✔ | - | ✔ | ✔ |
| Pro | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Business | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Enterprise | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

---

## 4. Coze Plugins（ByteDance）

### 4.1 概述

Coze 采用 **Plugin** 体系，每个 Plugin 包含多个 **Tool**（即独立 API）。Plugin 在 Agent 编辑页配置，属于 Agent 级别的绑定，而非会话级。

### 4.2 添加 Plugin

**方式一：手动添加**
1. 进入 Agent 的 **Develop 页面**
2. 找到 **Plugins** 功能区
3. 点击 **"+"** 图标
4. 在 "Add Plugin" 页面展开目标 Plugin 查看其 Tools
5. 点击 **"Add"** 添加

**方式二：AI 推荐添加**
1. 点击 Plugin 区的 **AI 图标**
2. 让大模型根据 Agent 描述**自动推荐**合适的 Plugin
3. 确认后添加

```
┌──────────────────────────────────────┐
│  Agent: 市场分析助手                    │
│  ┌──────────────────────────────┐    │
│  │ Plugins                  [+] │    │
│  │ ┌────────────┐ ┌──────────┐  │    │
│  │ │ News Search│ │ Translate│  │    │
│  │ └────────────┘ └──────────┘  │    │
│  │ ┌──────────────┐             │    │
│  │ │ Image Analyze │             │    │
│  │ └──────────────┘             │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Prompt                       │    │
│  │ ...                          │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

**方式三：自建 Plugin**
- 导入已有 API（OpenAPI/Swagger）
- 使用 Coze IDE 编写代码
- 导入 JSON/YAML 文件
- 使用 Code Parser

### 4.3 删除 Plugin

- 在 Agent Develop 页面，直接从 Plugin 列表中移除
- Plugin 的创建者可编辑/删除自己的 Plugin
- Team Owner/Admin 可管理团队内所有 Plugin

### 4.4 会话级控制

**Coze 没有会话级的 Connector 控制**。Plugin 绑定在 Agent 上，用户使用 Agent 时自动获得 Agent 配置的所有 Plugin 能力。

### 4.5 主要限制

- 每个 Workspace 最多 1,000 个 Plugin
- 每个 Plugin 最多 100 个 Tool
- 每个账号最多 30 个 IDE Plugin
- 依赖包总大小上限 250 MB

---

## 5. Cursor MCP

### 5.1 概述

Cursor 作为 AI 代码编辑器，通过 **MCP Server** 配置来集成外部工具，但其设计面向开发者，采用纯配置文件方式。

### 5.2 添加 MCP Server

通过编辑 JSON 配置文件 (`~/.cursor/mcp.json` 或项目级 `.cursor/mcp.json`)：

```json
{
  "mcpServers": {
    "linear": {
      "url": "https://mcp.linear.app/mcp"
    },
    "notion": {
      "url": "https://mcp.notion.com/mcp"
    },
    "custom-server": {
      "command": "node",
      "args": ["./my-mcp-server.js"]
    }
  }
}
```

### 5.3 删除 MCP Server

直接编辑配置文件，删除对应的 server 条目。

### 5.4 会话级控制

**Cursor 没有会话级控制**。所有配置的 MCP Server 全局可用，Agent 根据上下文自动决定是否调用。

### 5.5 特点

| 特点 | 说明 |
|------|------|
| 配置即生效 | 无需 UI 交互，编辑 JSON 即可 |
| 两级作用域 | Global (`~/.cursor/`) 和 Project (`.cursor/`) |
| Stdio + SSE | 支持本地进程和远程 HTTP 两种传输 |
| 无 OAuth UI | 需要用户手动处理认证 token |

---

## 6. Dify Tools

### 6.1 概述

Dify 作为开源 Agent 平台，支持通过 **Plugin Marketplace** 安装工具，也支持自建 Tool 集成。

### 6.2 添加 Tool

1. 从 **Plugin Marketplace** 搜索并安装
2. 在 Agent/Workflow 编辑界面添加 Tool 节点
3. 配置 Tool 所需的 API Key 等认证信息
4. 或通过 OpenAPI Schema 自建 Tool

### 6.3 删除 Tool

- 从 Workspace 卸载 Plugin
- 从 Agent/Workflow 中移除 Tool 节点

### 6.4 会话级控制

**Dify 没有会话级控制**。Tool 绑定在 Agent 或 Workflow 的节点上。

---

## 7. 横向对比总结

### 7.1 生命周期管理对比

```
                    Claude          ChatGPT         Coze           Cursor         Dify
                    ──────          ───────         ────           ──────         ────
发现              Directory        App Directory   Plugin Store   文档/GitHub    Marketplace
                    (UI浏览)         (UI浏览)        (UI浏览)       (无UI)         (UI浏览)

安装/连接         OAuth flow       OAuth flow      +按钮添加      JSON配置       API Key
                    (一键Connect)    (一键Connect)   (Agent级)      (手动编辑)     (手动配置)

会话级控制        Toggle开关        @mention        ❌              ❌              ❌
                    ⭐最佳           中等

管理              Settings页       Settings页      Agent编辑页    配置文件       Workspace
                    (Disconnect)     (Disconnect)    (移除)         (删除条目)     (卸载)

权限管控          工具级3档        RBAC+Action     Creator/Admin  无              Workspace级
                    Allow/Approve    Control+Domain
                    /Block          Constraints
```

### 7.2 UX 模式分类

| 模式 | 代表 | 适用场景 | 优劣 |
|------|------|---------|------|
| **Directory + OAuth + Per-Conversation Toggle** | Claude | 面向终端用户的 AI 助手 | ✅ 最灵活 ✅ 隐私可控 ❌ 复杂度高 |
| **App Store + @mention** | ChatGPT | 面向广泛用户的 AI 平台 | ✅ 生态丰富 ✅ 自然交互 ❌ 控制粒度不够 |
| **Plugin Store + Agent-bound** | Coze | 面向 Bot 开发者 | ✅ 简单明确 ❌ 用户无法按会话调整 |
| **Config File** | Cursor | 面向开发者 | ✅ 极简 ❌ 无UI ❌ 无动态控制 |
| **Marketplace + Workflow Node** | Dify | 面向低代码构建 | ✅ 可视化 ✅ 灵活编排 ❌ 非实时 |

### 7.3 关键设计模式提炼

#### 模式 A：「Connect → Toggle → Use」（Claude 模式）
```
全局连接(1次) → 会话级开关(每次对话) → 自动/手动调用
```
- 连接一次，终身可用
- 每次对话可选择性启用
- Tool access 有 Auto/On-demand/Always-on 三档

#### 模式 B：「Install → @Invoke」（ChatGPT 模式）
```
App Store 安装 → 对话中 @mention 调用
```
- 安装即可用
- 通过 @mention 显式控制调用哪个 App
- 省去了 toggle 步骤但失去了明确的 scope 控制

#### 模式 C：「Bind → Auto」（Coze 模式）
```
Agent 编辑时绑定 Plugin → 使用 Agent 时自动可用
```
- Plugin 是 Agent 的能力定义
- 用户不感知 Plugin 的存在
- 适合 Bot 分发场景

---

## 8. 对我们产品的设计建议

### 8.1 推荐采用「Claude 模式 + ChatGPT @mention」混合方案

```
┌──────────────────────────────────────────────────────┐
│                   Connector 生命周期                    │
│                                                      │
│  ① 发现          ② 连接           ③ 会话启用         │
│  Directory       OAuth/API Key    Toggle + @mention  │
│  (搜索+分类)     (一键连接)        (per-conversation)  │
│                                                      │
│  ④ 使用          ⑤ 管理           ⑥ 权限             │
│  Auto+Manual     Settings页       Admin 3档控制      │
│  (AI判断+用户    (断开/重连)       Allow/Approve      │
│   显式指令)                        /Block             │
└──────────────────────────────────────────────────────┘
```

### 8.2 具体 UX 设计建议

#### 1. Connector Directory（发现）

借鉴 Claude 的弹窗设计（如用户截图所示）：
- 顶部搜索框
- 两列卡片网格
- 每张卡片：Logo + 名称 + Connect 按钮
- 支持按类别筛选（项目管理、分析、CRM 等）

#### 2. Connect Flow（连接）

```
点击 Connect → OAuth 弹窗 → 授权 → 连接成功提示 → 自动添加到已连接列表
```

#### 3. Per-Conversation Toggle（会话级控制）⭐ 核心差异化

借鉴 Claude 的 "+ 按钮 → Connectors" 菜单：
- 显示已连接的 connector 列表
- 每个旁边有 toggle 开关
- 默认状态可配置（全开/全关/记住上次）
- 底部有 "Manage connectors" 入口

#### 4. Tool Access Mode（加载策略）

当用户连接 5+ connector 时，提供：
- **Auto**：AI 自动决定
- **On demand**：仅在用户提及时加载
- **Manual**：用户必须显式 toggle

#### 5. Admin 权限控制（Team/Enterprise）

三档权限，参考 Claude 设计：
| 档位 | 含义 | 场景 |
|------|------|------|
| **Always Allow** | 无需确认直接执行 | 只读查询操作 |
| **Needs Approval** | 每次执行前弹窗确认 | 写操作（创建、更新） |
| **Blocked** | 完全禁止 | 删除、批量修改等高危操作 |

### 8.3 P0 实现优先级

| 阶段 | 功能 | 参考 |
|------|------|------|
| **P0** | Connector Directory UI（搜索 + 卡片列表） | Claude Add connectors 弹窗 |
| **P0** | OAuth Connect/Disconnect 流程 | Claude & ChatGPT |
| **P0** | Per-conversation Toggle 开关 | Claude（仅此家有此设计） |
| **P1** | @mention 显式调用 | ChatGPT |
| **P1** | Tool Access Mode 档位 | Claude Auto/On-demand |
| **P2** | Admin 权限管控（3 档） | Claude + ChatGPT |
| **P2** | Custom Connector（MCP URL 输入） | Claude Custom Connector |
| **P3** | Interactive Connector（in-chat UI） | Claude + ChatGPT |

---

## 附录：各平台参考链接

| 平台 | 文档 |
|------|------|
| Claude Connectors | https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities |
| Claude Custom MCP | https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp |
| Claude Remote MCP Servers | https://platform.claude.com/docs/en/docs/agents-and-tools/remote-mcp-servers |
| ChatGPT Apps | https://help.openai.com/en/articles/11487775-apps-in-chatgpt |
| ChatGPT Actions | https://help.openai.com/en/articles/9442513-configuring-actions-in-gpts |
| Coze Plugin | https://www.coze.com/open/docs/guides/plugin |
| Coze Use Plugin | https://www.coze.com/open/docs/guides/use_plugin |
| Cursor MCP | https://cursor.com/docs (MCP section) |
| Dify | https://docs.dify.ai |

---

## 附录：用户提供的截图分析

用户提供的截图是 **Claude Cowork 的 "Add connectors" 弹窗**，展示了以下 10 个 connector：

| # | Connector | 类别 |
|---|-----------|------|
| 1 | Slack | 团队沟通 |
| 2 | Linear | 项目管理 |
| 3 | Asana | 项目管理 |
| 4 | monday.com | 项目管理 |
| 5 | Atlassian (Jira/Confluence) | 项目管理 + 知识库 |
| 6 | Notion | 知识管理 |
| 7 | Amplitude | 数据分析 |
| 8 | Pendo | 产品分析 |
| 9 | Fireflies.ai | 会议记录 |
| 10 | Salesforce | CRM |

**UI 设计特点**：
- 弹窗居中展示，带 X 关闭按钮
- 顶部搜索框，圆角设计
- 两列卡片，等宽均分
- 每张卡片：左侧品牌 Logo + 名称，右侧 "Connect" 文字按钮
- 卡片有浅灰边框，hover 可能有高亮效果
- 整体风格极简、干净，符合 Claude 品牌调性
