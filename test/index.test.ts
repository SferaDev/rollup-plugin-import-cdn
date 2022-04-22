import http, { RequestListener } from "http";
import fetch from "isomorphic-fetch";
import { rollup } from "rollup";
import { virtualFs } from "rollup-plugin-virtual-fs";
import { expect, test } from "vitest";
import { importCdn, PluginOptions } from "../src";
import ts from "typescript";

const buildServer = (callback: RequestListener, port: number): Promise<http.Server> => {
    return new Promise((resolve) => {
        const net = http.createServer(callback);
        net.listen(port, () => resolve(net));
    });
};

const serverResponse: RequestListener = (req, res) => {
    res.setHeader("content-type", "application/javascript");
    res.writeHead(200);
    if (req.url == "/") {
        res.end(`export * from "./sub.js";`);
    } else {
        res.end(`export const message = "Hello world!"`);
    }
};

const bundle = async (
    code: string,
    { extraFiles, ...options }: Omit<PluginOptions, "fetchImpl"> & { extraFiles?: Record<string, string> } = {}
) => {
    const bundle = await rollup({
        input: "file:///index.js",
        plugins: [
            importCdn({ ...options, fetchImpl: fetch }),
            virtualFs({
                files: {
                    ...(extraFiles ?? {}),
                    "/index.js": ts.transpile(code, { target: ts.ScriptTarget.ES2020 }),
                },
            }),
        ],
    });

    const { output } = await bundle.generate({ format: "esm" });
    return output;
};

test("Load from remote url", async () => {
    const server = await buildServer(serverResponse, 8080);
    const output = await bundle(`
        import { message } from "http://localhost:8080";
        console.log(message);
    `);
    server.close();

    expect(output).toMatchSnapshot();
}, 30000);

test("Load from package", async () => {
    const server = await buildServer(serverResponse, 8080);
    const output = await bundle(
        `
            import { message } from "foo";
            console.log(message);
        `,
        { priority: [() => "http://localhost:8080"] }
    );
    server.close();

    expect(output).toMatchSnapshot();
}, 30000);

test("Load from package", async () => {
    const server = await buildServer(serverResponse, 8080);
    const output = await bundle(
        `
            import { message } from "./foo.js";
            console.log(message);
        `,
        {
            priority: [() => "http://localhost:8080"],
            extraFiles: {
                "/foo.js": `
                              export { message } from "foo";
                           `,
            },
        }
    );
    server.close();

    expect(output).toMatchSnapshot();
}, 30000);

test("Load from real package (skypack)", async () => {
    const output = await bundle(
        `
            import { BaseClient } from "@xata.io/client";
            console.log(BaseClient);
        `,
        { priority: ["skypack"] }
    );

    expect(output).toMatchSnapshot();
}, 30000);
