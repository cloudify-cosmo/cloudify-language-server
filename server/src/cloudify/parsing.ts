/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from 'fs';
import {parse} from 'yaml';
import {
    JSONItems,
} from './utils';

export function getParsed(uri:string) {
    if (uri.startsWith('file://')) {
        uri = uri.replace('file://', '');
    } else if (uri.startsWith('file:/')) {
        uri = uri.replace('file:/', '');
    }
    console.log('Reading ' + uri);
    let parsed:JSONItems<object|string|[]> = {};
    try {
        const file = fs.readFileSync(uri, 'utf8');
        parsed = parse(file);    
    } catch {
        console.log('Error');
    }
    console.log('Read ' + parsed);
    return parsed;
}
