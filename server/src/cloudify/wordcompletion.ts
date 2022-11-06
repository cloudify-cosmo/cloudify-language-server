/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
    CompletionItem,
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
    getParsed,
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

const cloudifyKeywords = [
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
    parsed:JSONItems<object|string|[]>;  // The raw parsed YAML data (JSON).
    dslVersion:string; // The resolved current DSL version.
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
        this.parsed = {};
        this.dslVersion = '';
        this.imports = null;
        this.inputs = null;
        this.nodeTypes = null;
        this.refresh();
    }

    refresh=()=>{
        this.parsed = getParsed(this.uri);
        this.dslVersion = this.getDslVersion();
        this.imports = this.getImports();
        this.nodeTypes = this.getNodeTypes();
        this.inputs = this.getInputs();
        // this.dataTypes = this.getDataTypes();
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
        console.log('Raw version '.concat(rawVersion));
        const _version = new CloudifyToscaDefinitionsVersionValidator(rawVersion);
        return _version.toString();
    };

    getImports=()=>{
        const rawImports = this.getSection('imports');
        console.log('Raw imports ' + rawImports);
        const _imports = new ImportsValidator(this.dslVersion, rawImports);
        return _imports;
    };

    getInputs=()=>{
        const rawInputs = this.getSection('inputs');
        console.log('Raw inputs: ' + rawInputs);
        const _inputs = new InputValidator(rawInputs);
        return _inputs;
    };

    getDataTypes=()=>{
        return [];
    };
    getNodeTypes=()=>{
        const rawNodeTypes = this.getSection('node_types');
        console.log('Raw node_types: ' + rawNodeTypes);
        const _nodeTypes = new NodeTypeValidator(rawNodeTypes);
        return _nodeTypes;
    };
}

class CloudifyWords {

    timer:TimeManager;

    ctx:BlueprintContext|null;
    keywords: CompletionItem[];
    importedPlugins:string[];
    dslVersion:string;

    constructor() {
        this.ctx = null;
        this.keywords = [];
        this.importedPlugins = [];
        this.dslVersion = '';
        this.setupInitialListOfKeywords();
        this.timer = new TimeManager(2);
    }

    public async init(uri:string) {
        if (this.ctx == null) {
            this.ctx = new BlueprintContext(uri);
        } else if (this.timer.isReady()) {
            this.addRelativeImports(uri);
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
        appendCompletionItems(this.keywords, cloudifyKeywords);
        appendCompletionItems(this.keywords, toscaDefinitionsVersionKeywords);
        appendCompletionItems(this.keywords, importKeywords);
        appendCompletionItems(this.keywords, pluginNames);
        appendCompletionItems(this.keywords, inputKeywords);
        appendCompletionItems(this.keywords, nodeTypeKeywords);
    };

}

export const cloudify = new CloudifyWords();
