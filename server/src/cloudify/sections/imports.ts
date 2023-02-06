/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as fs from 'fs';
import * as path from 'path';

export const name = 'imports';
export const keywords = [
    'cloudify/types/types.yaml',
    'https://cloudify.co/spec/cloudify/6.3.0/types.yaml',
    'https://cloudify.co/spec/cloudify/6.4.0/types.yaml',
    'plugin:'
];
export const pluginRegex = /^\s+-\s?plugin:/;

// TODO: Add find yaml files in subfolders and add them to import options.
// TODO: Add version constraints prediction.


class PluginValidator {
    // TODO: Support Properties and Properties Description.
    // TODO: Validate the DSL versions supports properties and description/plugin import as a dict.
    // TODO: To support version resolution.

    rawImport:string|object;
    dslVersion:string;
    name:string;
    version:string;
    propertiesDescription:string;
    properties:object;
    _isPlugin:boolean;

    constructor(dslVersion:string, importItem:string|object) {
        this.dslVersion = dslVersion;
        this.rawImport = importItem;
        this.name = '';
        this.version = '';
        this.propertiesDescription = '';
        this.properties = {};
        this._isPlugin = false;
        this.setupPlugin();
    }

    setupPlugin=()=>{
        if (typeof this.rawImport === 'string') {
            this.assignVersion(this.rawImport);
        } else if (typeof this.rawImport === 'object') {
            for (const key in this.rawImport) {
                if (key.includes('plugin:')) {
                    this.assignVersion(key);
                }
            }
        }
    };

    assignVersion=(line:string)=>{
        const splitString:string[] = line.split(/[:?]/);
        if (splitString.length >= 2) {
            this.name = splitString[1];
            this._isPlugin = true;
            this.version = 'latest';
        }
        if (splitString.length == 3) {
            this.version = splitString[2];
        }
    };

    isPlugin=()=>{
        return this._isPlugin;
    };

}

class ItemValidator {
    dslVersion:string;
    importItem;
    _asPlugin:PluginValidator;
    pluginVersion:string;
    pluginName:string;

    constructor (dslVersion:string, importItem:string|object) {
        this.dslVersion = dslVersion;
        this.importItem = importItem;
        this._asPlugin = new PluginValidator(dslVersion, importItem);
        this.pluginVersion = this._asPlugin.version;
        this.pluginName = this._asPlugin.name;
    }

    isString=()=>{
        if (this.dslVersion == null) {
            return false;
        } else if (typeof this.importItem === 'string') {
            return true;
        } else {
            return false;
        }
    };

    toString=()=>{
        if (this.isString()) {
            return this.importItem as string;
        } else {
            // console.error('Unable to return item as string.');
            return '';
        }
    };

    isPlugin=()=>{
        return this._asPlugin.isPlugin();
    };

}

export class Validator {
    dslVersion:string;
    rawImports:string[]|object[];
    imports:ItemValidator[];
    plugins:string[];

    constructor(dslVersion:string, rawImports:[]|object|string|null) {
        this.dslVersion = dslVersion;
        this.rawImports = [];
        if (!Array.isArray(rawImports)) {
            this.rawImports = [];
        } else if (rawImports.length > 0) {
            this.rawImports = rawImports;
        }
        this.imports = [];
        this.assignImports();
        this.plugins = [];
        this.assignPlugins();
    }

    assignImports=()=>{
        for (const rawImported of this.rawImports) {
            const imported = new ItemValidator(this.dslVersion, rawImported);
            this.imports.push(imported);
        }
        // console.log('imports: ' + this.imports);
    };

    assignPlugins=()=>{
        for (const imported of this.imports) {
            if (imported.isPlugin()) {
                this.plugins.push(imported.pluginName);
            }
        }
        // console.log('plugins ' + this.plugins);
    };
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

