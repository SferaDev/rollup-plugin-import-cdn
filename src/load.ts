import { init, parse } from "es-module-lexer";
import url from "url";
import type { AvailableCDNs, Dependency, PluginOptions } from "./types";

const isUrl = (value: string) => /^(http(s){0,1}:){0,1}\/\//.test(value);

const parseCDN: Record<AvailableCDNs, (key: string) => string> = {
    skypack: (key) => `https://cdn.skypack.dev/${key}`,
    unpkg: (key) => `https://unpkg.com/${key}`,
};

function resolveDependencyUrls(key: string, options: PluginOptions): string[] {
    console.log("Attempt", key);

    if (key.startsWith("/") || key.startsWith("file://") || key.startsWith(".")) return [];

    if (isUrl(key)) return [key];

    return (
        options.priority?.map((cdn) => {
            if (typeof cdn === "string") return parseCDN[cdn](key);

            return cdn(key);
        }) ?? []
    );
}

export async function resolveDependency(name: string, options: PluginOptions): Promise<Dependency | null> {
    const urls = resolveDependencyUrls(name, options);
    if (urls.length === 0) return null;

    for await (const url of urls) {
        try {
            const response = await options.fetchImpl(url);
            const main = await response.text();

            return { name: name, url: response.url, main };
        } catch (error) {
            continue;
        }
    }

    console.warn(`[rollup-plugin-import-cdn] Could not resolve dependency ${name}`);

    return null;
}

export async function loadHook(key: string, options: PluginOptions) {
    const dependency = await resolveDependency(key, options);
    if (!dependency) return;

    await init;

    const [imports] = parse(dependency.main);

    let position = 0;

    return imports
        .map(({ s, e }) => {
            const string = dependency.main.slice(s, e);
            return !isUrl(string) ? { string, start: s, end: e } : undefined;
        })
        .reduce((code, data) => {
            if (!data) return code;

            const resolvedUrl = url.resolve(dependency.url, data.string);

            const s = data.start + position;
            const e = data.end + position;
            const str = resolvedUrl.split("");
            const before = code.slice(0, s);
            const middle = code.slice(s, e);
            const after = code.slice(e);
            const lMiddle = middle.length;
            const lStr = str.length;
            position += lStr - lMiddle;
            return [...before, ...str, ...after];
        }, dependency.main.split(""))
        .join("");
}
