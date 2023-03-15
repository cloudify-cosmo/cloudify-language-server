interface StringMap { [key: string]: string; }

const toscaDefinitionsVersion = `https://docs.cloudify.co/latest/developer/blueprints/spec-versioning/`;
const description = `You can provide a description of the blueprint.`;
const imports = `https://docs.cloudify.co/latest/developer/blueprints/spec-imports/`
const inputs = `https://docs.cloudify.co/latest/developer/blueprints/spec-inputs/`;
const dslDefinitions = `https://docs.cloudify.co/latest/developer/blueprints/spec-dsl-definitions/`;
const nodeTypes = `https://docs.cloudify.co/latest/developer/blueprints/spec-node-types/`;
const nodeTemplates = `https://docs.cloudify.co/latest/developer/blueprints/spec-node-templates/`;
const blueprintLabels = `https://docs.cloudify.co/latest/developer/blueprints/spec-blueprint-labels/`;
const capabilities = `https://docs.cloudify.co/latest/developer/blueprints/spec-capabilities/`;
const labels = `https://docs.cloudify.co/latest/developer/blueprints/spec-labels/`;
const outputs = `https://docs.cloudify.co/latest/developer/blueprints/spec-outputs/`;
const relationships = `https://docs.cloudify.co/latest/developer/blueprints/spec-relationships/`;
const plugins = `https://docs.cloudify.co/latest/developer/blueprints/spec-plugins/`;
const deploymentSettings = `https://docs.cloudify.co/latest/developer/blueprints/spec-deployment-settings/`;
const interfaces = `https://docs.cloudify.co/latest/developer/blueprints/spec-interfaces/`;
const workflows = `https://docs.cloudify.co/latest/developer/blueprints/spec-workflows/`;
const groups = `https://docs.cloudify.co/latest/developer/blueprints/spec-groups/`;
const policies = `https://docs.cloudify.co/latest/developer/blueprints/spec-policies/`;
const policyTypes = `https://docs.cloudify.co/latest/developer/blueprints/spec-policy-types/`;
const policyTriggers = `https://docs.cloudify.co/latest/developer/blueprints/spec-policy-triggers/`;
const dataTypes = `https://docs.cloudify.co/latest/developer/blueprints/spec-data-types/`;
const uploadResources = `https://docs.cloudify.co/latest/developer/blueprints/spec-upload-resources/`;
const getSecret = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-secret`;
const getInput = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-input`;
const getProperty = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-property`;
const getAttribute = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-attribute`;
const getAttributesList = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-attributes-list`;
const getAttributesDict = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-attributes-dict`;
const getCapability = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-capability`;
const getLabel = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-label`;
const getSys = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-sys`;
const stringFind = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-find`;
const stringReplace = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-replace`;
const stringSplit = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-replace`;
const stringLower = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-lower`;
const stringUpper = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-upper`;
const concat = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-replace`;
const merge = `https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-replace`;

export const names:StringMap = {
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
	'outputs': outputs,
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
	'get_secret': getSecret,
	'get_input': getInput,
	'get_property': getProperty,
	'get_attribute': getAttribute,
	'get_attributes_dict': getAttributesDict,
	'get_attributes_list': getAttributesList,
	'get_capability': getCapability,
	'get_label': getLabel,
	'get_sys': getSys,
	'string_find': stringFind,
	'string_lower': stringLower,
	'string_upper': stringUpper,
	'string_replace': stringReplace,
	'string_split': stringSplit,
	'concat': concat,
	'merge': merge,
};
