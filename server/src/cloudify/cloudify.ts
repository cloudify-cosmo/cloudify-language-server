
import {
    Pair,
    Scalar,
    YAMLMap,
    stringify,
    parseDocument,
} from 'yaml';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {nodeTemplates} from './constants/default-node-template-properties';
import {CompletionItem, Diagnostic, TextDocumentPositionParams} from 'vscode-languageserver/node';
import {readFile, semanticToken, documentCursor} from './parsing';
import {cfyLint} from './cfy-lint';
import {words} from './word-completion';
import {
    isPair,
    isScalar,
    isYAMLMap,
    isYAMLSeq,
    isTopLevel,
    makeCamelCase,
    pairIsInstrinsicFunction,
} from './utils';
import {getNodeTypesForPluginVersion} from './marketplace';
import {
    NodeTypeItem,
    list as nodeTypeKeywords,
} from './sections/node-types';
import {
    list as pluginNames,
    regex as pluginNameRegex
} from './sections/plugins';
import {
    CloudifyYAML,
    BlueprintContext,
    cloudifyTopLevelNames
} from './blueprint';
import {
    getImportableYamls,
    name as importsName,
    keywords as importKeywords,
} from './sections/imports';
import {
    inputTypes,
    name as inputsName,
    keywords as inputKeywords,
} from './sections/inputs';
import {
    name as toscaDefinitionsVersionName,
    keywords as toscaDefinitionsVersionKeywords
} from './sections/tosca-definitions-version';
import {
    getPropertiesAsString,
    name as nodeTemplateName,
    keywords as nodeTemplateKeywords,
} from './sections/node-templates';

const MAX_CFY_LINT_PROCESSES = 3;
let ConcurrentProcesses = 0;

export class CloudifyWords extends words {

    ctx:CloudifyYAML;
    textDoc:TextDocumentPositionParams|null;
    relativeImports:string[];
    importedPlugins:string[];
    importedNodeTypeNames:string[];
    importedNodeTypes:CompletionItem[];
    importedNodeTypeObjects:NodeTypeItem[];
    semanticTokens:semanticToken[];
    //eslint-disable-next-line
    inputs:Object;
    //eslint-disable-next-line
    nodeTemplates:Object;
    diagnostics:Diagnostic[];
    _currentKeywords:CompletionItem[];
    _importsReload:boolean;
    doc:TextDocument|null;

    constructor() {
        super();
        this.ctx = new CloudifyYAML();
        this.textDoc = null;
        this.importedPlugins = [];
        this.relativeImports = [];
        this.importedNodeTypeNames = [];
        this.importedNodeTypes = [];
        this.importedNodeTypeObjects = [];
        this.semanticTokens = [];
        this.inputs = {};
        this.nodeTemplates = {};
        this.diagnostics = [];
        this._currentKeywords = [];
        this._importsReload = false;
        this.doc = null;
    }
    public get importsReload() {
        return this._importsReload;
    }
    public set importsReload(value:boolean) {
        this._importsReload = value;
    }
    public get currentKeywords() {
        return this._currentKeywords;
    }
    public set currentKeywords(value:CompletionItem[]) {
        this._currentKeywords = value;
    }
    public appendCurrentKeyword(value:string) {
        this.appendCompletionItem(value, this._currentKeywords);
    }
    public appendCurrentKeywords(values:string[]) {
        this.appendCompletionItems(values, this._currentKeywords);
    }
    //eslint-disable-next-line
    registerTopLevelSemanticToken=(item:any)=>{
        const line = this.ctx.cursor.getLineNumberFromCurrentCharacter(item.key.range[0] + 1);
        this.registerSemanticToken(item, line, item.key.value.length, 0, 1, 1);
        if (item.key.value === importsName) {
            this.registerImportSemanticToken(item);
        } else if (item.key.value === inputsName) {
            this.registerInputSemanticToken(item);
        } else if (item.key.value === nodeTemplateName) {
            this.registerInputSemanticToken(item);
        }
    };
    //eslint-disable-next-line
    registerInputSemanticToken=(item:any)=>{
        const startPoint = this.ctx.cursor.fileIndentation;
        if (isYAMLMap(item.value)) {
            for (const mapItem of item.value.items) {
                const line = this.ctx.cursor.getLineNumberFromCurrentCharacter(mapItem.key.range[0]);
                this.registerSemanticToken(
                    mapItem,
                    line,
                    mapItem.key.value.length,
                    startPoint,
                    2,
                    2
                );
                if (isYAMLMap(mapItem.value)) {
                    for (const nestedInputItem of mapItem.value.items) {
                        const line = this.ctx.cursor.getLineNumberFromCurrentCharacter(nestedInputItem.key.range[0]);
                        this.registerSemanticToken(
                            nestedInputItem,
                            line,
                            nestedInputItem.key.value.length,
                            2 * startPoint,
                            10,
                            1
                        );
                    }
                }
            }
        }
    };
    //eslint-disable-next-line
    registerImportSemanticToken=(item:any)=>{
        const startPoint = this.ctx.cursor.fileIndentation + 2;
        for (const seqItem of item.value.items) {
            const line = this.ctx.cursor.getLineNumberFromCurrentCharacter(seqItem.range[1]);
            if ((seqItem.value == null) || (seqItem.value === 'undefined') || (seqItem.value.length < 1)) {
                return;
            } else if (seqItem.value.startsWith('plugin:')) {
                this.registerSemanticToken(seqItem, line, 6, startPoint, 10, 1);
                const pluginName = seqItem.value.split(':')[1];
                this.registerSemanticToken(seqItem, line, pluginName.length, startPoint + 7, 12, 1);
            } else {
                this.registerSemanticToken(seqItem, line, seqItem.value.length, startPoint, 12, 1);
            }
        }
    };
    //eslint-disable-next-line
    registerSemanticToken=(item:any, line:number, length:number, character: number, tokenType:number, tokenModifier:number)=>{
        this.semanticTokens.push({
            item: item,
            line: line,
            character: character,
            length: length,
            tokenType: tokenType,
            tokenModifier: tokenModifier,
        });
    };

