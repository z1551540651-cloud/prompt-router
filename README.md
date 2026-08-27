# Prompt Router

一个本地优先的个人提示词快速调用工具，支持 macOS 和 Windows。

## 当前能力

- 内置你提供的 12 个提示词模板；
- 提示词以 Markdown 文件保存，可在应用、Obsidian 或编辑器里修改；
- 全局快捷键 `⌘/Ctrl + Shift + Space` 唤起面板；
- 搜索提示词，预览后复制并尝试粘贴到原输入框；
- 输入普通问题，由本地关键词规则自动推荐提示词；
- 没有可靠匹配时保留候选并要求手动确认，不强行套用；
- 可从设置按钮选择 iCloud、OneDrive 或其他同步目录。

## 运行

```bash
pnpm install
pnpm build
pnpm start
```

首次启动时，程序会把内置模板复制到 Electron 的用户数据目录。点击右上角设置按钮，可以切换到自己的同步目录。

## macOS 权限

为了让程序把结果自动粘贴到之前的输入框，需要在“系统设置 → 隐私与安全性 → 辅助功能”中允许 Prompt Router 控制电脑。如果没有授权，程序仍会把结果放进剪贴板，你可以手动粘贴。

Windows 使用 PowerShell 的键盘模拟完成自动粘贴；遇到管理员权限窗口或特殊输入框时，也会退回剪贴板。

## 修改提示词

每个模板都是一个 Markdown 文件，格式如下：

```markdown
---
id: example
name: 示例提示词
description: 用途说明
useWhen: 适用于什么情况
category: 决策
keywords: [选择, 对比]
variables: [问题, 目标]
---

提示词正文，支持【问题】和 {{目标}} 两种变量写法。
```

保存前应用会生成同名 `.bak` 备份。无法解析的文件不会被覆盖。

## 自动匹配

第一版默认使用本地规则，不会后台读取所有输入，也不会自动向 ChatGPT、Claude 或其他服务发送问题。之后可以增加 OpenAI-compatible 服务作为低置信度时的可选兜底；当前版本没有要求配置 API key。

## 构建安装包

```bash
pnpm dist:mac
pnpm dist:win
```

macOS 签名、公证和 Windows 安装包的最终构建，需要在对应平台配置签名证书后进行。
