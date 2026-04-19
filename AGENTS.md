# OpenCode Config Manager - uTools 插件项目

## 项目简介

OpenCode Config Manager Opencode 配置文件可视化管理的插件。

## 当前技术栈（已按仓库现状更新）

### 前端与构建

- Vue `^3.5.13`
- Element Plus `^2.13.6`
- Vite `^6.0.11`
- `@vitejs/plugin-vue` `^5.2.1`
- 包管理及脚本：
  - `npm run dev` -> `vite`
  - `npm run build` -> `vite build`

### 运行与模块体系

- 根 `package.json` 为 `"type": "module"`，前端代码使用 ESM。
- `src/main.js` 通过 `app.use(ElementPlus)` 全量注册 Element Plus。
- `public/preload/package.json` 为 `"type": "commonjs"`，preload 使用 CommonJS（`require`）。

### 类型与开发体验

- 项目在 Vue SFC 中使用 `<script lang="ts" setup>`。
- 使用 `utools-api-types` 提供 API 类型提示。
- 当前仓库未启用独立 `tsc` 构建流程（以 Vite + IDE 类型提示为主）。
- `unplugin-auto-import` 与 `unplugin-vue-components` 已安装，但当前 `vite.config.js` 未启用这两个插件，导入仍以手动显式导入为准。

## uTools 运行模型

- 插件本质是 `Node.js 本地能力 + Web 前端页面`。
- 渲染层仅通过 `window.utools.*` 调官方 API。
- 本地文件系统/路径/Node 能力通过 preload 封装后暴露给 `window.services.*`。
- 当前项目主入口在 `src/App.vue`

## 开发命令

```bash
# 本地开发
npm run dev

# 生产构建（输出 dist/）
npm run build
```

注意：

- uTools 打包时仅打包 `dist/`。
- `public/plugin.json` 中 `development.main` 当前指向 `http://localhost:5173`。
- preload 改动通常不能像前端那样热更新，开发时建议开启“退出到后台立即结束运行”。

## 当前目录结构（关键）

```text
/public
  /plugin.json
  /preload
    /package.json
    /services.js
/src
  /main.js
  /main.css
  /App.vue
/dist
```

## 前端开发规范

### 组件与脚本风格

- Vue 组件优先使用 Composition API + `<script lang="ts" setup>`。
- 变量/函数使用 `camelCase`，常量使用 `UPPER_SNAKE_CASE`。
- 组件文件/目录使用 `PascalCase`。

### API 边界

- 允许：`window.utools.*`
- 允许：`window.services.*`
- 禁止在 Vue 组件中直接使用 `require('node:*')` 或直接依赖 Electron。
- 文件系统、路径、进程、原生调用优先放到 preload 封装。
## 文档基线（uTools 官方）

以下链接为本项目开发时优先参考：

- 快速开始: https://www.u-tools.cn/docs/developer/basic/getting-started.html
- 第一个插件应用: https://www.u-tools.cn/docs/developer/basic/first-plugin.html
- 调试插件应用: https://www.u-tools.cn/docs/developer/basic/debug-plugin.html
- plugin.json 配置: https://www.u-tools.cn/docs/developer/information/plugin-json.html
- preload 预加载脚本: https://www.u-tools.cn/docs/developer/information/preload.html
- API 总览: https://www.u-tools.cn/docs/developer/docs.html
- 事件 API: https://www.u-tools.cn/docs/developer/utools-api/events.html
- 窗口 API: https://www.u-tools.cn/docs/developer/utools-api/window.html
- 系统 API: https://www.u-tools.cn/docs/developer/utools-api/system.html
- 本地数据库 API: https://www.u-tools.cn/docs/developer/utools-api/db.html
- 动态指令 API: https://www.u-tools.cn/docs/developer/api-reference/utools/features.html
- dbStorage: https://www.u-tools.cn/docs/developer/api-reference/db/db-storage.html
- dbCryptoStorage: https://www.u-tools.cn/docs/developer/api-reference/db/db-crypto-storage.html

## 开发默认判断规则

- 能用 `window.utools` 直接实现的能力，优先不新增 preload 接口。
- 需要 Node.js/文件系统/路径处理的能力，放到 preload。
- 仅轻量配置或页面偏好，优先 `dbStorage`。
- 触发后无需停留在插件窗口的能力，优先考虑 `mainHide + hideMainWindowPaste*` 方案。
