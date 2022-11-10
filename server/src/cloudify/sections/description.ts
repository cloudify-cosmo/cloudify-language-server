/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const name = 'description';

export class validator {
    name:string;
    value:string;

    constructor(name:string, value:string) {
        this.name = name;
        this.value = value;
    }
}
