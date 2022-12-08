import {nodeTemplates as awsNodeTemplates} from './aws';
import {nodeTemplates as gcpNodeTemplates} from './gcp';
import {nodeTemplates as azureNodeTemplates} from './azure';

export const nodeTemplates = new Map();
for (const module of [awsNodeTemplates, gcpNodeTemplates, azureNodeTemplates]) {
    for (const [key, value] of module) {
        nodeTemplates.set(key, value);
    }
}
