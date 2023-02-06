
import {stringify} from 'yaml';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {nodeTemplates} from './constants/default-node-template-properties';
import {CompletionItem, Diagnostic, TextDocumentPositionParams} from 'vscode-languageserver/node';

import { cfyLint } from './cfy-lint';
import {words} from './word-completion';
import {documentCursor} from './parsing';
import {getNodeType, validIndentation, getParentSection, validIndentationAndKeyword} from './utils';
import {getNodeTypesForPluginVersion} from './marketplace';
import {list as nodeTypeKeywords, NodeTypeItem} from './sections/node-types';
import {list as pluginNames, regex as pluginNameRegex} from './sections/plugins';
import {keywords as intrinsicFunctionKeywords} from './sections/intrinsic-functions';
import {CloudifyYAML, BlueprintContext, cloudifyTopLevelNames} from './blueprint';
import {getImportableYamls, name as importsKeyword, keywords as importKeywords, pluginRegex} from './sections/imports';
import {name as inputsName, keywords as inputKeywords, inputTypes, InputItem, InputItems} from './sections/inputs';
import {name as nodeTemplateName, keywords as nodeTemplateKeywords, getPropertiesAsString} from './sections/node-templates';
import {name as toscaDefinitionsVersionName, keywords as toscaDefinitionsVersionKeywords} from './sections/tosca-definitions-version';


class CloudifyWords extends words {

    ctx:CloudifyYAML;
    textDoc:TextDocumentPositionParams|null;
    relativeImports:string[];
    importedPlugins:string[];
    importedNodeTypeNames:string[];
    importedNodeTypes:CompletionItem[];
    importedNodeTypeObjects:NodeTypeItem[];
    inputs:InputItems<InputItem>;
    diagnostics:Diagnostic[];

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
        this.diagnostics = [];
    }

    public async refresh(textDocument:TextDocument) {
        if (this.ctx.dslVersion === '') {
            this.ctx = new BlueprintContext(textDocument.uri);
        }
        if (this.timer.isReady()) {
            await this.importPlugins();
            this.inputs = this.ctx.getInputs().contents;
            this.diagnostics = await cfyLint(textDocument).then((result) => {return result;});}
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
            this.ctx.cursor = new documentCursor(textDoc);
        }
    };

    public contextualizedKeywords(textDoc:TextDocumentPositionParams):CompletionItem[] {
        // We want to suggest keywords based on the current situation.
        this.refreshCursor(textDoc);
    
        const currentKeywordOptions:CompletionItem[] = [];


        if (this.isNewSection()) {
            return this.returnTopLevel(currentKeywordOptions);
        }
        if (this.isTosca()) {
            if (this.ctx.dslVersion === '') {
                return this.returnTosca(currentKeywordOptions);
            }
        }
        if (this.isImports()) {
            if (this.isPluginImport()) {
                return this.returnPluginImports(currentKeywordOptions);
            }
            return this.returnImports(currentKeywordOptions, textDoc.textDocument.uri);
        }
        if (this.isInput()) {
            if (this.isTypeKeywords()) {
                this.appendCompletionItems(inputTypes, currentKeywordOptions);
                return currentKeywordOptions;
            }
            if (this.isKeywords()) {
                this.appendCompletionItems(inputKeywords, currentKeywordOptions);
                return currentKeywordOptions;
            }
        }

        if (this.isIntrinsicFunction()) {
            this.appendCompletionItems(intrinsicFunctionKeywords, currentKeywordOptions);
            return currentKeywordOptions;
        }

        if (this.isInputIntrinsicFunction()) {
            return this.returnInputNames(currentKeywordOptions);
        }

    
        if (this.isNodeTemplate()) {
            // This will check if the current line is like: "type:"
            if (this.isTypeKeywords()) {
                // If it's "type", then we want like "cloudify.nodes.Root"
                return this.returnNodeTemplateTypes(currentKeywordOptions);
            }
            // This will check if it should be any indented
            if (this.isKeywords()) {              
                if (this.isNodeTemplateProperties()) {
                    return this.returnNodeTemplatePropertiesKeywords();
                }
                // This will return like "type", "properties" "relationships" etc.
                return this.returnNodeTemplateKeywords(currentKeywordOptions);
            }
        }

        return this.returnTopLevel(currentKeywordOptions);
    }

    returnTopLevel=(list:CompletionItem[])=>{
        this.appendCompletionItems(cloudifyTopLevelNames, list);
        return list;
    };
    returnTosca=(list:CompletionItem[])=>{
        this.appendCompletionItems(toscaDefinitionsVersionKeywords, list);
        return list;
    };
    returnImports=(list:CompletionItem[], uri:string)=>{
        this.appendCompletionItems(importKeywords, list);
        const importableYamls:string[] = getImportableYamls(uri);
        this.appendCompletionItems(importableYamls, list);
        return list;
    };
    returnPluginImports=(list:CompletionItem[])=>{
        this.appendPluginCompletionItems(pluginNames, list);
        return list;
    };
    returnNodeTemplateKeywords=(list:CompletionItem[])=>{
        this.appendCompletionItems(nodeTemplateKeywords, list);
        return list;
    };
    returnNodeTemplatePropertiesKeywords=()=>{
        const list:CompletionItem[] = [];
        
        const nodeTypeName = getNodeType(this.ctx.cursor);
        console.log(nodeTypeName);
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
    isNewSection=():boolean=>{
        return (this.ctx.cursor.indentation == 0);
    };
    isTosca=():boolean=>{
        return this.ctx.cursor.line.startsWith(toscaDefinitionsVersionName);
    };
    isImports=():boolean=>{
        return this.ctx.section === importsKeyword;
    };
    isPluginImport=():boolean=>{
        return this.ctx.cursor.line.match(pluginRegex) != null;
    };
    isInput=():boolean=>{
        return this.ctx.section === inputsName;
    };
    isKeywords=():boolean=>{
        return validIndentation(this.ctx.cursor.line);
    };
    isTypeKeywords=():boolean=>{
        return validIndentationAndKeyword(this.ctx.cursor.line, 'type:');
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
        return this.ctx.section === nodeTemplateName;
    };
    isNodeTemplateProperties=():boolean=>{
        if (getParentSection(this.ctx.cursor) !== '') {
            return true;
        }
        return false;
    };
}

export const cloudify = new CloudifyWords();
