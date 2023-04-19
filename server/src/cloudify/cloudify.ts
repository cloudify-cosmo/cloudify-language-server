
import {stringify} from 'yaml';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {nodeTemplates} from './constants/default-node-template-properties';
import {CompletionItem, Diagnostic, TextDocumentPositionParams} from 'vscode-languageserver/node';

import { cfyLint } from './cfy-lint';
import { words } from './word-completion';
import {documentCursor} from './parsing';
import {
    isMatch,
    getNodeType,
    validIndentation,
    getParentSection,
    validIndentationAndKeyword
} from './utils';
import {getNodeTypesForPluginVersion} from './marketplace';
import {list as nodeTypeKeywords, NodeTypeItem} from './sections/node-types';
import {list as pluginNames, regex as pluginNameRegex} from './sections/plugins';
import {
    keywords as intrinsicFunctionKeywords,
    lineContainsFn,
    lineMayContainFn,
    wordsMayIndicateFn,
    lineContainsGetInput,
    lineContainsConcatFn,
    lineContainsGetNodeTemplate
} from './sections/intrinsic-functions';
import {CloudifyYAML, BlueprintContext, cloudifyTopLevelNames} from './blueprint';
import {getImportableYamls, name as importsKeyword, keywords as importKeywords, pluginRegex} from './sections/imports';
import {name as inputsName, keywords as inputKeywords, inputTypes, InputItem, InputItems} from './sections/inputs';
import {isToscaDefinitionsLine, keywords as toscaDefinitionsVersionKeywords} from './sections/tosca-definitions-version';
import {name as nodeTemplateName, keywords as nodeTemplateKeywords, getPropertiesAsString, NodeTemplateItem, NodeTemplateItems} from './sections/node-templates';


class CloudifyWords extends words {

    ctx:CloudifyYAML;
    textDoc:TextDocumentPositionParams|null;
    relativeImports:string[];
    importedPlugins:string[];
    importedNodeTypeNames:string[];
    importedNodeTypes:CompletionItem[];
    importedNodeTypeObjects:NodeTypeItem[];
    inputs:InputItems<InputItem>;
    nodeTemplates:NodeTemplateItems<NodeTemplateItem>;
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
        this.nodeTemplates = {};
        this.diagnostics = [];
    }

    public async refresh(textDocument:TextDocument) {
        if (this.ctx.dslVersion === '') {
            this.ctx = new BlueprintContext(textDocument.uri);
        } else if ((this.ctx instanceof BlueprintContext) && (this.timer.isReady())) {
            this.ctx.refresh();
            await this.importPlugins();
            this.inputs = this.ctx.getInputs().contents;
            this.nodeTemplates = this.ctx.getNodeTemplates().contents;
        }
        if (this.cfyLintTimer.isReady()) {
            this.diagnostics = await cfyLint(textDocument).then((result) => {return result;});
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
                    if (nodeType.type.startsWith('cloudify.nodes.')) {
                        this.importedNodeTypeObjects.push(nodeType);
                        this.importedNodeTypeNames.push(nodeType.type);
                        this.appendCompletionItem(nodeType.type, this.importedNodeTypes);   
                    }
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

        if (isToscaDefinitionsLine(this.ctx.cursor.line)) {
            return this.returnTosca(currentKeywordOptions);
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
            if (lineContainsFn(this.ctx.cursor.line)) {
                if (this.isInputIntrinsicFunction()) {
                    return this.returnInputNames(currentKeywordOptions);
                }
                if (this.isNodeTemplateIntrinsicFunction()) {
                    return this.returnNodeTemplateNames(currentKeywordOptions);
                }   
            }
            this.appendCompletionItems(intrinsicFunctionKeywords, currentKeywordOptions);
            return currentKeywordOptions;
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

        return [];
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
    returnNodeTemplateNames=(list:CompletionItem[])=>{
        for (const nodeTemplateName of Object.keys(this.nodeTemplates)) {
            const argument = `[ ${nodeTemplateName}, INSERT_PROPERTY_NAME ]`;
            this.appendCompletionItem(argument, list);
        }
        return list;
    };
    isNewSection=():boolean=>{
        console.log(this.ctx.cursor.line);
        return (isMatch(this.ctx.cursor.line, '^$'));
    };
    isTosca=():boolean=>{
        return isToscaDefinitionsLine(this.ctx.cursor.line);
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
        if (lineMayContainFn(this.ctx.cursor.line)) {
            return true;
        } else if (wordsMayIndicateFn(this.ctx.cursor.words))  {
            return true;
        }
        return false;
    };
    isInputIntrinsicFunction=():boolean=>{
        return lineContainsGetInput(this.ctx.cursor.line);
    };
    isNodeTemplateIntrinsicFunction=():boolean=>{
        return lineContainsGetNodeTemplate(this.ctx.cursor.line);
    };
    isConcatIntrinsicFunction=():boolean=>{
        return lineContainsConcatFn(this.ctx.cursor.line);
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
