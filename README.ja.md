# React + TypeScript + Vite

このテンプレートは、Vite 上で React を動作させるために必要最小限のセットアップを提供し、HMR といくつかの ESLint ルールがすぐに使えます。

現在、利用できる公式プラグインは次の 2 つです。

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) は [Babel](https://babeljs.io/)（[rolldown-vite](https://vite.dev/guide/rolldown) で使用する場合は [oxc](https://oxc.rs)）を使って Fast Refresh に対応します。
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) は [SWC](https://swc.rs/) を使って Fast Refresh に対応します。

## React コンパイラ

パフォーマンス（開発時とビルド時の両方）への影響があるため、このテンプレートでは React コンパイラを有効化していません。導入方法は [こちらのドキュメント](https://react.dev/learn/react-compiler/installation) を参照してください。

## ESLint 設定の拡張

プロダクション用途のアプリケーションを開発する場合は、型を考慮した lint ルールを有効化するよう設定を更新することをおすすめします。

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // 他の設定...

      // tseslint.configs.recommended を削除し、以下に置き換える
      tseslint.configs.recommendedTypeChecked,
      // さらに厳しいルールが必要な場合はこちら
      tseslint.configs.strictTypeChecked,
      // スタイル面のルールを追加したい場合はこちら
      tseslint.configs.stylisticTypeChecked,

      // 他の設定...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // その他のオプション...
    },
  },
])
```

また、React 固有のルールを提供する [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) と [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) を導入することもできます。

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // 他の設定...
      // React 用の lint ルールを有効化
      reactX.configs['recommended-typescript'],
      // React DOM 用の lint ルールを有効化
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // その他のオプション...
    },
  },
])
```
