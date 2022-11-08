/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {CompletionItem, TextDocumentPositionParams} from 'vscode-languageserver/node';
import {JSONItems, TimeManager, getCompletionItem, appendCompletionItems} from './utils';
import {getNodeTypesForPluginVersion} from './marketplace';
import {cursor, readLines, getParsed, getCursor} from './parsing';
import {name as toscaDefinitionsVersionName, keywords as toscaDefinitionsVersionKeywords, Validator as CloudifyToscaDefinitionsVersionValidator} from './sections/toscaDefinitionsVersion';
import {list as pluginNames} from './sections/plugins';
import {name as descriptionName} from './sections/description';
import {name as labelsName} from './sections/labels';
import {name as blueprintLabelsName} from './sections/blueprintLabels';
import {getImportableYamls, name as importsKeyword, keywords as importKeywords, Validator as ImportsValidator} from './sections/imports';
import {name as inputsKeyword, keywords as inputKeywords, Validator as InputValidator, inputTypes} from './sections/inputs';
import {name as dslDefnitionName} from './sections/dslDefinitions';
import {name as nodeTypeKeyword, list as nodeTypeKeywords, Validator as NodeTypeValidator} from './sections/nodeTypes';
import {name as nodeTemplatesName} from './sections/nodeTemplates';
import {name as relationshipsName} from './sections/relationships';
import {name as workflowsName} from './sections/workflows';
import {name as capabilitiesName, alternateName as outputsName} from './sections/capabilities';

const cloudifyTopLevelKeywords = [
    toscaDefinitionsVersionName,
    descriptionName,
    labelsName,
    blueprintLabelsName,
    importsKeyword,
    inputsKeyword,
    dslDefnitionName,
    nodeTypeKeyword,
    nodeTemplatesName,
    relationshipsName,
    workflowsName,
    outputsName,
    capabilitiesName,
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
    lines:string[]; // The current lines in the blueprint file.
    dslVersion:string; // The resolved current DSL version. May not be null.
    cursor:cursor;
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
        this.cursor = {line: '', lines: [], lineLength: 0, words: [], word: '', wordLength: 0, indentation: 0} as cursor;
        this.imports = null;
        this.inputs = null;
        this.nodeTypes = null;
        this.refresh();
    }

    refresh=()=>{
        this.parsed = getParsed(this.uri);
        this.lines = readLines(this.uri);
        this.section = this.getDSLSection(null);
        this.dslVersion = this.getDslVersion();
        this.imports = this.getImports();
        this.nodeTypes = this.getNodeTypes();
        this.inputs = this.getInputs();
        // this.dataTypes = this.getDataTypes();
    };

    getDSLSection=(currentLineNumber:number|null)=>{
        if (currentLineNumber == null) {
            currentLineNumber = 0;
        } else if (currentLineNumber < 0) {
            currentLineNumber = 0;
        }
        const lines = this.lines.reverse();
        console.log('lines: ' + lines);
        for (let n = currentLineNumber; n < this.lines.length; n++) {
            const line = lines[n];
            const firstKey: string[] = line.split(':');
            const candidate = cloudifyTopLevelKeywords.find(element => element == firstKey[0]) as string;
            if (cloudifyTopLevelKeywords.includes(candidate)) {
                return candidate;
            }
        }
        return null;
    };

    setDSLSection=(currentLineNumber:number)=>{
        this.section = this.getDSLSection(currentLineNumber);
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
    relativeImports:string[];
    nodeTypeKeywords:CompletionItem[];
    dslVersion:string;

    constructor() {
        this.ctx = null;
        this.keywords = [];
        this.importedPlugins = [];
        this.relativeImports = [];
        this.nodeTypeKeywords = [];
        this.dslVersion = '';
        this.setupInitialListOfKeywords();
        this.timer = new TimeManager(1);
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
            this.relativeImports.push(value);
            this.appendKeyword(value); // We are not using this list very much after context addition, but still not removing it.
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

    appendCompletionItem = (keyword:string, target:CompletionItem[])=>{
        const keywordNames = target.map((obj) => obj.label);
        if (!keywordNames.includes(keyword)) {
            const currentIndex = target.length;
            target.push(
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

    refreshCursor=(textDoc:TextDocumentPositionParams)=>{
        if (this.ctx != null) {
            this.ctx.cursor = getCursor(textDoc);
            this.ctx.setDSLSection(textDoc.position.line);
        }
    };

    public contextualizedKeywords(textDoc:TextDocumentPositionParams):CompletionItem[] {
        // We want to suggest keywords based on the current situation.
        this.refreshCursor(textDoc);
        const currentKeywordOptions:CompletionItem[] = [];
        if ((this.ctx == null) || (this.ctx.section == null)) {
            return this.returnTopLevel(currentKeywordOptions);
        }

        if (this.isTosca()) {
            if (this.dslUnset()) {
                return this.returnTosca(currentKeywordOptions);
            }
        }

        if (this.isImports()) {
            if (this.isPluginImports()) {
                return this.returnPluginImports(currentKeywordOptions);
            }
            return this.returnImports(currentKeywordOptions);
        }

        if (this.isInput()) {
            if (this.returnInputKeywords()) {
                appendCompletionItems(currentKeywordOptions, inputKeywords);
                return currentKeywordOptions;
            }
            if (this.returnInputTypeKeywords()) {
                appendCompletionItems(currentKeywordOptions, inputTypes);
                return currentKeywordOptions;
            }
        }

        // if (this.ctx.section == null) {
        //     return this.returnTopLevel(currentKeywordOptions);
        // }
        return [];
        // return this.keywords;
    }

    returnTopLevel=(list:CompletionItem[])=>{
        appendCompletionItems(list, cloudifyTopLevelKeywords);
        return list;
    };

    isTosca=():boolean=>{
        if (this.ctx != null) {
            if (this.ctx.section === toscaDefinitionsVersionName) {
                return true;
            }
        }
        return false;
    };
    dslUnset=()=>{
        if (this.dslVersion === '') {
            return true;
        }
        return false;

    };
    returnTosca=(list:CompletionItem[])=>{
        appendCompletionItems(list, toscaDefinitionsVersionKeywords);
        return list;
    };
    isImports=():boolean=>{
        if (this.ctx != null) {
            if (this.ctx.section === importsKeyword) {
                return true;
            }
        }
        return false;
    };
    isPluginImports=():boolean=>{
        if (this.ctx == null) {
            return false;
        }
        if (this.ctx.cursor.words.includes('plugin:')) {
            return true;
        }
        return false;
    };
    returnImports=(list:CompletionItem[])=>{
        appendCompletionItems(list, importKeywords);
        appendCompletionItems(list, this.relativeImports);
        return list;
    };
    returnPluginImports=(list:CompletionItem[])=>{
        appendCompletionItems(list, pluginNames);
        return list;
    };
    isInput=():boolean=>{
        if (this.ctx == null) {
            return false;
        }
        if (this.ctx.section != inputsKeyword) {
            return false;
        }
        return true;
    };
    returnInputKeywords=():boolean=>{
        if (this.ctx == null) {
            return false;
        }
        if (this.ctx.cursor.words[0] !== '') {
            return false;
        }
        if (this.ctx.cursor.words[1] !== '') {
            return false;
        }
        return true;
    };
    returnInputTypeKeywords=():boolean=>{
        if (this.ctx == null) {
            return false;
        }
        if (this.ctx.cursor.words[0] !== '') {
            return false;
        }
        if (this.ctx.cursor.words[1] !== 'type:') {
            return false;
        }
        return true;
    };

}

export const cloudify = new CloudifyWords();
