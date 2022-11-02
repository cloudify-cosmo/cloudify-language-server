/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as fs from 'fs';
import * as path from 'path';
import {
    keywords as dslVersionAsString,
} from './toscaDefinitionsVersion';

export const name = 'imports';
export const keywords = [
    'cloudify/types/types.yaml',
    'https://cloudify.co/spec/cloudify/6.3.0/types.yaml',
    'https://cloudify.co/spec/cloudify/6.4.0/types.yaml',
    'plugin:'
];

// TODO: Add find yaml files in subfolders and add them to import options.
// TODO: Add version constraints prediction.

class importItem {}

class itemValidator {
    importItem:importItem;
    isString:boolean;

    constructor (dslVersion:string, importItem:importItem) {
        if (dslVersion == null) {
            this.isString = false;
            this.importItem = '';
        } else if (dslVersionAsString.includes(dslVersion)) {
            this.isString = true;
            this.importItem = importItem;
        } else if (typeof importItem === 'string') {
            this.isString = true;
            this.importItem = importItem;
        } else {
            this.isString = false;
            this.importItem = importItem as importItem;
        }
    }

    toString() {
        if (this.isString) {
            return this.importItem as string;
        } else {
            console.error('Unable to return item as string.');
            return '';
        }
    }
}

export class validator {
    dslVersion:string;
    rawImports = [];
    imports:itemValidator[];
    plugins:string[];

    constructor(dslVersion:string, rawImports:[]) {
        this.dslVersion = dslVersion;
        if (rawImports === undefined) {
            this.rawImports = [];
        } else if (rawImports.length > 0) {
            this.rawImports = rawImports;
        }
        this.imports = [];
        this.plugins = [];
        this.assignPlugins();
    }

    assignPlugins() {
        try {
            for (const rawImported of this.rawImports) {
                const imported = new itemValidator(this.dslVersion, rawImported);
                this.imports.push(imported);
                const stringImport = imported.toString();
                if (stringImport.startsWith('plugin:')) {
                    this.plugins.push(stringImport.replace('plugin:', ''));
                }
                console.log('plugins ' + this.plugins);
            }
        } catch (e) {
            // Worse things could happen.
            console.log(e);
        }
    }
}

function getImportsDir(referencePath:string): string {
    if (referencePath.startsWith('file:/')) {
        referencePath = referencePath.replace('file:/', '');
    }
    const importsDir:string = path.join(path.dirname(referencePath), 'imports');
    if (fs.existsSync(importsDir)) {
        return importsDir;
    } else {
        return '';
    }
}

export function getImportableYamls(referencePath:string): string[] {
    const importableYamls = [];
    const importsDir:string = getImportsDir(referencePath);
    if (importsDir.length > 0 ) {
        for (const fileName of fs.readdirSync(importsDir)) {
            if (fileName.endsWith('.yaml')) {
                importableYamls.push(path.join('imports', fileName));
            } else if (fileName.endsWith('.yml')) {
                throw new Error('Invalid relative import filename: ' + fileName + 'must end with ".yaml".');
            }
        }
    }
    return importableYamls;
}

