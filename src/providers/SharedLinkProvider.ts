'use strict';

import {
    DocumentLink,
    DocumentLinkProvider,
    TextDocument,
    window,
} from 'vscode';
import * as util from '../util';

export default class LinkProvider implements DocumentLinkProvider {
    ignore_Controllers;
    route_methods;

    constructor() {
        this.ignore_Controllers = util.ignore_Controllers;
        this.route_methods = util.route_methods;
    }

    async provideDocumentLinks(doc: TextDocument): Promise<DocumentLink[]> {
        const editor = window.activeTextEditor;
        const links: any = [];

        if (editor) {
            util.setWs(doc.uri);

            const text = doc.getText();

            /* Routes ------------------------------------------------------------------- */

            const reg_route = new RegExp(`(?<=(${this.route_methods})\\()(?:.*?)(['"](.*?)['"])`, 'g');
            const route_matches = text.matchAll(reg_route);

            for (const match of route_matches) {
                const found = match[3];

                const files: any = await util.getRouteFilePath(found);
                const range = doc.getWordRangeAtPosition(
                    // @ts-ignore
                    doc.positionAt(match.index + found.length),
                    new RegExp(found),
                );

                if (files.length && range) {
                    for (const file of files) {
                        const documentlink = new DocumentLink(range, file.fileUri);
                        documentlink.tooltip = file.tooltip;

                        links.push(documentlink);
                    }
                }
            }

            /* Controller --------------------------------------------------------------- */

            const reg_controller = new RegExp(/['"]\S+(?=Controller)(.*?)(?<!\.php)['"]/, 'g');
            const controller_matches = text.matchAll(reg_controller);

            for (const match of controller_matches) {
                const found = match[0];

                if (!new RegExp(`['"](${this.ignore_Controllers})['"]`).test(found)) {
                    const files: any = await util.getControllerFilePaths(found);
                    const range = doc.getWordRangeAtPosition(
                        // @ts-ignore
                        doc.positionAt(match.index),
                        reg_controller,
                    );

                    if (files.length && range) {
                        for (const file of files) {
                            const documentlink = new DocumentLink(range, file.fileUri);
                            documentlink.tooltip = file.tooltip;

                            links.push(documentlink);
                        }
                    }
                }
            }
        }

        return links;
    }
}
