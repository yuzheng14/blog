# typescript 语言服务器插件

你可能会好奇为什么装了 [`Vue - Official`](https://marketplace.visualstudio.com/items?itemName=Vue.volar) 插件后 typescript 就能够找到 `.vue` 文件的类型声明了。这背后就是 typescript 语言服务器插件在起作用。

## 工作原理

typescript 语言服务器插件基于装饰器模式实现，其核心原理是通过包装原始的 [`LanguageService`](https://github.com/microsoft/TypeScript/blob/main/src/services/types.ts) 实例来扩展功能。具体机制包括：

1. **代理模式** - 插件接收原始 LanguageService 实例，返回一个增强后的代理实例
2. **方法拦截** - 可以拦截和修改语言服务的各种操作
3. **功能扩展** - 在原有功能基础上添加新的行为

通过这种机制，插件可以实现以下功能：

- 支持新的文件扩展名和特殊语法
- 为特定领域语言提供类型信息
- 增强智能提示、定义跳转等编辑器特性

需要注意的是，语言服务插件有以下限制：

- 不能添加新的自定义语法到 typescript
- 不能改变编译器如何生成 JavaScript
- 不能自定义类型系统来改变 `tsc` 运行时的错误判断

typescript 从 2.2 版本开始支持这种插件架构。

## 开发自定义插件

下面详细介绍开发 typescript 语言服务插件的完整流程：

### 初始化插件

插件需要导出一个工厂函数，接收 typescript 模块：

```typescript
import ts from 'typescript/lib/tsserverlibrary'

export default function init(modules: { typescript: typeof ts }) {
  const ts = modules.typescript
  /* 后续逻辑... */
}
```

### 创建装饰器

使用装饰器模式包装原始 LanguageService：

```typescript
import ts from 'typescript/lib/tsserverlibrary'

export default function init(modules: { typescript: typeof ts }) {
  const ts = modules.typescript

  // [!code ++]
  function create(info: ts.server.PluginCreateInfo) {
    // 创建代理对象 // [!code ++]
    const proxy: ts.LanguageService = Object.create(null) // [!code ++]
    // [!code ++]
    // 复制原始语言服务所有方法 // [!code ++]
    // [!code ++]
    for (let k of Object.keys(info.languageService) as Array<
      keyof ts.LanguageService // [!code ++]
      // [!code ++]
    >) {
      const x = info.languageService[k]! // [!code ++]
      // @ts-expect-error - 因为动态代理方法签名，TypeScript 无法静态推断出正确类型 // [!code ++]
      proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args) // [!code ++]
    } // [!code ++]
    return proxy // [!code ++]
  } // [!code ++]
  return { create } // [!code ++]
}
```

### 添加自定义逻辑

示例：修改补全列表：

```typescript
import ts from 'typescript/lib/tsserverlibrary'

export default function init(modules: { typescript: typeof ts }) {
  const ts = modules.typescript
  function create(info: ts.server.PluginCreateInfo) {
    // 创建代理对象
    const proxy: ts.LanguageService = Object.create(null)

    // 复制原始语言服务所有方法
    for (let k of Object.keys(info.languageService) as Array<
      keyof ts.LanguageService
    >) {
      const x = info.languageService[k]!

      // @ts-expect-error - js 运行时 tricks，ts 无法推断出正确类型
      proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args)
    }
    // [!code ++]
    proxy.getCompletionsAtPosition = (fileName, position, options) => {
      // [!code ++]
      const prior = info.languageService.getCompletionsAtPosition(
        fileName, // [!code ++]
        position, // [!code ++]
        options, // [!code ++]
      ) // [!code ++]
      if (!prior) return // [!code ++]
      // [!code ++]
      // 过滤掉特定补全项 // [!code ++]
      prior.entries = prior.entries.filter((e) => e.name !== 'caller') // [!code ++]
      return prior // [!code ++]
    } // [!code ++]
    return proxy
  }
  return { create }
}
```

### 处理用户配置

通过 `info.config` 获取用户配置：

```typescript
import ts from 'typescript/lib/tsserverlibrary'

export default function init(modules: { typescript: typeof ts }) {
  const ts = modules.typescript
  function create(info: ts.server.PluginCreateInfo) {
    const whatToBan: string[] = info.config.bannedNames || ['caller'] // [!code ++]
    // 创建代理对象
    const proxy: ts.LanguageService = Object.create(null)

    // 复制原始语言服务所有方法
    for (let k of Object.keys(info.languageService) as Array<
      keyof ts.LanguageService
    >) {
      const x = info.languageService[k]!

      // @ts-expect-error - js 运行时 tricks，ts 无法推断出正确类型
      proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args)
    }
    proxy.getCompletionsAtPosition = (fileName, position, options) => {
      const prior = info.languageService.getCompletionsAtPosition(
        fileName,
        position,
        options,
      )
      if (!prior) return prior
      // [!code ++]
      prior.entries = prior.entries.filter((e) => !whatToBan.includes(e.name))
      return prior
    }

    return proxy
  }

  return { create }
}
```

`tsconfig.json` 配置示例：

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "your-plugin",
        "bannedNames": ["caller", "callee"]
      }
    ]
  }
}
```

### 设置日志记录

1. 首先需要设置环境变量启用日志：

```bash
export TSS_LOG="-logToFile true -file /path/to/log.txt -level verbose"
```

2. 在代码中使用日志服务记录信息：

```typescript
info.project.projectService.logger.info('插件初始化完成')

// 记录调试信息
info.project.projectService.logger.msg('调试信息', 'verbose')
```

确保日志文件目录存在且有写入权限。

### 打包

由于 tsserver 需要 CommonJS 格式的代码，我们需要一个将写好的代码进行打包。这里使用 tsdown 进行打包：

1. 安装 tsdown：

```bash
bun add -D tsdown
```

2. 配置 tsdown

```typescript
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./index.ts'],
  format: 'cjs',
})
```

3. 配置打包命令（package.json）：

```json
{
  "scripts": {
    "build": "tsdown"
  }
}
```

4. 配置入口

```json
{
  "main": "dist/index.js"
}
```

> 注意：tsserver 目前使用 CommonJS 模块解析机制，不支持 package.json 中的 `exports` 字段

3. 运行打包：

```bash
bun run -b build
```

> 注意：必须使用 CommonJS 格式，不能直接使用现代 ES 模块语法

### 发布为 npm 包

确保：

- 主入口指向编译后的 JS 文件
- 包含 typescript 为 peerDependency
- 测试时可以使用 `npm link` 本地链接
