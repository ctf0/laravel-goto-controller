import debounce from 'lodash.debounce';
import {
    commands,
    languages,
    window,
    workspace,
} from 'vscode';
import RouteCompletionItemProvider from './providers/RouteCompletionItemProvider';
import SharedLinkProvider from './providers/SharedLinkProvider';
import * as util from './util';

let providers: any = [];
let classmap_file;

export async function activate({ subscriptions }) {
    util.readConfig();

    // config
    subscriptions.push(
        workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(util.PACKAGE_NAME)) {
                util.readConfig();
            }
        }),
    );

    // controllers & routes
    classmap_file = await workspace.findFiles(util.config.classmap_file, null, 1);

    if (!classmap_file.length) {
        return;
    }

    util.setWs();

    classmap_file = classmap_file[0];

    // init
    await init(subscriptions);

    // route app_url
    subscriptions.push(
        commands.registerCommand('lgc.addAppUrl', util.saveAppURL),
        commands.registerCommand(util.cmndName, util.scrollToText),
    );

    util.clearAll.event(async () => {
        await clearAll();
        initProviders();
    });
}

async function init(subscriptions) {
    // file content changes
    await util.listenToFileChanges(classmap_file, subscriptions);

    // links
    initProviders();
    subscriptions.push(
        window.onDidChangeActiveTextEditor(async () => {
            await clearAll();
            initProviders();
        }),
    );

    // scroll
    util.scrollToText();
}

const initProviders = debounce(() => {
    providers.push(languages.registerDocumentLinkProvider(['php', 'blade'], new SharedLinkProvider()));

    if (util.show_route_completion) {
        providers.push(languages.registerCompletionItemProvider(['php', 'blade'], new RouteCompletionItemProvider()));
    }
}, 250);

function clearAll() {
    return new Promise((res) => {
        providers.map((e) => e.dispose());
        providers = [];

        setTimeout(() => res(true), 500);
    });
}

export function deactivate() {
    clearAll();
}
