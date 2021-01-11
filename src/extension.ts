'use strict'

import {
    commands,
    languages,
    window,
    workspace
} from 'vscode'
import RouteCompletionItemProvider from './providers/RouteCompletionItemProvider'
import SharedLinkProvider          from './providers/SharedLinkProvider'
import * as util                   from './util'

const debounce = require('lodash.debounce')
let providers = []
let classmap_file
let artisan_file

export async function activate({subscriptions}) {
    util.readConfig()

    // config
    workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration(util.PACKAGE_NAME)) {
            util.readConfig()
        }
    })

    // controllers & routes
    classmap_file = await workspace.findFiles(util.classmap_file_path, null, 1)
    artisan_file = await workspace.findFiles('artisan', null, 1)

    classmap_file = classmap_file[0]
    artisan_file = artisan_file[0]
    init()

    // route app_url
    subscriptions.push(commands.registerCommand('lgc.addAppUrl', util.saveAppURL))
    util.clearAll.event(() => {
        clearAll()
        initProviders()
    })
}

function init() {
    // links
    if (window.activeTextEditor) {
        initProviders()
    }

    window.onDidChangeActiveTextEditor(
        debounce(async function (editor) {
            if (editor) {
                await clearAll()
                initProviders()
            }
        }, 250)
    )

    // scroll
    util.scrollToText()

    // file content changes
    util.listenToFileChanges(classmap_file, artisan_file, debounce)
}

const initProviders = debounce(function () {
    providers.push(languages.registerDocumentLinkProvider(['php', 'blade'], new SharedLinkProvider()))

    if (util.show_route_completion) {
        providers.push(languages.registerCompletionItemProvider(['php', 'blade'], new RouteCompletionItemProvider()))
    }
}, 250)

function clearAll () {
    return new Promise((res, rej) => {
        providers.map((e) => e.dispose())
        providers = []

        setTimeout(() => {
            return res(true)
        }, 500)
    })
}

export function deactivate() {
    clearAll()
}
