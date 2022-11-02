/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
    CompletionItem,
    CompletionItemKind,
} from 'vscode-languageserver/node';
import {
    getNodeTypesForPluginVersion,
} from './marketplace';
import {
    getParsed,
} from './parsing';
import {
    name as toscaDefinitionsVersionName,
    keywords as toscaDefinitionsVersionKeywords,
    validator as cloudifyToscaDefinitionsVersionValidator,
} from './sections/toscaDefinitionsVersion';
import {
    name as importsKeyword,
    keywords as importKeywords,
    getImportableYamls,
    validator as importsValidator,
} from './sections/imports';
import {
    name as nodeTypeKeyword,
} from './sections/nodeTypes';

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

const pluginNames = [
    'cloudify-ansible-plugin',
    'cloudify-aws-plugin',
    'cloudify-azure-plugin',
    'cloudify-docker-plugin',
    'cloudify-fabric-plugin',
    'cloudify-gcp-plugin',
    'cloudify-helm-plugin',
    'cloudify-kubernetes-plugin',
    'cloudify-openstack-plugin',
    'cloudify-serverless-plugin',
    'cloudify-spot-ocean-plugin',
    'cloudify-starlingx-plugin',
    'cloudify-terraform-plugin',
    'cloudify-terragrunt-plugin',
    'cloudify-utilities-plugin',
    'cloudify-vsphere-plugin'
];

const inputKeywords = [
    'type',
    'description',
    'required',
    'default'
];

const nodeTypeKeywords = [
    'cloudify.nodes.Port',
    'cloudify.nodes.Root',
    'cloudify.nodes.Tier',
    'cloudify.nodes.Router',
    'cloudify.nodes.Subnet',
    'cloudify.nodes.Volume',
    'cloudify.nodes.Network',
    'cloudify.nodes.Compute',
    'cloudify.nodes.Container',
    'cloudify.nodes.VirtualIP',
    'cloudify.nodes.FileSystem',
    'cloudify.nodes.ObjectStorage',
    'cloudify.nodes.LoadBalancer',
    'cloudify.nodes.SecurityGroup',
    'cloudify.nodes.SoftwareComponent',
    'cloudify.nodes.DBMS',
    'cloudify.nodes.Database',
    'cloudify.nodes.WebServer',
    'cloudify.nodes.ApplicationServer',
    'cloudify.nodes.MessageBusServer',
    'cloudify.nodes.ApplicationModule',
    'cloudify.nodes.CloudifyManager',
    'cloudify.nodes.Component',
    'cloudify.nodes.ServiceComponent',
    'cloudify.nodes.SharedResource',
    'cloudify.nodes.Blueprint',
    'cloudify.nodes.PasswordSecret'
];

function getCompletionItem(newLabel:string, newData:any): CompletionItem {
    return {
        label: newLabel,
        kind: CompletionItemKind.Text,
        data: newData,
    };
}

export function getCloudifyKeywords() {
    const masterWordCompletionList:CompletionItem[] = [];
    appendCompletionItems(masterWordCompletionList, cloudifyKeywords);
    appendCompletionItems(masterWordCompletionList, toscaDefinitionsVersionKeywords);
    appendCompletionItems(masterWordCompletionList, importKeywords);
    appendCompletionItems(masterWordCompletionList, pluginNames);
    appendCompletionItems(masterWordCompletionList, inputKeywords);
    appendCompletionItems(masterWordCompletionList, nodeTypeKeywords);
    return masterWordCompletionList;
}

function appendCompletionItems(mainList:CompletionItem[], newList:string[]) {
    let currentIndex:number = mainList.length;
    for (const keyword of newList) {
        mainList.push(getCompletionItem(keyword, currentIndex));
        currentIndex++;
    }
    return mainList;
}

class blueprintContext {
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
            return Object();
        }
    };
    getDslVersion=()=>{
        const rawVersion = this.getSection(toscaDefinitionsVersionName);
        console.log('Raw version '.concat(rawVersion));
        const _version = new cloudifyToscaDefinitionsVersionValidator(rawVersion);
        return _version.toString();
    };
    getImports=()=>{
        const rawImports = this.getSection('imports') as [];
        console.log('Raw imports ' + rawImports);
        const _imports = new importsValidator(this.dslVersion, rawImports);
        return _imports;
    };
}

class cloudifyWords {
    keywords: CompletionItem[];
    initialized: boolean;
    importedPlugins:string[];
    dslVersion:string;

    constructor() {
        this.keywords = getCloudifyKeywords();
        this.initialized = false;
        this.importedPlugins = [];
        this.dslVersion = '';
    }

    public async update(uri:string) {
        const ctx = new blueprintContext(uri);
        this.addRelativeImports(uri);    
        this.dslVersion = ctx.dslVersion;
        for (const plugin of ctx.imports.plugins) {
            await this.importPlugin(plugin);
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

    // TODO: Create a new function that will import base types.
    // public async importTypes() {
    //
    // }

    public addRelativeImports(documentUri:string) {
        for (const value of getImportableYamls(documentUri)) {
            this.appendKeyword(value);
        }
    }

    public async importPlugin(pluginName:string) {
        if (!(typeof pluginName === 'string')) {
            return '';
        }
        const pluginSubString = pluginName.match('^cloudify\-[a-z]*\-plugin$') as string[];
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
}

export const cloudify = new cloudifyWords();
