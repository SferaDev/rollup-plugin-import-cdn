# rollup-plugin-import-cdn

Import ESM modules from URL for local use and be processed by rollup, allowing to apply tree-shaking on non-local resources.

Code based from https://github.com/UpperCod/rollup-plugin-import-url

## Install

```
npm install rollup-plugin-import-cdn
```

## Usage

```js
import importCdn from "rollup-plugin-import-cdn";

export default {
    plugins: [importCdn()],
};
```
