/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const keywords:string[] = ['get_input:', 'concat:', 'get_property:', 'get_attribute:', 'get_capability:', 'get_environment_capability:'];
interface StringMap { [key: string]: string; }

export const getSecret = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-secret';
export const getInput = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-input';
export const getProperty = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-property';
export const getAttribute = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-attribute';
export const getAttributesList = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-attributes-list';
export const getAttributesDict = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-attributes-dict';
export const getCapability = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-capability';
export const getLabel = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-label';
export const getSys = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#get-sys';
export const stringFind = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-find';
export const stringReplace = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-replace';
export const stringSplit = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-replace';
export const stringLower = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-lower';
export const stringUpper = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-upper';
export const concat = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-replace';
export const merge = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-replace';

export const documentation:StringMap = {
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
