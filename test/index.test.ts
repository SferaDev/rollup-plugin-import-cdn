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

const bundle = async (code: string, options?: Omit<PluginOptions, "fetchImpl">) => {
    const bundle = await rollup({
        input: "file:///index.js",
        plugins: [
            importCdn({ ...options, fetchImpl: fetch }),
            virtualFs({
                files: {
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

    expect(output).toMatchInlineSnapshot(`
      [
        {
          "code": "const message = \\"Hello world!\\";
      
      console.log(message);
      ",
          "dynamicImports": [],
          "exports": [],
          "facadeModuleId": "file:///index.js",
          "fileName": "index.js",
          "implicitlyLoadedBefore": [],
          "importedBindings": {},
          "imports": [],
          "isDynamicEntry": false,
          "isEntry": true,
          "isImplicitEntry": false,
          "map": null,
          "modules": {
            "file:///index.js": {
              "code": "console.log(message);",
              "originalLength": 71,
              "removedExports": [],
              "renderedExports": [],
              "renderedLength": 21,
            },
            "http://localhost:8080/sub.js": {
              "code": "const message = \\"Hello world!\\";",
              "originalLength": 37,
              "removedExports": [],
              "renderedExports": [
                "message",
              ],
              "renderedLength": 31,
            },
          },
          "name": "index",
          "referencedFiles": [],
          "type": "chunk",
        },
      ]
    `);
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

    expect(output).toMatchInlineSnapshot(`
      [
        {
          "code": "const message = \\"Hello world!\\";
      
      console.log(message);
      ",
          "dynamicImports": [],
          "exports": [],
          "facadeModuleId": "file:///index.js",
          "fileName": "index.js",
          "implicitlyLoadedBefore": [],
          "importedBindings": {},
          "imports": [],
          "isDynamicEntry": false,
          "isEntry": true,
          "isImplicitEntry": false,
          "map": null,
          "modules": {
            "file:///index.js": {
              "code": "console.log(message);",
              "originalLength": 53,
              "removedExports": [],
              "renderedExports": [],
              "renderedLength": 21,
            },
            "http://localhost:8080/sub.js": {
              "code": "const message = \\"Hello world!\\";",
              "originalLength": 37,
              "removedExports": [],
              "renderedExports": [
                "message",
              ],
              "renderedLength": 31,
            },
          },
          "name": "index",
          "referencedFiles": [],
          "type": "chunk",
        },
      ]
    `);
}, 30000);
