/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {CompletionItem, TextDocumentPositionParams} from 'vscode-languageserver/node';

import {getCursor} from './parsing';
import {list as pluginNames} from './sections/plugins';
import {getNodeTypesForPluginVersion} from './marketplace';
import {list as nodeTypeKeywords} from './sections/nodeTypes';
import {name as nodeTemplateName, keywords as nodeTemplateKeywords} from './sections/nodeTemplates';
import {CloudifyYAML, BlueprintContext, cloudifyTopLevelKeywords} from './blueprint';
import {TimeManager, getCompletionItem, appendCompletionItems} from './utils';
import {name as inputsKeyword, keywords as inputKeywords, inputTypes} from './sections/inputs';
import {getImportableYamls, name as importsKeyword, keywords as importKeywords} from './sections/imports';
import {name as toscaDefinitionsVersionName, keywords as toscaDefinitionsVersionKeywords} from './sections/toscaDefinitionsVersion';

class words {
    timer:TimeManager;
    keywords: CompletionItem[];

    constructor() {
        this.timer = new TimeManager(0.5);
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
    importedPlugins:string[];
    relativeImports:string[];
    textDoc:TextDocumentPositionParams|null;
    importedNodeTypeNames:string[];
    importedNodeTypes:CompletionItem[];

    constructor() {
        super();
        this.ctx = new CloudifyYAML();
        this.importedPlugins = [];
        this.relativeImports = [];
        this.importedNodeTypeNames = [];
        this.importedNodeTypes = [];
        this.textDoc = null;
    }

    public async refresh(uri:string) {
        if (this.ctx.dslVersion === '') {
            this.ctx = new BlueprintContext(uri);
        }
        if (this.timer.isReady()) {
            this.ctx.refresh();
            await this.importPlugins();
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
            console.log('Section: ' + this.ctx.section);
            console.log(this.ctx.cursor);
            if (this.isNodeTemplateKeywords()) {
                return this.returnNodeTemplateKeywords(currentKeywordOptions);
            }
            if (this.isNodeTemplateTypeKeywords()) {
                return this.returnNodeTemplateTypes(currentKeywordOptions);
            }
        }

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

    isNodeTemplate=():boolean=>{
        console.log(this.ctx.cursor);
        if (this.ctx.section === nodeTemplateName) {
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

    returnNodeTemplateTypes=(list:CompletionItem[])=>{
        this.appendCompletionItems(nodeTypeKeywords, list);
        this.appendCompletionItems(this.importedNodeTypeNames, list);
        return list;
    };
}

export const cloudify = new CloudifyWords();
