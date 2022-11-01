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
    name as toscaDefinitionsVersionKeyword,
	keywords as toscaDefinitionsVersionKeywords,
	validator as cloudifyToscaDefinitionsVersionValidator,
} from './sections/toscaDefinitionsVersion';
import {
    name as importsKeyword,
	keywords as importKeywords,
	getImportableYamls,
} from './sections/imports';
import {
	name as nodeTypeKeyword,
} from './sections/nodeTypes';

const cloudifyKeywords = [
	toscaDefinitionsVersionKeyword,
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
]

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
]

const inputKeywords = [
	'type', 'description', 'required', 'default'
]

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
]

function getCompletionItem(newLabel:string, newData:any): CompletionItem {
	return {
		label: newLabel,
		kind: CompletionItemKind.Text,
		data: newData,
	}
}

export function getCloudifyKeywords() {
	const masterWordCompletionList:CompletionItem[] = new Array();
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
	for (let keyword of newList) {
		mainList.push(getCompletionItem(keyword, currentIndex));
		currentIndex++;
	}
	return mainList;
}

class cloudifyWords {
	keywords: CompletionItem[];
	initialized: boolean;
	importedPlugins;

	constructor() {
		this.keywords = getCloudifyKeywords();
		this.initialized = false;
		this.importedPlugins = new Array();
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
		for (let value of getImportableYamls(documentUri)) {
			this.appendKeyword(value);
		}
	}

    public async importPlugin(pluginName:string) {
		if (this.importedPlugins.includes(pluginName)) {
			let nodeTypes = await getNodeTypesForPluginVersion('pluginName');
			for (let nodeType of nodeTypes) {
				this.appendKeyword(nodeType.type);
			}
		}
	}

	appendKeyword = (keyword:string)=>{
		const keywordNames = this.keywords.map((obj) => obj.label);
		if (!keywordNames.includes(keyword)) {
			let currentIndex = this.keywords.length;
			this.keywords.push(
				getCompletionItem(keyword, currentIndex)
			)	
		}
	}
}

export const cloudify = new cloudifyWords();
