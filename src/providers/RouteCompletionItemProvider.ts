'use strict';

import {
    CompletionItem,
    CompletionItemKind,
    MarkdownString,
    Uri,
} from 'vscode';
import * as util from '../util';

export default class CompletionItemProvider {
    routes_list;
    route_methods;
    app_url;

    constructor() {
        this.app_url = util.app_url;
        this.route_methods = util.route_methods;
        this.routes_list = util.routes_contents.filter((e) => e.name);
    }

    provideCompletionItems(document, position) {
        const txt = document.lineAt(position).text;
        const reg_route = new RegExp(`(?<=(${this.route_methods})\\()['"].*?['"]`, 'g');

        if (!txt.match(reg_route)) {
            return undefined;
        }

        const arr = [];

        for (const route of this.routes_list) {
            let { uri: url, name, action, method } = route;
            url = `${this.app_url}${url}`;

            const parse = Uri.parse(url);
            const label = name.split('.').splice(0, 1).join('.'); // route group name
            const string = new MarkdownString(`[${url}](command:vscode.open?${parse})`);
            string.isTrusted = true;

            const comp = new CompletionItem(name, CompletionItemKind.Reference);
            comp.filterText = label;
            comp.commitCharacters = ['.'];
            comp.detail = 'Laravel GoTo Controller';
            comp.documentation = string.appendCodeblock(`Action: ${action}\n---\nType: ${method}`);

            arr.push(comp);
        }

        return arr;
    }
}
