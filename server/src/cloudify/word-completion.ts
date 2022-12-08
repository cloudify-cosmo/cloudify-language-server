/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { stringify } from 'yaml';
import {nodeTemplates} from './constants/default-node-template-properties';
import {CompletionItem, TextDocumentPositionParams} from 'vscode-languageserver/node';

import {getCursor} from './parsing';
import {TimeManager, getCompletionItem} from './utils';
import {getNodeTypesForPluginVersion} from './marketplace';
import {list as nodeTypeKeywords, NodeTypeItem} from './sections/node-types';
import {list as pluginNames, regex as pluginNameRegex} from './sections/plugins';
import {keywords as intrinsicFunctionKeywords} from './sections/intrinsic-functions';
import {CloudifyYAML, BlueprintContext, cloudifyTopLevelKeywords} from './blueprint';
import {name as nodeTemplateName, keywords as nodeTemplateKeywords, getPropertiesAsString} from './sections/node-templates';
import {name as inputsKeyword, keywords as inputKeywords, inputTypes, InputItem, InputItems} from './sections/inputs';
import {getImportableYamls, name as importsKeyword, keywords as importKeywords} from './sections/imports';
import {name as toscaDefinitionsVersionName, keywords as toscaDefinitionsVersionKeywords} from './sections/tosca-definitions-version';

class words {
    timer:TimeManager;
    keywords: CompletionItem[];

    constructor() {
        this.timer = new TimeManager(0.05);
        this.keywords = [];
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

    appendCompletionItems=(keywords:string[], target:CompletionItem[])=>{
        for (const keyword of keywords) {
            this.appendCompletionItem(keyword, target);
        }
    };

}

class CloudifyWords extends words {

    ctx:CloudifyYAML;
    textDoc:TextDocumentPositionParams|null;
    relativeImports:string[];
    importedPlugins:string[];
    importedNodeTypeNames:string[];
    importedNodeTypes:CompletionItem[];
    importedNodeTypeObjects:NodeTypeItem[];
    inputs:InputItems<InputItem>;

    constructor() {
        super();
        this.ctx = new CloudifyYAML();
        this.textDoc = null;
        this.importedPlugins = [];
        this.relativeImports = [];
        this.importedNodeTypeNames = [];
        this.importedNodeTypes = [];
        this.importedNodeTypeObjects = [];
        this.inputs = {};
    }

    public async refresh(uri:string) {
        if (this.ctx.dslVersion === '') {
            this.ctx = new BlueprintContext(uri);
        }
        if (this.timer.isReady()) {
            this.ctx.refresh();
            await this.importPlugins();
            this.inputs = this.ctx.getInputs().contents;
        }
    }

    addRelativeImports=(documentUri:string, target:CompletionItem[])=>{
        for (const value of getImportableYamls(documentUri)) {
            this.appendCompletionItem(value, target);
        }
    };

    public async importPlugins() {
        if (this.ctx != null) {
            if (this.ctx.imports != null) {
                for (const plugin of this.ctx.imports.plugins) {
                    await this._importPlugin(plugin);
                }
            }
        }
    }

