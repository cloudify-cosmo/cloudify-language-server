/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {JSONItems} from './utils';
import {name as labelsName} from './sections/labels';
import {name as workflowsName} from './sections/workflows';
import {documentCursor, readLines, getParsed} from './parsing';
import {name as descriptionName} from './sections/description';
import {name as relationshipsName} from './sections/relationships';
import {name as nodeTemplatesName} from './sections/node-templates';
import {name as dslDefnitionName} from './sections/dsl-definitions';
import {name as blueprintLabelsName} from './sections/blueprint-labels';
import {name as inputsName} from './sections/inputs';
import {
    name as importsName,
    Validator as ImportsValidator
} from './sections/imports';
import {
    name as nodeTypeName,
    Validator as NodeTypeValidator
} from './sections/node-types';
import {
    name as capabilitiesName,
    alternateName as outputsName
} from './sections/capabilities';
import {name as toscaDefinitionsVersionName} from './sections/tosca-definitions-version';

export const cloudifyTopLevelNames = [
    inputsName,
    labelsName,
    importsName,
    outputsName,
    nodeTypeName,
    workflowsName,
    descriptionName,
    capabilitiesName,
    dslDefnitionName,
    nodeTemplatesName,
    relationshipsName,
    blueprintLabelsName,
    toscaDefinitionsVersionName,
];

export class CloudifyYAML {
    parsed:JSONItems<object|string|[]>;  // The raw parsed YAML data (JSON).
    lines:string[]; // The current lines in the blueprint file.
    rawDslVersion:string; // TODO: Change to a better type for comparison.
    rawImports:string; // TODO: Change to a better type for comparison.
    rawInputs:string; // TODO: Change to a better type for comparison.
    rawNodeTemplates:string; // TODO: Change to a better type for comparison.
    dslVersion:string; // The resolved current DSL version. May not be null.
    imports:ImportsValidator|null; // A list of imports.
    //eslint-disable-next-line
    inputs:Object; // A dictionary of inputs.
    nodeTypes:NodeTypeValidator|null; // A dictionary of node types.
    private _cursor:documentCursor; // Where we are located in the file.
    private _section:string;  // The current section we are editing, e.g. inputs, imports.
    private _sectionStart:number;
    private _sectionEnd:number;
    private _processingSection:string;
    private _path:string;

    constructor() {
        this.parsed = {};
        this.lines = [];
        this._cursor = new documentCursor(null);
        this._section = '';
        this.rawDslVersion = '';
        this.rawImports = '{}';
        this.rawInputs = '{}';
        this.rawNodeTemplates = '{}';
        this.dslVersion = '';
        this.imports = null;
        this.inputs = {};
        this.nodeTypes = null;
        this._sectionStart = 0;
        this._sectionEnd = 0;
        this._processingSection = '';
        this._path = '';
    }

    public get yamlPath() {
        return this._path;
    }

    public set yamlPath(value) {
        this._path = value;
    }

    public get processingSection() {
        return this._processingSection;
    }

    public set processingSection(value) {
        this._processingSection = value;
    }

    public get sectionStart() {
        return this._sectionStart;
    }

    public set sectionStart(value) {
        this._sectionStart = value;
    }

    public get sectionEnd() {
        return this._sectionEnd;
    }

    public set sectionEnd(value) {
        this._sectionEnd = value;
    }

    public get cursor() {
        if (this._cursor == null) {
            this._cursor = new documentCursor(null);
        }
        return this._cursor;
    }

    public set cursor(cursor:documentCursor) {
        this._cursor = cursor;
    }

    getSection = (sectionName:string)=>{
        try {
            return this.parsed[sectionName];
        } catch {
            return null;
        }
    };

    getImports=()=>{
        const rawImports = this.getSection('imports');
        const _imports = new ImportsValidator(this.dslVersion, rawImports);
        return _imports;
    };

    assignInputs=()=>{
        const obj = JSON.parse(this.rawInputs);
        if (inputsName in obj) {
            return obj[inputsName];
        }
        return {};
    };

    assignNodeTemplates=()=>{
        const obj = JSON.parse(this.rawNodeTemplates);
        if (nodeTemplatesName in obj) {
            return obj[nodeTemplatesName];
        }
        return {};
    };

    getDataTypes=()=>{
        return [];
    };

    getNodeTypes=()=>{
        const rawNodeTypes = this.getSection('node_types');
        const _nodeTypes = new NodeTypeValidator(rawNodeTypes);
        return _nodeTypes;
    };

    public get section() {
        return this._section;
    }

    public set section(value) {
        this._section = value;
    }

}

export class BlueprintContext extends CloudifyYAML {

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

    // TODO: Add Data types:
    // dataTypes; // A dictionary of data types.
    // TODO: Add node templates.
    // TODO: Add relationships.
    // TODO: Add capabilities and outputs. (They are basically identical.)
    // TODO: Add DSL Definitions.
    // TODO: Add description.

    constructor(uri:string) {
        super();
        this.uri = uri;
        this.refresh();
    }

    refresh=()=>{
        this.parsed = getParsed(this.uri);
        if (!this.parsed || Object.values(this.parsed).length == 0){
            console.log('*** error!!!');
        }        
        this.lines = readLines(this.uri);
        this.imports = this.getImports();
        this.nodeTypes = this.getNodeTypes();
        this.inputs = this.assignInputs();
    };

}
