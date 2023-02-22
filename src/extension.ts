'use strict';

import debounce from 'lodash.debounce';
import {
    commands,
    languages,
    window,
    workspace
} from 'vscode';
import SharedLinkProvider from './providers/SharedLinkProvider';
import * as util from './util';

let providers: any = [];
let classmap_file;

export async function activate({ subscriptions }) {
    await util.readConfig();

    // config
    workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration(util.PACKAGE_NAME)) {
            await util.readConfig();
        }
    });

    // controllers & routes
    classmap_file = await workspace.findFiles(util.config.classmap_file, null, 1);

    if (!classmap_file.length) {
        return
    }


    classmap_file = classmap_file[0];

    // init
    await init(subscriptions);

    // route app_url
    subscriptions.push(commands.registerCommand('lgc.addAppUrl', util.saveAppURL));
    subscriptions.push(commands.registerCommand(util.cmndName, util.scrollToText));

    util.clearAll.event(async () => {
        await clearAll();
        initProviders();
    });
}

async function init(subscriptions) {
    // file content changes
    await util.listenToFileChanges(classmap_file, debounce);

    // links
    initProviders();
    subscriptions.push(
        window.onDidChangeActiveTextEditor(async (e) => {
            await clearAll();
            initProviders();
        }),
    );

    // scroll
    util.scrollToText();
}

const initProviders = debounce(() => {
    providers.push(languages.registerDocumentLinkProvider(['php', 'blade'], new SharedLinkProvider()));
}, 250);

function clearAll() {
    return new Promise((res, rej) => {
        providers.map((e) => e.dispose());
        providers = [];

        setTimeout(() => res(true), 500);
    });
}

export function deactivate() {
    clearAll();
}
