/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
    CompletionItem,
    TextDocumentPositionParams,
} from 'vscode-languageserver/node';

import {
    JSONItems,
    TimeManager,
    getCompletionItem,
    appendCompletionItems,
} from './utils';

import {
    getNodeTypesForPluginVersion,
} from './marketplace';

import {
    readLines,
    getParsed,
    getCursor,
} from './parsing';

import {
    name as toscaDefinitionsVersionName,
    keywords as toscaDefinitionsVersionKeywords,
    Validator as CloudifyToscaDefinitionsVersionValidator,
} from './sections/toscaDefinitionsVersion';

import {
    getImportableYamls,
    name as importsKeyword,
    keywords as importKeywords,
    Validator as ImportsValidator,
} from './sections/imports';

import {
    name as nodeTypeKeyword,
    list as nodeTypeKeywords,
    Validator as NodeTypeValidator,
} from './sections/nodeTypes';

import {
    list as pluginNames,
} from './sections/plugins';

import {
    name as inputsKeyword,
    keywords as inputKeywords,
    Validator as InputValidator,
} from './sections/inputs';

const cloudifyTopLevelKeywords = [
    toscaDefinitionsVersionName,
    'description',
    importsKeyword,
    inputsKeyword,
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

    // Blueprint Context stores the current YAML state.
    // It then initializes each of the top level sections, e.g. inputs, imports, node_types.
    // // For each top level section, it checks what we currently have as a value, e.g:
    // // tosca_definitions_version: cloudify_dsl_1_3
    // // the value is "cloudify_dsl_1_3." Values can also be complex, lists, maps, etc.
    // After we know the current values of the sections we can determine if there are
    // other actions to perform. For example:
    // Should we try to import node types from an imported plugin or file?
    // Should we activate or deactivate certain capabilities, based on DSL version?
    // Suggest keywords, based on node instance properties.
    // Suggest instrinsic function arguments, based on existing inputs or node templates.

    uri:string; // The file location of master blueprint file.
    section:string|null;
    parsed:JSONItems<object|string|[]>;  // The raw parsed YAML data (JSON).
    lines:string[];
    dslVersion:string; // The resolved current DSL version. May not be null.
    level:string|null;
    imports:ImportsValidator|null; // A list of imports.
    inputs:InputValidator|null; // A dictionary of inputs.
    nodeTypes:NodeTypeValidator|null; // A dictionary of node types.

    // TODO: Add Data types:
    // dataTypes; // A dictionary of data types.
    // TODO: Add node templates.
    // TODO: Add relationships.
    // TODO: Add capabilities and outputs. (They are basically identical.)
    // TODO: Add DSL Definitions.
    // TODO: Add description.

    constructor(uri:string) {
        this.uri = uri;
        this.section = null;
        this.parsed = {};
        this.lines = [];
        this.dslVersion = ''; // All others may be null, but this must be a string for other fns that use it.
        this.level = null;
        this.imports = null;
        this.inputs = null;
        this.nodeTypes = null;
        this.refresh();
    }

    refresh=()=>{
        this.parsed = getParsed(this.uri);
        this.lines = readLines(this.uri);
        this.level = this.getLevel(null);
        this.dslVersion = this.getDslVersion();
        this.imports = this.getImports();
        this.nodeTypes = this.getNodeTypes();
        this.inputs = this.getInputs();
        // this.dataTypes = this.getDataTypes();
    };

    getLevel=(currentLineNumber:number|null)=>{
        if (currentLineNumber == null) {
            currentLineNumber = 0;
        }
        const lines = this.lines.reverse();
        for (let n = currentLineNumber; n < this.lines.length; n++) {
            const line = lines[n];
            const splitLine:string[] = line.split(':');
            const candidate = cloudifyTopLevelKeywords.find(element => element == splitLine[0]);
            if (candidate !== undefined) {
                return candidate;
            }
        }
        return null;
    };

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
        } else if (typeof rawVersion === 'object') {
            return '';
        }
        // console.log('Raw version '.concat(rawVersion));
        const _version = new CloudifyToscaDefinitionsVersionValidator(rawVersion);
        return _version.toString();
    };

    getImports=()=>{
        const rawImports = this.getSection('imports');
        // console.log('Raw imports ' + rawImports);
        const _imports = new ImportsValidator(this.dslVersion, rawImports);
        return _imports;
    };

    getInputs=()=>{
        const rawInputs = this.getSection('inputs');
        // console.log('Raw inputs: ' + rawInputs);
        const _inputs = new InputValidator(rawInputs);
        return _inputs;
    };

    getDataTypes=()=>{
        return [];
    };
    getNodeTypes=()=>{
        const rawNodeTypes = this.getSection('node_types');
        // console.log('Raw node_types: ' + rawNodeTypes);
        const _nodeTypes = new NodeTypeValidator(rawNodeTypes);
        return _nodeTypes;
    };
}

