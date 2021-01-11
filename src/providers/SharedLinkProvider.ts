'use strict'

import {
    DocumentLink,
    DocumentLinkProvider,
    Position,
    TextDocument,
    window
} from 'vscode'
import * as util from '../util'

export default class LinkProvider implements DocumentLinkProvider {
    ignore_Controllers
    route_methods

    constructor() {
        this.ignore_Controllers = util.ignore_Controllers
        this.route_methods = util.route_methods
    }

    async provideDocumentLinks(doc: TextDocument): Promise<DocumentLink[]> {
        let editor = window.activeTextEditor

        if (editor) {
            util.setWs(doc)

            const text = doc.getText()
            let links = []

            /* Routes ------------------------------------------------------------------- */

            let reg_route = new RegExp(`(?<=(${this.route_methods})\\()['"](.*?)['"]`, 'g')
            let route_matches

            while ((route_matches = reg_route.exec(text)) !== null) {
                let found = route_matches[0]
                const line = doc.lineAt(doc.positionAt(route_matches.index).line)
                const indexOf = line.text.indexOf(found)
                const position = new Position(line.lineNumber, indexOf)
                const range = doc.getWordRangeAtPosition(position, new RegExp(reg_route))

                if (range) {
                    let files: any = await util.getRouteFilePath(found)

                    if (files.length) {
                        for (const file of files) {
                            let documentlink = new DocumentLink(range, file.fileUri)
                            documentlink.tooltip = file.tooltip

                            links.push(documentlink)
                        }
                    }
                }
            }

            /* Controller --------------------------------------------------------------- */

            let reg_controller = new RegExp(/['"]\S+(?=Controller)(.*?)(?<!\.php)['"]/, 'g')
            let controller_matches

            while ((controller_matches = reg_controller.exec(text)) !== null) {
                let found = controller_matches[0]
                const line = doc.lineAt(doc.positionAt(controller_matches.index).line)
                const indexOf = line.text.indexOf(found)
                const position = new Position(line.lineNumber, indexOf)
                const range = doc.getWordRangeAtPosition(position, new RegExp(reg_controller))

                if (range && !new RegExp(`['"](${this.ignore_Controllers})['"]`).test(found)) {
                    let files: any = await util.getControllerFilePaths(found)

                    if (files.length) {
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