    private registerImports() {
        if (this.ctx.section !== importsName) {
            return;
        }
        //eslint-disable-next-line
        if (this.ctx.cursor.line.match(/^(\s){0,4}(\-(\s)plugin:)/)) {
            this.registerPluginImports();
            if (this.importedNodeTypeNames.length == 0) {
                this.importsReload == true;
            }
        //eslint-disable-next-line
        } else if (this.ctx.cursor.line.match(/^(\s){0,4}(\-){1}/)) {
            for (const kw of importKeywords) {
                if ((!(this.ctx.rawImports.includes(kw)) || (kw === 'plugin:'))) {
                    this.appendCurrentKeyword(kw);
                }
            }
            if (this.textDoc != null) {
                const importableYamls:string[] = getImportableYamls(this.textDoc.textDocument.uri);
                this.appendCurrentKeywords(importableYamls);
            }
        }
    }

    private registerInputs() {
        if (this.ctx.section !== inputsName) {
            return;
        }
    }

    private registerDescription() {
        if (this.ctx.section !== 'description') {
            return;
        }
        this.currentKeywords = [];
        this.appendCurrentKeyword('This blueprint does xyz...');
    }

    private registerToscaVersions() {
        if (this.ctx.cursor.line.match(/^tosca_definitions_version:(\s){1}/)) {
            this.currentKeywords = [];
            this.appendCurrentKeywords(toscaDefinitionsVersionKeywords);   
        }
    }

    private registerPluginImports() {
        if (this.ctx.section !== importsName) {
            return;
        }
        const unimportedPlugins = [];
        for (const name of pluginNames) {
            if (!(this.ctx.rawImports.includes(name))) {
                unimportedPlugins.push(name);
            }
        }
        this.appendPluginCompletionItems(unimportedPlugins, this._currentKeywords);
    }

    private registerSpaces() {
        if (this.ctx.cursor.line.match(/(:){1}(\s){1,}$/)) {
            return;
        }
        const currentIndent = this.ctx.cursor.fileIndentation - this.ctx.cursor.indentation;
        let space = '';
        if (currentIndent > 0) {
            space = `${'  '.repeat(currentIndent)}`;
        }
        if ((this.ctx.cursor.lineNumber > 1) && (this.ctx.cursor.line !== undefined)) {
            //eslint-disable-next-line
            if ((this.ctx.section === importsName) && !(this.ctx.cursor.line.match(/^(\s){0,4}[\-]{1}/))) {
                space += '- ';
                this.appendCurrentKeyword(space);
            } else {
                this.appendCurrentKeyword(space);
            }
        }
    }

