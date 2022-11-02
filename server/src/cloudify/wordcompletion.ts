/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
    CompletionItem,
} from 'vscode-languageserver/node';

import {
    getCompletionItem,
    appendCompletionItems,
} from './utils';

import {
    getNodeTypesForPluginVersion,
} from './marketplace';

import {
    getParsed,
} from './parsing';

import {
    name as toscaDefinitionsVersionName,
    keywords as toscaDefinitionsVersionKeywords,
    Validator as CloudifyToscaDefinitionsVersionValidator,
} from './sections/toscaDefinitionsVersion';

import {
    name as importsKeyword,
    keywords as importKeywords,
    getImportableYamls,
    Validator as ImportsValidator,
} from './sections/imports';

import {
    name as nodeTypeKeyword,
    list as nodeTypeKeywords,
} from './sections/nodeTypes';

import {
    list as pluginNames,
} from './sections/plugins';

import {
    keywords as inputKeywords,
} from './sections/inputs';

const cloudifyKeywords = [
    toscaDefinitionsVersionName,
    'description',
    importsKeyword,
    'inputs',
    'dsl_definitions',
    'labels',
    'blueprint_labels',
    nodeTypeKeyword,
    'relationships',
    'workflows',
    'node_templates',
    'outputs',
    'capabilities',
];

class BlueprintContext {
    uri:string;
    parsed;
    dslVersion:string;
    imports;

    constructor(uri:string) {
        this.uri = uri;
        this.parsed = getParsed(this.uri);
        this.dslVersion = this.getDslVersion();
        this.imports = this.getImports();
    }
    getSection = (sectionName:string)=>{

        try {
            return this.parsed[sectionName];
        } catch {
            return null;
        }
    };
    getDslVersion=()=>{
        const rawVersion = this.getSection(toscaDefinitionsVersionName);
        if (rawVersion == null) {
            return '';
        }
        console.log('Raw version '.concat(rawVersion));
        const _version = new CloudifyToscaDefinitionsVersionValidator(rawVersion);
        return _version.toString();
    };
    getImports=()=>{
        let rawImports = this.getSection('imports');
        if (rawImports == null) {
            rawImports = [];
        }
        console.log('Raw imports ' + rawImports);
        const _imports = new ImportsValidator(this.dslVersion, rawImports);
        return _imports;
    };
}

class CloudifyWords {

    keywords: CompletionItem[];
    initialized: boolean;
    importedPlugins:string[];
    dslVersion:string;

    constructor() {
        this.keywords = [];
        this.initialized = false;
        this.importedPlugins = [];
        this.dslVersion = '';
        this.setupInitialListOfKeywords();    
    }

    public async update(uri:string) {
        const ctx = new BlueprintContext(uri);
        this._addRelativeImports(uri);    
        this.dslVersion = ctx.dslVersion;
        for (const plugin of ctx.imports.plugins) {
            await this._importPlugin(plugin);
        }
    }

    public async init () {
        if (this.initialized) {
            return '';
        } else {
            this.initialized = true;
            return '';
        }
    }

    private _addRelativeImports(documentUri:string) {
        for (const value of getImportableYamls(documentUri)) {
            this.appendKeyword(value);
        }
    }

    private async _importPlugin(pluginName:string) {

        if ((pluginName == null) || (!(typeof pluginName === 'string'))) {
            return '';
        }

        let pluginSubString = pluginName.match('^cloudify-[a-z]*-plugin$') as string[];
        if (pluginSubString == null) {
            pluginSubString = [];
        }

        if (pluginSubString.length == 1) {
            const pluginName:string = pluginSubString[0];
            if (!this.importedPlugins.includes(pluginName)) {
                const nodeTypes = await getNodeTypesForPluginVersion(pluginName);
                for (const nodeType of nodeTypes) {
                    this.appendKeyword(nodeType.type);
                }
                this.importedPlugins.push(pluginName);
            }
        }
    }

    appendKeyword = (keyword:string)=>{
        const keywordNames = this.keywords.map((obj) => obj.label);
        if (!keywordNames.includes(keyword)) {
            const currentIndex = this.keywords.length;
            this.keywords.push(
                getCompletionItem(keyword, currentIndex)
            );    
        }
    };

    setupInitialListOfKeywords=()=>{
        appendCompletionItems(this.keywords, cloudifyKeywords);
        appendCompletionItems(this.keywords, toscaDefinitionsVersionKeywords);
        appendCompletionItems(this.keywords, importKeywords);
        appendCompletionItems(this.keywords, pluginNames);
        appendCompletionItems(this.keywords, inputKeywords);
        appendCompletionItems(this.keywords, nodeTypeKeywords);
    };

}

export const cloudify = new CloudifyWords();
