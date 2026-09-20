import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // 判定逻辑均为纯函数测试，默认 node 环境；需要 DOM 的用例可在文件头加
    // `// @vitest-environment jsdom` 单独声明
    environment: 'node',
  },
});
