/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
    rawRequest,
} from './rest';
import {
    NodeTypeItem,
} from './sections/node-types';


// For casting the response of each item in https://marketplace.cloudify.co/plugins/[pluginName]/versions.
interface VersionResponse {
    created_at: string;
    version:string;
    yaml_urls:[];
    wagon_urls:[];
    supported_cm_versions:[],
    downloads:[];
    id:string;
    plugin_id:string;
}

// For concatenating our URL.
const protocol = 'https';
const domain = 'marketplace.cloudify.co';
const baseUrl:string = protocol + '://' + domain + '/'; 

// Various useful functions for operating with the marketplace API.
async function getPluginId(pluginName:string): Promise<string> {
    // Get the ID of a plugin in the marketplace API.
    const endpoint:string = 'plugins?name='.concat(pluginName);
    const url:string = protocol + '://' + domain + '/' + endpoint;
    return rawRequest(url, 'GET').then(
        result => {
            const pluginItem = result.items[0] as NodeTypeItem;
            return pluginItem.id;
        }
    );
}

export async function getPluginVersions(pluginName:string) {
    // Get all available versions of a particular plugin.
    const pluginId = await getPluginId(pluginName);
    const endpoint:string = 'plugins/' + pluginId + '/versions';
    const url:string = baseUrl + endpoint;
    return rawRequest(url, 'GET').then(
        result => {
            const versionIds = [];
            for (const key in result.items) {
                const item = result.items[key] as VersionResponse;
                versionIds.push(item.version);
            }
            return versionIds.sort(
                (a, b) => a.localeCompare(b, undefined, { numeric:true })
            );
        }
    );
}

export async function getLatestPluginVersion(pluginName:string) {
    // Get the latest version of a particular plugin.
    const pluginVersions = await getPluginVersions(pluginName);
    return pluginVersions[pluginVersions.length-1];
}

export async function getNodeTypesForPluginVersion(pluginName:string, pluginVersion='latest') {
    // Get all of the node types available in a particular plugin version.
    if ( pluginVersion === 'latest' ) {
        pluginVersion = await getLatestPluginVersion(pluginName);
    }
    const nodeTypeItems:NodeTypeItem[] = [];
    const endpoint:string = 'node-types?&plugin_name=' + pluginName + '&plugin_version='  + pluginVersion;
    const url:string = baseUrl + endpoint;
    return rawRequest(url, 'GET').then(
        result => {
            for (const key in result.items) {
                const item = result.items[key] as NodeTypeItem;
                nodeTypeItems.push(item);
            }
            return nodeTypeItems;
        }
    );
}
