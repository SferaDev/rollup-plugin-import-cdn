import { Plugin as RollupPlugin } from "rollup";
import { loadHook } from "./load";
import type { PluginOptions } from "./types";
import { PartialBy } from "./utils";

export function importCdn(pluginOptions: PartialBy<PluginOptions, "fetchImpl"> = {}): RollupPlugin {
    const fetchImpl = typeof fetch !== "undefined" ? fetch : pluginOptions.fetchImpl;
    console.log(fetchImpl);
    if (!fetchImpl) {
        throw new Error(`A fetch implementation is required for plugin-import-cdn to work.`);
    }

    const options = { ...pluginOptions, fetchImpl };

    return {
        name: "plugin-import-cdn",
        async resolveId(key: string) {
            return key;
        },
        async load(key: string) {
            return loadHook(key, options);
        },
    };
}

export * from "./types";
