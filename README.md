# AI 英语口语陪练

React 18 + TypeScript + Tailwind CSS + Shadcn UI 风格组件实现的英语口语练习工具。支持场景对话、MiniMax 大模型追问、语音输入、稳定分片转写、用户录音回放、发音/流利度/语法/表达评分、纠错改写、课后总结、历史练习、收藏、错题本、文本和 PDF 导出。

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

## 稳定转写配置

浏览器内置 Web Speech API 在部分网络环境下会频繁返回 `network`，实时转写不稳定。新版增加了同源转写接口：

- `GET /api/transcribe/health`：检查云端 ASR 是否已配置。
- `POST /api/transcribe`：接收浏览器录音片段并转写。

启用方式：

```powershell
copy .env.example .env
```

然后在 `.env` 中填写：

```text
OPENAI_API_KEY=你的_API_Key
OPENAI_TRANSCRIBE_MODEL=whisper-1
```

重新启动：

```powershell
npm.cmd run dev
```

应用左侧「语音设置」里的「转写模式」建议保持「自动选择」。自动模式会优先使用稳定云端分片转写；没有配置 `OPENAI_API_KEY` 时，才退回浏览器实时转写或录音回放模式。

## MiniMax 大模型配置

MiniMax 用于生成更自然的 AI 追问和表达建议。API Key 只放在本地 `.env`，不要提交到 GitHub。

```text
MINIMAX_API_KEY=你的_MiniMax_API_Key
MINIMAX_CHAT_MODEL=MiniMax-M3
```

本地开发服务会提供：

- `GET /api/coach-turn/health`：检查 MiniMax 是否已配置。
- `POST /api/coach-turn`：把用户回答、场景、历史上下文和本地评分发送给 MiniMax，生成下一轮英文追问和中文表达建议。

如果没有配置 `MINIMAX_API_KEY`，应用会自动回退到本地追问逻辑。

## 麦克风与转写说明

语音链路会先调用 `navigator.mediaDevices.getUserMedia` 请求麦克风权限并启动 `MediaRecorder`。这样即使浏览器实时转写不可用，仍可录制并回放用户自己的语音。

转写优先级：

1. 稳定云端分片转写：每 5 秒上传一个音频片段到本地 `/api/transcribe`，由服务端调用 ASR。
2. 浏览器实时转写：仅作为兜底，依赖 Chrome / Edge 的 Web Speech API。
3. 录音回放模式：当云端未配置、浏览器转写不可用或网络不稳定时，保留录音并允许用户手动输入文本继续评分。

如果没有拿到任何转写文本，应用也不会卡住：系统会自动记录本轮语音回答，保留录音回放，并直接进入下一轮对话。文本评分和语法纠错会在有转写文本时启用。

## 已实现功能

- 三栏式工作台：左侧设置区 20%、中间对话区 55%、右侧反馈区 25%。
- 现代 AIGC 教育产品风格：天蓝主色、薄荷绿成功态、深灰蓝文字、8px 圆角、柔和分层阴影。
- 顶部导航栏：产品 logo、用户头像、设置入口。
- 场景选择：面试、点餐、会议、旅行，带 Lucide 线性图标。
- 语音设置：美式 / 英式 / 澳式口音、语音选择、0.5x 到 2x 语速调节、转写模式选择。
- 实时语音：麦克风权限诊断、动态波形、稳定分片转写、录音回放、错误 Toast。
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
- `src/lib/aiCoach.ts`：MiniMax 大模型追问接口封装。
- `src/hooks/useSpeechInput.ts`：麦克风、录音、分片转写、浏览器转写兜底和错误诊断。
- `src/hooks/useSpeechSynthesis.ts`：AI 朗读、口音和语速控制。
- `vite.config.ts`：Vite 配置及本地 `/api/transcribe` 转写接口。
- `src/lib/analysis.ts`：评分、纠错、总结生成。
- `src/lib/scenarios.ts`：训练场景与高频表达。
- `src/lib/storage.ts`：历史、收藏、错题本本地存储。
- `src/components/ui/*`：Shadcn 风格基础组件。
- `src/components/Charts.tsx`：雷达图和趋势图。
