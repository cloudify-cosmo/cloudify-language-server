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

const cloudifyKeywords = [
	'tosca_definitions_version',
	'description',
	'imports',
	'inputs',
	'dsl_definitions',
	'labels',
	'blueprint_labels',
	'node_types',
	'relationships',
	'workflows',
	'node_templates',
	'outputs',
	'capabilities',
]

const toscaDefinitionsVersionKeywords = [
	'cloudify_dsl_1_3',
	'cloudify_dsl_1_4',
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

	constructor() {
		this.keywords = getCloudifyKeywords();
	}

	public async init () {
		let nodeTypes = await getNodeTypesForPluginVersion('cloudify-aws-plugin');
		for (let nodeType of nodeTypes) {
			this.appendKeyword(nodeType.type);
		}
		return '';
	}

	appendKeyword = (keyword:string)=>{
        let currentIndex = this.keywords.length;
		this.keywords.push(
			getCompletionItem(keyword, currentIndex)
		)
	}

}

export const cloudify = new cloudifyWords();
