/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { isMatch } from '../utils';

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
export const stringSplit = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-split';
export const stringLower = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-lower';
export const stringUpper = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-upper';
export const concat = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#concat';
export const merge = 'https://docs.cloudify.co/latest/developer/blueprints/spec-intrinsic-functions/#string-replace';

interface StringMap { [key: string]: string; }

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
const names:string[] = ['get_input', 'concat', 'get_property', 'get_attribute', 'get_capability', 'get_environment_capability'];

function getKeywords() {
    const _keywords:string[] = [];
    names.forEach((e) => _keywords.push(e.concat(':')));
    return _keywords;    
}

export const keywords = getKeywords();

const startFn = '\\{\\s*';
const stopFn = '\\s*\\}';
const intrinsicFunctionNamePattern = '(' + names.join('|') + ')';

export function wordsMayIndicateFn(words:string[]): boolean {
    /**
     * Checks if the contents of this.ctx.cursor.words can indicate an intrinsic function.
     * For example, given the lines
     * "    foo: {"
     * "    foo: {}"
     * "    foo: { }"
     * we can reasonably guess that a user wants to use an intrinsic function.
     * Obviously, there are other use cases for that, but this is a Cloudify blueprint and that's the most
     * common use for an inline curly base pair.
     */
    let word:string = '';
    if (words.length > 0) {
        word = words.at(-1) as string;
    }

    let lastWord:string = '';
    if (words.length > 1) {
        lastWord = words.at(-2) as string;
    }

    if (word === '{}') {
        return true;
    } else if ((word === '}') && (lastWord === '{')) {
        return true;
    }

    return false;
}

export function lineMayContainFn(line:string): boolean {
    return isMatch(line, startFn + '.{1,}' + stopFn);
}

export function lineContainsFn(line:string): boolean {
    return isMatch(line, startFn + intrinsicFunctionNamePattern + '.{0,}' + stopFn);
}

export function lineContainsGetInput(line:string): boolean {
    return isMatch(line, startFn + 'get_input:{0,1}\\s*');
}

export function lineContainsGetNodeTemplate(line:string): boolean {
    return isMatch(line, startFn + '(get_property|get_attribute):{0,1}');
}

export function lineContainsConcatFn(line:string): boolean {
    return isMatch(line, startFn + 'concat:{0,1}');
}