class CloudifyWords {

    timer:TimeManager;

    ctx:BlueprintContext|null;
    keywords: CompletionItem[];
    importedPlugins:string[];
    nodeTypeKeywords:CompletionItem[];
    dslVersion:string;

    constructor() {
        this.ctx = null;
        this.keywords = [];
        this.importedPlugins = [];
        this.nodeTypeKeywords = [];
        this.dslVersion = '';
        this.setupInitialListOfKeywords();
        this.timer = new TimeManager(2);
    }

    public async refresh(uri:string) {
        if (this.ctx == null) {
            this.ctx = new BlueprintContext(uri);
            this.addRelativeImports(uri);
        } else if (this.timer.isReady()) {
            this.ctx.refresh();
            this.dslVersion = this.ctx.dslVersion;
            await this.importPlugins();
        }
    }

    private addRelativeImports(documentUri:string) {
        for (const value of getImportableYamls(documentUri)) {
            this.appendKeyword(value);
        }
    }

    public async importPlugins() {
        if (this.ctx != null) {
            if (this.ctx.imports != null) {
                for (const plugin of this.ctx.imports.plugins) {
                    await this._importPlugin(plugin);
                }
            }
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
        appendCompletionItems(this.keywords, cloudifyTopLevelKeywords);
        appendCompletionItems(this.keywords, toscaDefinitionsVersionKeywords);
        appendCompletionItems(this.keywords, importKeywords);
        appendCompletionItems(this.keywords, pluginNames);
        appendCompletionItems(this.keywords, inputKeywords);
        appendCompletionItems(this.keywords, nodeTypeKeywords);
    };

    public contextualizedKeywords(textDoc:TextDocumentPositionParams):CompletionItem[] {
        const currentKeywordOptions:CompletionItem[] = [];

        const cursor = getCursor(textDoc);
        console.log(cursor);

        if ((this.ctx == null) || (textDoc.position.character <= 2)) {
            appendCompletionItems(currentKeywordOptions, cloudifyTopLevelKeywords);
            return currentKeywordOptions;
        }
        this.ctx.section = this.ctx.level;

        if ((this.ctx.level === toscaDefinitionsVersionName) && (this.dslVersion === '')) {
            appendCompletionItems(currentKeywordOptions, toscaDefinitionsVersionKeywords);
            return currentKeywordOptions;
        } else if ((this.ctx.level === toscaDefinitionsVersionName) && (this.dslVersion !== '')) {
            this.ctx.level = null;
        }

        if (this.ctx.level === importsKeyword) {
            if (cursor.words.includes('plugin:')) {
                appendCompletionItems(currentKeywordOptions, pluginNames);
                return currentKeywordOptions;
            }
            appendCompletionItems(currentKeywordOptions, importKeywords);
            return currentKeywordOptions;
        }

        if (this.ctx.section == null) {
            appendCompletionItems(currentKeywordOptions, cloudifyTopLevelKeywords);
            return currentKeywordOptions; 
        }
        return this.keywords;
    }
}

export const cloudify = new CloudifyWords();
