import escapeStringRegexp from 'escape-string-regexp';
import {
    DocumentLink,
    DocumentLinkProvider,
    TextDocument,
    window,
} from 'vscode';
import * as util from '../util';
import * as parser from './Parser';

export default class LinkProvider implements DocumentLinkProvider {
    ignore_Controllers;
    route_methods;

    constructor() {
        this.ignore_Controllers = util.ignore_Controllers;
        this.route_methods = util.route_methods;
    }

    async provideDocumentLinks(doc: TextDocument): Promise<DocumentLink[]> {
        const editor = window.activeTextEditor;
        const links: DocumentLink[] = [];

        if (editor) {
            util.setWs(doc.uri);

            const text = doc.getText();

            /* Routes ------------------------------------------------------------------- */

            const reg_route = new RegExp(`(?<=(${this.route_methods})\\()(['"](.*?)['"])`, 'g');
            const route_matches = text.matchAll(reg_route);

            for (const match of route_matches) {
                const found = match[3];
                const files: any = await util.getRouteFilePath(found);
                const range = doc.getWordRangeAtPosition(
                    // @ts-ignore
                    doc.positionAt(match.index + found.length),
                    new RegExp(escapeStringRegexp(found)),
                );

                if (files.length && range) {
                    for (const file of files) {
                        const documentlink: DocumentLink = new DocumentLink(range, file.fileUri);
                        documentlink.tooltip = file.tooltip;

                        links.push(documentlink);
                    }
                }
            }

            /* Controller --------------------------------------------------------------- */
            if (doc.languageId === 'php') {
                const nodesList = parser.buildASTFromContent(text);

                for (const item of nodesList) {
                    let el = item[1];
                    let action;

                    if (el.kind === 'array') {
                        el = el.items[1];
                        action = item[1].items[0].value.what.name + '@' + el.value.value;
                        action = action.replace('\\', '');
                    } else {
                        action = el.value;
                    }

                    if (!new RegExp(this.ignore_Controllers).test(action)) {
                        const files: any = await util.getControllerFilePaths(action);
                        const range = parser.getRangeFromLoc(el.loc.start, el.loc.end);

                        if (files.length && range) {
                            for (const file of files) {
                                const documentlink: DocumentLink = new DocumentLink(range, file.fileUri);
                                documentlink.tooltip = file.tooltip;

                                links.push(documentlink);
                            }
                        }
                    }
                }
            }
        }

        return links;
    }
}
