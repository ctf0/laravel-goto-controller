'use strict'

import {
    commands,
    env,
    EventEmitter,
    Range,
    Selection,
    Uri,
    window,
    workspace
} from 'vscode'

const fs   = require('fs')
const path = require('path')
const sep  = path.sep
export const escapeStringRegexp = require('escape-string-regexp')
export const clearAll = new EventEmitter()

let ws

export function setWs(uri) {
    ws = workspace.getWorkspaceFolder(uri)?.uri.fsPath
}

/* Controllers ------------------------------------------------------------------ */
let classmap_fileContents  = ''
let cache_store_controller = []

export function getControllerFilePaths(text) {
    let editor = `${env.uriScheme}://file`
    let info   = text.replace(/['"]/g, '')
    let list   = checkCache(cache_store_controller, info)

    if (!list.length) {
        let controller
        let method

        if (info.includes('@')) {
            let arr    = info.split('@')
            controller = arr[0]
            method     = arr[1]
        } else {
            let arr    = info.split('\\')
            controller = arr.pop()
        }

        for (const path of getKeyLine(controller)) {
            list.push({
                tooltip : path.replace(/^[\\\/]/g, ''),
                fileUri : Uri
                    .parse(`${editor}${ws}${path}`)
                    .with({authority: 'ctf0.laravel-goto-controller', query: method})
            })
        }

        if (list.length) {
            saveCache(cache_store_controller, info, list)
        }
    }

    return list
}

export async function listenToFileChanges(classmap_file, artisan_file, debounce) {
    await getFileContent(classmap_file)
    await getRoutesInfo(artisan_file)

    let watcher = workspace.createFileSystemWatcher(classmap_file_path)

    watcher.onDidChange(
        debounce(async function(e) {
            await getFileContent(classmap_file)
            await getRoutesInfo(artisan_file)

            cache_store_route      = []
            cache_store_controller = []
        }, 500)
    )
}

function getKeyLine(k) {
    k         = `\\${k}`
    let match = classmap_fileContents.match(new RegExp(`['"].*${escapeStringRegexp(k)}.*php['"]`, 'gm'))

    if (match) {
        let result = []

        for (const item of match) {
            let line      = item
            let file: any = line.match(new RegExp(/['"]\S+(?=php).*?['"]/))

            if (file) {
                file     = file[0].replace(/['"]/g, '')
                let path = line.includes('$baseDir')
                    ? file
                    : line.includes('$vendorDir')
                        ? `${sep}vendor${sep}${file}`
                        : null

                result.push(path.replace(/[\\\/]+/g, sep))
            }
        }

        return result
    }

    return []
}

function getFileContent(file) {
    if (file) {
        return fs.readFile(file.path, 'utf8', (err, data) => {
            classmap_fileContents = data
        })
    }
}

/* Routes ------------------------------------------------------------------- */
const exec = require('await-exec')
export let routes_contents = []
export let app_url = ''
let cache_store_route = []

export function getRouteFilePath(text) {
    let cache_key = text.replace(/['"]/g, '')
    let list      = checkCache(cache_store_route, cache_key)

    if (!list.length) {
        let info = extractController(cache_key)

        if (!info) {
            return []
        }

        let {uri: url, action, method: urlType} = info

        if (action == 'Closure') {
            return []
        }

        let editor = `${env.uriScheme}://file`
        let controller
        let method

        if (action.includes('@')) {
            let arr = action.split('@')
            method  = arr[1]

            let namespace = arr[0].split('\\')
            controller    = namespace.pop()
        } else {
            let arr    = action.split('\\')
            controller = arr.pop()
        }

        let path = getKeyLine(controller)[0]

        if (!path) {
            return []
        }

        // controller
        list.push({
            tooltip : action,
            fileUri : Uri
                .parse(`${editor}${ws}${path}`)
                .with({authority: 'ctf0.laravel-goto-controller', query: method})
        })

        // browser
        if (urlType.includes('GET') && app_url) {
            list.push({
                tooltip : `${app_url}${url}`,
                fileUri : Uri.parse(`${app_url}${url}`)
            })
        }

        saveCache(cache_store_route, cache_key, list)
    }

    return list
}

let counter = 1

async function getRoutesInfo(file) {
    let timer

    try {
        let res = await exec('php artisan route:list --columns=uri,name,action,method --json', {
            cwd   : workspace.getWorkspaceFolder(file)?.uri.fsPath,
            shell : env.shell
        })

        routes_contents = JSON.parse(res.stdout)
    } catch (error) {
        // console.error(error)

        if (counter >= 3) {
            return clearTimeout(timer)
        }

        timer = setTimeout(() => {
            counter++
            getRoutesInfo(file)
        }, 2000)
    }
}

function extractController(k) {
    return routes_contents.find((e) => e.name == k)
}

export async function saveAppURL() {
    app_url = await window.showInputBox({
        placeHolder : 'project APP_URL',
        value       : await env.clipboard.readText() || '',
        validateInput(v) {
            if (!v) {
                return 'you have to add a name'
            } else {
                return ''
            }
        }
    })

    if (app_url) {
        app_url = app_url.endsWith(sep) ? app_url : `${app_url}${sep}`
        clearAll.fire(clearAll)
    }
}


/* Scroll ------------------------------------------------------------------- */
export function scrollToText() {
    window.registerUriHandler({
        handleUri(provider) {
            let {authority, path, query} = provider

            if (authority == 'ctf0.laravel-goto-controller') {
                commands.executeCommand('vscode.openFolder', Uri.file(path))
                    .then(() => {
                        setTimeout(() => {
                            let editor = window.activeTextEditor
                            let range  = getTextPosition(query, editor.document)

                            if (range) {
                                editor.selection = new Selection(range.start, range.end)
                                editor.revealRange(range, 2)
                            }

                            if (!range && query) {
                                window.showInformationMessage(
                                    'Laravel Goto Controller: Copy Method Name To Clipboard',
                                    ...['Copy']
                                ).then((e) => {
                                    if (e) {
                                        env.clipboard.writeText(query)
                                    }
                                })
                            }
                        }, config.waitB4Scroll)
                    })
            }
        }
    })
}

function getTextPosition(searchFor, doc) {
    if (searchFor) {
        const regex = new RegExp('function ' + escapeStringRegexp(`${searchFor}(`))
        const match = regex.exec(doc.getText())

        if (match) {
            let pos = doc.positionAt(match.index + match[0].length)

            return new Range(pos, pos)
        }
    }

    return null
}

/* Helpers ------------------------------------------------------------------ */

function checkCache(cache_store, text) {
    let check = cache_store.find((e) => e.key == text)

    return check ? check.val : []
}

function saveCache(cache_store, text, val) {
    checkCache(cache_store, text).length
        ? false
        : cache_store.push({
            key : text,
            val : val
        })

    return val
}

/* Config ------------------------------------------------------------------- */
export const PACKAGE_NAME = 'laravelGotoController'
let config
export let classmap_file_path: string = ''
export let ignore_Controllers: string = ''
export let route_methods: string = ''

export function readConfig() {
    config = workspace.getConfiguration(PACKAGE_NAME)

    classmap_file_path = config.classmapfile
    ignore_Controllers = config.ignoreControllers.map((e) => escapeStringRegexp(e)).join('|')
    route_methods      = config.routeMethods.map((e) => escapeStringRegexp(e)).join('|')
}
