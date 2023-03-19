
import { documentation as toscaDefinitionsVersion } from './sections/tosca-definitions-version';
import { documentation as imports } from './sections/imports';
import { documentation as inputs } from './sections/inputs';
import { documentation as dslDefinitions } from './sections/inputs';
import { documentation as nodeTypes } from './sections/node-types';
import { documentation as nodeTemplates } from './sections/node-templates';
import { documentation as blueprintLabels} from './sections/blueprint-labels';
import { documentation as labels} from './sections/labels';
import { documentation as capabilities} from './sections/capabilities';
import { documentation as relationships} from './sections/relationships';
import { documentation as intrinsicFunctionsNames } from './sections/intrinsic-functions';

interface StringMap { [key: string]: string; }

const description = 'Provide a description of a blueprint.';
const plugins = 'https://docs.cloudify.co/latest/developer/blueprints/spec-plugins/';
const deploymentSettings = 'https://docs.cloudify.co/latest/developer/blueprints/spec-deployment-settings/';
const interfaces = 'https://docs.cloudify.co/latest/developer/blueprints/spec-interfaces/';
const workflows = 'https://docs.cloudify.co/latest/developer/blueprints/spec-workflows/';
const groups = 'https://docs.cloudify.co/latest/developer/blueprints/spec-groups/';
const policies = 'https://docs.cloudify.co/latest/developer/blueprints/spec-policies/';
const policyTypes = 'https://docs.cloudify.co/latest/developer/blueprints/spec-policy-types/';
const policyTriggers = 'https://docs.cloudify.co/latest/developer/blueprints/spec-policy-triggers/';
const dataTypes = 'https://docs.cloudify.co/latest/developer/blueprints/spec-data-types/';
const uploadResources = 'https://docs.cloudify.co/latest/developer/blueprints/spec-upload-resources/';

const localNames:StringMap = {
    'tosca_definitions_version': toscaDefinitionsVersion,
    'description': description,
    'imports': imports,
    'inputs': inputs,
    'dsl_definitions': dslDefinitions,
    'node_types': nodeTypes,
    'node_templates': nodeTemplates,
    'blueprint_labels': blueprintLabels,
    'capabilities': capabilities,
    'labels': labels,
    'relationships': relationships,
    'deployment_settings': deploymentSettings,
    'plugins': plugins,
    'interfaces': interfaces,
    'workflows': workflows,
    'groups': groups,
    'policies': policies,
    'policy_types': policyTypes,
    'policy_triggers': policyTriggers,
    'data_types': dataTypes,
    'upload_resources': uploadResources,
};

export const names:StringMap = Object.assign({}, localNames, intrinsicFunctionsNames);
