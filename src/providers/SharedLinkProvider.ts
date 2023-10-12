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
                try {
                    const nodesList = parser.buildASTFromContent(text);

                    for (const item of nodesList) {
                        let el = item[1];

                        if (!el) {
                            continue;
                        }

                        let action;
                        const range = parser.getRangeFromLoc(el.loc.start, el.loc.end);

                        if (el.kind === 'array') {
                            const method_separator = util.getMethodSeparator(doc.getText(range));

                            action = el.items[0].value.what.name + method_separator + el.items[1].value.value;
                            action = action.replace('\\', '');

                            el = el.items[1];
                        } else {
                            action = el.value;
                        }

                        if (action && !new RegExp(this.ignore_Controllers).test(action)) {
                            const files: any = await util.getControllerFilePaths(action);

                            if (files.length && range) {
                                for (const file of files) {
                                    const documentlink: DocumentLink = new DocumentLink(range, file.fileUri);
                                    documentlink.tooltip = file.tooltip;

                                    links.push(documentlink);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(error);
                }
            }
        }

        return links;
    }
}