    public async refresh(textDocument:TextDocument) {
        // TODO: See if we can load an already existing file completely.
        if (this.ctx.dslVersion === '') {
            this.ctx = new BlueprintContext(textDocument.uri);
        }
        if ((this.ctx instanceof BlueprintContext) && (this.timer.isReady())) {
            try {
                this.ctx.refresh();
            } catch {
                this.registerTopLevelCursor();
            }
        }
        this.doc = textDocument;
        await this.privateRefresh();
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
                console.debug(`Importing previously unimported plugin ${pluginName}.`);
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

    public async privateRefresh() {
    
        let doRefresh = false;
        let latestContent = '';
        if ((this.ctx.cursor.raw == null) && (this.textDoc == null)) {
            // console.warn('Unable to execute refresh, because we do not have raw text document.');
        } else if (this.ctx.cursor.raw != null) {
            latestContent = readFile(this.ctx.cursor.raw.textDocument.uri);
            doRefresh = true;
        } else if (this.textDoc != null) {
            latestContent = readFile(this.textDoc.textDocument.uri);
            doRefresh = true;
        }

        if ((doRefresh == true) && (latestContent !== '')) {
            this._currentKeywords = [];
            if (this.doc != null && this.investigateYaml(this.doc.uri) && this.cfyLintTimer.isReady()) {
                if (ConcurrentProcesses < MAX_CFY_LINT_PROCESSES){
                    ConcurrentProcesses += 1;
                    this.diagnostics = [];
                    // TODO: FIgure out if the textDocument vs this.textDoc.
                    if (this.doc != null) {
                        this.diagnostics = await cfyLint(this.doc).then((result) => {return result;});
                        ConcurrentProcesses -= 1;
                    }   
                }  
            }

            this.inputs = this.ctx.assignInputs();
            this.nodeTemplates = this.ctx.assignNodeTemplates();
        } else {
            this.appendCurrentKeyword(`${toscaDefinitionsVersionName}: `);
        }
    }

    public areRawYAMLSectionsEquivalent(str:string, sectionName:string):boolean {
        if (sectionName === toscaDefinitionsVersionName) {
            if ((this.ctx.rawDslVersion != null) && (this.ctx.rawDslVersion === str)) {
                return true;
            }
        } else if (sectionName === importsName) {
            if ((this.ctx.rawImports != null) && (this.ctx.rawImports === str)) {
                return true;
            }
        } else if (sectionName === inputsName) {
            if ((this.ctx.rawInputs != null) && (this.ctx.rawInputs === str)) {
                return true;
            }
        } else if (sectionName === nodeTemplateName) {
            if ((this.ctx.rawNodeTemplates != null) && (this.ctx.rawNodeTemplates === str)) {
                return true;
            }
        }
        return false;   
    }

    public assignRawTopLevel(item:Pair) {
        const key = item.key as Scalar;
        this.ctx.processingSection = key.value as string;
        const itemStr = item.toString(); // Change this to use some lower level object than string.
        
        if (this.ctx.processingSection === toscaDefinitionsVersionName) {
            //eslint-disable-next-line
            // @ts-ignore
            const toscaDSL = item.value.value as string; 
            if (this.areRawYAMLSectionsEquivalent(itemStr, toscaDefinitionsVersionName)) {
                // console.debug('assignRawTopLevel: The DSL has not changed.');
            } else if (toscaDefinitionsVersionKeywords.includes(toscaDSL)) {
                this.ctx.rawDslVersion = itemStr;
                this.ctx.dslVersion = toscaDSL;
            } else {
                // console.debug('assignRawTopLevel: Could not assign tosca.');
            }
        } else if (this.ctx.processingSection === importsName) {
            // This is the imports section.
            if (this.areRawYAMLSectionsEquivalent(itemStr, importsName)) {
                // console.debug('assignRawTopLevel: The imports section has not changed.');
            } else {
                this.ctx.rawImports = itemStr;
                this.importsReload = true;
            }
        } else if (this.ctx.processingSection === inputsName) {
            // This is a inputs section.
            if (this.areRawYAMLSectionsEquivalent(itemStr, inputsName)) {
                // console.debug('assignRawTopLevel: The inputs section has not changed.');
            } else {
                this.ctx.rawInputs = itemStr;
            }
        } else if (this.ctx.processingSection === nodeTemplateName) {
            // This is a node templates section.
            if (this.areRawYAMLSectionsEquivalent(itemStr, nodeTemplateName)) {
                // console.debug('assignRawTopLevel: The node templates section has not changed.');
            } else {
                this.ctx.rawNodeTemplates = itemStr;
            }
        }
        return true;
    }

    //eslint-disable-next-line
    private unAssignDocumentation(item:any):boolean {
        if ((item.key.value === 'description') && (item.value.value != null) && (item.value.value.length > 1)) {
            if ((item.value.type === 'BLOCK_FOLDED') && (this.ctx.cursor.indentation < 1)) {
                return true;
            } else if ((item.value.type === 'BLOCK_LITERAL') && (this.ctx.cursor.indentation < 1)) {
                return true;
            } else if ((item.value.type === 'PLAIN') && (this.ctx.cursor.line.length < 1)) {
                return true;
            } 
        }
        return false;
    }

    //eslint-disable-next-line
    private assignSections(nextItem:any, item:any) {
        if ((item.value != null) && (item.key != null)) {
            if (this.unAssignDocumentation(item)) {
                this.ctx.section = '';  
                return;
            }
            if ((nextItem == null) && (this.ctx.cursor.currentCharacter > item.key.range[2])) {
                this.ctx.sectionStart = item.key.range[0];
                this.ctx.sectionEnd = this.ctx.cursor.finalCharacter;
                this.ctx.section = item.key.value;
                this.ctx.yamlPath = '';
            } else if (this.ctx.cursor.currentCharacter <= item.value.range[2] + 1) {
                this.ctx.sectionStart = item.key.range[0];
                this.ctx.sectionEnd = item.value.range[2] + 1;   
            } else if ((nextItem.key != null) && (this.ctx.cursor.character <= nextItem.key.range[0])) {
                this.ctx.sectionStart = item.key.range[0];
                this.ctx.sectionEnd = nextItem.key.range[0] + 1;   
            }
        }

        if ((this.ctx.cursor.currentCharacter <= this.ctx.sectionEnd) && (this.ctx.cursor.currentCharacter >= this.ctx.sectionStart) && (cloudifyTopLevelNames.includes(item.key.value))) {
            this.ctx.section = item.key.value;
            this.ctx.yamlPath = '';
        }
    }

    //eslint-disable-next-line
    public recurseParsedDocument(nextItem:any, item:any, parentItem:any) {
        if (item === undefined) {
            return false;
        }
        let charInside = false;
        if (isPair(item)) {
            //eslint-disable-next-line
            // @ts-ignore
            const itemKeyRange = item.key.range;
            const itemLineNumber = this.ctx.cursor.getLineNumberFromCurrentCharacter(itemKeyRange[0] + 1);
            if ((this.ctx.cursor.lines[itemLineNumber].split(/^(\s)+/).length == 1) && isTopLevel(item)) {
                //eslint-disable-next-line
                // @ts-ignore
                this.registerTopLevelSemanticToken(item);
                this.assignRawTopLevel(item);
                if (isPair(nextItem)) {
                    this.assignSections(nextItem, item);
                } else if (nextItem == null) {
                    this.assignSections(nextItem, item);
                }
            }
            const charInsideValue = this.recurseParsedDocument(nextItem, item.value, item);
            if (charInsideValue) {
                charInside = true;
                //eslint-disable-next-line
                // @ts-ignore
                this.ctx.yamlPath = item.key.value + '.' + this.ctx.yamlPath;
            } else if (nextItem == null) {
                //eslint-disable-next-line
                // @ts-ignore
                this.ctx.yamlPath = item.key.value + '.' + this.ctx.yamlPath;
            }
        } else if (isScalar(item)) {
            charInside = this.ctx.cursor.currentCharInsideScalar(item.range);
            if ((!charInside) && (item.value == null) && (this.ctx.cursor.currentCharacter + 1 >= this.ctx.cursor.finalCharacter)) {
                charInside = true;
            }
            return charInside;
        } else if (isYAMLSeq(item)) {
            let insideSequence = false;
            for (const seqItem of item.items) {
                insideSequence = this.recurseParsedDocument(nextItem, seqItem, item);
                if (insideSequence == true) {
                    charInside = true;
                }
            }
        } else if (isYAMLMap(item)) {
            let insideMap = false;
            for (const mapItem of item.items) {
                if (pairIsInstrinsicFunction(mapItem)) {
                    console.log(`?The item ${item} is an intrinsic function.`);
                } else {
                    if ((!(this.registerNestedNodeTemplate(mapItem, parentItem))) || (!(this.registerNestedInput(mapItem, parentItem)))) {
                        insideMap = this.recurseParsedDocument(nextItem, mapItem, item);
                        if (insideMap == true) {
                            charInside = true;
                        }
                    }
                }
            }
        }
        return charInside;
    }

    //eslint-disable-next-line
    private registerNestedInput(nextItem:any, parentItem:any):boolean {
        let contains = true;
        try {
            if (parentItem.key.value === inputsName) {
                if ((isPair(nextItem)) && (isScalar(nextItem.key))) {
                    const char = this.ctx.cursor.currentCharacter;
                    //eslint-disable-next-line
                    // @ts-ignore
                    const nextItemKeyValue:string = nextItem.key.value;
                    //eslint-disable-next-line
                    // @ts-ignore
                    const nextItemValueRange:Array = nextItem.value.range;
                    //eslint-disable-next-line
                    // @ts-ignore
                    const nextItemValueJSON = nextItem.value.toJSON();
                    if ((isYAMLMap(nextItem.value)) || (isScalar(nextItem.value))) {
                        if ((nextItemValueRange[0] < char) && (char <= nextItemValueRange[2] + 4)) {
                            this.currentKeywords = [];
                            if (this.ctx.cursor.line.match(/^(\s){2,4}(type:){1}/)) {
                                this.appendCurrentKeywords(inputTypes);
                            } else if (this.ctx.cursor.line.match(/^(\s){2,4}(required:){1}/)) {
                                this.appendCurrentKeywords(['true', 'false']);
                            } else if (this.ctx.cursor.line.match(/^(\s){2,4}(display_label:){1}/)) {
                                this.appendCurrentKeyword(makeCamelCase(nextItemKeyValue));
                            } else if (this.ctx.cursor.line.match(/^(\s){2,4}(default:){1}/)) {
                                //eslint-disable-next-line
                                if (isYAMLMap(nextItem.value) && (nextItemValueJSON.hasOwnProperty('type'))) {
                                    if (nextItemValueJSON['type'] === 'boolean') {
                                        this.appendCurrentKeywords(['true', 'false']);
                                    }
                                }
                            }
                        } else if ((nextItemValueRange[1] + 8 >= char) && (this.ctx.cursor.isLineIndentedLevel(2))) {
                            for (const name of inputKeywords) {
                                if (isYAMLMap(nextItem.value)) {
                                    const nextItemValueJSON = nextItem.value.toJSON();
                                    //eslint-disable-next-line
                                    if (nextItemValueJSON.hasOwnProperty(name)) {
                                        continue;
                                    }
                                }
                                this.appendCurrentKeyword(`${name}:`);
                            }
                        }
                    }
                }
            }
        } catch {
            contains = false;
        }
        return contains;
    }

    //eslint-disable-next-line
    private registerNodeTypeProperties(nextItem:any) {
        let nodeTypeName = '';
        try {
            for (const item of nextItem.value.items) {
                if (isPair(item)) {
                    //eslint-disable-next-line
                    // @ts-ignore
                    if ((item.key.value === 'type') && (item.value.value != null)) {
                        //eslint-disable-next-line
                        // @ts-ignore
                        nodeTypeName = item.value.value;
                        break;
                    }
                }
            }
        } catch {
            // pass
        }
        if (nodeTypeName === '') {
            return;
        }
        for (const nodeTypeObject of this.importedNodeTypeObjects) {
            console.debug(`Registering node type: ${nodeTypeObject.type}`);
            if (nodeTypeObject.type === nodeTypeName) {
                let newSection;
                const suggested = nodeTemplates.get(nodeTypeName);
                if (this.ctx.cursor.lines[this.ctx.cursor.lineNumber - 2].includes('properties')) {
                    newSection = new Map();
                } else {
                    if (suggested != undefined) {
                        newSection = {'properties': suggested};
                        this.appendCurrentKeyword(stringify({'properties': suggested}));
                        return;
                    }
                    newSection = {'properties': new Map()};
                }
                const properties = getPropertiesAsString(nodeTypeObject.properties, newSection);
                this.appendCurrentKeyword(properties);
            }
        }
    }

    //eslint-disable-next-line
    private registerNestedNodeTemplate(nextItem:any, parentItem:any):boolean {
        let contains = true;
        try {
            if (parentItem.key.value === nodeTemplateName) {
                if ((isPair(nextItem)) && (isScalar(nextItem.key))) {
                    const char = this.ctx.cursor.currentCharacter;
                    //eslint-disable-next-line
                    // @ts-ignore
                    const nextItemValueRange:Array = nextItem.value.range;
                    if ((isYAMLMap(nextItem.value)) || (isScalar(nextItem.value))) {
                        if ((nextItemValueRange[0] < char) && (char <= nextItemValueRange[2] + 4)) {
                            this.currentKeywords = [];
                            if (this.ctx.cursor.line.match(/^(\s){2,4}(type:){1}/)) {
                                this.appendCurrentKeywords(nodeTypeKeywords);
                                this.appendCurrentKeywords(this.importedNodeTypeNames);
                            } else if (this.ctx.cursor.line.match(/^(\s){2,4}(relationships:){1}/)) {
                                // TODO: Add Relationships Stuff
                            }
                        } else if (nextItemValueRange[1] + 8 >= char) {
                            if (this.ctx.cursor.isLineIndentedLevel(2)) {
                                for (const name of nodeTemplateKeywords) {
                                    if (isYAMLMap(nextItem.value)) {
                                        const nextItemValueJSON = nextItem.value.toJSON();
                                        //eslint-disable-next-line
                                        if (nextItemValueJSON.hasOwnProperty(name)) {
                                            if (this.ctx.cursor.lines[this.ctx.cursor.lineNumber - 2].includes(name)) {
                                                this.appendCurrentKeyword(' '.repeat(this.ctx.cursor.fileIndentation));
                                            }
                                            continue;
                                        }
                                    }
                                    this.appendCurrentKeyword(`${name}:`);
                                }   
                            } else if (this.ctx.cursor.isLineIndentedLevel(1)) {
                                this.appendCurrentKeyword(' '.repeat(this.ctx.cursor.fileIndentation));
                            }
                        } else if (nextItemValueRange[1] + 9 >= char) {
                            if (this.ctx.cursor.isLineIndentedLevel(3)) {
                                this.registerNodeTypeProperties(nextItem);
                            }
                        }
                    }
                }
            }
        } catch {
            contains = false;
        }
        return contains;
    }

    public investigateYaml(file:string) {
        let successful = true;
        let doc;
        try {
            doc = parseDocument(file);
            console.log('******************** investigateYaml  ********************');

        } catch (error) {
            console.error(`Unable to parse ${file}. Error: ${error}`);
            successful = false;
        }
        this.ctx.cursor.lines = file.split('\n');
        if (doc !== undefined) {
            if ((doc.contents != null) && (doc.contents instanceof YAMLMap)) {
                let previousItem:any; //eslint-disable-line
                let parentItem:any; //eslint-disable-line
                for (const nextItem of doc.contents.items) {
                    try {
                        this.recurseParsedDocument(nextItem, previousItem, parentItem);
                    } catch (error) {
                        console.error(`An error occured while parsing item: ${nextItem}.`);
                        console.error(`Error: ${error}`);
                    }
                    parentItem = previousItem;
                    previousItem = nextItem;
                }
                this.recurseParsedDocument(null, previousItem, parentItem);
                this.registerTopLevelJson(doc.contents.toJSON());
            }
        }
        this.registerToscaVersions();
        this.registerDescription();
        this.registerImports();
        this.registerInputs();
        this.registerSpaces();
        return successful;
    }

    public registerTopLevelCursor() {
        if (this.ctx.cursor.character < 1) {
            this.currentKeywords = [];
            const elements = this.ctx.cursor.lines.map(line => line.split(' ')[0]);
            for (let name of cloudifyTopLevelNames) {
                //eslint-disable-next-line
                if (!(elements.hasOwnProperty(name))) {
                    if (['description', toscaDefinitionsVersionName].includes(name)) {
                        name = `${name}: `;
                    } else if (name === importsName) {
                        name = `${name}:\n  - `;
                    } else {
                        name = `${name}:\n\n  `;
                    }
                    this.appendCurrentKeyword(name);
                }
            }
        }
    }

    //eslint-disable-next-line
    public registerTopLevelJson(json:any) {
        if (this.ctx.cursor.character < 1) {
            this.currentKeywords = [];
            for (let name of cloudifyTopLevelNames) {
                //eslint-disable-next-line
                if (!(json.hasOwnProperty(name))) {
                    if (['description', toscaDefinitionsVersionName].includes(name)) {
                        name = `${name}: `;
                    } else if (name === importsName) {
                        name = `${name}:\n  - `;
                    } else {
                        name = `${name}:\n\n  `;
                    }
                    this.appendCurrentKeyword(name);
                }
            }
        }
    }

}