    public async importPluginOnCompletion(pluginName:string) {
        if (pluginNameRegex.test(pluginName)) {
            this._importPlugin(pluginName);
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
                    this.importedNodeTypeObjects.push(nodeType);
                    this.importedNodeTypeNames.push(nodeType.type);
                    this.appendCompletionItem(nodeType.type, this.importedNodeTypes);
                }
                this.importedPlugins.push(pluginName);
            }
        }
    }

    refreshCursor=(textDoc:TextDocumentPositionParams|null)=>{
        if (textDoc != null) {
            this.textDoc = textDoc;
            this.ctx.cursor = getCursor(textDoc);
            this.ctx.setDSLSection(textDoc.position.line);
        } else {
            this.ctx.setDSLSection(this.ctx.cursor.lineNumber);
        }
    };

    public contextualizedKeywords(textDoc:TextDocumentPositionParams):CompletionItem[] {
        // We want to suggest keywords based on the current situation.
        this.refreshCursor(textDoc);
    
        const currentKeywordOptions:CompletionItem[] = [];

        if ((this.ctx.section == null) || (this.ctx.cursor.line = '') || (textDoc.position.character <=2)) {
            return this.returnTopLevel(currentKeywordOptions);
        }

        if (this.isTosca()) {
            if (this.ctx.dslVersion === '') {
                return this.returnTosca(currentKeywordOptions);
            }
        }

        if (this.isImports()) {
            if (this.isPluginImports()) {
                return this.returnPluginImports(currentKeywordOptions);
            }
            return this.returnImports(currentKeywordOptions, textDoc.textDocument.uri);
        }

        if (this.isIntrinsicFunction()) {
            this.appendCompletionItems(intrinsicFunctionKeywords, currentKeywordOptions);
            return currentKeywordOptions;
        }

        if (this.isInputIntrinsicFunction()) {
            return this.returnInputNames(currentKeywordOptions);
        }

        if (this.isInput()) {
            if (this.isInputKeywords()) {
                this.appendCompletionItems(inputKeywords, currentKeywordOptions);
                return currentKeywordOptions;
            }
            if (this.isInputTypeKeywords()) {
                this.appendCompletionItems(inputTypes, currentKeywordOptions);
                return currentKeywordOptions;
            }
        }
    
        if (this.isNodeTemplate()) {
            if (this.isNodeTemplateKeywords()) {
                if (this.isNodeTemplateProperties()) {
                    return this.returnNodeTemplatePropertiesKeywords();
                }
                return this.returnNodeTemplateKeywords(currentKeywordOptions);
            }
            if (this.isNodeTemplateTypeKeywords()) {
                return this.returnNodeTemplateTypes(currentKeywordOptions);
            }
        }

        // this.refreshCursor(textDoc);

        return this.returnTopLevel(currentKeywordOptions);
    }

    returnTopLevel=(list:CompletionItem[])=>{
        this.appendCompletionItems(cloudifyTopLevelKeywords, list);
        return list;
    };

    isTosca=():boolean=>{
        if (this.ctx.section === toscaDefinitionsVersionName) {
            return true;
        }
        return false;
    };

    returnTosca=(list:CompletionItem[])=>{
        this.appendCompletionItems(toscaDefinitionsVersionKeywords, list);
        return list;
    };

    isImports=():boolean=>{
        if (this.ctx.section === importsKeyword) {
            return true;
        }
        return false;
    };

    isPluginImports=():boolean=>{
        if (this.ctx.cursor.words.includes('plugin:')) {
            return true;
        }
        return false;
    };

    returnImports=(list:CompletionItem[], uri:string)=>{
        this.appendCompletionItems(importKeywords, list);
        const importableYamls:string[] = getImportableYamls(uri);
        this.appendCompletionItems(importableYamls, list);
        return list;
    };

    returnPluginImports=(list:CompletionItem[])=>{
        this.appendCompletionItems(pluginNames, list);
        return list;
    };

    isInput=():boolean=>{
        if (this.ctx.section != inputsKeyword) {
            return false;
        }
        return true;
    };

    isInputKeywords=():boolean=>{
        if (this.ctx.cursor.words[0] !== '') {
            return false;
        }
        if (this.ctx.cursor.words[1] !== '') {
            return false;
        }
        return true;
    };

    isInputTypeKeywords=():boolean=>{
        if (this.ctx.cursor.words[0] !== '') {
            return false;
        }
        if (this.ctx.cursor.words[1] !== 'type:') {
            return false;
        }
        return true;
    };

    isIntrinsicFunction=():boolean=>{
        if ((this.ctx.cursor.words.includes('{')) && (this.ctx. cursor.words.includes('}'))) {
            if ((this.ctx.cursor.words.indexOf('}') - this.ctx.cursor.words.indexOf('{')) >= 1) {
                return true;
            }
        }
        if (this.ctx.cursor.word.includes('{}')) {
            return true;
        }
        return false;
    };

    isInputIntrinsicFunction=():boolean=>{
        if (this.ctx.cursor.words.includes('{get_input:')) {
            return true;
        }
        if (this.ctx.cursor.words.includes('get_input:')) {
            return true;
        }
        return false;
    };

    isNodeTemplate=():boolean=>{
        if (this.ctx.section === nodeTemplateName) {
            return true;
        } 
        return false;
    };

    isNodeTemplateProperties=():boolean=>{
        console.log(this.ctx.cursor);
        // const linesLength = this.ctx.cursor.lines.length;
        // const currentLine = this.ctx.cursor.lineNumber;
        if (this.ctx.cursor.lines[this.ctx.cursor.lineNumber].length !== 4) {
            return false;
        }
        const typeLine = this.ctx.cursor.lines[this.ctx.cursor.lineNumber-1].split(' ');
        if (typeLine[typeLine.length-2] !== 'type:') {
            return false;
        }
        if (this.importedNodeTypeNames.includes(typeLine[typeLine.length-1])) {
            return true;
        }
        return false;
    };

    isNodeTemplateKeywords=():boolean=>{
        if (this.ctx.cursor.words[0] !== '') {
            return false;
        }
        if (this.ctx.cursor.words[1] !== '') {
            return false;
        }
        return true;
    };

    isNodeTemplateTypeKeywords=():boolean=>{
        if (this.ctx.cursor.words[0] !== '') {
            return false;
        }
        if (this.ctx.cursor.words[1] !== 'type:') {
            return false;
        }
        return true;
    };

    returnNodeTemplateKeywords=(list:CompletionItem[])=>{
        this.appendCompletionItems(nodeTemplateKeywords, list);
        return list;
    };

    returnNodeTemplatePropertiesKeywords=()=>{
        const list:CompletionItem[] = [];

        const linesLength = this.ctx.cursor.lineNumber;
        const typeLine = this.ctx.cursor.lines[linesLength-1].split(' ');
        const nodeTypeName = typeLine[typeLine.length-1];

        this.appendCompletionItems(nodeTemplateKeywords, list);
        // Get the suggested properties for node type.
        for (const nodeTypeObject of this.importedNodeTypeObjects) {
            if (nodeTypeObject.type === nodeTypeName) {
                const suggested = nodeTemplates.get(nodeTypeName);
                if (suggested !== undefined) {
                    this.appendCompletionItem(stringify({'properties': suggested}), list);
                } else {
                    const properties = getPropertiesAsString(nodeTypeObject.properties);
                    this.appendCompletionItem(properties, list);    
                }
            }
        }
        return list;
    };

    returnNodeTemplateTypes=(list:CompletionItem[])=>{
        this.appendCompletionItems(nodeTypeKeywords, list);
        this.appendCompletionItems(this.importedNodeTypeNames, list);
        return list;
    };

    returnInputNames=(list:CompletionItem[])=>{
        for (const inputName of Object.keys(this.inputs)) {
            this.appendCompletionItem(inputName, list);
        }
        return list;
    };
}

export const cloudify = new CloudifyWords();
