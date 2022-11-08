'use strict'

import {
    DocumentLink,
    DocumentLinkProvider,
    TextDocument,
    window
} from 'vscode'
import * as util from '../util'

export default class LinkProvider implements DocumentLinkProvider {
    ignore_Controllers
    route_methods

    constructor() {
        this.ignore_Controllers = util.ignore_Controllers
        this.route_methods      = util.route_methods
    }

    async provideDocumentLinks(doc: TextDocument): Promise<DocumentLink[]> {
        let editor = window.activeTextEditor

        if (editor) {
            util.setWs(doc.uri)

            const text = doc.getText()
            let links  = []

            /* Routes ------------------------------------------------------------------- */

            const reg_route   = new RegExp(`(?<=(${this.route_methods})\\()(?:.*?)(['"](.*?)['"])`, 'g')
            let route_matches = text.matchAll(reg_route)

            for (const match of route_matches) {
                let prim  = match[0]
                let found = match[2]
                let i     = match.index

                if (prim != found) {
                    i = (i + prim.length) - found.length
                }

                let files: any = await util.getRouteFilePath(found)
                const range    = doc.getWordRangeAtPosition(
                    doc.positionAt(i),
                    new RegExp(found)
                )

                if (files.length && range) {
                    for (const file of files) {
                        let documentlink     = new DocumentLink(range, file.fileUri)
                        documentlink.tooltip = file.tooltip

                        links.push(documentlink)
                    }
                }
            }

            /* Controller --------------------------------------------------------------- */

            const reg_controller   = new RegExp(/['"]\S+(?=Controller)(.*?)(?<!\.php)['"]/, 'g')
            let controller_matches = text.matchAll(reg_controller)

            for (const match of controller_matches) {
                let found = match[0]

                if (!new RegExp(`['"](${this.ignore_Controllers})['"]`).test(found)) {
                    let files: any = await util.getControllerFilePaths(found)
                    const range    = doc.getWordRangeAtPosition(
                                        doc.positionAt(match.index),
                                        reg_controller
                                    )

                    if (files.length && range) {
                        for (const file of files) {
                            let documentlink     = new DocumentLink(range, file.fileUri)
                            documentlink.tooltip = file.tooltip

                            links.push(documentlink)
                        }
                    }
                }
            }

            return links
        }
    }
}
