'use strict';

import escapeStringRegexp from 'escape-string-regexp';
import { execaCommand } from 'execa';
import path from 'node:path';
import {
    commands,
    DocumentSymbol,
    env,
    EventEmitter,
    Selection,
    SymbolKind,
    TextEditorRevealType,
    Uri,
    window,
    workspace,
} from 'vscode';


const sep = path.sep;
export const cmndName = 'lgc.openFile';
const scheme = `command:${cmndName}`;

export const clearAll = new EventEmitter();

let ws = workspace.workspaceFolders![0].uri.fsPath || '';

export function setWs(uri) {
    ws = workspace.getWorkspaceFolder(uri)?.uri.fsPath;
}

/* Controllers ------------------------------------------------------------------ */
let classmap_fileContents: any;
let cache_store_controller = [];

export function getControllerFilePaths(text) {
    const info = text.replace(/['"]/g, '');
    const list = checkCache(cache_store_controller, info);

    if (!list.length) {
        let controller;
        let method;

        if (info.includes('@')) {
            const arr = info.split('@');
            controller = arr[0];
            method = arr[1];
        } else {
            controller = info;
        }

        for (const path of getKeyLine(controller)) {
            const args = prepareArgs({ path: path, query: method });

            list.push({
                tooltip : path.replace(ws, ''),
                fileUri : Uri.parse(`${scheme}?${args}`),
            });
        }

        if (list.length) {
            saveCache(cache_store_controller, info, list);
        }
    }

    return list;
}

function prepareArgs(args: object) {
    return encodeURIComponent(JSON.stringify([args]));
}


export async function listenToFileChanges(classmap_file, debounce) {
    await runPhpCli(classmap_file);
    await getRoutesInfo();

    const watcher = workspace.createFileSystemWatcher(config.classmap_file);

    watcher.onDidChange(
        debounce(async (e) => {
            await runPhpCli(classmap_file);
            await getRoutesInfo();

            cache_store_route = [];
            cache_store_controller = [];
        }, 500),
    );
}

function getKeyLine(controller) {
    return classmap_fileContents
        ?.filter((item) => item.namespace.startsWith(controller))
        ?.map((item) => item.file);
}


/* Routes ------------------------------------------------------------------- */
export let routes_contents = [];
export let app_url = '';
let cache_store_route = [];

export function getRouteFilePath(text) {
    const cache_key = text.replace(/['"]/g, '');
    const list = checkCache(cache_store_route, cache_key);

    if (!list.length) {
        const info = extractController(cache_key);

        if (!info) {
            return [];
        }

        const { uri: url, action, method: urlType } = info;

        if (action == 'Closure') {
            return [];
        }

        let controller;
        let method;

        if (action.includes('@')) {
            const arr = action.split('@');

            controller = arr[0];
            method = arr[1];
        } else {
            controller = action;
        }

        const path = getKeyLine(controller)[0];

        if (!path) {
            return [];
        }

        const args = prepareArgs({ path: path, query: method });

        // controller
        list.push({
            tooltip : action,
            fileUri : Uri.parse(`${scheme}?${args}`),
        });

        // browser
        if (urlType.includes('GET') && app_url) {
            list.push({
                tooltip : `${app_url}${url}`,
                fileUri : Uri.parse(`${app_url}${url}`),
            });
        }

        saveCache(cache_store_route, cache_key, list);
    }

    return list;
}

let counter = 1;

async function getRoutesInfo() {
    let timer;

    try {
        const { stdout } = await execaCommand(`${config.phpCommand} ${config.routeListCommand}`, {
            cwd   : ws,
            shell : env.shell,
        });

        routes_contents = JSON.parse(stdout);
    } catch (error) {
        // console.error(error)

        if (counter >= 3) {
            return clearTimeout(timer);
        }

        timer = setTimeout(() => {
            counter++;
            getRoutesInfo();
        }, 2000);
    }
}

async function runPhpCli(file: Uri) {
    const fPath = file.path.replace(`${ws}/`, '');

    try {
        const cmnd = `${config.phpCommand} -r 'echo json_encode(include("${fPath}"));'`;
        const { stdout } = await execaCommand(cmnd, {
            cwd   : ws,
            shell : env.shell,
        });

        return classmap_fileContents = Object
            .entries(JSON.parse(stdout))
            .map(([key, value]) => ({
                namespace : key,
                // @ts-ignore
                file      : value.startsWith(ws) ? value : value.replace(new RegExp(`^${config.dockerVolumePath}`, 'm'), ws),
            }));
    } catch (error) {
        // console.error(error);
    }
}

function extractController(routeName) {
    return routes_contents.find((e) => e.name == routeName);
}

export async function saveAppURL() {
    app_url = await window.showInputBox({
        placeHolder : 'project APP_URL',
        value       : await env.clipboard.readText() || '',
        validateInput(v) {
            if (!v) {
                return 'you have to add a name';
            } else {
                return '';
            }
        },
    });

    if (app_url) {
        app_url = app_url.endsWith(sep) ? app_url : `${app_url}${sep}`;
        clearAll.fire(clearAll);
    }
}


/* Scroll ------------------------------------------------------------------- */
export function scrollToText(args = undefined) {
    if (args !== undefined) {
        const { path, query } = args;

        commands.executeCommand('vscode.open', Uri.file(path))
            .then(async () => {
                const editor = window.activeTextEditor;
                const symbolsList: DocumentSymbol[] = await commands.executeCommand('vscode.executeDocumentSymbolProvider', editor.document.uri);
                const range = await getRange(query, symbolsList);

                if (range) {
                    editor.selection = new Selection(range.start, range.end);
                    editor.revealRange(range, TextEditorRevealType.InCenter);
                }

                if (!range && query) {
                    window.showInformationMessage(
                        'Laravel Goto Controller: Copy Method Name To Clipboard',
                        ...['Copy'],
                    ).then((e) => {
                        if (e) {
                            env.clipboard.writeText(query);
                        }
                    });
                }
            });
    }
}

async function getRange(query, symbolsList) {
    let node = symbolsList.find((symbol: DocumentSymbol) => symbol.kind === SymbolKind.Class);

    if (node) {
        node = node.children.find((symbol: DocumentSymbol) => symbol.kind === SymbolKind.Method && symbol.name === query);

        return node.location.range;
    }
}

/* Helpers ------------------------------------------------------------------ */

function checkCache(cache_store, text) {
    const check = cache_store.find((e) => e.key == text);

    return check ? check.val : [];
}

function saveCache(cache_store, text, val) {
    checkCache(cache_store, text).length
        ? false
        : cache_store.push({
            key : text,
            val : val,
        });

    return val;
}

/* Config ------------------------------------------------------------------- */
export const PACKAGE_NAME = 'laravelGotoController';
export let config;
export let ignore_Controllers = '';
export let route_methods = '';

export function readConfig() {
    config = workspace.getConfiguration(PACKAGE_NAME);

    ignore_Controllers = config.ignoreControllers.map((e) => escapeStringRegexp(e)).join('|');
    route_methods = config.routeMethods.map((e) => escapeStringRegexp(e)).join('|');
}
