# AI 英语口语陪练

React 18 + TypeScript + Tailwind CSS + Shadcn UI 风格组件实现的英语口语练习工具。支持场景对话、实时语音识别、用户录音回放、发音/流利度/语法/表达评分、纠错改写、课后总结、历史练习、收藏、错题本、文本和 PDF 导出。

## 运行

```powershell
npm.cmd install
npm.cmd run dev
```

打开：

```text
http://127.0.0.1:5173
```

Windows PowerShell 如果禁止 `npm.ps1`，请使用 `npm.cmd`。

## 已实现功能

- 三栏式工作台：左侧设置区 20%、中间对话区 55%、右侧反馈区 25%。
- 现代 AIGC 教育产品风格：天蓝主色、薄荷绿成功态、深灰蓝文字、8px 圆角、柔和分层阴影。
- 顶部导航栏：产品 logo、用户头像、设置入口。
- 场景选择：面试、点餐、会议、旅行，带 Lucide 线性图标。
- 语音设置：美式 / 英式 / 澳式口音、语音选择、0.5x 到 2x 语速调节。
- 实时语音：麦克风权限诊断、动态波形、实时转写、录音回放、错误 Toast。
- 文本兜底：Ctrl+Enter 发送，空格键开始 / 停止语音。
- 打字机效果：AI 回复逐字显示。
- 即时反馈：五维评分、分数颜色分段、进度条、雷达图、历史趋势图。
- 纠错改写：删除线标注原表达，绿色标注建议表达，悬停查看原因。
- 高频表达：点击插入、收藏。
- 历史练习：查看、删除、按历史场景重新开始。
- 错题本：自动收集错误表达，支持清空。
- 课后总结：亮点、主要问题、改进建议、重点词汇句型，支持文本导出和浏览器保存 PDF。

## 代码结构

- `src/App.tsx`：主应用与业务编排。
- `src/hooks/useSpeechInput.ts`：麦克风、录音、实时转写和错误诊断。
- `src/hooks/useSpeechSynthesis.ts`：AI 朗读、口音和语速控制。
- `src/lib/analysis.ts`：评分、纠错、总结生成。
- `src/lib/scenarios.ts`：训练场景与高频表达。
- `src/lib/storage.ts`：历史、收藏、错题本本地存储。
- `src/components/ui/*`：Shadcn 风格基础组件。
- `src/components/Charts.tsx`：雷达图和趋势图。
